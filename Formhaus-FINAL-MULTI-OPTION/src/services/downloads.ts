import type { FloorPlan } from "../engine/types";
export function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
export const downloadJSON = (plan: FloorPlan) =>
  saveBlob(
    new Blob([JSON.stringify(plan, null, 2)], { type: "application/json" }),
    "formhaus-" + plan.id + ".json",
  );
export async function downloadPNG(svg: SVGSVGElement, plan: FloorPlan) {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute(
    "viewBox",
    `-7 -7 ${plan.plot.width + 14} ${plan.plot.length + 14}`,
  );
  clone.setAttribute("width", "1800");
  clone.setAttribute(
    "height",
    String(
      Math.round((1800 * (plan.plot.length + 14)) / (plan.plot.width + 14)),
    ),
  );
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  const text = new XMLSerializer().serializeToString(clone),
    url = URL.createObjectURL(
      new Blob([text], { type: "image/svg+xml;charset=utf-8" }),
    );
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () =>
        reject(new Error("Could not render the floor plan image."));
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Image export is unavailable.");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("PNG export failed."))),
        "image/png",
      ),
    );
    saveBlob(blob, "formhaus-" + plan.id + ".png");
  } finally {
    URL.revokeObjectURL(url);
  }
}
