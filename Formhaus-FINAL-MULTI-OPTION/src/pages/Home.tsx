import { useState, useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowUpRight,
  ArrowRight,
  MousePointer2,
  Move3D,
  Layers3,
  Ruler,
  ShieldCheck,
  Box,
  Download,
  Compass,
  Play,
  Pause,
} from "lucide-react";
import { useProject } from "../state/ProjectContext";
import { HouseScene } from "../components/HouseScene";
import { PlanSVG } from "../components/PlanSVG";
export function Home() {
  const { plan } = useProject(),
    [flat, setFlat] = useState(true),
    [rotate, setRotate] = useState(true),
    [mode, setMode] = useState<"3d" | "2d">("3d");
  const reduced = useReducedMotion();
  useEffect(() => {
    const t = setTimeout(() => setFlat(false), reduced ? 0 : 1200);
    return () => clearTimeout(t);
  }, [reduced]);
  return (
    <>
      <section className="home-hero page-width">
        <motion.div
          className="hero-copy"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65 }}
        >
          <div className="eyebrow">
            <span className="tiny-rule" /> THE INTELLIGENT DESIGN STUDIO
          </div>
          <h1>
            Transform Your
            <br />
            Requirements into
            <br />
            <em>Intelligent 3D</em>
            <br />
            Home Designs<span className="gold-dot">.</span>
          </h1>
          <p>
            A space to imagine what comes next. Create a considered floor plan,
            explore every room, and see your home take shape.
          </p>
          <div className="hero-actions">
            <a className="button primary" href="#/generate">
              Generate Your Plan <ArrowUpRight size={18} />
            </a>
            <a className="text-link" href="#/viewer">
              Explore 3D <ArrowRight size={17} />
            </a>
          </div>
          <div className="hero-proof">
            <span>
              <ShieldCheck size={16} /> Validated layouts
            </span>
            <span>
              <Layers3 size={16} /> 2D + 3D, connected
            </span>
          </div>
        </motion.div>
        <motion.div
          className="hero-model"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1 }}
        >
          <div className="model-topline">
            <span className="model-caption">
              <span className="live-dot" /> YOUR HOME, IN PERSPECTIVE
            </span>
            <div className="segmented small">
              <button
                className={mode === "3d" ? "active" : ""}
                onClick={() => setMode("3d")}
              >
                3D
              </button>
              <button
                className={mode === "2d" ? "active" : ""}
                onClick={() => setMode("2d")}
              >
                2D
              </button>
            </div>
          </div>
          <div className="hero-canvas">
            {mode === "3d" ? (
              <HouseScene
                plan={plan}
                hero
                flat={flat}
                rotate={rotate && !reduced}
              />
            ) : (
              <PlanSVG plan={plan} />
            )}
          </div>
          <div className="model-badge">
            <span className="model-badge-icon">
              <Compass size={22} />
            </span>
            <div>
              <strong>
                {plan.requirements.bedrooms} BHK · {plan.plot.width} ×{" "}
                {plan.plot.length} ft
              </strong>
              <small>{plan.plot.entrance}-facing residence</small>
            </div>
            <span className="badge-label">CONCEPT 01</span>
          </div>
          <div className="hero-model-footer">
            <span>
              <MousePointer2 size={14} /> Drag to orbit{" "}
              <span className="separator">/</span> Scroll to zoom
            </span>
            <div>
              <button
                aria-label={
                  rotate
                    ? "Pause automatic rotation"
                    : "Start automatic rotation"
                }
                title="Automatic rotation"
                onClick={() => setRotate(!rotate)}
              >
                {rotate ? <Pause size={15} /> : <Play size={15} />}
              </button>
              <button
                onClick={() => {
                  setMode("3d");
                  setFlat(!flat);
                }}
                className="transform-link"
              >
                <Layers3 size={15} />
                {flat ? "Build in 3D" : "Flatten plan"}
              </button>
            </div>
          </div>
        </motion.div>
      </section>
      <section className="facts-strip page-width">
        <div>
          <span className="fact-number">01 — 03</span>
          <span>Bedrooms, tailored to you</span>
        </div>
        <div>
          <span className="fact-number">One plan.</span>
          <span>Two ways to experience it</span>
        </div>
        <div>
          <span className="fact-number">Every room.</span>
          <span>Connected and checked</span>
        </div>
        <div className="facts-note">
          <Ruler size={25} />
          <p>
            Designed around your plot.
            <br />
            <strong>Built around your life.</strong>
          </p>
        </div>
      </section>
      <section className="process-section page-width">
        <div className="section-heading">
          <div>
            <div className="eyebrow">FROM POSSIBILITY TO PERSPECTIVE</div>
            <h2>Your idea. A clearer picture.</h2>
          </div>
          <a href="#/how-it-works" className="text-link">
            Inside the process <ArrowUpRight size={17} />
          </a>
        </div>
        <div className="process-grid">
          {[
            {
              icon: Ruler,
              title: "Define your space",
              text: "Your plot, your rooms, your priorities.",
            },
            {
              icon: Layers3,
              title: "Discover a layout",
              text: "Explore up to three practical alternatives.",
            },
            {
              icon: ShieldCheck,
              title: "Check the details",
              text: "Room sizes, openings, and access validated.",
            },
            {
              icon: Box,
              title: "Step into 3D",
              text: "Watch the walls rise. Explore every angle.",
            },
            {
              icon: Download,
              title: "Make it yours",
              text: "Save your drawing, data, or 3D model.",
            },
          ].map((s, i) => (
            <a
              href={i < 2 ? "#/generate" : i === 2 ? "#/plan" : "#/viewer"}
              className="process-card"
              key={s.title}
            >
              <div className="process-card-top">
                <s.icon size={24} />
                <span>0{i + 1}</span>
              </div>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </a>
          ))}
        </div>
      </section>
      <section className="home-bottom page-width">
        <Move3D size={32} />
        <div>
          <h2>A better way to see your future home.</h2>
          <p>
            Start with your requirements. Leave with a space you can explore.
          </p>
        </div>
        <a href="#/generate" className="button cream">
          Start designing <ArrowUpRight size={18} />
        </a>
      </section>
    </>
  );
}
