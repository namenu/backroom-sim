import type { ItemState, ItemType, StationType } from "../types";
import type { PlaceRole } from "../workflow/types";

// ============================================================
// Views — readonly snapshots extracted from world state
// ============================================================

export interface ItemView {
  readonly id: number;
  readonly type: ItemType;
  readonly state: ItemState;
  readonly x: number;
  readonly y: number;
}

export interface StationView {
  readonly type: StationType;
  readonly x: number;
  readonly y: number;
}

export interface TransformRuleView {
  readonly station: StationType;
  readonly fromState: ItemState;
  readonly toState: ItemState;
  readonly duration: number;
}

// ============================================================
// Perception — pure derivation from World + Worker
// ============================================================

export interface AdjacentPickup {
  readonly item: ItemView;
  readonly station: StationView;
  readonly nextStationType: StationType | null;
  readonly nearestNext: { readonly x: number; readonly y: number } | null;
}

export interface Perception {
  readonly workerId: number;
  readonly workerX: number;
  readonly workerY: number;

  // --- Carrying context ---
  readonly carriedItem: ItemView | null;
  readonly carriedPickupRole: PlaceRole | undefined;
  readonly adjacentStorageForCarried: StationView | null;
  readonly adjacentTransform: {
    readonly station: StationView;
    readonly rule: TransformRuleView;
  } | null;
  readonly nextStationForCarried: StationType | null;
  readonly nearestNextStation: { readonly x: number; readonly y: number } | null;
  readonly nearestStorageForCarried: { readonly x: number; readonly y: number } | null;

  // --- Not-carrying context ---
  readonly adjacentReturning: readonly AdjacentPickup[];
  readonly adjacentReceiving: readonly ItemView[];
  readonly adjacentStorageProcessable: readonly AdjacentPickup[];
  readonly adjacentProcessDone: readonly AdjacentPickup[];

  // --- Global scan ---
  readonly nearestWork: {
    readonly x: number;
    readonly y: number;
    readonly stationType: StationType;
  } | null;

  // --- BFS directions (first step toward target, null = already adjacent/no path) ---
  readonly dirToNextStation: readonly [number, number] | null;
  readonly dirToStorage: readonly [number, number] | null;
  readonly dirToWork: readonly [number, number] | null;

  // --- Pipeline awareness (stigmergy signals) ---
  readonly pipeline: PipelineSnapshot;
}

// ============================================================
// Pipeline snapshot — global environment signals
// ============================================================

export interface StationSummary {
  /** Total stations of this type in the layout */
  readonly total: number;
  /** Items currently sitting at these stations (not carried) */
  readonly itemCount: number;
  /** Workers currently in "working" state adjacent to this station type */
  readonly workersBusy: number;
}

export interface PipelineSnapshot {
  /** Per-station-type summary */
  readonly stations: Readonly<Record<string, StationSummary>>;
  /** Item counts grouped by state (e.g., raw: 4, chopped: 2) */
  readonly itemsByState: Readonly<Record<string, number>>;
}

// ============================================================
// Condition — discriminated union, evaluated against Perception
// ============================================================

export type Condition =
  | { readonly kind: "carrying" }
  | { readonly kind: "notCarrying" }
  | { readonly kind: "carriedItemState"; readonly state: ItemState }
  | { readonly kind: "carriedPickupRole"; readonly role: PlaceRole }
  | { readonly kind: "hasAdjacentStorage" }
  | { readonly kind: "hasAdjacentTransform" }
  | { readonly kind: "hasNextStation" }
  | { readonly kind: "hasAdjacentReturning" }
  | { readonly kind: "hasAdjacentReceiving" }
  | { readonly kind: "hasAdjacentStorageProcessable" }
  | { readonly kind: "hasAdjacentProcessDone" }
  | { readonly kind: "hasGlobalWork" }
  // --- Pipeline-aware conditions ---
  | { readonly kind: "nextStationHasCapacity"; readonly stationType: StationType }
  | { readonly kind: "stationOverloaded"; readonly stationType: StationType; readonly threshold: number }
  | { readonly kind: "itemStateCount"; readonly state: ItemState; readonly min?: number; readonly max?: number };

// ============================================================
// Action — low-level primitives executed each tick
// ============================================================

export type Action =
  | { readonly kind: "move"; readonly dx: number; readonly dy: number }
  | { readonly kind: "pickup"; readonly itemId: number }
  | { readonly kind: "drop" }
  | { readonly kind: "work" }
  | { readonly kind: "wait" };

// ============================================================
// Intent — what rules produce (resolved to Action via perception)
// ============================================================

export type Intent =
  | { readonly kind: "dropAtAdjacentStorage" }
  | { readonly kind: "moveToStorage" }
  | { readonly kind: "workAtAdjacentTransform" }
  | { readonly kind: "moveToNextStation" }
  | { readonly kind: "pickUpReturning" }
  | { readonly kind: "pickUpReceiving" }
  | { readonly kind: "pickUpStorageProcessable" }
  | { readonly kind: "pickUpProcessDone" }
  | { readonly kind: "seekWork" }
  | { readonly kind: "idle" };

// ============================================================
// Rule — condition list (AND) → intent
// ============================================================

export interface Rule {
  readonly name: string;
  readonly when: readonly Condition[];
  readonly then: Intent;
}
