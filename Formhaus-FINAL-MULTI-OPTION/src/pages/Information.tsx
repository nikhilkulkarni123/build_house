import {
  ArrowUpRight,
  ArrowRight,
  Ruler,
  Layers3,
  ShieldCheck,
  Box,
  Download,
  Network,
  Code2,
  GraduationCap,
} from "lucide-react";
export function HowItWorks() {
  return (
    <div className="page-width work-page information-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">THE PROCESS / FROM 2D TO 3D</div>
          <h1>
            Less guesswork.
            <br />
            <em>More perspective.</em>
          </h1>
          <p>
            Five steps from a list of requirements to a home you can explore.
          </p>
        </div>
        <a href="#/generate" className="button primary">
          Try it yourself <ArrowUpRight size={17} />
        </a>
      </div>
      <div className="how-steps">
        {[
          {
            icon: Ruler,
            title: "Start with your space.",
            text: "Enter your plot dimensions, bedroom count, bathroom count, and entrance direction. Choose the extra spaces that matter to you.",
            detail:
              "Your requirements become the constraints for every design.",
          },
          {
            icon: Layers3,
            title: "Let the layout take shape.",
            text: "The final neural predictor receives requested room types, exact plot width/length and entrance direction. It predicts learned room sites/areas plus connectivity signals; a generic balanced joint decoder turns those learned signals into one exhaustive orthogonal floor-plan partition.",
            detail:
              "Room x/y/width/height come from the neural room decoder; connectivity comes from learned heads rather than semantic adjacency templates.",
          },
          {
            icon: ShieldCheck,
            title: "Check every connection.",
            text: "Formhaus verifies every partition leaf, checks learned connectivity, and reports full plot coverage. The joint decoder produces zero unexplained residual and zero room overlap.",
            detail:
              "The validator reports model limitations instead of inventing missing rooms or moving rooms with rules.",
          },
          {
            icon: Box,
            title: "Give the plan a new dimension.",
            text: "The 2D drawing and 3D scene use the exact same joint room/passsage partition and the same geometry-supported learned door openings. Drawing x becomes 3D X and drawing y becomes 3D Z.",
            detail:
              "The model predicts door candidates. Formhaus shows them honestly as learned candidates and does not cut a fake wall opening when the predicted room geometry does not support it. Windows are not predicted.",
          },
          {
            icon: Download,
            title: "Explore it. Keep it.",
            text: "Orbit the model-derived geometry, inspect predicted rooms, change the lighting, or hide the walls. Download the drawing as PNG, the prediction as JSON, or the scene as GLB.",
            detail: "Your latest design is also saved in this browser.",
          },
        ].map((s, i) => (
          <section className="how-step" key={s.title}>
            <span className="how-number">0{i + 1}</span>
            <span className="how-icon">
              <s.icon size={28} />
            </span>
            <div>
              <h2>{s.title}</h2>
              <p>{s.text}</p>
              <span className="how-detail">{s.detail}</span>
            </div>
          </section>
        ))}
      </div>
      <div className="coordinate-card">
        <div>
          <span className="eyebrow">ONE SOURCE OF TRUTH</span>
          <h2>A floor plan, with height.</h2>
          <p>
            A 12 × 10 ft room at (5, 8) in the drawing becomes a 12 × 10 ft
            floor starting at X = 5, Z = 8. Height adds the third dimension; the
            footprint stays exactly the same.
          </p>
        </div>
        <div className="coordinate-mapping">
          <span>2D drawing</span>
          <strong>x → X</strong>
          <strong>y → Z</strong>
          <strong>height → Y</strong>
          <span>3D house</span>
        </div>
      </div>
    </div>
  );
}
export function About() {
  return (
    <div className="page-width work-page information-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">ABOUT FORMHAUS / A COLLEGE PBL PROJECT</div>
          <h1>
            Intelligent design.
            <br />
            <em>Transparent by design.</em>
          </h1>
          <p>
            AI-Based Automated 2D-to-3D Residential Floor Plan Generation and
            Visualization System
          </p>
        </div>
        <span className="about-monogram">
          <GraduationCap size={48} />
        </span>
      </div>
      <div className="about-grid">
        <article className="about-card">
          <span className="eyebrow">THE PURPOSE</span>
          <h2>Make a floor plan easier to imagine.</h2>
          <p>
            Residential requirements are often a list of numbers and room names.
            Formhaus turns that list into an inspectable layout and an
            interactive 3D model, helping students and future homeowners explore
            design possibilities.
          </p>
          <p>
            The first version prioritizes consistent geometry, understandable
            validation, and a complete working experience.
          </p>
        </article>
        <article className="about-card teal">
          <span className="eyebrow">WHAT POWERS IT TODAY</span>
          <Network size={32} />
          <h2>
            Trained model.
            <br />
            No layout-rule fallback.
          </h2>
          <p>
            Formhaus loads the physical-size-aware neural site/area/connectivity checkpoint distilled from the supplied DoorFloorNet soft maps. The final balanced joint slicing decoder is driven by those learned sites and areas, giving shared orthogonal walls and full coverage. Third bedroom, study and utility use compatible teacher semantics; parking and pooja use explicitly labelled proxy supervision. There are no room-type placement templates.
          </p>
          <span className="about-status">
            <ShieldCheck size={16} /> Every returned plan passes validation
          </span>
        </article>
      </div>
      <section className="tech-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">BUILT WITH</span>
            <h2>A connected, modern toolkit.</h2>
          </div>
          <Code2 size={29} />
        </div>
        <div className="tech-tags">
          {[
            "React",
            "TypeScript",
            "Vite",
            "Tailwind CSS",
            "Three.js",
            "React Three Fiber",
            "Drei",
            "Framer Motion",
            "Lucide",
            "Vitest",
            "Python",
            "PyTorch",
            "FastAPI",
          ].map((t) => (
            <span key={t}>{t}</span>
          ))}
        </div>
      </section>
      <section className="future-section">
        <span className="eyebrow">THE NEXT CHAPTER</span>
        <h2>Keep improving the learned model without hiding its limits.</h2>
        <div className="future-grid">
          {[
            {
              n: "01",
              title: "Replace proxy semantics with native labels",
              text: "Collect native parking and pooja training labels so those two spaces no longer rely on learned Entrance/Storage proxy supervision.",
            },
            {
              n: "02",
              title: "Train cleaner boundaries",
              text: "Train the structured decoder directly against ground-truth RPLAN boxes when the original data file is available, improving room size and position accuracy.",
            },
            {
              n: "03",
              title: "Add learned structure",
              text: "Train dedicated neural heads for doors, windows, and wall openings instead of inventing those elements with hand-written placement rules.",
            },
            {
              n: "04",
              title: "Evaluate honestly",
              text: "Measure room IoU, missing-room rate, connectivity, and practical design quality on unseen plans before claiming architectural reliability.",
            },
          ].map((s) => (
            <div key={s.n}>
              <span>{s.n}</span>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </div>
          ))}
        </div>
      </section>
      <section className="project-disclaimer">
        <ShieldCheck size={24} />
        <div>
          <h3>A concept, before a construction plan.</h3>
          <p>
            Generated layouts are for preliminary visualization and require
            professional approval before construction. Local building
            regulations, setbacks, structure, services, and accessibility
            requirements are outside this prototype’s validation scope.
            Displayed room sizes are nominal; actual clear dimensions depend on
            wall detailing.
          </p>
        </div>
      </section>
      <a href="#/generate" className="text-link">
        Explore what’s possible <ArrowRight size={17} />
      </a>
    </div>
  );
}
