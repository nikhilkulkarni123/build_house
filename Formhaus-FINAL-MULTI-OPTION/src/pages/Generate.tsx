import { useState, useEffect } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  Car,
  BookOpen,
  Flame,
  Leaf,
  WashingMachine,
  LoaderCircle,
  Ruler,
  BedDouble,
  Bath,
  Compass,
  Check,
  Info,
} from "lucide-react";
import { useProject } from "../state/ProjectContext";
import type { Requirements, Direction } from "../engine/types";
import { PlanSVG } from "../components/PlanSVG";
import { ValidationPanel } from "../components/ValidationPanel";
import { validatePlan } from "../engine/validation";
export function Generate() {
  const { plan, generate, loading, error } = useProject();
  const [form, setForm] = useState<Requirements>({ ...plan.requirements });
  useEffect(() => setForm({ ...plan.requirements }), [plan.id]);
  const optionalSlots = [form.parking, form.utility, form.study, form.pooja, form.openSpace].filter(Boolean).length;
  const requestedSlots = form.bedrooms + form.bathrooms + 2 + optionalSlots;
  const overCapacity = requestedSlots > 8;
  const change = <K extends keyof Requirements>(
    key: K,
    value: Requirements[K],
  ) => setForm((prev) => ({ ...prev, [key]: value }));
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (await generate(form)) window.location.hash = "/plan";
  }
  return (
    <div className="page-width work-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">01 / DEFINE YOUR SPACE</div>
          <h1>
            Great homes start <em>with you.</em>
          </h1>
          <p>Tell us what you need. The AI will return three ranked, structurally distinct layout alternatives.</p>
        </div>
        <span className="engine-tag">
          <span className="live-dot" /> Final multi-option AI · 3 ranked joint-partition alternatives
        </span>
      </div>
      <div className="generate-layout">
        <form className="requirements-card" onSubmit={submit}>
          <div className="card-header">
            <Ruler size={20} />
            <h2>Your requirements</h2>
            <span>IN FEET</span>
          </div>
          <fieldset>
            <legend>
              <span>01</span> Plot dimensions
            </legend>
            <div className="field-grid">
              <label>
                Plot width
                <div className="input-unit">
                  <input
                    aria-label="Plot width in feet"
                    type="number"
                    min="12"
                    max="100"
                    step=".5"
                    required
                    value={form.width || ""}
                    onChange={(e) => change("width", Number(e.target.value))}
                  />
                  <span>ft</span>
                </div>
              </label>
              <label>
                Plot length
                <div className="input-unit">
                  <input
                    aria-label="Plot length in feet"
                    type="number"
                    min="12"
                    max="100"
                    step=".5"
                    required
                    value={form.length || ""}
                    onChange={(e) => change("length", Number(e.target.value))}
                  />
                  <span>ft</span>
                </div>
              </label>
            </div>
            <div className="area-hint">
              <Ruler size={14} />{" "}
              {Number.isFinite(form.width * form.length)
                ? (form.width * form.length).toLocaleString()
                : 0}{" "}
              sq ft of possibility
            </div>
            {(form.width < 20 || form.length < 20) && (
              <div className="area-hint capacity-over">
                <Info size={14} /> Compact plot mode: the model will still predict from the exact dimensions, then Formhaus will flag rooms that are too small instead of resizing them with rules.
              </div>
            )}
          </fieldset>
          <fieldset>
            <legend>
              <span>02</span> The essentials
            </legend>
            <div className="field-grid">
              <div>
                <label className="field-label">
                  <BedDouble size={15} /> Bedrooms
                </label>
                <div
                  className="segmented"
                  role="group"
                  aria-label="Number of bedrooms"
                >
                  {([1, 2, 3] as const).map((n) => (
                    <button
                      type="button"
                      className={form.bedrooms === n ? "active" : ""}
                      aria-pressed={form.bedrooms === n}
                      key={n}
                      onClick={() => change("bedrooms", n)}
                    >
                      {n} BHK
                    </button>
                  ))}
                </div>
              </div>
              <label>
                <span className="field-label">
                  <Bath size={15} /> Bathrooms
                </span>
                <select
                  value={form.bathrooms}
                  onChange={(e) => change("bathrooms", Number(e.target.value))}
                  aria-label="Number of bathrooms"
                >
                  {[1, 2, 3].map((n) => (
                    <option key={n} value={n}>
                      {n} {n === 1 ? "bathroom" : "bathrooms"}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="field-label entrance-label">
              <Compass size={15} /> Entrance direction
            </label>
            <div
              className="segmented directions"
              role="group"
              aria-label="Entrance direction"
            >
              {(["North", "South", "East", "West"] as Direction[]).map((d) => (
                <button
                  type="button"
                  className={form.entrance === d ? "active" : ""}
                  aria-pressed={form.entrance === d}
                  key={d}
                  onClick={() => change("entrance", d)}
                >
                  {d}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>
              <span>03</span> Make room for more
            </legend>
            <div className="options-grid">
              {(
                [
                  { key: "parking", label: "Parking", icon: Car },
                  {
                    key: "utility",
                    label: "Utility room",
                    icon: WashingMachine,
                  },
                  { key: "study", label: "Study room", icon: BookOpen },
                  { key: "pooja", label: "Pooja room", icon: Flame },
                  {
                    key: "openSpace",
                    label: "Balcony / open space",
                    icon: Leaf,
                  },
                ] as const
              ).map((o) => (
                <label
                  className={"option " + (form[o.key] ? "selected" : "")}
                  key={o.key}
                >
                  <o.icon size={19} />
                  <span>{o.label}</span>
                  <input
                    type="checkbox"
                    checked={form[o.key]}
                    onChange={(e) => change(o.key, e.target.checked)}
                  />
                  <span className="check-box" aria-hidden="true">
                    {form[o.key] && <Check size={13} />}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className={"area-hint " + (overCapacity ? "capacity-over" : "")}>
            <Info size={14} /> {requestedSlots}/8 learned room slots selected
          </div>
          {overCapacity && (
            <div role="alert" className="error-message">
              <Info size={19} /> The supplied teacher checkpoint supports at most 8 requested spaces in one plan. Deselect {requestedSlots - 8} optional space{requestedSlots - 8 === 1 ? "" : "s"} or reduce room counts.
            </div>
          )}
          {error && (
            <div role="alert" className="error-message">
              <Info size={19} />
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={loading || overCapacity}
            className="button primary generate-submit"
          >
            {loading ? (
              <>
                <LoaderCircle className="spin" size={19} /> Checking your
                layouts…
              </>
            ) : (
              <>
                Generate Plan <ArrowUpRight size={19} />
              </>
            )}
          </button>
          <p className="form-footnote">
            The final model predicts learned room sites/areas and connectivity, then decodes them jointly into one orthogonal partition. Requested rooms plus Passage cover 100% of the plot with shared walls, zero overlap and no unexplained white space. No room-type preferred-side, row or adjacency templates are used.
          </p>
        </form>
        <div className="generate-preview">
          <div className="preview-heading">
            <div>
              <span className="eyebrow">YOUR CURRENT DESIGN</span>
              <h2>A place to begin.</h2>
            </div>
            <span className="pill">{plan.requirements.bedrooms} BHK</span>
          </div>
          <div className="generate-drawing">
            <PlanSVG plan={plan} />
          </div>
          <div className="drawing-meta">
            <span>
              <strong>
                {plan.plot.width} × {plan.plot.length}
              </strong>{" "}
              ft plot
            </span>
            <span>
              <strong>{plan.plot.entrance}</strong> entrance
            </span>
            <a href="#/plan">
              Open plan <ArrowRight size={16} />
            </a>
          </div>
          <ValidationPanel result={validatePlan(plan)} compact />
          <div className="design-tip">
            <span>DESIGN NOTE</span>
            <p>
              More isn’t always better. A well-sized room and a short, connected
              passage can make a compact home feel generous.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
