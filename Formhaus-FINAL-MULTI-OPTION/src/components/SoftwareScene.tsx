import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { SVGRenderer } from "three/examples/jsm/renderers/SVGRenderer.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { buildSoftwareModel, disposeModel } from "../engine/scene-model";
import { OPEN_TYPES } from "../engine/types";
import type { FloorPlan, Room } from "../engine/types";
interface Props {
  plan: FloorPlan;
  roof?: boolean;
  walls?: boolean;
  furniture?: boolean;
  night?: boolean;
  top?: boolean;
  rotate?: boolean;
  flat?: boolean;
  replay?: number;
  resetKey?: number;
  labels?: boolean;
  selected?: string;
  onSelect?: (r: Room) => void;
  onReady?: (ready: boolean) => void;
  hero?: boolean;
  modelRef: React.RefObject<THREE.Group | null>;
}
export function SoftwareScene(props: Props) {
  const host = useRef<HTMLDivElement>(null),
    current = useRef(props);
  current.current = props;
  const [labelPositions, setLabelPositions] = useState<
    { id: string; name: string; x: number; y: number }[]
  >([]);
  useEffect(() => {
    if (!host.current) return;
    const el = host.current,
      renderer = new SVGRenderer();
    renderer.setQuality("high");
    renderer.setPrecision(2);
    renderer.overdraw = 0.3;
    renderer.domElement.setAttribute("role", "img");
    renderer.domElement.setAttribute(
      "aria-label",
      "Interactive 3D house rendered with software graphics",
    );
    renderer.domElement.style.cssText =
      "display:block;width:100%;height:100%;pointer-events:none";
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const span = Math.max(props.plan.plot.width, props.plan.plot.length),
      camera = new THREE.PerspectiveCamera(props.hero ? 37 : 40, 1, 0.1, 600);
    camera.position.set(span * 0.92, span * 0.83, span * 1.08);
    const ambient = new THREE.AmbientLight("#ffffff", 0.5),
      sun = new THREE.DirectionalLight("#fff9e7", 0.6);
    sun.position.set(-15, 45, 25);
    scene.add(ambient, sun);
    const grid = new THREE.GridHelper(150, 50, "#c9d1bf", "#dce2d4");
    grid.position.y = -0.78;
    (grid.material as THREE.LineBasicMaterial).color.set("#b6c4b2");
    (grid.material as THREE.LineBasicMaterial).transparent = true;
    (grid.material as THREE.LineBasicMaterial).opacity = 0.5;
    scene.add(grid);
    const controls = new OrbitControls(camera, el);
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    controls.minDistance = 12;
    controls.maxDistance = span * 3.5;
    controls.maxPolarAngle = Math.PI / 2 - 0.025;
    controls.autoRotateSpeed = props.hero ? 0.4 : 0.65;
    let model = buildSoftwareModel(props.plan, {
      walls: props.walls !== false,
      roof: !!props.roof,
      furniture: props.furniture !== false,
    });
    scene.add(model.root);
    props.modelRef.current = model.root;
    let lastLayers = "",
      lastCamera = "",
      lastReplay = props.replay,
      lastNight: boolean | undefined,
      progress = 0.015,
      moving = false,
      raf = 0,
      lastTime = 0,
      hover = "",
      lastSelected = "";
    let needsRender = true;
    controls.addEventListener("change", () => {
      needsRender = true;
    });
    const target = camera.position.clone();
    const raycaster = new THREE.Raycaster(),
      mouse = new THREE.Vector2();
    let start = { x: 0, y: 0 };
    const size = () => {
      const rect = el.getBoundingClientRect();
      renderer.setSize(rect.width, rect.height);
      camera.aspect = rect.width / Math.max(rect.height, 1);
      camera.updateProjectionMatrix();
      needsRender = true;
    };
    const observer = new ResizeObserver(size);
    observer.observe(el);
    size();
    const hit = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      mouse.set(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        (-(e.clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(mouse, camera);
      return raycaster.intersectObjects(model.floors)[0]?.object.userData
        .roomId as string | undefined;
    };
    const down = (e: PointerEvent) => {
      moving = false;
      start = { x: e.clientX, y: e.clientY };
    };
    const move = (e: PointerEvent) => {
      if (!e.buttons) hover = hit(e) || "";
    };
    const up = (e: PointerEvent) => {
      if (Math.hypot(e.clientX - start.x, e.clientY - start.y) < 5) {
        const id = hit(e);
        const room = current.current.plan.rooms.find((r) => r.id === id);
        if (room) current.current.onSelect?.(room);
      }
    };
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.style.touchAction = "none";
    function frame(time: number) {
      raf = requestAnimationFrame(frame);
      if (time - lastTime < 32) return;
      const dt = Math.min((time - lastTime) / 1000, 0.06);
      lastTime = time;
      const p = current.current;
      const layers = [p.walls !== false, !!p.roof, p.furniture !== false].join(
        ":",
      );
      if (layers !== lastLayers) {
        needsRender = true;
        lastLayers = layers;
        scene.remove(model.root);
        disposeModel(model.root);
        model = buildSoftwareModel(p.plan, {
          walls: p.walls !== false,
          roof: !!p.roof,
          furniture: p.furniture !== false,
        });
        scene.add(model.root);
        p.modelRef.current = model.root;
        lastSelected = "";
      }
      if (p.night !== lastNight) {
        needsRender = true;
        lastNight = p.night;
        renderer.setClearColor(
          new THREE.Color(p.night ? "#142b32" : "#eef1e9"),
          1,
        );
        ambient.intensity = 1;
        ambient.color.setRGB(
          p.night ? 0.25 : 0.5,
          p.night ? 0.28 : 0.5,
          p.night ? 0.33 : 0.5,
        );
        sun.color.set(p.night ? "#efb570" : "#fff9e7");
        sun.intensity = p.night ? 0.5 : 0.6;
      }
      const cam = [!!p.top, p.resetKey || 0].join(":");
      if (cam !== lastCamera) {
        lastCamera = cam;
        target.set(
          p.top ? 0 : span * 0.92,
          p.top ? span * 1.65 : span * 0.83,
          p.top ? 0.01 : span * 1.08,
        );
        controls.target.set(0, 0, 0);
        moving = true;
      }
      if (p.replay !== lastReplay) {
        lastReplay = p.replay;
        progress = 0.015;
      }
      const targetHeight = p.flat ? 0.015 : 1;
      if (Math.abs(progress - targetHeight) > 0.0005) {
        progress = THREE.MathUtils.damp(progress, targetHeight, 3.5, dt);
        needsRender = true;
      } else if (progress !== targetHeight) {
        progress = targetHeight;
        needsRender = true;
      }
      model.construction.scale.y = progress;
      if (moving) {
        camera.position.lerp(target, 1 - Math.exp(-dt * 4));
        if (camera.position.distanceTo(target) < 0.1) moving = false;
      }
      controls.autoRotate = !!p.rotate && !p.top;
      controls.update();
      const selection = (p.selected || "") + ":" + hover;
      if (selection !== lastSelected) {
        needsRender = true;
        lastSelected = selection;
        for (const floor of model.floors) {
          const room = p.plan.rooms.find(
            (r) => r.id === floor.userData.roomId,
          )!;
          (floor.material as THREE.MeshLambertMaterial).color.set(
            room.id === p.selected || room.id === hover
              ? "#86b8a7"
              : room.colour,
          );
        }
      }
      // Avoid regenerating hundreds of SVG paths while the camera and model
      // are idle. OrbitControls invalidates only when its camera changes.
      if (!needsRender) return;
      needsRender = false;
      renderer.render(scene, camera);
      if (p.labels && !p.roof) {
        const rect = el.getBoundingClientRect();
        setLabelPositions(
          p.plan.rooms
            .filter((r) => !OPEN_TYPES.includes(r.type) && r.type !== "passage")
            .map((r) => {
              const v = new THREE.Vector3(
                r.x + r.width / 2 - p.plan.plot.width / 2,
                0.4,
                r.y + r.height / 2 - p.plan.plot.length / 2,
              ).project(camera);
              return {
                id: r.id,
                name: r.name,
                x: ((v.x + 1) * rect.width) / 2,
                y: ((1 - v.y) * rect.height) / 2,
              };
            }),
        );
      }
    }
    raf = requestAnimationFrame(frame);
    props.onReady?.(true);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      controls.dispose();
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      disposeModel(model.root);
      grid.geometry.dispose();
      (grid.material as THREE.Material).dispose();
      renderer.domElement.remove();
      props.modelRef.current = null;
      props.onReady?.(false);
    };
  }, [props.plan.id]);
  return (
    <div
      className="software-scene"
      ref={host}
      aria-label="3D view. Drag to orbit, scroll to zoom, right-drag to pan."
    >
      {props.labels &&
        !props.roof &&
        labelPositions.map((p) => (
          <div
            className="software-label room-label"
            key={p.id}
            style={{ left: p.x, top: p.y }}
          >
            {p.name}
          </div>
        ))}
    </div>
  );
}
