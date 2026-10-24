import {
  Suspense,
  useRef,
  useState,
  useMemo,
  useEffect,
  forwardRef,
  useImperativeHandle,
  Component,
} from "react";
import type { ReactNode } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Html, ContactShadows } from "@react-three/drei";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { Box, Furniture } from "./Furniture";
import { getWalls, splitWall, roomToWorld } from "../engine/geometry";
import { OPEN_TYPES } from "../engine/types";
import { modelWallSegments, predictionRectangles } from "../engine/model-prediction";
import type { FloorPlan, Room } from "../engine/types";
import { saveBlob } from "../services/downloads";
import { serializeGLB } from "../services/export-glb";
import { PlanSVG } from "./PlanSVG";
import { SoftwareScene } from "./SoftwareScene";
export interface SceneHandle {
  exportGLB: () => Promise<void>;
}
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
}
class SceneBoundary extends Component<
  { children: ReactNode; plan: FloorPlan },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="scene-fallback">
        <PlanSVG plan={this.props.plan} />
        <p>
          3D is unavailable in this browser. Your 2D plan is ready to explore.
        </p>
      </div>
    ) : (
      this.props.children
    );
  }
}
function CameraRig({
  plan,
  top,
  resetKey,
  rotate,
  hero,
}: {
  plan: FloorPlan;
  top?: boolean;
  resetKey?: number;
  rotate?: boolean;
  hero?: boolean;
}) {
  const controls = useRef<OrbitControlsImpl>(null);
  const { camera } = useThree();
  const target = useRef(new THREE.Vector3()),
    moving = useRef(true);
  useEffect(() => {
    const span = Math.max(plan.plot.width, plan.plot.length);
    target.current.set(
      top ? 0 : span * 0.92,
      top ? span * 1.65 : span * 0.83,
      top ? 0.01 : span * 1.08,
    );
    moving.current = true;
    controls.current?.target.set(0, 0, 0);
  }, [plan.id, plan.plot.width, plan.plot.length, top, resetKey]);
  useFrame((_, delta) => {
    if (moving.current) {
      camera.position.lerp(target.current, 1 - Math.exp(-delta * 4));
      controls.current?.update();
      if (camera.position.distanceTo(target.current) < 0.07)
        moving.current = false;
    }
  });
  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      minDistance={12}
      maxDistance={Math.max(plan.plot.width, plan.plot.length) * 3.5}
      maxPolarAngle={Math.PI / 2 - 0.025}
      autoRotate={rotate && !top}
      autoRotateSpeed={hero ? 0.4 : 0.65}
      onStart={() => {
        moving.current = false;
      }}
    />
  );
}
function Construction({
  flat,
  replay,
  children,
}: {
  flat?: boolean;
  replay?: number;
  children: ReactNode;
}) {
  const ref = useRef<THREE.Group>(null),
    progress = useRef(0.015);
  useEffect(() => {
    progress.current = 0.015;
  }, [replay]);
  useFrame((_, dt) => {
    progress.current = THREE.MathUtils.damp(
      progress.current,
      flat ? 0.015 : 1,
      3.5,
      dt,
    );
    if (ref.current) ref.current.scale.y = progress.current;
  });
  return (
    <group ref={ref} name="construction">
      {children}
    </group>
  );
}
function House({
  plan,
  roof,
  walls = true,
  furniture = true,
  flat,
  replay,
  labels,
  selected,
  onSelect,
  groupRef,
}: { plan: FloorPlan; groupRef: React.RefObject<THREE.Group | null> } & Props) {
  const wallPieces = useMemo(
    () => getWalls(plan).flatMap((w) => splitWall(plan, w)),
    [plan],
  );
  const [hover, setHover] = useState("");
  const predicted = useMemo(() => predictionRectangles(plan), [plan]);
  const modelWalls = useMemo(() => modelWallSegments(plan), [plan]);
  if (plan.modelPrediction && !["learned-rectangles", "joint-partition", "joint-partition-multi-option"].includes(plan.modelPrediction.inferenceMode)) {
    return (
      <group
        ref={groupRef}
        name="FormhausModelPrediction"
        position={[-plan.plot.width / 2, 0, -plan.plot.length / 2]}
        userData={{ unit: "feet", planId: plan.id, schemaVersion: 1, source: "model" }}
      >
        <Box
          position={[plan.plot.width / 2, -0.38, plan.plot.length / 2]}
          size={[plan.plot.width + 1, 0.6, plan.plot.length + 1]}
          colour="#e5e4d7"
        />
        {predicted.map((r, i) => {
          const room = plan.rooms.find((candidate) => candidate.id === `model-room-${r.slot}`);
          const active = selected === room?.id || hover === room?.id;
          return (
            <mesh
              key={`${r.slot}-${i}`}
              name={`prediction-slot-${r.slot}-${i}`}
              position={[r.x + r.width / 2, flat ? 0.03 : 0.12, r.y + r.height / 2]}
              receiveShadow
              onPointerOver={(e) => {
                e.stopPropagation();
                if (room) setHover(room.id);
              }}
              onPointerOut={() => setHover("")}
              onClick={(e) => {
                e.stopPropagation();
                if (room) onSelect?.(room);
              }}
            >
              <boxGeometry args={[r.width, flat ? 0.08 : 0.22, r.height]} />
              <meshStandardMaterial color={active ? "#9fc7b2" : r.colour} roughness={0.92} />
            </mesh>
          );
        })}
        {!flat && walls && modelWalls.map((w, i) => {
          const horizontal = Math.abs(w.y2 - w.y1) < 1e-6;
          const wallLength = horizontal ? Math.abs(w.x2 - w.x1) : Math.abs(w.y2 - w.y1);
          const thickness = w.exterior ? Math.max(plan.wallThickness, 0.38) : Math.max(plan.wallThickness * 0.72, 0.28);
          const x = (w.x1 + w.x2) / 2;
          const z = (w.y1 + w.y2) / 2;
          return (
            <Box
              key={`model-wall-${i}`}
              position={[x, plan.wallHeight / 2, z]}
              size={[horizontal ? wallLength : thickness, plan.wallHeight, horizontal ? thickness : wallLength]}
              colour={w.exterior ? "#f2f0e6" : "#e3e4d8"}
            />
          );
        })}
        {!flat && plan.modelPrediction.roomSlots.filter((s) => s.pixels > 0).map((slot) => {
          const room = plan.rooms.find((r) => r.id === `model-room-${slot.slot}`);
          if (!room) return null;
          return (
            <Html
              key={slot.slot}
              position={[slot.labelX ?? room.x + room.width / 2, 0.48, slot.labelY ?? room.y + room.height / 2]}
              center
              distanceFactor={65}
              zIndexRange={[5, 0]}
              style={{ pointerEvents: "none" }}
            >
              <div className="room-label">{slot.name}</div>
            </Html>
          );
        })}
      </group>
    );
  }
  return (
    <group
      ref={groupRef}
      name="FormhausHouse"
      position={[-plan.plot.width / 2, 0, -plan.plot.length / 2]}
      userData={{ unit: "feet", planId: plan.id, schemaVersion: 1 }}
    >
      <Box
        position={[plan.plot.width / 2, -0.38, plan.plot.length / 2]}
        size={[plan.plot.width + 1, 0.6, plan.plot.length + 1]}
        colour="#e5e4d7"
      />
      {plan.modelPrediction?.circulation && (
        <Box
          position={[
            plan.modelPrediction.circulation.x + plan.modelPrediction.circulation.width / 2,
            -0.005,
            plan.modelPrediction.circulation.y + plan.modelPrediction.circulation.height / 2,
          ]}
          size={[
            plan.modelPrediction.circulation.width,
            0.08,
            plan.modelPrediction.circulation.height,
          ]}
          colour="#d8cfbb"
        />
      )}
      {plan.rooms.map((r) => {
        const m = roomToWorld(r);
        return (
          <group key={r.id}>
            <mesh
              name={"floor-" + r.id}
              userData={{
                roomId: r.id,
                roomName: r.name,
                width: r.width,
                length: r.height,
              }}
              position={[m.x, 0.005, m.z]}
              receiveShadow
              onPointerOver={(e) => {
                e.stopPropagation();
                setHover(r.id);
              }}
              onPointerOut={() => setHover("")}
              onClick={(e) => {
                e.stopPropagation();
                onSelect?.(r);
              }}
            >
              <boxGeometry args={[m.width, 0.13, m.depth]} />
              <meshStandardMaterial
                color={
                  selected === r.id || hover === r.id ? "#97bca8" : r.colour
                }
                roughness={0.95}
              />
            </mesh>
            {labels && !OPEN_TYPES.includes(r.type) && r.type !== "passage" && (
              <Html
                position={[m.x, 0.23, m.z]}
                center
                distanceFactor={65}
                zIndexRange={[5, 0]}
                style={{ pointerEvents: "none" }}
              >
                <div className="room-label">{r.name}</div>
              </Html>
            )}
          </group>
        );
      })}
      {!flat && plan.modelPrediction?.doorCandidates?.map((d) => (
        <Box
          key={d.id}
          position={[d.x, 0.12, d.y]}
          size={[
            d.orientation === "horizontal" ? d.width : 0.22,
            0.16,
            d.orientation === "vertical" ? d.width : 0.22,
          ]}
          colour="#b47f55"
        />
      ))}
      <Construction flat={flat} replay={replay}>
        {walls &&
          wallPieces.map((w, i) => (
            <Box
              key={i}
              position={[w.x, w.bottom + w.height / 2, w.y]}
              size={[w.width, w.height, w.depth]}
              colour={w.exterior ? "#f2f0e6" : "#e3e4d8"}
            />
          ))}
        {walls &&
          plan.windows.map((w) => (
            <group
              key={w.id}
              position={[w.x, w.sill, w.y]}
              rotation={[0, w.orientation === "vertical" ? Math.PI / 2 : 0, 0]}
            >
              <Box
                position={[0, 0, 0]}
                size={[w.width, 0.12, 0.4]}
                colour="#4e6866"
              />
              <Box
                position={[0, w.height, 0]}
                size={[w.width, 0.12, 0.4]}
                colour="#4e6866"
              />
              {[-w.width / 2, 0, w.width / 2].map((x, i) => (
                <Box
                  key={i}
                  position={[x, w.height / 2, 0]}
                  size={[0.09, w.height, 0.35]}
                  colour="#4e6866"
                />
              ))}
              <mesh position={[0, w.height / 2, 0]}>
                <boxGeometry args={[w.width, w.height, 0.04]} />
                <meshStandardMaterial
                  color="#91cbd1"
                  transparent
                  opacity={0.3}
                  roughness={0.18}
                  depthWrite={false}
                />
              </mesh>
            </group>
          ))}
        {walls &&
          plan.doors
            .filter((d) => d.kind === "internal")
            .map((d) => (
              <group
                key={d.id}
                position={[d.x, 0, d.y]}
                rotation={[
                  0,
                  d.orientation === "vertical" ? Math.PI / 2 : 0,
                  0,
                ]}
              >
                <group
                  position={[-d.width / 2, 0, 0]}
                  rotation={[0, -Math.PI / 3, 0]}
                >
                  <Box
                    position={[d.width / 2, 3.45, 0]}
                    size={[d.width, 6.9, 0.11]}
                    colour="#b69870"
                  />
                  <Box
                    position={[d.width - 0.25, 3.35, -0.11]}
                    size={[0.18, 0.12, 0.12]}
                    colour="#465b56"
                  />
                </group>
              </group>
            ))}
        {furniture && plan.rooms.map((r) => <Furniture key={r.id} room={r} />)}
        {roof &&
          plan.rooms
            .filter((r) => !OPEN_TYPES.includes(r.type))
            .map((r) => (
              <Box
                key={"roof-" + r.id}
                position={[
                  r.x + r.width / 2,
                  plan.wallHeight + 0.25,
                  r.y + r.height / 2,
                ]}
                size={[r.width, 0.45, r.height]}
                colour="#47615b"
              />
            ))}
      </Construction>
    </group>
  );
}
function Ready({ onReady }: { onReady?: Props["onReady"] }) {
  useEffect(() => {
    onReady?.(true);
    return () => onReady?.(false);
  }, [onReady]);
  return null;
}
export const HouseScene = forwardRef<SceneHandle, Props>((props, ref) => {
  const model = useRef<THREE.Group>(null);
  const span = Math.max(props.plan.plot.width, props.plan.plot.length);
  const [supported] = useState(() => {
    try {
      const c = document.createElement("canvas");
      const gl = c.getContext("webgl2");
      if (!gl) return false;
      gl.getExtension("WEBGL_lose_context")?.loseContext();
      return true;
    } catch {
      return false;
    }
  });
  useImperativeHandle(
    ref,
    () => ({
      async exportGLB() {
        if (!model.current)
          throw new Error("The 3D scene is still loading or unavailable.");
        const result = await serializeGLB(model.current);
        saveBlob(
          new Blob([result], { type: "model/gltf-binary" }),
          "formhaus-" + props.plan.id + ".glb",
        );
      },
    }),
    [props.plan.id],
  );
  if (!supported) return <SoftwareScene {...props} modelRef={model} />;
  return (
    <SceneBoundary plan={props.plan}>
      <Canvas
        shadows
        dpr={[1, 1.6]}
        camera={{
          position: [span * 0.92, span * 0.83, span * 1.08],
          fov: props.hero ? 37 : 40,
          near: 0.1,
          far: 600,
        }}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: "high-performance",
        }}
        aria-label="Interactive 3D floor plan. Drag to orbit, scroll to zoom, right-drag to pan."
      >
        <color
          attach="background"
          args={[props.night ? "#142b32" : "#eef1e9"]}
        />
        <ambientLight intensity={props.night ? 0.5 : 1.3} />
        <hemisphereLight
          args={["#f5f1df", "#8da297", props.night ? 0.3 : 1.4]}
        />
        <directionalLight
          position={[15, 50, 25]}
          intensity={props.night ? 0.3 : 3}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-65}
          shadow-camera-right={65}
          shadow-camera-top={65}
          shadow-camera-bottom={-65}
          shadow-bias={-0.0005}
        />
        {props.night && (
          <>
            <pointLight
              position={[0, 12, 0]}
              color="#ffca7e"
              intensity={1300}
              distance={70}
            />
            <pointLight
              position={[-12, 7, -8]}
              color="#facaa0"
              intensity={400}
              distance={50}
            />
          </>
        )}
        <Suspense fallback={null}>
          <House {...props} groupRef={model} />
          <ContactShadows
            position={[0, -0.75, 0]}
            opacity={props.night ? 0.25 : 0.27}
            scale={span * 2}
            blur={2.5}
            far={20}
            resolution={512}
            frames={1}
          />
          <Ready onReady={props.onReady} />
        </Suspense>
        <gridHelper
          args={[
            150,
            50,
            props.night ? "#30484b" : "#cad4c9",
            props.night ? "#233d40" : "#dfe5d9",
          ]}
          position={[0, -0.72, 0]}
        />
        <CameraRig
          plan={props.plan}
          top={props.top}
          resetKey={props.resetKey}
          rotate={props.rotate}
          hero={props.hero}
        />
      </Canvas>
    </SceneBoundary>
  );
});
HouseScene.displayName = "HouseScene";
