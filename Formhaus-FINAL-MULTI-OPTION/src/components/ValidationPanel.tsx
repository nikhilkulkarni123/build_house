import { useState } from "react";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ChevronDown,
  ShieldCheck,
} from "lucide-react";
import type { ValidationResult } from "../engine/types";
export function ValidationPanel({
  result,
  compact = false,
}: {
  result: ValidationResult;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(!compact),
    passed = result.checks.filter((c) => c.status === "pass").length;
  return (
    <section
      className={"validation-panel " + (result.valid ? "" : "invalid")}
      aria-label="Plan validation"
    >
      <button
        className="validation-heading"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <span className="validation-icon">
          <ShieldCheck size={21} />
        </span>
        <span>
          <strong>
            {result.valid ? "Design checks passed" : "Design needs attention"}
          </strong>
          <small>
            {passed} passed ·{" "}
            {result.checks.filter((c) => c.status === "warning").length}{" "}
            advisory notes
          </small>
        </span>
        <ChevronDown className={open ? "rotated" : ""} size={18} />
      </button>
      {open && (
        <div className="validation-checks">
          {result.checks.map((c) => (
            <div className={"check " + c.status} key={c.id}>
              {c.status === "pass" ? (
                <CheckCircle2 size={16} />
              ) : c.status === "fail" ? (
                <XCircle size={16} />
              ) : (
                <AlertTriangle size={16} />
              )}
              <div>
                <strong>{c.label}</strong>
                <p>{c.detail}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
