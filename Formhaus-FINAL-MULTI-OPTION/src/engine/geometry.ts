import type { Door, FloorPlan, Room, Wall, WallPiece, Window } from "./types";
import { OPEN_TYPES } from "./types";
export const EPS = 0.001;
export const near = (a: number, b: number) => Math.abs(a - b) < EPS;
export const overlaps = (a: Room, b: Room) =>
  Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) > EPS &&
  Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y) > EPS;
export function sharedEdge(a: Room, b: Room) {
  if (near(a.x + a.width, b.x) || near(b.x + b.width, a.x)) {
    const start = Math.max(a.y, b.y),
      end = Math.min(a.y + a.height, b.y + b.height);
    if (end - start > EPS)
      return {
        orientation: "vertical" as const,
        fixed: near(a.x + a.width, b.x) ? b.x : a.x,
        start,
        end,
      };
  }
  if (near(a.y + a.height, b.y) || near(b.y + b.height, a.y)) {
    const start = Math.max(a.x, b.x),
      end = Math.min(a.x + a.width, b.x + b.width);
    if (end - start > EPS)
      return {
        orientation: "horizontal" as const,
        fixed: near(a.y + a.height, b.y) ? b.y : a.y,
        start,
        end,
      };
  }
  return null;
}
export function doorBetween(
  a: Room,
  b: Room,
  id: string,
  width = 2.8,
): Door | null {
  const e = sharedEdge(a, b);
  if (!e || e.end - e.start < width + 0.3) return null;
  const c = (e.start + e.end) / 2;
  return {
    id,
    from: a.id,
    to: b.id,
    x: e.orientation === "vertical" ? e.fixed : c,
    y: e.orientation === "horizontal" ? e.fixed : c,
    width,
    orientation: e.orientation,
    kind:
      OPEN_TYPES.includes(a.type) && OPEN_TYPES.includes(b.type)
        ? "opening"
        : "internal",
  };
}
// Each collinear boundary is split at every endpoint. Coincident shared walls
// become one wall with two room IDs; this same topology powers SVG and Three.js.
export function getWalls(plan: FloorPlan): Wall[] {
  type Edge = {
    orientation: "horizontal" | "vertical";
    fixed: number;
    start: number;
    end: number;
    roomId: string;
  };
  const buckets = new Map<string, Edge[]>();
  for (const r of plan.rooms.filter((r) => !OPEN_TYPES.includes(r.type))) {
    const edges: Edge[] = [
      {
        orientation: "horizontal",
        fixed: r.y,
        start: r.x,
        end: r.x + r.width,
        roomId: r.id,
      },
      {
        orientation: "horizontal",
        fixed: r.y + r.height,
        start: r.x,
        end: r.x + r.width,
        roomId: r.id,
      },
      {
        orientation: "vertical",
        fixed: r.x,
        start: r.y,
        end: r.y + r.height,
        roomId: r.id,
      },
      {
        orientation: "vertical",
        fixed: r.x + r.width,
        start: r.y,
        end: r.y + r.height,
        roomId: r.id,
      },
    ];
    for (const e of edges) {
      const key = e.orientation + ":" + e.fixed.toFixed(4);
      buckets.set(key, [...(buckets.get(key) || []), e]);
    }
  }
  const result: Wall[] = [];
  for (const [key, edges] of buckets) {
    const points = [...new Set(edges.flatMap((e) => [e.start, e.end]))].sort(
      (a, b) => a - b,
    );
    for (let i = 0; i < points.length - 1; i++) {
      const start = points[i],
        end = points[i + 1],
        mid = (start + end) / 2,
        cover = edges.filter((e) => e.start < mid && e.end > mid);
      if (!cover.length) continue;
      const e = cover[0],
        ids = [...new Set(cover.map((c) => c.roomId))];
      result.push({
        id: key + ":" + start,
        x1: e.orientation === "horizontal" ? start : e.fixed,
        y1: e.orientation === "vertical" ? start : e.fixed,
        x2: e.orientation === "horizontal" ? end : e.fixed,
        y2: e.orientation === "vertical" ? end : e.fixed,
        orientation: e.orientation,
        roomIds: ids,
        exterior: ids.length === 1,
      });
    }
  }
  return result;
}
export function openingOnWall(o: Door | Window, w: Wall) {
  const fixed = w.orientation === "horizontal" ? w.y1 : w.x1;
  const p = w.orientation === "horizontal" ? o.y : o.x;
  const c = w.orientation === "horizontal" ? o.x : o.y;
  const start = w.orientation === "horizontal" ? w.x1 : w.y1;
  const end = w.orientation === "horizontal" ? w.x2 : w.y2;
  return (
    o.orientation === w.orientation &&
    near(fixed, p) &&
    c + o.width / 2 > start + EPS &&
    c - o.width / 2 < end - EPS
  );
}
export function splitWall(plan: FloorPlan, w: Wall): WallPiece[] {
  const horizontal = w.orientation === "horizontal",
    start = horizontal ? w.x1 : w.y1,
    end = horizontal ? w.x2 : w.y2,
    fixed = horizontal ? w.y1 : w.x1;
  const holes = [
    ...plan.doors
      .filter((d) => openingOnWall(d, w))
      .map((d) => ({
        start: (horizontal ? d.x : d.y) - d.width / 2,
        end: (horizontal ? d.x : d.y) + d.width / 2,
        bottom: 0,
        top: 7,
      })),
    ...plan.windows
      .filter((d) => openingOnWall(d, w))
      .map((d) => ({
        start: (horizontal ? d.x : d.y) - d.width / 2,
        end: (horizontal ? d.x : d.y) + d.width / 2,
        bottom: d.sill,
        top: d.sill + d.height,
      })),
  ];
  const points = [
      ...new Set([
        start,
        end,
        ...holes.flatMap((o) => [
          Math.max(start, o.start),
          Math.min(end, o.end),
        ]),
      ]),
    ]
      .filter((v) => v >= start && v <= end)
      .sort((a, b) => a - b),
    out: WallPiece[] = [];
  function piece(a: number, b: number, bottom: number, top: number) {
    if (b - a < EPS || top - bottom < EPS) return;
    out.push({
      x: horizontal ? (a + b) / 2 : fixed,
      y: horizontal ? fixed : (a + b) / 2,
      width: horizontal ? b - a : plan.wallThickness,
      depth: horizontal ? plan.wallThickness : b - a,
      bottom,
      height: top - bottom,
      exterior: w.exterior,
    });
  }
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i],
      b = points[i + 1],
      mid = (a + b) / 2,
      voids = holes
        .filter((o) => o.start < mid && o.end > mid)
        .sort((a, b) => a.bottom - b.bottom);
    let cursor = 0;
    for (const hole of voids) {
      piece(a, b, cursor, hole.bottom);
      cursor = Math.max(cursor, hole.top);
    }
    piece(a, b, cursor, plan.wallHeight);
  }
  return out;
}
export function addWindows(plan: FloorPlan): Window[] {
  const walls = getWalls(plan),
    out: Window[] = [];
  for (const r of plan.rooms.filter(
    (r) => !OPEN_TYPES.includes(r.type) && r.type !== "passage",
  )) {
    const candidates = walls
      .filter((w) => w.exterior && w.roomIds.includes(r.id))
      .sort(
        (a, b) =>
          Math.hypot(b.x2 - b.x1, b.y2 - b.y1) -
          Math.hypot(a.x2 - a.x1, a.y2 - a.y1),
      );
    for (const w of candidates) {
      const length = Math.hypot(w.x2 - w.x1, w.y2 - w.y1);
      if (length < 3) continue;
      const width = Math.min(r.type === "bathroom" ? 2 : 4, length - 1.5);
      const window: Window = {
        id: "win-" + r.id,
        roomId: r.id,
        x: (w.x1 + w.x2) / 2,
        y: (w.y1 + w.y2) / 2,
        width,
        orientation: w.orientation,
        sill: r.type === "bathroom" ? 5.3 : 3,
        height: r.type === "bathroom" ? 1.5 : 3.5,
      };
      if (
        plan.doors.some(
          (d) =>
            openingOnWall(d, w) &&
            Math.abs(
              w.orientation === "horizontal" ? d.x - window.x : d.y - window.y,
            ) <
              (d.width + width) / 2 + 0.3,
        )
      )
        continue;
      out.push(window);
      break;
    }
  }
  return out;
}
// The canonical coordinate mapping is shared by mesh placement and tests.
export const roomToWorld = (r: Room) => ({
  x: r.x + r.width / 2,
  y: 0,
  z: r.y + r.height / 2,
  width: r.width,
  depth: r.height,
});
