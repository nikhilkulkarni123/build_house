import { useState, useRef, useCallback } from "react";
import {
  Box,
  Layers3,
  RotateCcw,
  Sun,
  Moon,
  Armchair,
  Home,
  PanelTop,
  Download,
  Play,
  Pause,
  Maximize,
  MousePointer2,
  Move,
  ArrowLeft,
  LoaderCircle,
  X,
  Check,
  Info,
} from "lucide-react";
import { useProject } from "../state/ProjectContext";
import { HouseScene } from "../components/HouseScene";
import type { SceneHandle } from "../components/HouseScene";
import type { Room } from "../engine/types";
import { dimension } from "../components/PlanSVG";
import { validatePlan } from "../engine/validation";
import { modelSlotForRoom } from "../engine/model-prediction";
export function Viewer() {
  const { plan, plans, selected, select, notify } = useProject();
  const [roof, setRoof] = useState(false),
    [walls, setWalls] = useState(true),
    [furniture, setFurniture] = useState(true),
    [night, setNight] = useState(false),
    [top, setTop] = useState(false),
    [rotate, setRotate] = useState(false),
    [flat, setFlat] = useState(false),
    [replay, setReplay] = useState(0),
    [resetKey, setResetKey] = useState(0),
    [room, setRoom] = useState<Room | null>(null),
    [ready, setReady] = useState(false),
    [exporting, setExporting] = useState(false);
  const scene = useRef<SceneHandle>(null);
  const onReady = useCallback((r: boolean) => setReady(r), []);
  const validation = validatePlan(plan);
  const selectedModelSlot = room ? modelSlotForRoom(plan, room.id) : null;
  const modelOnly = Boolean(plan.modelPrediction && !["learned-rectangles", "joint-partition", "joint-partition-multi-option"].includes(plan.modelPrediction.inferenceMode));
  async function exportModel() {
    setExporting(true);
    try {
      if (!scene.current) throw new Error("The scene is not ready.");
      await scene.current.exportGLB();
      notify("3D house exported as GLB, with real-world dimensions in meters.");
    } catch (e) {
      notify(e instanceof Error ? e.message : "Export failed.");
    } finally {
      setExporting(false);
    }
  }
  return (
    <div className="page-width work-page viewer-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">03 / A NEW PERSPECTIVE</div>
          <h1>
            Welcome to <em>your home.</em>
          </h1>
          <p>Explore the space, one angle at a time.</p>
        </div>
        <a href="#/plan" className="button outline">
          <ArrowLeft size={16} /> Back to 2D plan
        </a>
      </div>
      <section className="viewer-shell">
        <div className="viewer-topbar">
          <div className="viewer-design">
            <Box size={21} />
            <div>
              <strong>{plan.name}</strong>
              <span>
                {plan.requirements.bedrooms} BHK · {plan.plot.width} ×{" "}
                {plan.plot.length} ft
              </span>
            </div>
          </div>
          <div className="viewer-option-picker" role="group" aria-label="AI layout alternative">
            {plans.map((candidate, i) => (
              <button
                key={candidate.id}
                className={selected === i ? "active" : ""}
                aria-pressed={selected === i}
                onClick={() => {
                  select(i);
                  setRoom(null);
                  setResetKey((k) => k + 1);
                }}
              >
                Option {i + 1}
              </button>
            ))}
          </div>
          <div className="segmented viewer-tabs">
            <button
              className={!top ? "active" : ""}
              aria-pressed={!top}
              onClick={() => setTop(false)}
            >
              <Box size={15} /> Perspective
            </button>
            <button
              className={top ? "active" : ""}
              aria-pressed={top}
              onClick={() => setTop(true)}
            >
              <PanelTop size={15} /> Top view
            </button>
          </div>
          <button
            className="button primary export-glb"
            onClick={exportModel}
            disabled={!ready || exporting}
          >
            {exporting ? (
              <LoaderCircle className="spin" size={16} />
            ) : (
              <Download size={16} />
            )}{" "}
            {exporting ? "Exporting…" : "Export GLB"}
          </button>
        </div>
        <div className={"viewer-canvas " + (night ? "night" : "")}>
          {plan.rooms && plan.rooms.length > 0 ? (
            <HouseScene
              ref={scene}
              plan={plan}
              roof={roof}
              walls={walls}
              furniture={furniture}
              night={night}
              top={top}
              rotate={rotate}
              flat={flat}
              replay={replay}
              resetKey={resetKey}
              labels={!roof}
              selected={room?.id}
              onSelect={setRoom}
              onReady={onReady}
            />
          ) : (
            <div className="error-message">
              This plan has no rooms to display. Return to the generator to create a
              valid layout.
            </div>
          )}
          <div className="scene-controls glass">
            <span className="controls-title">SCENE LAYERS</span>
            {[
              {
                label: "Walls",
                icon: Layers3,
                value: walls,
                fn: () => setWalls(!walls),
              },
              ...(!modelOnly ? [
                {
                  label: "Furniture",
                  icon: Armchair,
                  value: furniture,
                  fn: () => setFurniture(!furniture),
                },
                {
                  label: "Roof",
                  icon: Home,
                  value: roof,
                  fn: () => setRoof(!roof),
                },
              ] : []),
            ].map((c) => (
              <button
                role="switch"
                aria-checked={c.value}
                key={c.label}
                onClick={c.fn}
              >
                <c.icon size={17} />
                <span>{c.label}</span>
                <span className={"toggle " + (c.value ? "on" : "")} />
              </button>
            ))}
            <div className="controls-separator" />
            <button
              onClick={() => setNight(!night)}
              aria-label={night ? "Switch to day mode" : "Switch to night mode"}
            >
              {night ? <Moon size={17} /> : <Sun size={17} />}
              <span>{night ? "Night mode" : "Day mode"}</span>
              <span className="mode-tag">{night ? "PM" : "AM"}</span>
            </button>
          </div>
          <div className="camera-controls glass">
            <button
              aria-label="Reset camera"
              title="Reset camera"
              onClick={() => {
                setTop(false);
                setResetKey((k) => k + 1);
              }}
            >
              <Maximize size={18} />
            </button>
            <button
              aria-label={rotate ? "Pause rotation" : "Start rotation"}
              title="Auto-rotate"
              onClick={() => setRotate(!rotate)}
            >
              {rotate ? <Pause size={18} /> : <Play size={18} />}
            </button>
            <button
              aria-label="Replay wall construction"
              title="Replay construction"
              onClick={() => {
                setFlat(false);
                setReplay((k) => k + 1);
              }}
            >
              <RotateCcw size={18} />
            </button>
          </div>
          {room && (
            <div className="room-detail glass">
              <div>
                <span className="eyebrow">ROOM DETAILS</span>
                <button
                  aria-label="Close room details"
                  onClick={() => setRoom(null)}
                >
                  <X size={16} />
                </button>
              </div>
              <h3>{room.name}</h3>
              <div className="room-detail-metrics">
                <p>
                  <strong>
                    {selectedModelSlot && ["learned-rectangles", "joint-partition", "joint-partition-multi-option"].includes(plan.modelPrediction?.inferenceMode || "") ? `${dimension(room.width)} × ${dimension(room.height)}` : selectedModelSlot ? "MODEL REGION" : `${dimension(room.width)} × ${dimension(room.height)}`}
                  </strong>
                  <span>{selectedModelSlot && ["learned-rectangles", "joint-partition", "joint-partition-multi-option"].includes(plan.modelPrediction?.inferenceMode || "") ? "joint learned partition · ft" : selectedModelSlot ? "checkpoint-predicted geometry" : "dimensions · ft"}</span>
                </p>
                <p>
                  <strong>{Math.round(selectedModelSlot?.areaSqFt ?? room.width * room.height)}</strong>
                  <span>area · sq ft</span>
                </p>
              </div>
            </div>
          )}
          <div className="scene-compass">
            <span>N</span>
            <div>✦</div>
            <span>S</span>
          </div>
          <div className="scene-caption">
            <span className="live-dot" />
            {flat ? "2D FOOTPRINT" : "LIVE 3D MODEL"}
            <span className="caption-line" /> {plan.plot.entrance.toUpperCase()}{" "}
            ENTRANCE
          </div>
        </div>
        <div className="viewer-bottom">
          <div className="viewer-hints">
            <span>
              <MousePointer2 size={14} /> Drag to orbit
            </span>
            <span>
              <Move size={14} /> Right-drag to pan
            </span>
            <span>Scroll to zoom</span>
          </div>
          <button
            className="button transform-button"
            onClick={() => {
              setFlat(!flat);
              setRoof(false);
            }}
          >
            <Layers3 size={16} />
            {flat ? "Build into 3D" : "Animate to 2D"}
            <Play size={14} />
          </button>
        </div>
      </section>
      <div className="viewer-summary">
        <div>
          <span className="success-pill">
            <Check size={15} />{" "}
            {validation.valid ? "Geometry verified" : "Validation failed"}
          </span>
          <p>One shared plan. Identical coordinates in both views.</p>
        </div>
        <span>
          <Info size={15} /> Click a room floor to inspect its dimensions.
        </span>
      </div>
      <div className="room-schedule">
        <div className="section-heading">
          <h2>A place for everything.</h2>
          <span>{plan.rooms.length} model-predicted spaces</span>
        </div>
        <div className="room-chips">
          {plan.rooms.map((r) => (
            <button
              key={r.id}
              className={room?.id === r.id ? "selected" : ""}
              onClick={() => setRoom(r)}
            >
              <i style={{ background: r.colour }} />
              <span>{r.name}</span>
              <small>{Math.round(modelSlotForRoom(plan, r.id)?.areaSqFt ?? r.width * r.height)} sq ft</small>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
