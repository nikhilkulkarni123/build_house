"""FastAPI service for Formhaus' learned structured floor-plan decoder.

The neural checkpoint predicts room sites/areas and connectivity from the user requirements. A generic balanced joint slicing decoder converts those learned signals into one exhaustive orthogonal partition. There are no room-type preferred-side, row, coordinate, or semantic adjacency templates.
"""
from __future__ import annotations

from datetime import datetime, timezone
import json
import os
import hashlib
import math
from pathlib import Path
from typing import Literal
import uuid

import numpy as np
import torch
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

try:
    from .structured_model import ConnectivityRectNet
except ImportError:
    from structured_model import ConnectivityRectNet

app = FastAPI(title="Formhaus joint learned floor-plan service", version="7.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:4173",
        "http://127.0.0.1:4173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ROOM_ID = {
    "living": 0,
    "master_bedroom": 1,
    "kitchen": 2,
    "bathroom": 3,
    "second_bedroom": 7,
    "balcony": 9,
    "third_bedroom": 14,
    "study": 15,
    "utility": 16,
    "parking": 17,
    "pooja": 18,
}
ROOM_LABEL = {
    0: ("Living room", "living"),
    1: ("Master bedroom", "bedroom"),
    2: ("Kitchen", "kitchen"),
    3: ("Bathroom", "bathroom"),
    7: ("Second bedroom", "bedroom"),
    9: ("Balcony", "open"),
    14: ("Third bedroom", "bedroom"),
    15: ("Study room", "study"),
    16: ("Utility room", "utility"),
    17: ("Parking", "parking"),
    18: ("Pooja room", "pooja"),
}
COLOURS = {
    "living": "#d9e7df",
    "bedroom": "#eee3d1",
    "kitchen": "#dae4ed",
    "bathroom": "#dce9eb",
    "open": "#d3e2c9",
    "study": "#e3ddeb",
    "utility": "#dbe5e0",
    "parking": "#e1e5e4",
    "pooja": "#f0e7d1",
}
ENTRANCE_ID = {"North": 0, "South": 1, "East": 2, "West": 3}


PRACTICAL_MINIMUMS = {
    "living": (7.0, 8.0),
    "bedroom": (6.5, 8.0),
    "kitchen": (5.0, 6.5),
    "bathroom": (3.5, 5.0),
    "study": (5.0, 6.5),
    "utility": (3.5, 4.5),
    "pooja": (2.5, 3.0),
    "open": (3.0, 4.0),
    "parking": (7.5, 13.0),
}

def _feasibility(rooms: list[dict], requirements: Requirements) -> dict:
    undersized = []
    for room in rooms:
        minimum = PRACTICAL_MINIMUMS.get(room["type"])
        if not minimum:
            continue
        short, long = sorted((float(room["width"]), float(room["height"])))
        min_short, min_long = minimum
        if short + 1e-6 < min_short or long + 1e-6 < min_long:
            undersized.append({
                "name": room["name"],
                "predicted": [round(short, 2), round(long, 2)],
                "minimum": [min_short, min_long],
            })
    return {
        "practical": len(undersized) == 0,
        "plotAreaSqFt": requirements.width * requirements.length,
        "undersizedRooms": undersized,
        "note": (
            "Model output meets the bundled compact concept-design minimums."
            if not undersized
            else "The model produced geometry, but one or more rooms are too small for the bundled compact concept-design minimums. Formhaus does not move or resize them with placement rules."
        ),
    }


class Requirements(BaseModel):
    width: float = Field(ge=12, le=100)
    length: float = Field(ge=12, le=100)
    bedrooms: Literal[1, 2, 3]
    bathrooms: Literal[1, 2, 3]
    parking: bool
    entrance: Literal["North", "South", "East", "West"]
    utility: bool = False
    study: bool = False
    pooja: bool = False
    openSpace: bool = False


def _checkpoint_path() -> Path:
    return Path(
        os.getenv(
            "STRUCTURED_MODEL_CHECKPOINT",
            Path(__file__).with_name("formhaus_final_model.pt"),
        )
    )


def _metrics_path() -> Path:
    return Path(__file__).with_name("formhaus_final_model_metrics.json")


DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
CHECKPOINT_PATH = _checkpoint_path()
MODEL: ConnectivityRectNet | None = None
META: dict = {}
METRICS: dict = {}
LOAD_ERROR = ""

try:
    checkpoint = torch.load(CHECKPOINT_PATH, map_location=DEVICE, weights_only=True)
    META = dict(checkpoint.get("meta", {}))
    pad_id = int(META.get("pad_id", 13))
    max_rooms = int(META.get("max_rooms", 8))
    MODEL = ConnectivityRectNet(pad_id=pad_id, max_rooms=max_rooms, vocab_size=int(META.get("vocab_size", 20))).to(DEVICE)
    MODEL.load_state_dict(checkpoint["model_state"])
    MODEL.eval()
    if _metrics_path().exists():
        METRICS = json.loads(_metrics_path().read_text(encoding="utf-8"))
    elif isinstance(META.get("metrics"), dict):
        METRICS = dict(META["metrics"])
except Exception as exc:
    LOAD_ERROR = f"{type(exc).__name__}: {exc}"


def unsupported_requirements(r: Requirements) -> list[str]:
    # All UI room types have a learned runtime token in the extended decoder.
    return []

def requested_room_ids(r: Requirements) -> list[int]:
    ids = [ROOM_ID["master_bedroom"]]
    ids += [ROOM_ID["bathroom"]] * r.bathrooms
    ids += [ROOM_ID["living"]]
    if r.bedrooms >= 2:
        ids.append(ROOM_ID["second_bedroom"])
    if r.bedrooms >= 3:
        ids.append(ROOM_ID["third_bedroom"])
    ids.append(ROOM_ID["kitchen"])
    if r.parking:
        ids.append(ROOM_ID["parking"])
    if r.utility:
        ids.append(ROOM_ID["utility"])
    if r.study:
        ids.append(ROOM_ID["study"])
    if r.pooja:
        ids.append(ROOM_ID["pooja"])
    if r.openSpace:
        ids.append(ROOM_ID["balcony"])
    return ids

def _labels_for_room_ids(room_ids: list[int]) -> list[tuple[str, str]]:
    occurrences: dict[int, int] = {}
    result: list[tuple[str, str]] = []
    for type_id in room_ids:
        occurrences[type_id] = occurrences.get(type_id, 0) + 1
        base, room_type = ROOM_LABEL[type_id]
        if type_id == ROOM_ID["bathroom"] and occurrences[type_id] > 1:
            base = f"Bathroom {occurrences[type_id]}"
        result.append((base, room_type))
    return result


def _intersection(a: np.ndarray, b: np.ndarray) -> float:
    x0 = max(float(a[0]), float(b[0]))
    y0 = max(float(a[1]), float(b[1]))
    x1 = min(float(a[2]), float(b[2]))
    y1 = min(float(a[3]), float(b[3]))
    return max(0.0, x1 - x0) * max(0.0, y1 - y0)


def _predict(requirements: Requirements, room_ids: list[int]):
    assert MODEL is not None
    max_rooms = int(META.get("max_rooms", 8))
    pad_id = int(META.get("pad_id", 19))
    types = np.full((1, max_rooms), pad_id, dtype=np.int64)
    mask = np.zeros((1, max_rooms), dtype=np.bool_)
    types[0, : len(room_ids)] = room_ids
    mask[0, : len(room_ids)] = True
    entrance = np.asarray([ENTRANCE_ID[requirements.entrance]], dtype=np.int64)

    with torch.inference_mode():
        boxes, passage, adjacency_logits, door_xy, door_orientation_logits = MODEL(
            torch.from_numpy(types).to(DEVICE),
            torch.from_numpy(mask).to(DEVICE),
            torch.tensor([requirements.width], dtype=torch.float32, device=DEVICE),
            torch.tensor([requirements.length], dtype=torch.float32, device=DEVICE),
            torch.from_numpy(entrance).to(DEVICE),
        )
    count = len(room_ids)
    return (
        boxes[0, :count].detach().cpu().numpy().astype(np.float64),
        passage[0].detach().cpu().numpy().astype(np.float64),
        torch.sigmoid(adjacency_logits[0, :count, :count]).detach().cpu().numpy().astype(np.float64),
        door_xy[0, :count, :count].detach().cpu().numpy().astype(np.float64),
        torch.sigmoid(door_orientation_logits[0, :count, :count]).detach().cpu().numpy().astype(np.float64),
    )


def _candidate_seed(requirements: Requirements, candidate_index: int) -> int:
    payload = json.dumps(requirements.model_dump(), sort_keys=True, separators=(",", ":"))
    digest = hashlib.sha256(f"{payload}|{candidate_index}".encode("utf-8")).digest()
    return int.from_bytes(digest[:8], "little") % (2**32 - 1)


def _sample_variant(
    requirements: Requirements,
    boxes: np.ndarray,
    passage: np.ndarray,
    candidate_index: int,
) -> tuple[np.ndarray, np.ndarray, int, float]:
    """Sample a latent variation around the neural prediction.

    The perturbation is room-type agnostic: all learned sites and areas receive the
    same stochastic treatment. It changes no semantic room rule and never assigns a
    preferred side or coordinate to a room type. Candidate 0 is the exact base signal.
    """
    seed = _candidate_seed(requirements, candidate_index)
    if candidate_index == 0:
        return boxes.copy(), passage.copy(), seed, 0.0
    rng = np.random.default_rng(seed)
    strength = min(0.12, 0.045 + 0.0045 * candidate_index)

    def perturb_rects(rects: np.ndarray, site_strength: float, size_strength: float) -> np.ndarray:
        r = rects.copy().astype(np.float64)
        centres = np.c_[(r[:, 0] + r[:, 2]) / 2, (r[:, 1] + r[:, 3]) / 2]
        sizes = np.c_[r[:, 2] - r[:, 0], r[:, 3] - r[:, 1]].clip(0.035, 0.92)
        angle = float(rng.normal(0.0, site_strength * 1.1))
        c, si = math.cos(angle), math.sin(angle)
        rot = np.asarray([[c, -si], [si, c]], dtype=np.float64)
        centres = (centres - 0.5) @ rot.T + 0.5
        centres += rng.normal(0.0, site_strength, centres.shape)
        sizes *= np.exp(rng.normal(0.0, size_strength, sizes.shape))
        sizes = np.clip(sizes, 0.035, 0.92)
        centres = np.clip(centres, 0.03, 0.97)
        x0 = np.clip(centres[:, 0] - sizes[:, 0] / 2, 0.0, 1.0 - sizes[:, 0])
        y0 = np.clip(centres[:, 1] - sizes[:, 1] / 2, 0.0, 1.0 - sizes[:, 1])
        return np.c_[x0, y0, x0 + sizes[:, 0], y0 + sizes[:, 1]]

    varied_boxes = perturb_rects(boxes, strength, strength * 0.85)
    varied_passage = perturb_rects(passage.reshape(1, 4), strength * 0.65, strength * 0.6)[0]
    return varied_boxes, varied_passage, seed, strength


def _door_accessibility(rooms: list[dict], doors: list[dict]) -> dict:
    graph: dict[str, set[str]] = {"outside": set()}
    for room in rooms:
        graph.setdefault(room["id"], set())
    for door in doors:
        a, b = str(door["from"]), str(door["to"])
        graph.setdefault(a, set()).add(b)
        graph.setdefault(b, set()).add(a)
    seen: set[str] = set()
    stack = ["outside"]
    while stack:
        node = stack.pop()
        if node in seen:
            continue
        seen.add(node)
        stack.extend(n for n in graph.get(node, set()) if n not in seen)
    reachable = [r["id"] for r in rooms if r["id"] in seen]
    unreachable = [r["name"] for r in rooms if r["id"] not in seen]
    return {
        "allReachable": len(unreachable) == 0,
        "reachableRoomIds": reachable,
        "unreachableRooms": unreachable,
        "reachableShare": len(reachable) / max(1, len(rooms)),
    }


def _candidate_score(rooms: list[dict], doors: list[dict], feasibility: dict, accessibility: dict) -> tuple[float, dict]:
    requested_rooms = [r for r in rooms if r["type"] != "passage"]
    aspects = []
    for r in requested_rooms:
        short, long = sorted((float(r["width"]), float(r["height"])))
        aspects.append(long / max(short, 1e-6))
    mean_aspect = float(np.mean(aspects)) if aspects else 9.0
    compactness = float(np.mean([min(1.0, 2.2 / max(1.0, a)) for a in aspects])) if aspects else 0.0
    passage = next((r for r in rooms if r["type"] == "passage"), None)
    passage_width = min(float(passage["width"]), float(passage["height"])) if passage else 0.0
    entrance_count = sum(1 for d in doors if d.get("kind") == "entrance")
    score = 45.0 * float(accessibility["reachableShare"])
    score += 20.0 if feasibility.get("practical") else max(0.0, 20.0 - 5.0 * len(feasibility.get("undersizedRooms", [])))
    score += 20.0 * compactness
    score += 8.0 * min(1.0, passage_width / 3.0)
    score += 7.0 if entrance_count == 1 else 0.0
    return round(float(score), 3), {
        "reachableShare": round(float(accessibility["reachableShare"]), 4),
        "allReachable": bool(accessibility["allReachable"]),
        "meanRoomAspect": round(mean_aspect, 4),
        "compactnessScore": round(compactness, 4),
        "passageWidthFt": round(passage_width, 3),
        "practical": bool(feasibility.get("practical")),
        "undersizedCount": len(feasibility.get("undersizedRooms", [])),
        "doorCount": len(doors),
    }


def _layout_signature(rooms: list[dict], plot_width: float, plot_length: float) -> tuple:
    signature = []
    for room in rooms:
        signature.extend([
            round(float(room["x"]) / plot_width, 2),
            round(float(room["y"]) / plot_length, 2),
            round(float(room["width"]) / plot_width, 2),
            round(float(room["height"]) / plot_length, 2),
        ])
    return tuple(signature)


def _signature_distance(a: tuple, b: tuple) -> float:
    if len(a) != len(b) or not a:
        return 1.0
    return float(np.mean(np.abs(np.asarray(a, dtype=np.float64) - np.asarray(b, dtype=np.float64))))


def _coverage_stats(boxes: np.ndarray, passage: np.ndarray, grid: int = 180) -> dict:
    """Raster estimate used only for transparent quality reporting/visualization."""
    yy, xx = np.mgrid[0:grid, 0:grid]
    xn = (xx + 0.5) / grid
    yn = (yy + 0.5) / grid
    room_occ = np.zeros((grid, grid), dtype=bool)
    for x0, y0, x1, y1 in boxes:
        room_occ |= (xn >= x0) & (xn <= x1) & (yn >= y0) & (yn <= y1)
    px0, py0, px1, py1 = [float(v) for v in passage]
    passage_occ = (xn >= px0) & (xn <= px1) & (yn >= py0) & (yn <= py1)
    visible_circulation = passage_occ & ~room_occ
    residual = ~room_occ & ~passage_occ
    return {
        "roomUnionShare": float(room_occ.mean()),
        "circulationVisibleShare": float(visible_circulation.mean()),
        "residualShare": float(residual.mean()),
        "method": f"{grid}x{grid} reporting raster; it does not move or resize model output",
    }



def _joint_partition(boxes: np.ndarray, passage: np.ndarray, plot_width: float, plot_length: float, passage_share: float = 0.08):
    """Generic balanced joint slicing decoder driven only by learned sites/areas.

    Room ordering along a split comes from neural site centres. Cut fractions come
    from neural area predictions. The decoder selects the current physical long
    axis and the split that best avoids extreme child aspect ratios. No room type
    receives a preferred side, row, adjacency, or coordinate.
    """
    centres = np.c_[(boxes[:, 0] + boxes[:, 2]) / 2, (boxes[:, 1] + boxes[:, 3]) / 2]
    wh = np.c_[boxes[:, 2] - boxes[:, 0], boxes[:, 3] - boxes[:, 1]].clip(0.02, 1.0)
    areas = (wh[:, 0] * wh[:, 1]).clip(0.002, None)
    pc = np.asarray([(passage[0] + passage[2]) / 2, (passage[1] + passage[3]) / 2], dtype=np.float64)
    sites = np.vstack([centres, pc])
    ps = float(np.clip(passage_share, 0.05, 0.12))
    weights = np.r_[areas / areas.sum() * (1.0 - ps), ps]
    out: list[tuple[float, float, float, float] | None] = [None] * len(weights)

    def aspect(w: float, h: float) -> float:
        if w <= 1e-9 or h <= 1e-9:
            return 1e9
        return max(w / h, h / w)

    def rec(indices: list[int], x: float, y: float, w: float, h: float):
        if len(indices) == 1:
            out[indices[0]] = (x, y, w, h)
            return
        phys_w, phys_h = w * plot_width, h * plot_length
        axis = 0 if phys_w >= phys_h else 1
        ordered = sorted(indices, key=lambda i: float(sites[i, axis]))
        total = float(weights[ordered].sum())
        cumulative = np.cumsum(weights[ordered])
        best: tuple[float, int, float] | None = None
        for split_index in range(1, len(ordered)):
            fraction = float(cumulative[split_index - 1] / total)
            if axis == 0:
                score = max(
                    aspect(w * fraction * plot_width, h * plot_length),
                    aspect(w * (1 - fraction) * plot_width, h * plot_length),
                )
            else:
                score = max(
                    aspect(w * plot_width, h * fraction * plot_length),
                    aspect(w * plot_width, h * (1 - fraction) * plot_length),
                )
            score += 0.15 * abs(fraction - 0.5)
            if best is None or score < best[0]:
                best = (score, split_index, fraction)
        assert best is not None
        _, split_index, fraction = best
        left, right = ordered[:split_index], ordered[split_index:]
        if axis == 0:
            rec(left, x, y, w * fraction, h)
            rec(right, x + w * fraction, y, w * (1 - fraction), h)
        else:
            rec(left, x, y, w, h * fraction)
            rec(right, x, y + h * fraction, w, h * (1 - fraction))

    rec(list(range(len(weights))), 0.0, 0.0, 1.0, 1.0)
    return [tuple(v) for v in out], weights, sites


def _shared_edge(a: dict, b: dict):
    eps = 1e-6
    ax0, ay0, ax1, ay1 = a['x'], a['y'], a['x'] + a['width'], a['y'] + a['height']
    bx0, by0, bx1, by1 = b['x'], b['y'], b['x'] + b['width'], b['y'] + b['height']
    if abs(ax1 - bx0) < eps or abs(bx1 - ax0) < eps:
        fixed = ax1 if abs(ax1 - bx0) < eps else ax0
        lo, hi = max(ay0, by0), min(ay1, by1)
        if hi - lo > 1e-5:
            return {'orientation': 'vertical', 'fixed': fixed, 'start': lo, 'end': hi}
    if abs(ay1 - by0) < eps or abs(by1 - ay0) < eps:
        fixed = ay1 if abs(ay1 - by0) < eps else ay0
        lo, hi = max(ax0, bx0), min(ax1, bx1)
        if hi - lo > 1e-5:
            return {'orientation': 'horizontal', 'fixed': fixed, 'start': lo, 'end': hi}
    return None


def _door_on_edge(edge: dict, preferred_x: float, preferred_y: float, max_width: float = 2.8):
    length = edge['end'] - edge['start']
    if length < 2.0:
        return None
    width = min(max_width, max(1.8, length - 0.45))
    half = width / 2
    preferred = preferred_x if edge['orientation'] == 'horizontal' else preferred_y
    center = min(max(preferred, edge['start'] + half + 0.05), edge['end'] - half - 0.05)
    return {
        'x': center if edge['orientation'] == 'horizontal' else edge['fixed'],
        'y': edge['fixed'] if edge['orientation'] == 'horizontal' else center,
        'width': width,
        'orientation': edge['orientation'],
    }


def _structured_payload(
    requirements: Requirements,
    room_ids: list[int],
    boxes: np.ndarray,
    passage: np.ndarray,
    adjacency_prob: np.ndarray,
    door_xy: np.ndarray,
    door_orientation_prob: np.ndarray,
):
    labels = _labels_for_room_ids(room_ids)
    plot_area = requirements.width * requirements.length
    partition, weights, _sites = _joint_partition(boxes, passage, requirements.width, requirements.length)
    room_rects = partition[:-1]
    passage_rect = partition[-1]
    rooms: list[dict] = []
    slots: list[dict] = []
    structured_boxes: list[dict] = []

    for idx, (type_id, rect, label_meta) in enumerate(zip(room_ids, room_rects, labels), start=1):
        name, room_type = label_meta
        x0, y0, nw, nh = [float(v) for v in rect]
        x, y = x0 * requirements.width, y0 * requirements.length
        width, height = nw * requirements.width, nh * requirements.length
        area = width * height
        room = {'id': f'model-room-{idx}', 'name': name, 'type': room_type, 'x': x, 'y': y, 'width': width, 'height': height, 'colour': COLOURS[room_type]}
        rooms.append(room)
        slots.append({'slot': idx, 'typeId': int(type_id), 'name': name, 'type': room_type, 'colour': COLOURS[room_type], 'pixels': 1, 'plotShare': area / plot_area, 'areaSqFt': area, 'labelX': x + width / 2, 'labelY': y + height / 2, 'componentCount': 1, 'mainComponentPixels': 1})
        structured_boxes.append({'slot': idx, 'typeId': int(type_id), 'name': name, 'type': room_type, 'colour': COLOURS[room_type], 'x0': x0, 'y0': y0, 'x1': x0 + nw, 'y1': y0 + nh, 'plotShare': area / plot_area, 'areaSqFt': area, 'labelX': x + width / 2, 'labelY': y + height / 2})

    px, py, pw, ph = [float(v) for v in passage_rect]
    passage_room = {'id': 'model-passage', 'name': 'Passage', 'type': 'passage', 'x': px * requirements.width, 'y': py * requirements.length, 'width': pw * requirements.width, 'height': ph * requirements.length, 'colour': '#f1eee7'}
    rooms.append(passage_room)
    circulation = {'name': 'Passage / circulation', 'type': 'passage', 'colour': '#f1eee7', 'x0': px, 'y0': py, 'x1': px + pw, 'y1': py + ph, 'x': passage_room['x'], 'y': passage_room['y'], 'width': passage_room['width'], 'height': passage_room['height'], 'areaSqFt': passage_room['width'] * passage_room['height'], 'note': 'Passage is a joint learned-site partition leaf; it is part of the exhaustive partition rather than an overlay.'}

    threshold = float(META.get('adjacency_threshold', 0.45))
    adjacency_edges: list[dict] = []
    door_candidates: list[dict] = []

    # Keep the learned room-to-room graph as model metadata. It is not used to
    # move any room. Door openings are only cut where the final partition has a
    # real shared wall.
    for i in range(len(room_ids)):
        for j in range(i + 1, len(room_ids)):
            probability = float(adjacency_prob[i, j])
            if probability < threshold:
                continue
            edge_id = f'learned-edge-{i+1}-{j+1}'
            adjacency_edges.append({
                'id': edge_id,
                'roomAId': rooms[i]['id'],
                'roomBId': rooms[j]['id'],
                'roomA': labels[i][0],
                'roomB': labels[j][0],
                'probability': probability,
            })
            door_candidates.append({
                'id': f'door-candidate-{i+1}-{j+1}',
                'roomAId': rooms[i]['id'],
                'roomBId': rooms[j]['id'],
                'roomA': labels[i][0],
                'roomB': labels[j][0],
                'x': float(door_xy[i, j, 0]) * requirements.width,
                'y': float(door_xy[i, j, 1]) * requirements.length,
                'orientation': 'vertical' if float(door_orientation_prob[i, j]) >= .5 else 'horizontal',
                'orientationProbability': float(door_orientation_prob[i, j]),
                'adjacencyProbability': probability,
                'width': 2.8,
                'renderedAsWallOpening': False,
            })

    # Build the physical shared-wall graph of the exhaustive partition. A
    # maximum-weight spanning tree selects enough openings to make the result
    # traversable. The weights use learned adjacency when it exists plus shared-
    # wall geometry. This is a generic connectivity decoder; it has no room-type
    # connection template such as kitchen->living or bedroom->passage.
    leaves = rooms
    physical_edges: list[dict] = []
    for i in range(len(leaves)):
        for j in range(i + 1, len(leaves)):
            edge = _shared_edge(leaves[i], leaves[j])
            if not edge:
                continue
            shared_len = max(0.0, float(edge['end'] - edge['start']))
            learned = 0.0
            pref_x = (leaves[i]['x'] + leaves[i]['width']/2 + leaves[j]['x'] + leaves[j]['width']/2) / 2
            pref_y = (leaves[i]['y'] + leaves[i]['height']/2 + leaves[j]['y'] + leaves[j]['height']/2) / 2
            if i < len(room_ids) and j < len(room_ids):
                learned = float(adjacency_prob[i, j])
                pref_x = float(door_xy[i, j, 0]) * requirements.width
                pref_y = float(door_xy[i, j, 1]) * requirements.length
            elif leaves[i]['type'] == 'passage' or leaves[j]['type'] == 'passage':
                # Passage is itself a learned partition leaf. Give a generic
                # circulation bonus to its shared walls, independent of room type.
                learned = 0.68
            norm_len = shared_len / max(1.0, min(requirements.width, requirements.length))
            physical_edges.append({
                'i': i, 'j': j, 'edge': edge,
                'score': learned + 0.22 * min(1.0, norm_len * 4.0),
                'learned': learned,
                'pref_x': pref_x, 'pref_y': pref_y,
            })

    # Entrance: choose the leaf that the joint partition actually placed at the
    # midpoint of the requested boundary side. This does not move the layout.
    side = requirements.entrance
    midpoint = requirements.width / 2 if side in ('North','South') else requirements.length / 2
    entrance_index = None
    boundary_candidates: list[int] = []
    for idx, r in enumerate(leaves):
        hit = False
        if side == 'North' and abs(r['y']) < 1e-6 and r['x'] <= midpoint <= r['x'] + r['width']:
            hit = True
        elif side == 'South' and abs(r['y'] + r['height'] - requirements.length) < 1e-6 and r['x'] <= midpoint <= r['x'] + r['width']:
            hit = True
        elif side == 'West' and abs(r['x']) < 1e-6 and r['y'] <= midpoint <= r['y'] + r['height']:
            hit = True
        elif side == 'East' and abs(r['x'] + r['width'] - requirements.width) < 1e-6 and r['y'] <= midpoint <= r['y'] + r['height']:
            hit = True
        if hit:
            boundary_candidates.append(idx)
    if boundary_candidates:
        entrance_index = boundary_candidates[0]

    doors: list[dict] = []
    used_pairs: set[tuple[int,int]] = set()
    if entrance_index is not None:
        r = leaves[entrance_index]
        if side in ('North','South'):
            seg_start, seg_end = r['x'], r['x'] + r['width']
            available = seg_end - seg_start
            width = min(3.0, max(1.8, available - .35))
            if available >= 1.8:
                half = width / 2
                center = min(max(midpoint, seg_start + half + .02), seg_end - half - .02)
                doors.append({'id':'entrance-door','from':'outside','to':r['id'],'x':center,'y':0.0 if side=='North' else requirements.length,'width':width,'orientation':'horizontal','kind':'entrance'})
        else:
            seg_start, seg_end = r['y'], r['y'] + r['height']
            available = seg_end - seg_start
            width = min(3.0, max(1.8, available - .35))
            if available >= 1.8:
                half = width / 2
                center = min(max(midpoint, seg_start + half + .02), seg_end - half - .02)
                doors.append({'id':'entrance-door','from':'outside','to':r['id'],'x':0.0 if side=='West' else requirements.width,'y':center,'width':width,'orientation':'vertical','kind':'entrance'})

    # Maximum-weight spanning tree on the physical dual graph guarantees a path
    # between partition leaves whenever the geometry permits one.
    if entrance_index is not None:
        connected = {entrance_index}
        while len(connected) < len(leaves):
            crossing = [e for e in physical_edges if (e['i'] in connected) ^ (e['j'] in connected)]
            if not crossing:
                break
            chosen = max(crossing, key=lambda e: (e['score'], e['edge']['end'] - e['edge']['start']))
            pair = tuple(sorted((chosen['i'], chosen['j'])))
            geom = _door_on_edge(chosen['edge'], chosen['pref_x'], chosen['pref_y'], max_width=3.0)
            if geom:
                a, b = leaves[chosen['i']], leaves[chosen['j']]
                doors.append({
                    'id': f'connect-{pair[0]+1}-{pair[1]+1}',
                    'from': a['id'], 'to': b['id'], **geom,
                    'kind': 'opening' if (a['type'] == 'passage' or b['type'] == 'passage') else 'internal',
                })
                used_pairs.add(pair)
            connected.add(chosen['i']); connected.add(chosen['j'])

    # Add a few additional high-confidence learned shared-wall connections to
    # create alternate movement routes without using semantic room templates.
    extras = sorted(
        [e for e in physical_edges if tuple(sorted((e['i'],e['j']))) not in used_pairs and e['learned'] >= max(threshold, .58)],
        key=lambda e: e['learned'], reverse=True,
    )[:3]
    for chosen in extras:
        pair = tuple(sorted((chosen['i'], chosen['j'])))
        geom = _door_on_edge(chosen['edge'], chosen['pref_x'], chosen['pref_y'], max_width=2.8)
        if not geom:
            continue
        a, b = leaves[chosen['i']], leaves[chosen['j']]
        doors.append({
            'id': f'extra-{pair[0]+1}-{pair[1]+1}',
            'from': a['id'], 'to': b['id'], **geom,
            'kind': 'opening' if (a['type'] == 'passage' or b['type'] == 'passage') else 'internal',
        })
        used_pairs.add(pair)

    rendered_pairs = {tuple(sorted((d['from'], d['to']))) for d in doors if d['from'] != 'outside'}
    for candidate in door_candidates:
        candidate['renderedAsWallOpening'] = tuple(sorted((candidate['roomAId'], candidate['roomBId']))) in rendered_pairs

    coverage = {'roomUnionShare': float(1.0 - weights[-1]), 'circulationVisibleShare': float(weights[-1]), 'residualShare': 0.0, 'method': 'exhaustive joint learned-site slicing partition; zero residual by construction'}
    return rooms, slots, structured_boxes, [], 0.0, circulation, adjacency_edges, door_candidates, coverage, doors


@app.get("/health")
def health():
    return {
        "status": "ok" if MODEL is not None else "error",
        "model_ready": MODEL is not None,
        "checkpoint": CHECKPOINT_PATH.name,
        "device": str(DEVICE),
        "meta": META,
        "held_out_metrics": METRICS,
        "load_error": LOAD_ERROR or None,
        "runtime_placement": "multi-option latent sampling around neural room sites/areas + exhaustive joint partition + generic shared-wall connectivity; zero semantic room-placement templates",
        "plot_dimension_range_ft": [12, 100],
        "verified_room_types": [
            "living room", "master bedroom", "second bedroom", "third bedroom",
            "kitchen", "bathroom", "balcony", "study room", "utility room",
            "parking", "pooja room"
        ],
        "extension_provenance": {
            "native_teacher_ids": {"third bedroom": 8, "study room": 6, "utility room": 11},
            "proxy_teacher_ids": {"parking": 10, "pooja room": 11},
            "note": "Parking and pooja use learned proxy supervision because the supplied DoorFloorNet has no native parking/pooja semantic IDs."
        },
    }


@app.post("/api/generate-plan")
def generate_plan(requirements: Requirements):
    if MODEL is None:
        raise HTTPException(status_code=503, detail=f"Structured model is not ready: {LOAD_ERROR}")

    unsupported = unsupported_requirements(requirements)
    if unsupported:
        raise HTTPException(
            status_code=422,
            detail={
                "message": "The trained structured model cannot generate some requested room types.",
                "unsupported": unsupported,
                "supported": [
                    "living room", "master bedroom", "second bedroom", "third bedroom",
                    "kitchen", "bathroom", "balcony/open space", "study room",
                    "utility room", "parking", "pooja room",
                ],
            },
        )

    room_ids = requested_room_ids(requirements)
    max_rooms = int(META.get("max_rooms", 8))
    if not 4 <= len(room_ids) <= max_rooms:
        raise HTTPException(
            status_code=422,
            detail=f"Structured model supports 4 to {max_rooms} requested room slots; this request creates {len(room_ids)}.",
        )

    base_boxes, base_passage, adjacency_prob, door_xy, door_orientation_prob = _predict(requirements, room_ids)

    teacher_epoch = int(META.get("teacher_checkpoint_epoch", 9))
    best_val = float(METRICS.get("best_val_loss", 0.0))
    training_method = str(
        METRICS.get(
            "training_method",
            "rectangular neural decoder distilled from supplied DoorFloorNet soft maps; no runtime placement rules",
        )
    )

    pool: list[dict] = []
    # Candidate 0 is the exact neural output. The remaining candidates are latent
    # samples around the same learned sites/areas. We deliberately sample a larger
    # pool and rank/deduplicate it so the UI receives distinct alternatives rather
    # than three cosmetic copies.
    for candidate_index in range(24):
        boxes, passage, seed, latent_strength = _sample_variant(
            requirements, base_boxes, base_passage, candidate_index
        )
        (
            rooms, room_slots, structured_boxes, overlap_pairs, overlap_share,
            circulation, adjacency_edges, door_candidates, coverage, doors
        ) = _structured_payload(
            requirements, room_ids, boxes, passage, adjacency_prob, door_xy, door_orientation_prob
        )
        feasibility = _feasibility(rooms, requirements)
        accessibility = _door_accessibility(rooms, doors)
        score, score_metrics = _candidate_score(rooms, doors, feasibility, accessibility)
        signature = _layout_signature(rooms, requirements.width, requirements.length)

        notes = [
            "This is one stochastic learned alternative sampled around the final neural room-site/area prediction; no room-type placement template is used.",
            "Room sites and target areas come from the frozen physical-size-aware neural decoder; the generic joint slicing decoder turns those learned signals into one exhaustive orthogonal partition.",
            "A generic shared-wall connectivity decoder uses learned adjacency probabilities plus physical wall contact to create a traversable door graph; it never changes room placement.",
            "The joint partition is exhaustive: requested rooms plus passage cover 100% of the plot with zero gaps and zero overlaps.",
            "The same selected candidate geometry is used by both the 2D plan and the 3D viewer.",
            feasibility["note"],
        ]
        if not accessibility["allReachable"]:
            notes.append("Accessibility warning: " + ", ".join(accessibility["unreachableRooms"]) + " cannot be reached from the entrance in this sampled candidate.")

        plan_id = uuid.uuid4().hex[:12]
        plan = {
            "schemaVersion": 1,
            "id": plan_id,
            "name": "AI layout alternative",
            "createdAt": datetime.now(timezone.utc).isoformat(),
            "source": "model",
            "plot": {
                "width": requirements.width,
                "length": requirements.length,
                "unit": "ft",
                "entrance": requirements.entrance,
            },
            "requirements": requirements.model_dump(),
            "rooms": rooms,
            "doors": doors,
            "windows": [],
            "wallHeight": 9,
            "wallThickness": 0.5,
            "notes": notes,
            "modelPrediction": {
                "imageSize": 0,
                "trainingImageSize": 64,
                "inferenceMode": "joint-partition-multi-option",
                "grid": [],
                "plotMask": [],
                "doorMask": [],
                "plotBox": {"left": 0, "top": 0, "width": 1, "height": 1},
                "roomSlots": room_slots,
                "structuredBoxes": structured_boxes,
                "requestedTypeIds": room_ids,
                "missingRequestedRooms": [],
                "checkpointEpoch": teacher_epoch,
                "validationLoss": best_val,
                "totalOverlapShare": overlap_share,
                "overlapPairs": overlap_pairs,
                "trainingMethod": training_method,
                "feasibility": feasibility,
                "circulation": circulation,
                "adjacencyEdges": adjacency_edges,
                "doorCandidates": door_candidates,
                "coverage": coverage,
                "partitionMethod": "stochastic learned-site recursive slicing; neural sites/areas are sampled with room-type-agnostic latent noise, then jointly partitioned with no semantic room-placement rules",
                "candidateSeed": int(seed),
                "latentStrength": round(float(latent_strength), 5),
                "candidateScore": score,
                "candidateMetrics": {**score_metrics, **accessibility},
            },
        }
        pool.append({"plan": plan, "score": score, "signature": signature, "candidate_index": candidate_index})

    pool.sort(key=lambda item: item["score"], reverse=True)
    selected: list[dict] = []
    # Require a meaningful normalized geometry difference between alternatives.
    # Relax slightly only if a difficult/compact request does not yield three.
    for min_distance in (0.055, 0.035, 0.018, 0.0):
        selected = []
        for item in pool:
            if all(_signature_distance(item["signature"], prev["signature"]) >= min_distance for prev in selected):
                selected.append(item)
            if len(selected) == 3:
                break
        if len(selected) == 3:
            break

    option_names = ["Option 1 · Best ranked", "Option 2 · Alternative layout", "Option 3 · Alternative layout"]
    plans = []
    for rank, item in enumerate(selected[:3], start=1):
        plan = item["plan"]
        plan["name"] = option_names[rank - 1]
        plan["modelPrediction"]["candidateRank"] = rank
        plan["modelPrediction"]["sourceCandidateIndex"] = int(item["candidate_index"])
        plan["modelPrediction"]["diversityFromBest"] = 0.0 if rank == 1 else round(_signature_distance(item["signature"], selected[0]["signature"]), 4)
        plans.append(plan)

    return {
        "plans": plans,
        "generation": {
            "poolSize": len(pool),
            "returned": len(plans),
            "method": "latent sampling around learned neural sites/areas + joint partition + generic connectivity validation/ranking",
        },
    }

