import { validatePlan } from "../engine/validation";
import type { FloorPlan, Requirements } from "../engine/types";

export interface GeneratorService {
  generate(
    requirements: Requirements,
    signal?: AbortSignal,
  ): Promise<FloorPlan[]>;
}

/**
 * Production generation path for this project.
 * Room sites/areas/connectivity are returned by the trained PyTorch service.
 * The backend jointly partitions the plot from those learned signals; there is intentionally no semantic placement-template fallback.
 */
export const apiGenerator: GeneratorService = {
  async generate(requirements, signal) {
    const res = await fetch("/api/generate-plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requirements),
      signal,
    });
    if (!res.ok) {
      let message = "The model service could not generate a plan.";
      try {
        const err = await res.json();
        const detail = err?.detail;
        if (typeof detail === "string") message = detail;
        else if (detail?.message) {
          message = detail.message;
          if (Array.isArray(detail.unsupported) && detail.unsupported.length)
            message += " Unsupported: " + detail.unsupported.join(", ") + ".";
        }
      } catch {
        /* keep generic error */
      }
      throw new Error(message);
    }
    const data: unknown = await res.json();
    if (
      !data ||
      typeof data !== "object" ||
      !("plans" in data) ||
      !Array.isArray(data.plans)
    )
      throw new Error("Invalid model response.");
    const plans: FloorPlan[] = data.plans.map((raw) => {
      try {
        if (
          raw.schemaVersion !== 1 ||
          !Array.isArray(raw.rooms) ||
          !Array.isArray(raw.doors) ||
          !Array.isArray(raw.windows) ||
          !raw.plot ||
          !raw.requirements ||
          !raw.modelPrediction
        )
          throw new Error();
        const plan = {
          ...raw,
          source: "model",
          requirements: { ...requirements },
        } as FloorPlan;
        const validation = validatePlan(plan);
        const hardFailures = validation.checks.filter(
          (check) => check.status === "fail" && check.id !== "feasibility",
        );
        if (
          plan.plot.width !== requirements.width ||
          plan.plot.length !== requirements.length ||
          plan.plot.entrance !== requirements.entrance ||
          hardFailures.length > 0
        )
          throw new Error();
        // Compact-plot feasibility is intentionally allowed through so the user
        // can inspect the model prediction and see exactly which learned rooms
        // are undersized. Formhaus never fixes those rooms with placement rules.
        return plan;
      } catch {
        throw new Error(
          "A learned model prediction failed structured-geometry validation.",
        );
      }
    });
    if (!plans.length) throw new Error("The model returned no layouts.");
    return plans.slice(0, 3);
  },
};

export const generatorService: GeneratorService = apiGenerator;
