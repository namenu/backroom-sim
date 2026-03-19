import type { WorkflowDef, Transition, Place, PlaceRole } from "./types";

/**
 * Indexed workflow graph — provides efficient queries over a WorkflowDef.
 *
 * Conceptually a Timed Colored Petri Net:
 *   Place  = node where tokens reside (with role: intake/storage/process/output/return)
 *   Transition = timed firing rule (fromColor → toColor at a place)
 *   Token color = item state (e.g., "raw", "chopped", "cooked")
 */
export class WorkflowGraph {
  readonly def: WorkflowDef;
  private _placeById = new Map<string, Place>();
  private _transitionsByPlace = new Map<string, Transition[]>();
  private _transitionByFromColor = new Map<string, Transition>();
  private _terminalColors = new Set<string>();
  private _outputs = new Set<string>();
  private _storageRoutesByTag = new Map<string, string>();
  private _autoTransitionsByPlace = new Map<string, Transition[]>();

  constructor(def: WorkflowDef) {
    this.def = def;

    for (const p of def.places) {
      this._placeById.set(p.id, p);
    }

    // Colors consumed by worker (non-auto) transitions
    const workerFromColors = new Set<string>();

    for (const t of def.transitions) {
      if (t.auto) {
        let list = this._autoTransitionsByPlace.get(t.placeId);
        if (!list) { list = []; this._autoTransitionsByPlace.set(t.placeId, list); }
        list.push(t);
      } else {
        let list = this._transitionsByPlace.get(t.placeId);
        if (!list) { list = []; this._transitionsByPlace.set(t.placeId, list); }
        list.push(t);
        workerFromColors.add(t.fromColor);
      }

      // Routing index: only non-auto transitions (workers don't route to auto places)
      if (!t.auto && !this._transitionByFromColor.has(t.fromColor)) {
        this._transitionByFromColor.set(t.fromColor, t);
      }

      this._outputs.add(`${t.placeId}:${t.toColor}`);
    }

    // Terminal colors: produced but never consumed by worker transitions
    // (auto-only inputs like "served" remain terminal for workers)
    for (const t of def.transitions) {
      if (!workerFromColors.has(t.toColor)) {
        this._terminalColors.add(t.toColor);
      }
    }

    for (const r of def.storageRoutes ?? []) {
      this._storageRoutesByTag.set(r.tokenTag, r.toPlaceId);
    }
  }

  /** Find a transition that can process this color at this place */
  findTransition(placeId: string, tokenColor: string): Transition | null {
    const list = this._transitionsByPlace.get(placeId);
    return list?.find((t) => t.fromColor === tokenColor) ?? null;
  }

  /** Where should a token with this color go next for processing? */
  nextPlaceFor(tokenColor: string): string | null {
    return this._transitionByFromColor.get(tokenColor)?.placeId ?? null;
  }

  /** Is this color terminal (no further processing available)? */
  isTerminal(tokenColor: string): boolean {
    return this._terminalColors.has(tokenColor);
  }

  /** Was a token with this color produced by a transition at this place? */
  isOutputOf(placeId: string, tokenColor: string): boolean {
    return this._outputs.has(`${placeId}:${tokenColor}`);
  }

  /** Get the role of a place */
  placeRole(placeId: string): PlaceRole | undefined {
    return this._placeById.get(placeId)?.role;
  }

  /** Determine which storage place a token should go to */
  storageFor(tokenTag: string): string | null {
    return this._storageRoutesByTag.get(tokenTag) ?? this.def.defaultStorageId ?? null;
  }

  /** Get auto-firing transitions at a place */
  autoTransitionsAt(placeId: string): readonly Transition[] {
    return this._autoTransitionsByPlace.get(placeId) ?? [];
  }

  get places(): readonly Place[] {
    return this.def.places;
  }

  get transitions(): readonly Transition[] {
    return this.def.transitions;
  }
}
