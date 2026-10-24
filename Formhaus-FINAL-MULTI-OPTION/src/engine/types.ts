export type Direction = "North" | "South" | "East" | "West";
export type RoomType =
  | "living"
  | "bedroom"
  | "kitchen"
  | "bathroom"
  | "passage"
  | "porch"
  | "parking"
  | "utility"
  | "study"
  | "pooja"
  | "open";
export interface Requirements {
  width: number;
  length: number;
  bedrooms: 1 | 2 | 3;
  bathrooms: number;
  parking: boolean;
  entrance: Direction;
  utility: boolean;
  study: boolean;
  pooja: boolean;
  openSpace: boolean;
}
export interface Plot {
  width: number;
  length: number;
  unit: "ft";
  entrance: Direction;
}
export interface Room {
  id: string;
  name: string;
  type: RoomType;
  x: number;
  y: number;
  width: number;
  height: number;
  colour: string;
}
export interface Door {
  id: string;
  from: string | "outside";
  to: string;
  x: number;
  y: number;
  width: number;
  orientation: "horizontal" | "vertical";
  kind: "entrance" | "internal" | "opening";
}
export interface Window {
  id: string;
  roomId: string;
  x: number;
  y: number;
  width: number;
  orientation: "horizontal" | "vertical";
  sill: number;
  height: number;
}
export interface ModelRoomSlot {
  slot: number;
  typeId: number;
  name: string;
  type: RoomType;
  colour: string;
  pixels: number;
  plotShare: number;
  areaSqFt: number;
  labelX: number | null;
  labelY: number | null;
  componentCount: number;
  mainComponentPixels: number;
}
export interface StructuredBoxPrediction {
  slot: number;
  typeId: number;
  name: string;
  type: RoomType;
  colour: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  plotShare: number;
  areaSqFt: number;
  labelX: number;
  labelY: number;
}
export interface ModelOverlapPair {
  roomA: string;
  roomB: string;
  overlapSqFt: number;
  overlapShare: number;
}
export interface ModelFeasibility {
  practical: boolean;
  plotAreaSqFt: number;
  undersizedRooms: Array<{ name: string; predicted: [number, number]; minimum: [number, number] }>;
  note: string;
}

export interface LearnedCirculation {
  name: string;
  type: "passage";
  colour: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  x: number;
  y: number;
  width: number;
  height: number;
  areaSqFt: number;
  note: string;
}
export interface LearnedAdjacencyEdge {
  id: string;
  roomAId: string;
  roomBId: string;
  roomA: string;
  roomB: string;
  probability: number;
}
export interface LearnedDoorCandidate {
  id: string;
  roomAId: string;
  roomBId: string;
  roomA: string;
  roomB: string;
  x: number;
  y: number;
  orientation: "horizontal" | "vertical";
  orientationProbability: number;
  adjacencyProbability: number;
  width: number;
  renderedAsWallOpening: boolean;
}
export interface LearnedCoverage {
  roomUnionShare: number;
  circulationVisibleShare: number;
  residualShare: number;
  method: string;
}

export interface ModelPrediction {
  imageSize: number;
  trainingImageSize: number;
  inferenceMode: "joint-partition" | "learned-rectangles" | "same-checkpoint-high-resolution" | string;
  grid: number[][];
  plotMask: number[][];
  doorMask: number[][];
  plotBox: { left: number; top: number; width: number; height: number };
  roomSlots: ModelRoomSlot[];
  structuredBoxes?: StructuredBoxPrediction[];
  requestedTypeIds: number[];
  missingRequestedRooms: string[];
  checkpointEpoch: number;
  validationLoss: number;
  totalOverlapShare?: number;
  overlapPairs?: ModelOverlapPair[];
  trainingMethod?: string;
  feasibility?: ModelFeasibility;
  circulation?: LearnedCirculation;
  adjacencyEdges?: LearnedAdjacencyEdge[];
  doorCandidates?: LearnedDoorCandidate[];
  coverage?: LearnedCoverage;
  partitionMethod?: string;
  candidateSeed?: number;
  latentStrength?: number;
  candidateScore?: number;
  candidateRank?: number;
  sourceCandidateIndex?: number;
  diversityFromBest?: number;
  candidateMetrics?: {
    reachableShare: number;
    allReachable: boolean;
    meanRoomAspect: number;
    compactnessScore: number;
    passageWidthFt: number;
    practical: boolean;
    undersizedCount: number;
    doorCount: number;
    reachableRoomIds?: string[];
    unreachableRooms?: string[];
  };
}
export interface FloorPlan {
  schemaVersion: 1;
  id: string;
  name: string;
  createdAt: string;
  source: "model";
  plot: Plot;
  requirements: Requirements;
  rooms: Room[];
  doors: Door[];
  windows: Window[];
  wallHeight: number;
  wallThickness: number;
  notes: string[];
  modelPrediction?: ModelPrediction;
}
export interface ValidationCheck {
  id: string;
  label: string;
  status: "pass" | "warning" | "fail";
  detail: string;
}
export interface ValidationResult {
  valid: boolean;
  checks: ValidationCheck[];
  reachableRoomIds: string[];
}
export interface Wall {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  orientation: "horizontal" | "vertical";
  roomIds: string[];
  exterior: boolean;
}
export interface WallPiece {
  x: number;
  y: number;
  width: number;
  depth: number;
  bottom: number;
  height: number;
  exterior: boolean;
}
export const DEFAULT_REQUIREMENTS: Requirements = {
  width: 50,
  length: 45,
  bedrooms: 2,
  bathrooms: 1,
  parking: false,
  entrance: "North",
  utility: false,
  study: false,
  pooja: false,
  openSpace: true,
};
export const COLOURS: Record<RoomType, string> = {
  living: "#d9e7df",
  bedroom: "#eee3d1",
  kitchen: "#dae4ed",
  bathroom: "#dce9eb",
  passage: "#f1eee7",
  porch: "#e9e3d8",
  parking: "#e1e5e4",
  utility: "#dbe5e0",
  study: "#e3ddeb",
  pooja: "#f0e7d1",
  open: "#d3e2c9",
};
export const OPEN_TYPES: RoomType[] = ["parking", "porch", "open"];
