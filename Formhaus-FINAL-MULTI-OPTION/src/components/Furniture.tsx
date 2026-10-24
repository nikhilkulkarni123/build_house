import type { Room } from "../engine/types";
export function Box({
  position,
  size,
  colour = "#f4f0e5",
  rotation = 0,
}: {
  position: [number, number, number];
  size: [number, number, number];
  colour?: string;
  rotation?: number;
}) {
  return (
    <mesh
      position={position}
      rotation={[0, rotation, 0]}
      castShadow
      receiveShadow
    >
      <boxGeometry args={size} />
      <meshStandardMaterial color={colour} roughness={0.8} />
    </mesh>
  );
}
export function Furniture({ room: r }: { room: Room }) {
  const w = r.width,
    d = r.height;
  return (
    <group position={[r.x, 0, r.y]}>
      {r.type === "bedroom" && (
        <group position={[w / 2, 0, d / 2]}>
          <Box position={[0, 0.55, 0]} size={[5, 0.8, 6.5]} colour="#9a775c" />
          <Box
            position={[0, 1.15, 0]}
            size={[4.9, 0.55, 6.4]}
            colour="#f8f4e9"
          />
          <Box
            position={[0, 1.46, 1]}
            size={[4.95, 0.15, 3.9]}
            colour="#78968e"
          />
          <Box position={[-1.2, 1.5, -2.2]} size={[1.9, 0.25, 1.2]} />
          <Box position={[1.2, 1.5, -2.2]} size={[1.9, 0.25, 1.2]} />
          <Box
            position={[0, 1.65, -3.4]}
            size={[5.3, 2.4, 0.3]}
            colour="#ae9275"
          />
          <Box
            position={[3.4, 0.75, -2.2]}
            size={[1.4, 1.5, 1.4]}
            colour="#aa8965"
          />
        </group>
      )}
      {r.type === "living" && (
        <group position={[w / 2, 0, d / 2]}>
          <Box
            position={[0, 0.04, 0.5]}
            size={[Math.min(w - 1, 8), 0.05, 7]}
            colour="#c1b99c"
          />
          <Box position={[-2, 1, 0]} size={[2.5, 1.5, 6.5]} colour="#e2dacb" />
          <Box
            position={[-3.15, 1.7, 0]}
            size={[0.45, 2.2, 6.5]}
            colour="#bdc4b0"
          />
          <Box
            position={[-2, 1.8, -3.1]}
            size={[2.6, 1.4, 0.4]}
            colour="#bdc4b0"
          />
          <Box
            position={[-2, 1.8, 3.1]}
            size={[2.6, 1.4, 0.4]}
            colour="#bdc4b0"
          />
          <Box
            position={[1.5, 0.9, 0]}
            size={[2.6, 0.3, 3.6]}
            colour="#ae845c"
          />
          <Box
            position={[1.5, 0.4, 0]}
            size={[1.7, 0.8, 2.5]}
            colour="#644b39"
          />
          <Box
            position={[1.3, 1.12, 0.3]}
            size={[0.7, 0.1, 1]}
            colour="#ece9da"
          />
        </group>
      )}
      {r.type === "kitchen" && (
        <>
          <Box
            position={[w / 2, 1.5, d - 1.3]}
            size={[w - 0.6, 3, 2]}
            colour="#bec7bf"
          />
          <Box
            position={[w / 2, 3.08, d - 1.3]}
            size={[w - 0.45, 0.18, 2.15]}
            colour="#eee9dd"
          />
          <Box
            position={[1.25, 1.5, d / 2]}
            size={[2, 3, Math.max(3, d - 2.6)]}
            colour="#bbc5ba"
          />
          <Box
            position={[1.25, 3.08, d / 2]}
            size={[2.1, 0.18, Math.max(3, d - 2.6)]}
            colour="#eee9dd"
          />
          <Box
            position={[w - 1.8, 3.2, d - 1.3]}
            size={[2, 0.06, 1.4]}
            colour="#4b5855"
          />
          <Box
            position={[w / 2, 1.25, d / 2 - 1]}
            size={[3.5, 2.5, 2.4]}
            colour="#c1a27e"
          />
        </>
      )}
      {r.type === "bathroom" && (
        <>
          <Box
            position={[w - 1.4, 0.65, 1.5]}
            size={[1.5, 1.3, 2.2]}
            colour="#fafaf8"
          />
          <Box position={[w - 1.4, 1.3, 0.6]} size={[1.4, 2.1, 0.6]} />
          <Box position={[1.25, 2, d - 1.2]} size={[1.8, 0.5, 1.5]} />
          <Box
            position={[1.4, 0.09, 1.7]}
            size={[2.3, 0.12, 2.5]}
            colour="#b0c6c7"
          />
        </>
      )}
      {r.type === "parking" && (
        <group
          position={[w / 2, 0, d / 2]}
          rotation={[0, w > d ? Math.PI / 2 : 0, 0]}
        >
          <Box position={[0, 1, 0]} size={[5.4, 1.4, 11.5]} colour="#5f777b" />
          <Box
            position={[0, 2.15, 0.2]}
            size={[4.9, 1.1, 6]}
            colour="#92a4a5"
          />
          <Box position={[0, 2.8, 0.2]} size={[4.3, 0.1, 5]} colour="#385057" />
          {[-2.7, 2.7].flatMap((x) =>
            [-3.5, 3.5].map((z) => (
              <mesh
                key={x + ":" + z}
                position={[x, 0.7, z]}
                rotation={[0, 0, Math.PI / 2]}
              >
                <cylinderGeometry args={[0.85, 0.85, 0.4, 12]} />
                <meshStandardMaterial color="#313b3a" />
              </mesh>
            )),
          )}
        </group>
      )}
      {(r.type === "study" || r.type === "pooja" || r.type === "utility") && (
        <>
          <Box
            position={[w / 2, 1.4, d - 1.25]}
            size={[Math.min(5, w - 1), 2.8, 1.8]}
            colour="#bb9f7b"
          />
          <Box
            position={[w / 2, 1.2, d - 3]}
            size={[1.6, 0.4, 1.6]}
            colour="#708983"
          />
        </>
      )}
      {r.type === "porch" && (
        <>
          <Box
            position={[0.7, 0.7, d - 0.7]}
            size={[0.9, 1.4, 0.9]}
            colour="#a49071"
          />
          <mesh position={[0.7, 1.8, d - 0.7]} castShadow>
            <sphereGeometry args={[0.75, 10, 10]} />
            <meshStandardMaterial color="#5e7e51" />
          </mesh>
        </>
      )}
    </group>
  );
}
