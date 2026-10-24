from fastapi.testclient import TestClient
from main import app

client = TestClient(app)
BASE = {
    "width": 50,
    "length": 45,
    "bedrooms": 2,
    "bathrooms": 1,
    "parking": False,
    "entrance": "North",
    "utility": False,
    "study": False,
    "pooja": False,
    "openSpace": True,
}


def test_health():
    body = client.get("/health").json()
    assert body["model_ready"] is True
    assert body["meta"]["architecture"] == "ConnectivityRectNet-final-v3"
    assert "parking" in body["verified_room_types"]
    assert "pooja room" in body["verified_room_types"]


def test_native_extended_generation():
    req = dict(BASE, width=40, length=60, entrance="East", utility=True, study=True)
    response = client.post("/api/generate-plan", json=req)
    assert response.status_code == 200
    plan = response.json()["plans"][0]
    names = {r["name"] for r in plan["rooms"]}
    assert {"Study room", "Utility room", "Balcony"} <= names
    assert plan["modelPrediction"]["inferenceMode"] == "joint-partition-multi-option"
    assert len(plan["rooms"]) == 9
    mp = plan["modelPrediction"]
    assert mp["circulation"]["width"] > 0 and mp["circulation"]["height"] > 0
    assert len(mp["adjacencyEdges"]) > 0
    assert len(mp["doorCandidates"]) == len(mp["adjacencyEdges"])
    assert mp["coverage"]["residualShare"] == 0
    assert mp["totalOverlapShare"] == 0


def test_third_bedroom_parking_pooja_generation():
    req = dict(BASE, width=30, length=45, entrance="East", bedrooms=3, openSpace=False, parking=True, pooja=True)
    response = client.post("/api/generate-plan", json=req)
    assert response.status_code == 200
    plan = response.json()["plans"][0]
    names = {r["name"] for r in plan["rooms"]}
    assert {"Third bedroom", "Parking", "Pooja room"} <= names
    assert len(plan["rooms"]) == 9
    assert "Passage" in names
    assert all(r["width"] > 0 and r["height"] > 0 for r in plan["rooms"])
    assert plan["modelPrediction"]["circulation"]["type"] == "passage"
    assert len(plan["modelPrediction"]["doorCandidates"]) > 0


def test_capacity_limit_is_explicit():
    req = dict(BASE, bedrooms=3, bathrooms=2, parking=True, utility=True, study=True, pooja=True, openSpace=True)
    response = client.post("/api/generate-plan", json=req)
    assert response.status_code == 422
    assert "at most 8" in response.json()["detail"] or "supports 4 to 8" in response.json()["detail"]


def test_12x20_is_accepted_and_evaluated():
    req = dict(BASE, width=12, length=20, bedrooms=1, bathrooms=1, openSpace=False)
    response = client.post("/api/generate-plan", json=req)
    assert response.status_code == 200
    plan = response.json()["plans"][0]
    assert plan["plot"]["width"] == 12
    assert plan["plot"]["length"] == 20
    assert "feasibility" in plan["modelPrediction"]
    assert isinstance(plan["modelPrediction"]["feasibility"]["practical"], bool)


def test_exact_physical_size_changes_normalized_prediction():
    a = dict(BASE, width=12, length=20, bedrooms=1, bathrooms=1, openSpace=False)
    b = dict(BASE, width=30, length=50, bedrooms=1, bathrooms=1, openSpace=False)
    pa = client.post("/api/generate-plan", json=a).json()["plans"][0]
    pb = client.post("/api/generate-plan", json=b).json()["plans"][0]
    ba = pa["modelPrediction"]["structuredBoxes"][0]
    bb = pb["modelPrediction"]["structuredBoxes"][0]
    delta = sum(abs(ba[k] - bb[k]) for k in ("x0", "y0", "x1", "y1"))
    assert delta > 1e-4


def test_joint_partition_is_exhaustive_and_non_overlapping():
    req = dict(BASE, width=30, length=45, entrance="East", bedrooms=3, openSpace=False, parking=True, pooja=True)
    response = client.post("/api/generate-plan", json=req)
    assert response.status_code == 200
    plan = response.json()["plans"][0]
    total_area = sum(float(r["width"]) * float(r["height"]) for r in plan["rooms"])
    assert abs(total_area - req["width"] * req["length"]) < 1e-5
    assert plan["modelPrediction"]["coverage"]["residualShare"] == 0
    assert plan["modelPrediction"]["totalOverlapShare"] == 0


def test_joint_partition_emits_geometry_supported_openings():
    req = dict(BASE, width=30, length=45, entrance="East", bedrooms=3, openSpace=False, parking=True, pooja=True)
    response = client.post("/api/generate-plan", json=req)
    plan = response.json()["plans"][0]
    ids = {r["id"] for r in plan["rooms"]}
    assert any(d["kind"] == "entrance" and d["from"] == "outside" for d in plan["doors"])
    assert any(d["kind"] in {"internal", "opening"} for d in plan["doors"])
    for d in plan["doors"]:
        assert d["width"] > 0
        assert d["to"] in ids
        assert d["from"] == "outside" or d["from"] in ids


def test_returns_three_distinct_ranked_options():
    req = dict(BASE, width=30, length=45, entrance="East", bedrooms=3, openSpace=False, parking=True, pooja=True)
    response = client.post("/api/generate-plan", json=req)
    assert response.status_code == 200
    body = response.json()
    assert len(body["plans"]) == 3
    assert body["generation"]["poolSize"] >= 12
    signatures = []
    scores = []
    for rank, plan in enumerate(body["plans"], start=1):
        mp = plan["modelPrediction"]
        assert mp["candidateRank"] == rank
        assert mp["candidateMetrics"]["allReachable"] is True
        scores.append(mp["candidateScore"])
        signatures.append(tuple((round(r["x"], 2), round(r["y"], 2), round(r["width"], 2), round(r["height"], 2)) for r in plan["rooms"]))
    assert scores == sorted(scores, reverse=True)
    assert len(set(signatures)) == 3


def test_every_returned_option_is_accessible_from_outside():
    req = dict(BASE, width=40, length=60, entrance="East", utility=True, study=True)
    plans = client.post("/api/generate-plan", json=req).json()["plans"]
    for plan in plans:
        graph = {"outside": set()}
        for room in plan["rooms"]:
            graph.setdefault(room["id"], set())
        for door in plan["doors"]:
            graph.setdefault(door["from"], set()).add(door["to"])
            graph.setdefault(door["to"], set()).add(door["from"])
        seen, stack = set(), ["outside"]
        while stack:
            node = stack.pop()
            if node in seen:
                continue
            seen.add(node)
            stack.extend(graph.get(node, ()))
        assert all(room["id"] in seen for room in plan["rooms"])
