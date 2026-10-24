import * as THREE from "three";
import type { FloorPlan, Room } from "./types";
import { OPEN_TYPES } from "./types";
import { getWalls, roomToWorld, splitWall } from "./geometry";
import { modelWallSegments, predictionRectangles } from "./model-prediction";
export interface ModelLayers {
  walls: boolean;
  roof: boolean;
  furniture: boolean;
}
// The software renderer shares the exact floor / wall / opening geometry with
// R3F. Only rasterization and the decorative furniture detail differ.
export function buildSoftwareModel(plan: FloorPlan, layers: ModelLayers) {
  const root = new THREE.Group();
  root.name = "FormhausHouse";
  root.position.set(-plan.plot.width / 2, 0, -plan.plot.length / 2);
  root.userData = { planId: plan.id, unit: "feet" };
  const construction = new THREE.Group();
  construction.name = "construction";
  root.add(construction);
  const floors: THREE.Mesh[] = [];
  const box = (
    parent: THREE.Object3D,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    c: string,
  ) => {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshLambertMaterial({ color: c }),
    );
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  };
  box(
    root,
    plan.plot.width / 2,
    -0.4,
    plan.plot.length / 2,
    plan.plot.width + 1,
    0.6,
    plan.plot.length + 1,
    "#d5d9c8",
  );
  if (plan.modelPrediction && !["learned-rectangles", "joint-partition", "joint-partition-multi-option"].includes(plan.modelPrediction.inferenceMode)) {
    for (const r of predictionRectangles(plan)) {
      const floor = box(
        root,
        r.x + r.width / 2,
        0,
        r.y + r.height / 2,
        r.width,
        0.12,
        r.height,
        r.colour,
      );
      floor.name = `prediction-slot-${r.slot}`;
      floor.userData = { roomId: `model-room-${r.slot}`, slot: r.slot };
      floors.push(floor);
    }
    if (layers.walls) {
      for (const w of modelWallSegments(plan)) {
        const horizontal = Math.abs(w.y2 - w.y1) < 1e-6;
        const length = horizontal ? Math.abs(w.x2 - w.x1) : Math.abs(w.y2 - w.y1);
        const thickness = w.exterior
          ? Math.max(plan.wallThickness, 0.38)
          : Math.max(plan.wallThickness * 0.72, 0.28);
        box(
          construction,
          (w.x1 + w.x2) / 2,
          plan.wallHeight / 2,
          (w.y1 + w.y2) / 2,
          horizontal ? length : thickness,
          plan.wallHeight,
          horizontal ? thickness : length,
          w.exterior ? "#f2f0e6" : "#e3e4d8",
        );
      }
    }
    return { root, construction, floors };
  }
  for (const r of plan.rooms) {
    const p = roomToWorld(r);
    const floor = box(root, p.x, 0, p.z, p.width, 0.12, p.depth, r.colour);
    floor.name = "floor-" + r.id;
    floor.userData = {
      roomId: r.id,
      roomName: r.name,
      width: r.width,
      length: r.height,
    };
    floors.push(floor);
  }
  if (layers.walls) {
    for (const w of getWalls(plan).flatMap((w) => splitWall(plan, w)))
      box(
        construction,
        w.x,
        w.bottom + w.height / 2,
        w.y,
        w.width,
        w.height,
        w.depth,
        w.exterior ? "#f2f0e6" : "#e3e4d8",
      );
    for (const w of plan.windows) {
      const group = new THREE.Group();
      group.position.set(w.x, w.sill, w.y);
      group.rotation.y = w.orientation === "vertical" ? Math.PI / 2 : 0;
      construction.add(group);
      box(group, 0, 0, 0, w.width, 0.1, 0.4, "#43656a");
      box(group, 0, w.height, 0, w.width, 0.1, 0.4, "#43656a");
      for (const x of [-w.width / 2, 0, w.width / 2])
        box(group, x, w.height / 2, 0, 0.08, w.height, 0.3, "#43656a");
      const glass = box(
        group,
        0,
        w.height / 2,
        0,
        w.width,
        w.height,
        0.025,
        "#a6d4d6",
      );
      (glass.material as THREE.MeshLambertMaterial).transparent = true;
      (glass.material as THREE.MeshLambertMaterial).opacity = 0.3;
    }
    for (const d of plan.doors.filter((d) => d.kind === "internal")) {
      const group = new THREE.Group();
      group.position.set(d.x, 0, d.y);
      group.rotation.y = d.orientation === "vertical" ? Math.PI / 2 : 0;
      construction.add(group);
      const hinge = new THREE.Group();
      hinge.position.x = -d.width / 2;
      hinge.rotation.y = -Math.PI / 3;
      group.add(hinge);
      box(hinge, d.width / 2, 3.45, 0, d.width, 6.9, 0.11, "#b69870");
    }
  }
  function furniture(r: Room) {
    const group = new THREE.Group();
    group.position.set(r.x, 0, r.y);
    construction.add(group);
    const b = (
        x: number,
        y: number,
        z: number,
        w: number,
        h: number,
        d: number,
        c: string,
      ) => box(group, x, y, z, w, h, d, c),
      w = r.width,
      d = r.height;
    if (r.type === "bedroom") {
      b(w / 2, 0.6, d / 2, 5, 0.9, 6.5, "#a18361");
      b(w / 2, 1.18, d / 2, 4.9, 0.5, 6.3, "#f8f4e9");
      b(w / 2, 1.46, d / 2 + 1, 4.95, 0.15, 3.8, "#78968e");
      b(w / 2 - 1.2, 1.5, d / 2 - 2.2, 1.9, 0.25, 1.2, "#fff9e8");
      b(w / 2 + 1.2, 1.5, d / 2 - 2.2, 1.9, 0.25, 1.2, "#fff9e8");
      b(w / 2, 1.65, d / 2 - 3.4, 5.3, 2.4, 0.3, "#ae9275");
      b(w / 2 + 3.4, 0.75, d / 2 - 2.2, 1.4, 1.5, 1.4, "#aa8965");
    }
    if (r.type === "living") {
      b(w / 2, 0.1, d / 2, Math.min(w - 1, 8), 0.08, 7, "#c1b99c");
      b(w / 2 - 2, 1, d / 2, 2.5, 1.5, 6.5, "#e2dacb");
      b(w / 2 - 3.15, 1.7, d / 2, 0.45, 2.2, 6.5, "#bdc4b0");
      b(w / 2 - 2, 1.8, d / 2 - 3.1, 2.6, 1.4, 0.4, "#bdc4b0");
      b(w / 2 - 2, 1.8, d / 2 + 3.1, 2.6, 1.4, 0.4, "#bdc4b0");
      b(w / 2 + 1.5, 0.9, d / 2, 2.6, 0.3, 3.6, "#ae845c");
      b(w / 2 + 1.5, 0.4, d / 2, 1.7, 0.8, 2.5, "#644b39");
    }
    if (r.type === "kitchen") {
      b(w / 2, 1.5, d - 1.3, w - 0.6, 3, 2, "#bac6bd");
      b(w / 2, 3.08, d - 1.3, w - 0.45, 0.18, 2.15, "#eee9dd");
      b(1.25, 1.5, d / 2, 2, 3, Math.max(3, d - 2.6), "#bac6bd");
      b(w / 2, 1.25, d / 2 - 1, 3.5, 2.5, 2.4, "#bea683");
    }
    if (r.type === "bathroom") {
      b(w - 1.4, 0.65, 1.5, 1.5, 1.3, 2.2, "#fafaf8");
      b(w - 1.4, 1.3, 0.6, 1.4, 2.1, 0.6, "#f9fbf5");
      b(1.25, 2, d - 1.2, 1.8, 0.5, 1.5, "#f9fbf5");
      b(1.4, 0.15, 1.7, 2.3, 0.2, 2.5, "#b0c6c7");
    }
    if (r.type === "parking") {
      const car = new THREE.Group();
      car.position.set(w / 2, 0, d / 2);
      car.rotation.y = w > d ? Math.PI / 2 : 0;
      group.add(car);
      box(car, 0, 1, 0, 5.4, 1.4, 11.5, "#637e80");
      box(car, 0, 2.1, 0.2, 4.9, 1, 6, "#91a7a7");
      box(car, 0, 2.65, 0.2, 4.3, 0.12, 5, "#426068");
      for (const x of [-2.7, 2.7])
        for (const z of [-3.5, 3.5])
          box(car, x, 0.7, z, 0.4, 1.5, 1.5, "#34423f");
    }
    if (["study", "pooja", "utility"].includes(r.type))
      b(w / 2, 1.4, d - 1.25, Math.min(5, w - 1), 2.8, 1.8, "#bb9f7b");
    if (r.type === "porch") {
      b(0.7, 0.7, d - 0.7, 0.9, 1.4, 0.9, "#a49071");
      const plant = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.8),
        new THREE.MeshLambertMaterial({ color: "#6d8b53" }),
      );
      plant.position.set(0.7, 1.8, d - 0.7);
      group.add(plant);
    }
  }
  if (layers.furniture) plan.rooms.forEach(furniture);
  if (layers.roof)
    for (const r of plan.rooms.filter((r) => !OPEN_TYPES.includes(r.type)))
      box(
        construction,
        r.x + r.width / 2,
        plan.wallHeight + 0.25,
        r.y + r.height / 2,
        r.width,
        0.45,
        r.height,
        "#47615b",
      );
  return { root, construction, floors };
}
export function disposeModel(root: THREE.Object3D) {
  root.traverse((o) => {
    if (o instanceof THREE.Mesh || o instanceof THREE.LineSegments) {
      o.geometry.dispose();
      for (const material of Array.isArray(o.material)
        ? o.material
        : [o.material])
        material.dispose();
    }
  });
}
