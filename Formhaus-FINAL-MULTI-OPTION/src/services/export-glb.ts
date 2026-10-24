import * as THREE from "three";
export async function serializeGLB(model: THREE.Group): Promise<ArrayBuffer> {
  const { GLTFExporter } = await import(
    "three/examples/jsm/exporters/GLTFExporter.js"
  );
  const clone = model.clone(true),
    converted: THREE.Material[] = [];
  clone.traverse((o) => {
    if (o.name === "construction") o.scale.y = 1;
    if (
      o instanceof THREE.Mesh &&
      o.material instanceof THREE.MeshLambertMaterial
    ) {
      const m = o.material,
        standard = new THREE.MeshStandardMaterial({
          color: m.color,
          transparent: m.transparent,
          opacity: m.opacity,
          roughness: 0.8,
        });
      o.material = standard;
      converted.push(standard);
    }
  });
  const root = new THREE.Group();
  root.name = "FormhausMeters";
  root.scale.setScalar(0.3048);
  root.add(clone);
  root.updateMatrixWorld(true);
  try {
    const result = await new GLTFExporter().parseAsync(root, {
      binary: true,
      onlyVisible: true,
    });
    if (!(result instanceof ArrayBuffer)) throw new Error("GLB export failed.");
    return result;
  } finally {
    converted.forEach((m) => m.dispose());
  }
}
