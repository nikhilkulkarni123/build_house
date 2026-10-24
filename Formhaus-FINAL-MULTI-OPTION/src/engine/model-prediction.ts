import type { FloorPlan } from "./types";

export interface PredictionRect {
  slot: number;
  x: number;
  y: number;
  width: number;
  height: number;
  colour: string;
  name: string;
}

export interface ModelWallSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  exterior: boolean;
  slotA: number;
  slotB: number;
}

function plotSlot(plan: FloorPlan, gx: number, gy: number): number {
  const p = plan.modelPrediction;
  if (!p || !p.grid || !p.plotBox) return 0;
  if (
    gx < p.plotBox.left ||
    gy < p.plotBox.top ||
    gx >= p.plotBox.left + p.plotBox.width ||
    gy >= p.plotBox.top + p.plotBox.height
  ) return 0;
  return p.grid[gy]?.[gx] ?? 0;
}

function isDoorCell(plan: FloorPlan, gx: number, gy: number): boolean {
  const p = plan.modelPrediction;
  return Boolean(p?.doorMask?.[gy]?.[gx]);
}

/**
 * Converts the raw 64x64 prediction into larger maximal rectangles while
 * preserving every predicted cell exactly. This is visualization-only:
 * it never decides where a room should go and never changes a room label.
 */
export function predictionRectangles(plan: FloorPlan): PredictionRect[] {
  const p = plan.modelPrediction;
  if (!p || !p.grid || !p.plotBox) return [];
  const sx = plan.plot.width / p.plotBox.width;
  const sy = plan.plot.length / p.plotBox.height;
  const slotMap = new Map(p.roomSlots.map((s) => [s.slot, s]));

  type Run = { slot: number; gx0: number; gx1: number; gy0: number; gy1: number };
  const completed: Run[] = [];
  let active = new Map<string, Run>();

  for (let gy = p.plotBox.top; gy < p.plotBox.top + p.plotBox.height; gy++) {
    const rowRuns: Run[] = [];
    let gx = p.plotBox.left;
    while (gx < p.plotBox.left + p.plotBox.width) {
      const slot = plotSlot(plan, gx, gy);
      let end = gx + 1;
      while (
        end < p.plotBox.left + p.plotBox.width &&
        plotSlot(plan, end, gy) === slot
      ) end++;
      if (slot > 0 && slotMap.has(slot)) {
        rowRuns.push({ slot, gx0: gx, gx1: end, gy0: gy, gy1: gy + 1 });
      }
      gx = end;
    }

    const next = new Map<string, Run>();
    for (const run of rowRuns) {
      const key = `${run.slot}:${run.gx0}:${run.gx1}`;
      const previous = active.get(key);
      if (previous && previous.gy1 === gy) {
        previous.gy1 = gy + 1;
        next.set(key, previous);
      } else {
        next.set(key, run);
      }
    }
    for (const [key, run] of active) {
      if (!next.has(key)) completed.push(run);
    }
    active = next;
  }
  completed.push(...active.values());

  return completed.map((r) => {
    const meta = slotMap.get(r.slot)!;
    return {
      slot: r.slot,
      x: (r.gx0 - p.plotBox.left) * sx,
      y: (r.gy0 - p.plotBox.top) * sy,
      width: (r.gx1 - r.gx0) * sx,
      height: (r.gy1 - r.gy0) * sy,
      colour: meta.colour,
      name: meta.name,
    };
  });
}

/** Backwards-compatible alias used by older components. */
export const predictionStrips = predictionRectangles;

/**
 * Extracts room boundaries directly from model-labelled cells and merges
 * consecutive collinear edges. Entrance cells from the notebook-style door
 * mask are left open on the exterior boundary.
 */
export function modelWallSegments(plan: FloorPlan): ModelWallSegment[] {
  const p = plan.modelPrediction;
  if (!p || !p.grid || !p.plotBox) return [];
  const { left, top, width, height } = p.plotBox;
  const sx = plan.plot.width / width;
  const sy = plan.plot.length / height;

  type UnitEdge = {
    orientation: "h" | "v";
    fixed: number;
    start: number;
    end: number;
    slotA: number;
    slotB: number;
    exterior: boolean;
  };
  const units: UnitEdge[] = [];

  // Vertical boundaries. Each grid line is examined once.
  for (let gy = top; gy < top + height; gy++) {
    for (let gx = left; gx <= left + width; gx++) {
      const a = gx > left ? plotSlot(plan, gx - 1, gy) : 0;
      const b = gx < left + width ? plotSlot(plan, gx, gy) : 0;
      if (a === b || (a === 0 && b === 0)) continue;
      const exterior = gx === left || gx === left + width;
      if (exterior) {
        const insideX = gx === left ? gx : gx - 1;
        if (isDoorCell(plan, insideX, gy)) continue;
      }
      units.push({ orientation: "v", fixed: gx, start: gy, end: gy + 1, slotA: a, slotB: b, exterior });
    }
  }

  // Horizontal boundaries. Each grid line is examined once.
  for (let gy = top; gy <= top + height; gy++) {
    for (let gx = left; gx < left + width; gx++) {
      const a = gy > top ? plotSlot(plan, gx, gy - 1) : 0;
      const b = gy < top + height ? plotSlot(plan, gx, gy) : 0;
      if (a === b || (a === 0 && b === 0)) continue;
      const exterior = gy === top || gy === top + height;
      if (exterior) {
        const insideY = gy === top ? gy : gy - 1;
        if (isDoorCell(plan, gx, insideY)) continue;
      }
      units.push({ orientation: "h", fixed: gy, start: gx, end: gx + 1, slotA: a, slotB: b, exterior });
    }
  }

  // Merge only edges with the same orientation, room pair and exterior flag.
  units.sort((a, b) =>
    a.orientation.localeCompare(b.orientation) ||
    a.fixed - b.fixed ||
    a.slotA - b.slotA ||
    a.slotB - b.slotB ||
    Number(a.exterior) - Number(b.exterior) ||
    a.start - b.start,
  );
  const merged: UnitEdge[] = [];
  for (const edge of units) {
    const last = merged[merged.length - 1];
    if (
      last &&
      last.orientation === edge.orientation &&
      last.fixed === edge.fixed &&
      last.slotA === edge.slotA &&
      last.slotB === edge.slotB &&
      last.exterior === edge.exterior &&
      last.end === edge.start
    ) {
      last.end = edge.end;
    } else {
      merged.push({ ...edge });
    }
  }

  return merged.map((e) => {
    if (e.orientation === "v") {
      const x = (e.fixed - left) * sx;
      return {
        x1: x,
        y1: (e.start - top) * sy,
        x2: x,
        y2: (e.end - top) * sy,
        exterior: e.exterior,
        slotA: e.slotA,
        slotB: e.slotB,
      };
    }
    const y = (e.fixed - top) * sy;
    return {
      x1: (e.start - left) * sx,
      y1: y,
      x2: (e.end - left) * sx,
      y2: y,
      exterior: e.exterior,
      slotA: e.slotA,
      slotB: e.slotB,
    };
  });
}

export function modelRoomAt(plan: FloorPlan, x: number, y: number) {
  const p = plan.modelPrediction;
  if (!p || !p.grid || !p.plotBox) return null;
  const gx = Math.min(
    p.plotBox.left + p.plotBox.width - 1,
    Math.max(
      p.plotBox.left,
      p.plotBox.left + Math.floor((x / plan.plot.width) * p.plotBox.width),
    ),
  );
  const gy = Math.min(
    p.plotBox.top + p.plotBox.height - 1,
    Math.max(
      p.plotBox.top,
      p.plotBox.top + Math.floor((y / plan.plot.length) * p.plotBox.height),
    ),
  );
  const slot = p.grid[gy]?.[gx] ?? 0;
  return plan.rooms.find((r) => r.id === `model-room-${slot}`) || null;
}

export function modelSlotForRoom(plan: FloorPlan, roomId: string) {
  const p = plan.modelPrediction;
  if (!p) return null;
  const match = /^model-room-(\d+)$/.exec(roomId);
  if (!match) return null;
  const slot = Number(match[1]);
  return p.roomSlots.find((s) => s.slot === slot) || null;
}
