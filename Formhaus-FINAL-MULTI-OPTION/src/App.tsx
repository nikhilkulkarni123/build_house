import { useEffect, useState, lazy, Suspense } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Menu,
  X,
  ArrowUpRight,
  CheckCircle2,
  RotateCcw,
  LoaderCircle,
} from "lucide-react";
import { ProjectProvider, useProject } from "./state/ProjectContext";
import { Generate } from "./pages/Generate";
import { Plan } from "./pages/Plan";
import { HowItWorks, About } from "./pages/Information";
const Home = lazy(() =>
  import("./pages/Home").then((m) => ({ default: m.Home })),
);
const Viewer = lazy(() =>
  import("./pages/Viewer").then((m) => ({ default: m.Viewer })),
);
const nav = [
  { path: "/", label: "Home" },
  { path: "/generate", label: "Generate Plan" },
  { path: "/plan", label: "2D Plan" },
  { path: "/viewer", label: "3D Viewer" },
  { path: "/how-it-works", label: "How It Works" },
  { path: "/about", label: "About Project" },
];
function Studio() {
  const [route, setRoute] = useState(window.location.hash.slice(1) || "/"),
    [menu, setMenu] = useState(false),
    [confirmReset, setConfirmReset] = useState(false);
  const { notice, reset } = useProject();
  useEffect(() => {
    const change = () => {
      setRoute(window.location.hash.slice(1) || "/");
      setMenu(false);
      window.scrollTo({ top: 0, behavior: "instant" });
    };
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, []);
  useEffect(() => {
    document.title = `${nav.find((n) => n.path === route)?.label || "Home"} — Formhaus`;
  }, [route]);
  return (
    <>
      <a
        href="#main-content"
        className="skip-link"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("main-content")?.focus();
        }}
      >
        Skip to content
      </a>
      <header className="site-header">
        <div className="nav-wrap page-width">
          <a className="brand" href="#/" aria-label="Formhaus home">
            <span className="brand-symbol">
              <svg viewBox="0 0 28 32" fill="none" aria-hidden="true">
                <path
                  d="M3 29V12L14 3l11 9v17H3Z M9 29V16l5-4 5 4v13 M14 12v17"
                  stroke="currentColor"
                  strokeWidth="1.6"
                />
              </svg>
            </span>
            formhaus<span className="brand-period">.</span>
          </a>
          <nav aria-label="Main navigation" className={menu ? "open" : ""}>
            {nav.map((n) => (
              <a
                key={n.path}
                className={route === n.path ? "active" : ""}
                href={"#" + n.path}
                aria-current={route === n.path ? "page" : undefined}
              >
                {n.label}
              </a>
            ))}
          </nav>
          <a className="nav-cta" href="#/generate">
            Create a plan <ArrowUpRight size={16} />
          </a>
          <button
            className="menu-button"
            aria-label={menu ? "Close navigation" : "Open navigation"}
            aria-expanded={menu}
            onClick={() => setMenu(!menu)}
          >
            {menu ? <X /> : <Menu />}
          </button>
        </div>
      </header>
      <main id="main-content" tabIndex={-1}>
        <Suspense
          fallback={
            <div className="page-loading">
              <LoaderCircle className="spin" size={30} />
              <p>Opening your design studio…</p>
            </div>
          }
        >
          {route === "/generate" ? (
            <Generate />
          ) : route === "/plan" ? (
            <Plan />
          ) : route === "/viewer" ? (
            <Viewer />
          ) : route === "/how-it-works" ? (
            <HowItWorks />
          ) : route === "/about" ? (
            <About />
          ) : (
            <Home />
          )}
        </Suspense>
      </main>
      <footer className="site-footer page-width">
        <div className="footer-top">
          <a href="#/" className="brand">
            formhaus<span className="brand-period">.</span>
          </a>
          <span>THOUGHTFULLY PLANNED. BEAUTIFULLY IMAGINED.</span>
          <button onClick={() => setConfirmReset(true)}>
            <RotateCcw size={14} /> Reset project
          </button>
        </div>
        <div className="footer-bottom">
          <p>
            Preliminary visualization only. Professional approval is required
            before construction.
          </p>
          <span>Learned structured floor-plan model · 2026</span>
        </div>
      </footer>
      {confirmReset && (
        <div
          className="dialog-backdrop"
          onKeyDown={(e) => {
            if (e.key === "Escape") setConfirmReset(false);
            if (e.key === "Tab") {
              const buttons = e.currentTarget.querySelectorAll("button");
              if (e.shiftKey && document.activeElement === buttons[0]) {
                e.preventDefault();
                (buttons[buttons.length - 1] as HTMLButtonElement).focus();
              } else if (
                !e.shiftKey &&
                document.activeElement === buttons[buttons.length - 1]
              ) {
                e.preventDefault();
                (buttons[0] as HTMLButtonElement).focus();
              }
            }
          }}
        >
          <section
            className="reset-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="reset-title"
            aria-describedby="reset-description"
          >
            <h2 id="reset-title">Start with a fresh plan?</h2>
            <p id="reset-description">
              Your current design will be replaced with the bundled learned structured-model example.
              Save the plan JSON first if you want to keep a copy.
            </p>
            <div>
              <button
                autoFocus
                className="button outline"
                onClick={() => setConfirmReset(false)}
              >
                Keep my design
              </button>
              <button
                className="button primary"
                onClick={() => {
                  reset();
                  setConfirmReset(false);
                  window.location.hash = "/generate";
                }}
              >
                Reset to example
              </button>
            </div>
          </section>
        </div>
      )}
      <AnimatePresence>
        {notice && (
          <motion.div
            role="status"
            className="toast"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
          >
            <CheckCircle2 size={19} />
            {notice}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
export default function App() {
  return (
    <ProjectProvider>
      <Studio />
    </ProjectProvider>
  );
}
