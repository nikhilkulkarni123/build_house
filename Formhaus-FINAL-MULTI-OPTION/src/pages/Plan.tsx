import { useState, useRef } from "react";
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Download,
  Box,
  ArrowRight,
  Check,
  FileJson,
  Move,
  Maximize2,
} from "lucide-react";
import { useProject } from "../state/ProjectContext";
import { PlanSVG, dimension } from "../components/PlanSVG";
import { ValidationPanel } from "../components/ValidationPanel";
import { validatePlan } from "../engine/validation";
import { downloadJSON, downloadPNG } from "../services/downloads";
import type { Room } from "../engine/types";
import { modelRoomAt, modelSlotForRoom } from "../engine/model-prediction";
export function Plan() {
  const { plan, plans, selected, select, notify } = useProject();
  const [zoom, setZoom] = useState(1),
    [pan, setPan] = useState({ x: 0, y: 0 }),
    [room, setRoom] = useState<Room | null>(null),
    [exporting, setExporting] = useState(false);
  const svg = useRef<SVGSVGElement>(null),
    drag = useRef<{ x: number; y: number; px: number; py: number } | null>(
      null,
    );
  const validation = validatePlan(plan),
    selectedModelSlot = room ? modelSlotForRoom(plan, room.id) : null,
    vw = (plan.plot.width + 14) / zoom,
    vh = (plan.plot.length + 14) / zoom;
  const viewBox = `${(plan.plot.width - vw) / 2 + pan.x} ${(plan.plot.length - vh) / 2 + pan.y} ${vw} ${vh}`;
  function resetView() {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }
  async function png() {
    if (!svg.current) return;
    setExporting(true);
    try {
      await downloadPNG(svg.current, plan);
      notify("Your 2D drawing has been downloaded.");
    } catch (e) {
      notify(e instanceof Error ? e.message : "Image export failed.");
    } finally {
      setExporting(false);
    }
  }
  return (
    <div className="page-width work-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">02 / DISCOVER YOUR LAYOUT</div>
          <h1>
            Every space, <em>considered.</em>
          </h1>
          <p>
            Compare your alternatives, inspect the details, and choose a design.
          </p>
        </div>
        <a href="#/generate" className="button outline">
          <RotateCcw size={16} /> Edit requirements
        </a>
      </div>
      <div className="plan-layout">
        <aside className="alternatives">
          <div className="aside-title">
            YOUR DESIGNS <span>{plans.length}</span>
          </div>
          {plans.map((p, i) => (
            <button
              className={"alternative " + (selected === i ? "selected" : "")}
              key={p.id}
              onClick={() => {
                select(i);
                setRoom(null);
                resetView();
              }}
              aria-pressed={selected === i}
            >
              <div className="alternative-thumbnail">
                <PlanSVG plan={p} mini />
                {selected === i && (
                  <span className="selected-check">
                    <Check size={15} />
                  </span>
                )}
              </div>
              <span className="alternative-name">
                <span>0{i + 1}</span>
                <strong>{p.name}</strong>
              </span>
              <span className="alternative-foot">
                {p.requirements.bedrooms} BHK · Score {Math.round(p.modelPrediction?.candidateScore ?? 0)}
                <span>
                  {p.modelPrediction?.candidateMetrics?.allReachable ? "Accessible" : "Review access"} <Check size={12} />
                </span>
              </span>
            </button>
          ))}
          <a href="#/generate" className="another-design">
            Generate another plan <ArrowRight size={15} />
          </a>
        </aside>
        <div className="plan-main">
          <section className="drawing-card">
            <div className="drawing-toolbar">
              <div>
                <span className="drawing-title">{plan.name}</span>
                <span className="drawing-subtitle">
                  {plan.plot.width}′ × {plan.plot.length}′ ·{" "}
                  {plan.plot.entrance}-facing · AI score {Math.round(plan.modelPrediction?.candidateScore ?? 0)}
                </span>
              </div>
              <div className="toolbar-buttons">
                <button
                  aria-label="Zoom out"
                  onClick={() => setZoom((z) => Math.max(0.65, z - 0.2))}
                >
                  <ZoomOut size={18} />
                </button>
                <span>{Math.round(zoom * 100)}%</span>
                <button
                  aria-label="Zoom in"
                  onClick={() => setZoom((z) => Math.min(3, z + 0.2))}
                >
                  <ZoomIn size={18} />
                </button>
                <i />
                <button aria-label="Reset plan view" onClick={resetView}>
                  <Maximize2 size={18} />
                </button>
              </div>
            </div>
            <div
              className="plan-canvas"
              onWheel={(e) =>
                setZoom((z) =>
                  Math.max(
                    0.65,
                    Math.min(3, z + (e.deltaY < 0 ? 0.08 : -0.08)),
                  ),
                )
              }
              onPointerDown={(e) => {
                if (e.button !== 0) return;
                drag.current = {
                  x: e.clientX,
                  y: e.clientY,
                  px: pan.x,
                  py: pan.y,
                };
                e.currentTarget.setPointerCapture(e.pointerId);
              }}
              onPointerMove={(e) => {
                if (!drag.current) return;
                const rect = e.currentTarget.getBoundingClientRect();
                const unit = Math.max(vw / rect.width, vh / rect.height);
                setPan({
                  x: drag.current.px - (e.clientX - drag.current.x) * unit,
                  y: drag.current.py - (e.clientY - drag.current.y) * unit,
                });
              }}
              onPointerUp={(e) => {
                if (
                  drag.current &&
                  Math.hypot(
                    e.clientX - drag.current.x,
                    e.clientY - drag.current.y,
                  ) < 4
                ) {
                  const rect = e.currentTarget.getBoundingClientRect(),
                    scale = Math.min(rect.width / vw, rect.height / vh);
                  const x =
                      (e.clientX - rect.left - (rect.width - vw * scale) / 2) /
                        scale +
                      (plan.plot.width - vw) / 2 +
                      pan.x,
                    y =
                      (e.clientY - rect.top - (rect.height - vh * scale) / 2) /
                        scale +
                      (plan.plot.length - vh) / 2 +
                      pan.y;
                  setRoom(
                    plan.modelPrediction && !["learned-rectangles", "joint-partition", "joint-partition-multi-option"].includes(plan.modelPrediction.inferenceMode)
                      ? modelRoomAt(plan, x, y)
                      : plan.rooms.find(
                          (r) => x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height,
                        ) || null,
                  );
                }
                drag.current = null;
              }}
              onPointerCancel={() => {
                drag.current = null;
              }}
            >
              <PlanSVG
                ref={svg}
                plan={plan}
                viewBox={viewBox}
                selectedRoom={room?.id}
              />
              <div className="canvas-watermark">
                FORMHAUS <span>/ CONCEPT DRAWING</span>
              </div>
            </div>
            <div className="drawing-legend">
              {["learned-rectangles", "joint-partition", "joint-partition-multi-option"].includes(plan.modelPrediction?.inferenceMode || "") ? (
                <>
                  <span>Joint learned partition · shared walls · 100% assigned · no semantic placement rules</span>
                  <span className="drawing-instruction"><Move size={13} /> Drag to pan · Select a predicted room</span>
                </>
              ) : plan.modelPrediction ? (
                <>
                  <span>Legacy segmentation prediction · {plan.modelPrediction.imageSize}×{plan.modelPrediction.imageSize} inference grid</span>
                  <span className="drawing-instruction"><Move size={13} /> Drag to pan · Select a predicted room</span>
                </>
              ) : (
                <>
                  <span><i className="legend-wall" /> Wall</span>
                  <span><i className="legend-window" /> Window</span>
                  <span><i className="legend-door" /> Door</span>
                  <span className="drawing-instruction"><Move size={13} /> Drag to pan · Select a room</span>
                </>
              )}
            </div>
          </section>
          <div className="plan-actions">
            <button
              className="button outline"
              disabled={exporting}
              onClick={png}
            >
              <Download size={17} />
              {exporting ? "Preparing PNG…" : "Download PNG"}
            </button>
            <button
              className="button outline"
              onClick={() => {
                downloadJSON(plan);
                notify("Plan JSON downloaded.");
              }}
            >
              <FileJson size={17} /> Save JSON
            </button>
            <a
              href="#/viewer"
              className="button primary"
              onClick={() => {
                window.location.hash = "/viewer";
              }}
            >
              <Box size={17} /> Convert to 3D <ArrowRight size={17} />
            </a>
          </div>
          {room && (
            <div className="room-info-inline">
              <span style={{ background: room.colour }} />
              <strong>{room.name}</strong>
              <p>
                {selectedModelSlot ? "Model-predicted region" : `${dimension(room.width)} × ${dimension(room.height)} ft`}
              </p>
              <b>{Math.round(selectedModelSlot?.areaSqFt ?? room.width * room.height)} sq ft</b>
            </div>
          )}
          <ValidationPanel result={validation} />
        </div>
      </div>
    </div>
  );
}
