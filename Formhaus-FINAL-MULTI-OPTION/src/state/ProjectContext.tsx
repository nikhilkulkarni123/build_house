import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import type { ReactNode } from "react";
import type { FloorPlan, Requirements } from "../engine/types";
import { generatorService } from "../services/generator";
import defaultModelOptions from "../examples/default-model-options.json";

const STORAGE = "formhaus-project-v7-multi-option-joint";
const DEFAULT_MODEL_PLANS = defaultModelOptions as FloorPlan[];
function restore(): { plans: FloorPlan[]; selected: number } {
  try {
    const raw = localStorage.getItem(STORAGE);
    if (raw) {
      const data = JSON.parse(raw);
      if (
        Array.isArray(data.plans) &&
        data.plans.length > 0 &&
        data.plans.length <= 3 &&
        data.plans.every(
          (p: FloorPlan) =>
            p.schemaVersion === 1 &&
            p.source === "model" &&
            Boolean(p.modelPrediction),
        )
      )
        return {
          plans: data.plans,
          selected: Math.min(
            Math.max(Number(data.selected) || 0, 0),
            data.plans.length - 1,
          ),
        };
    }
  } catch {
    /* Corrupt or obsolete local data is replaced by a validated default. */
  }
  return { plans: structuredClone(DEFAULT_MODEL_PLANS), selected: 0 };
}
interface ProjectState {
  plans: FloorPlan[];
  plan: FloorPlan;
  selected: number;
  select: (i: number) => void;
  generate: (r: Requirements) => Promise<boolean>;
  reset: () => void;
  loading: boolean;
  error: string;
  notice: string;
  notify: (text: string) => void;
}
const Context = createContext<ProjectState | null>(null);
export function ProjectProvider({ children }: { children: ReactNode }) {
  const [initial] = useState(restore),
    [plans, setPlans] = useState(initial.plans),
    [selected, setSelected] = useState(initial.selected),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const notify = useCallback((text: string) => setNotice(text), []);
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE, JSON.stringify({ plans, selected }));
    } catch {
      setNotice(
        "Browser storage is unavailable. Download your plan JSON to keep a copy.",
      );
    }
  }, [plans, selected]);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 5000);
    return () => clearTimeout(t);
  }, [notice]);
  async function generate(r: Requirements) {
    setLoading(true);
    setError("");
    try {
      const next = await generatorService.generate(r);
      setPlans(next);
      setSelected(0);
      return true;
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Generation failed. Please try again.",
      );
      return false;
    } finally {
      setLoading(false);
    }
  }
  function reset() {
    setPlans(structuredClone(DEFAULT_MODEL_PLANS));
    setSelected(0);
    setError("");
    notify("Project reset to the bundled three learned layout alternatives.");
  }
  return (
    <Context.Provider
      value={{
        plans,
        plan: plans[selected] || plans[0],
        selected,
        select: (i) => {
          if (i >= 0 && i < plans.length) setSelected(i);
        },
        generate,
        reset,
        loading,
        error,
        notice,
        notify,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useProject() {
  const c = useContext(Context);
  if (!c) throw new Error("Missing project context");
  return c;
}
