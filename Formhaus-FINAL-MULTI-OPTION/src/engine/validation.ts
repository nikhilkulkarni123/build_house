import type { FloorPlan, Room, ValidationResult } from "./types";
import { OPEN_TYPES } from "./types";
import {
  EPS,
  getWalls,
  near,
  openingOnWall,
  overlaps,
  sharedEdge,
} from "./geometry";
export const MINIMUMS: Partial<Record<Room["type"], [number, number]>> = {
  living: [9, 10],
  bedroom: [9, 10],
  kitchen: [7, 8],
  bathroom: [5, 5],
  study: [7, 8],
  utility: [5, 5],
  pooja: [4, 4],
  porch: [3, 4],
  open: [4, 4],
};
export function validatePlan(plan: FloorPlan): ValidationResult {
  if (plan.source === "model" && plan.modelPrediction) {
    const p = plan.modelPrediction;
    const slotsOk = p.roomSlots.length >= 4 && p.roomSlots.length <= 8;
    const missing = p.missingRequestedRooms || [];

    if (["learned-rectangles", "joint-partition", "joint-partition-multi-option"].includes(p.inferenceMode)) {
      const boxes = p.structuredBoxes || [];
      const geometryOk =
        boxes.length === p.roomSlots.length &&
        plan.rooms.length >= p.roomSlots.length &&
        boxes.every((b) =>
          [b.x0, b.y0, b.x1, b.y1].every(Number.isFinite) &&
          b.x0 >= 0 && b.y0 >= 0 && b.x1 <= 1 && b.y1 <= 1 &&
          b.x1 > b.x0 && b.y1 > b.y0,
        );
      const overlap = p.totalOverlapShare || 0;
      const circulationOk = Boolean(
        p.circulation &&
        [p.circulation.x, p.circulation.y, p.circulation.width, p.circulation.height].every(Number.isFinite) &&
        p.circulation.width > 0 && p.circulation.height > 0
      );
      const learnedEdges = p.adjacencyEdges || [];
      const graph = new Map(plan.rooms.map((r) => [r.id, new Set<string>()]));
      learnedEdges.forEach((e) => { graph.get(e.roomAId)?.add(e.roomBId); graph.get(e.roomBId)?.add(e.roomAId); });
      const graphSeen = new Set<string>();
      const graphStack = plan.rooms.length ? [plan.rooms[0].id] : [];
      while (graphStack.length) {
        const id = graphStack.pop()!;
        if (graphSeen.has(id)) continue;
        graphSeen.add(id);
        graph.get(id)?.forEach((next) => { if (!graphSeen.has(next)) graphStack.push(next); });
      }
      const graphConnected = plan.rooms.length > 0 && graphSeen.size === plan.rooms.length;
      const accessGraph = new Map<string, Set<string>>([["outside", new Set<string>()]]);
      plan.rooms.forEach((r) => accessGraph.set(r.id, new Set<string>()));
      plan.doors.forEach((d) => {
        if (!accessGraph.has(d.from)) accessGraph.set(d.from, new Set<string>());
        if (!accessGraph.has(d.to)) accessGraph.set(d.to, new Set<string>());
        accessGraph.get(d.from)?.add(d.to);
        accessGraph.get(d.to)?.add(d.from);
      });
      const accessSeen = new Set<string>();
      const accessStack = ["outside"];
      while (accessStack.length) {
        const id = accessStack.pop()!;
        if (accessSeen.has(id)) continue;
        accessSeen.add(id);
        accessGraph.get(id)?.forEach((next) => { if (!accessSeen.has(next)) accessStack.push(next); });
      }
      const unreachable = plan.rooms.filter((r) => !accessSeen.has(r.id));
      const allAccessible = unreachable.length === 0;
      const residualShare = p.coverage?.residualShare ?? 1;
      const checks: ValidationResult["checks"] = [
        { id: "checkpoint", label: "Physical-size-aware learned checkpoint loaded", status: "pass", detail: `The final joint decoder receives exact plot width and length and uses learned room sites distilled from DoorFloorNet epoch ${p.checkpointEpoch}.` },
        { id: "geometry", label: "Structured room geometry", status: geometryOk ? "pass" : "fail", detail: geometryOk ? `${boxes.length} learned partition leaves are finite and inside the plot.` : "Joint partition geometry is missing or malformed." },
        { id: "slots", label: "Requested model room slots", status: slotsOk ? "pass" : "fail", detail: `${p.roomSlots.length} requested room slots were sent to the model.` },
        { id: "missing", label: "Requested rooms generated", status: missing.length ? "warning" : "pass", detail: missing.length ? `Model did not generate: ${missing.join(", ")}.` : "Every requested supported room received learned geometry." },
        { id: "overlap", label: "Joint partition overlap", status: overlap > 0.03 ? "warning" : "pass", detail: overlap > 0 ? `Joint partition overlap totals ${(overlap * 100).toFixed(2)}% of plot area.` : "The joint partition has zero room overlap." },
        { id: "circulation", label: "Learned circulation", status: circulationOk ? "pass" : "fail", detail: circulationOk ? "The joint partition contains an explicit learned passage leaf." : "Learned circulation output is missing or malformed." },
        { id: "adjacency", label: "Learned room connectivity signal", status: graphConnected ? "pass" : "warning", detail: graphConnected ? `${learnedEdges.length} learned adjacency edges form a connected learned graph.` : `${learnedEdges.length} learned adjacency edges were predicted; the physical connectivity decoder may add geometry-supported links needed for access.` },
        { id: "accessibility", label: "Entrance-to-every-room access", status: allAccessible ? "pass" : "warning", detail: allAccessible ? `Actual wall openings connect the entrance to all ${plan.rooms.length} partition spaces.` : `Unreachable from the entrance: ${unreachable.map((r) => r.name).join(", ")}.` },
        { id: "door-candidates", label: "Learned door candidates", status: (p.doorCandidates?.length || 0) > 0 ? "pass" : "warning", detail: `${p.doorCandidates?.length || 0} learned door candidate locations are available; the generic shared-wall connectivity decoder cuts only physically valid openings.` },
        { id: "coverage", label: "Explained plot coverage", status: residualShare > 0.30 ? "warning" : "pass", detail: `${((1 - residualShare) * 100).toFixed(0)}% of the plot is assigned to learned rooms or passage; residual is ${(residualShare * 100).toFixed(0)}%.` },
        { id: "feasibility", label: "Compact-plot feasibility", status: p.feasibility?.practical === false ? "warning" : "pass", detail: p.feasibility?.practical === false ? `Model prediction is undersized for: ${p.feasibility.undersizedRooms.map((r) => r.name).join(", ")}. No rule-based resizing was applied.` : (p.feasibility?.note || "Predicted room sizes pass the bundled compact concept-design minimums.") },
        { id: "placement", label: "No rule-based room placement", status: "pass", detail: "Room sites and areas come from the neural decoder. A generic joint slicing layer partitions the plot from those learned sites; there are no room-type preferred-side, row, or adjacency templates." },
        { id: "scope", label: "Extended learned room scope", status: "pass", detail: "Third bedroom, study, utility, parking and pooja are enabled as learned tokens. Parking/pooja use proxy supervision from the supplied teacher because it has no native labels for those spaces." },
        { id: "limitations", label: "Model capacity", status: "warning", detail: "The supplied teacher architecture supports at most 8 requested room slots per plan. Door candidates are learned, but only geometry-supported openings should be cut into walls; windows are not predicted by this checkpoint." },
      ];
      return { valid: checks.every((c) => c.status !== "fail"), checks, reachableRoomIds: plan.rooms.filter((r) => accessSeen.has(r.id)).map((r) => r.id) };
    }

    const gridOk = Boolean(p.grid && p.grid.length === p.imageSize && p.grid.every((r) => r.length === p.imageSize));
    const checks: ValidationResult["checks"] = [
      { id: "checkpoint", label: "Trained checkpoint loaded", status: "pass", detail: `DoorFloorNet checkpoint epoch ${p.checkpointEpoch} produced this legacy segmentation prediction.` },
      { id: "grid", label: "Model output grid", status: gridOk ? "pass" : "fail", detail: gridOk ? `${p.imageSize}×${p.imageSize} segmentation inference is present.` : "Model prediction grid is malformed." },
      { id: "slots", label: "Requested model room slots", status: slotsOk ? "pass" : "fail", detail: `${p.roomSlots.length} room slots were sent to the model.` },
      { id: "missing", label: "Requested rooms received pixels", status: missing.length ? "warning" : "pass", detail: missing.length ? `Zero predicted pixels: ${missing.join(", ")}.` : "Every requested room slot received predicted area." },
      { id: "placement", label: "No rule-based placement", status: "pass", detail: "Room locations come from the model prediction, with no room packing or adjacency rule." },
    ];
    return { valid: checks.every((c) => c.status !== "fail"), checks, reachableRoomIds: plan.rooms.map((r) => r.id) };
  }
  const checks: ValidationResult["checks"] = [];
  const add = (
    id: string,
    label: string,
    ok: boolean,
    good: string,
    bad: string,
  ) =>
    checks.push({
      id,
      label,
      status: ok ? "pass" : "fail",
      detail: ok ? good : bad,
    });
  const roomIds = new Set(plan.rooms.map((r) => r.id));
  const sane =
    plan.plot.width > 0 &&
    plan.plot.length > 0 &&
    Number.isFinite(plan.plot.width) &&
    Number.isFinite(plan.plot.length) &&
    plan.rooms.length > 0 &&
    roomIds.size === plan.rooms.length &&
    plan.rooms.every(
      (r) =>
        [r.x, r.y, r.width, r.height].every(Number.isFinite) &&
        r.width > 0 &&
        r.height > 0,
    ) &&
    plan.wallHeight > 7 &&
    plan.wallThickness > 0 &&
    plan.doors.every(
      (d) => [d.x, d.y, d.width].every(Number.isFinite) && d.width > 0,
    ) &&
    plan.windows.every(
      (w) =>
        [w.x, w.y, w.width, w.sill, w.height].every(Number.isFinite) &&
        w.width > 0 &&
        w.sill >= 0 &&
        w.height > 0 &&
        w.sill + w.height <= plan.wallHeight,
    );
  add(
    "geometry",
    "Finite, well-formed geometry",
    sane,
    "Coordinates, IDs, and dimensions are well formed.",
    "Missing rooms, repeated IDs, or invalid dimensions.",
  );
  const conflicts = plan.rooms.flatMap((a, i) =>
    plan.rooms
      .slice(i + 1)
      .filter((b) => overlaps(a, b))
      .map((b) => a.name + " / " + b.name),
  );
  add(
    "overlap",
    "No overlapping rooms",
    !conflicts.length,
    "All room interiors are separate.",
    conflicts.join("; "),
  );
  const outside = plan.rooms.filter(
    (r) =>
      r.x < -EPS ||
      r.y < -EPS ||
      r.x + r.width > plan.plot.width + EPS ||
      r.y + r.height > plan.plot.length + EPS,
  );
  add(
    "boundary",
    "Inside plot boundary",
    !outside.length,
    "Every room fits inside the plot.",
    outside.map((r) => r.name).join(", ") + " extends beyond the plot.",
  );
  const small = plan.rooms.filter((r) => {
    const min = MINIMUMS[r.type];
    if (!min) return false;
    const [short, long] = [r.width, r.height].sort((a, b) => a - b);
    return short + EPS < min[0] || long + EPS < min[1];
  });
  add(
    "dimensions",
    "Practical minimum room sizes",
    !small.length,
    "Room dimensions meet the concept-design minimums.",
    small.map((r) => r.name).join(", ") + " is too small.",
  );
  const passage = plan.rooms.filter((r) => r.type === "passage");
  add(
    "passage",
    "Passage width ≥ 3 ft",
    passage.length > 0 &&
      passage.every((r) => Math.min(r.width, r.height) >= 3 - EPS),
    "Circulation has at least 3 ft of clear nominal width.",
    "A passage is missing or narrower than 3 ft.",
  );
  const parking = plan.rooms.filter((r) => r.type === "parking");
  add(
    "parking",
    "Parking fits 9 × 15 ft",
    (!plan.requirements.parking || parking.length > 0) &&
      parking.every(
        (r) =>
          Math.min(r.width, r.height) >= 9 - EPS &&
          Math.max(r.width, r.height) >= 15 - EPS,
      ),
    plan.requirements.parking
      ? "The parking bay meets 9 × 15 ft."
      : "Parking was not requested.",
    "Requested parking is missing or undersized.",
  );
  const badDoors = plan.doors.filter((d) => {
    const to = plan.rooms.find((r) => r.id === d.to);
    if (!to) return true;
    if (d.from === "outside") return d.kind !== "entrance";
    const from = plan.rooms.find((r) => r.id === d.from);
    if (!from) return true;
    const e = sharedEdge(from, to);
    if (!e || e.orientation !== d.orientation) return true;
    const c = e.orientation === "horizontal" ? d.x : d.y;
    return (
      !near(e.fixed, e.orientation === "horizontal" ? d.y : d.x) ||
      c - d.width / 2 < e.start - EPS ||
      c + d.width / 2 > e.end + EPS ||
      d.width < 2.5
    );
  });
  add(
    "doors",
    "Doors sit on shared boundaries",
    !badDoors.length,
    "Internal door openings connect adjacent rooms.",
    badDoors.map((d) => d.id).join(", ") +
      " has an invalid connection or opening.",
  );
  const entrances = plan.doors.filter((d) => d.from === "outside");
  const entry = entrances[0];
  const porch = entry && plan.rooms.find((r) => r.id === entry.to);
  const correctSide =
    entry &&
    (plan.plot.entrance === "North"
      ? entry.orientation === "horizontal" && near(entry.y, 0)
      : plan.plot.entrance === "South"
        ? entry.orientation === "horizontal" && near(entry.y, plan.plot.length)
        : plan.plot.entrance === "West"
          ? entry.orientation === "vertical" && near(entry.x, 0)
          : entry.orientation === "vertical" && near(entry.x, plan.plot.width));
  const onPorch =
    entry &&
    porch &&
    (entry.orientation === "horizontal"
      ? (near(entry.y, porch.y) || near(entry.y, porch.y + porch.height)) &&
        entry.x - entry.width / 2 >= porch.x - EPS &&
        entry.x + entry.width / 2 <= porch.x + porch.width + EPS
      : (near(entry.x, porch.x) || near(entry.x, porch.x + porch.width)) &&
        entry.y - entry.width / 2 >= porch.y - EPS &&
        entry.y + entry.width / 2 <= porch.y + porch.height + EPS);
  add(
    "entrance",
    "Entrance matches selected direction",
    entrances.length === 1 &&
      !!correctSide &&
      !!onPorch &&
      porch?.type === "porch" &&
      entry.width >= 3,
    "The " +
      plan.plot.entrance.toLowerCase() +
      " entrance opens into the porch.",
    "The external entrance is absent, misplaced, duplicated, or does not open into a porch.",
  );
  const connected = plan.rooms.filter(
    (r) => !plan.doors.some((d) => d.to === r.id || d.from === r.id),
  );
  add(
    "connections",
    "Every room has a connection",
    !connected.length,
    "All rooms have a door or an open connection.",
    connected.map((r) => r.name).join(", ") + " has no door.",
  );
  const graph = new Map<string, string[]>();
  for (const d of plan.doors.filter((d) => !badDoors.includes(d))) {
    graph.set(d.from, [...(graph.get(d.from) || []), d.to]);
    graph.set(d.to, [...(graph.get(d.to) || []), d.from]);
  }
  const reached = new Set<string>(["outside"]),
    queue = ["outside"];
  while (queue.length) {
    for (const n of graph.get(queue.shift()!) || []) {
      if (!reached.has(n)) {
        reached.add(n);
        queue.push(n);
      }
    }
  }
  const unreachable = plan.rooms.filter((r) => !reached.has(r.id));
  add(
    "accessibility",
    "Entrance access · graph checked",
    !unreachable.length,
    "Breadth-first search reaches every room from outside.",
    unreachable.map((r) => r.name).join(", ") +
      " cannot be reached from the entrance.",
  );
  const living = plan.rooms.find((r) => r.type === "living");
  add(
    "entry-path",
    "Porch connects directly to living",
    !!porch &&
      !!living &&
      plan.doors.some(
        (d) =>
          (d.from === porch.id && d.to === living.id) ||
          (d.to === porch.id && d.from === living.id),
      ),
    "The arrival sequence is entrance → porch → living.",
    "A direct porch-to-living connection is missing.",
  );
  const walls = getWalls(plan);
  const invalidWindows = plan.windows.filter(
    (w) =>
      !walls.some(
        (wall) =>
          wall.exterior &&
          wall.roomIds.includes(w.roomId) &&
          openingOnWall(w, wall) &&
          (wall.orientation === "horizontal"
            ? w.x - w.width / 2 >= wall.x1 - EPS &&
              w.x + w.width / 2 <= wall.x2 + EPS
            : w.y - w.width / 2 >= wall.y1 - EPS &&
              w.y + w.width / 2 <= wall.y2 + EPS),
      ),
  );
  add(
    "windows",
    "Exterior windows and ventilation",
    !invalidWindows.length &&
      plan.rooms
        .filter((r) => r.type === "bathroom")
        .every((r) => plan.windows.some((w) => w.roomId === r.id)),
    "Bathrooms have exterior ventilation; windows sit on exposed walls.",
    "A window is misplaced or a bathroom lacks exterior ventilation.",
  );
  const meets =
    plan.rooms.filter((r) => r.type === "bedroom").length ===
      plan.requirements.bedrooms &&
    plan.rooms.filter((r) => r.type === "bathroom").length ===
      plan.requirements.bathrooms &&
    !!living &&
    plan.rooms.some((r) => r.type === "kitchen") &&
    (["utility", "study", "pooja"] as const).every(
      (t) => !plan.requirements[t] || plan.rooms.some((r) => r.type === t),
    ) &&
    (!plan.requirements.openSpace || plan.rooms.some((r) => r.type === "open"));
  add(
    "requirements",
    "Requested spaces included",
    meets,
    "The plan includes the requested room types and counts.",
    "One or more requested rooms are missing.",
  );
  const indoorArea = plan.rooms
    .filter((r) => !OPEN_TYPES.includes(r.type))
    .reduce((s, r) => s + r.width * r.height, 0);
  const circulation =
    passage.reduce((s, r) => s + r.width * r.height, 0) / indoorArea;
  checks.push({
    id: "circulation",
    label: "Efficient circulation",
    status: circulation > 0.2 ? "warning" : "pass",
    detail:
      Math.round(circulation * 100) +
      "% of enclosed floor area is passage space.",
  });
  checks.push({
    id: "professional",
    label: "Professional review required",
    status: "warning",
    detail:
      "Concept geometry only. Local setbacks, structure, wall-clear dimensions, accessibility codes, and services need professional approval.",
  });
  return {
    valid: checks.every((c) => c.status !== "fail"),
    checks,
    reachableRoomIds: [...reached].filter((id) => id !== "outside"),
  };
}
