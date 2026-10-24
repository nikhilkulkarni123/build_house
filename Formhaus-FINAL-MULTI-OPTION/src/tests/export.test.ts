import { it, expect, vi } from "vitest";
import type { FloorPlan } from "../engine/types";
import { predictionRectangles } from "../engine/model-prediction";
import { buildSoftwareModel, disposeModel } from "../engine/scene-model";
import { serializeGLB } from "../services/export-glb";
import defaultModelPlan from "../examples/default-model-plan.json";

it("exports the model-derived footprint as a binary GLB", async () => {
  class Reader {
    result: ArrayBuffer | null = null;
    onloadend: (() => void) | null = null;
    readAsArrayBuffer(blob: Blob) {
      void blob.arrayBuffer().then((buffer) => {
        this.result = buffer;
        this.onloadend?.();
      });
    }
  }
  vi.stubGlobal("FileReader", Reader);
  const plan = structuredClone(defaultModelPlan) as FloorPlan;
  const model = buildSoftwareModel(plan, {
    walls: true,
    roof: false,
    furniture: false,
  });
  try {
    const binary = await serializeGLB(model.root);
    const header = new DataView(binary);
    expect(header.getUint32(0, true)).toBe(0x46546c67);
    expect(header.getUint32(4, true)).toBe(2);
    expect(header.getUint32(8, true)).toBe(binary.byteLength);
    expect(binary.byteLength).toBeGreaterThan(10000);
    expect(model.floors).toHaveLength(predictionRectangles(plan).length);
  } finally {
    disposeModel(model.root);
    vi.unstubAllGlobals();
  }
});
