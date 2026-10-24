import { afterEach, describe, it, expect, vi } from "vitest";
import { apiGenerator } from "../services/generator";
import { DEFAULT_REQUIREMENTS } from "../engine/types";
import type { FloorPlan } from "../engine/types";
import defaultModelPlan from "../examples/default-model-plan.json";

const fixture = () => structuredClone(defaultModelPlan) as FloorPlan;
afterEach(() => vi.unstubAllGlobals());

describe("joint partition generator service boundary", () => {
  it("accepts a valid model prediction", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ plans: [fixture()] }),
      }),
    );
    const plans = await apiGenerator.generate(DEFAULT_REQUIREMENTS);
    expect(plans).toHaveLength(1);
    expect(plans[0].source).toBe("model");
    expect(plans[0].modelPrediction?.checkpointEpoch).toBe(9);
  });

  it("rejects a payload that is not a model prediction", async () => {
    const plan = fixture() as FloorPlan & { modelPrediction?: FloorPlan["modelPrediction"] };
    delete plan.modelPrediction;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ plans: [plan] }) }),
    );
    await expect(apiGenerator.generate(DEFAULT_REQUIREMENTS)).rejects.toThrow(
      "validation",
    );
  });

  it("rejects mismatched plot requirements", async () => {
    const plan = fixture();
    plan.plot.width = 40;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ plans: [plan] }) }),
    );
    await expect(apiGenerator.generate(DEFAULT_REQUIREMENTS)).rejects.toThrow();
  });

  it("rejects an empty response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ plans: [] }) }),
    );
    await expect(apiGenerator.generate(DEFAULT_REQUIREMENTS)).rejects.toThrow(
      "no layouts",
    );
  });

  it("does not silently fall back after HTTP failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    await expect(apiGenerator.generate(DEFAULT_REQUIREMENTS)).rejects.toThrow(
      "service",
    );
  });
});
