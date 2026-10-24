import { describe, it, expect } from "vitest";
import type { FloorPlan } from "../engine/types";
import { validatePlan } from "../engine/validation";
import { getWalls } from "../engine/geometry";
import { buildSoftwareModel, disposeModel } from "../engine/scene-model";
import defaultModelPlan from "../examples/default-model-plan.json";

const sample = () => structuredClone(defaultModelPlan) as FloorPlan;

describe("Learned structured floor-plan geometry", () => {
  it("validates the bundled joint partition prediction", () => {
    const plan = sample();
    const result = validatePlan(plan);
    expect(result.valid).toBe(true);
    expect(plan.source).toBe("model");
    expect(plan.modelPrediction?.trainingImageSize).toBe(64);
    expect(plan.modelPrediction?.inferenceMode).toBe("joint-partition-multi-option");
    expect(plan.modelPrediction?.structuredBoxes?.length).toBe(plan.rooms.length);
  });

  it("keeps all joint partition rooms inside the exact plot", () => {
    const plan = sample();
    expect(plan.rooms.length).toBeGreaterThanOrEqual(4);
    for (const room of plan.rooms) {
      expect(room.x).toBeGreaterThanOrEqual(0);
      expect(room.y).toBeGreaterThanOrEqual(0);
      expect(room.x + room.width).toBeLessThanOrEqual(plan.plot.width + 1e-5);
      expect(room.y + room.height).toBeLessThanOrEqual(plan.plot.length + 1e-5);
      expect(room.width).toBeGreaterThan(0);
      expect(room.height).toBeGreaterThan(0);
    }
  });

  it("surfaces learned overlap rather than repairing placement", () => {
    const plan = sample();
    const overlap = plan.modelPrediction?.totalOverlapShare ?? 0;
    expect(overlap).toBeGreaterThanOrEqual(0);
    expect(overlap).toBeLessThan(0.03);
    expect(plan.notes.some((n) => n.includes("does not use room packing"))).toBe(true);
  });

  it("builds orthogonal drawing walls from the joint partition rooms", () => {
    const plan = sample();
    const walls = getWalls(plan);
    expect(walls.length).toBeGreaterThan(4);
    expect(walls.every((w) => w.orientation === "horizontal" || w.orientation === "vertical")).toBe(true);
  });

  it("software 3D uses the same joint partition geometry", () => {
    const plan = sample();
    const model = buildSoftwareModel(plan, {
      walls: true,
      roof: false,
      furniture: false,
    });
    try {
      expect(model.floors).toHaveLength(plan.rooms.length);
      expect(model.construction.children.length).toBeGreaterThan(0);
    } finally {
      disposeModel(model.root);
    }
  });
});
