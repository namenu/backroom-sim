/** Role a place plays in the workflow */
export type PlaceRole = "intake" | "storage" | "process" | "output" | "return" | "entrance";

/** A node in the workflow graph where tokens can reside */
export interface Place<P extends string = string> {
  readonly id: P;
  readonly capacity?: number;
  readonly role?: PlaceRole;
}

/** A processing step: transforms a token's color at a specific place */
export interface Transition<P extends string = string, C extends string = string> {
  readonly id: string;
  readonly placeId: P;
  readonly fromColor: C;
  readonly toColor: C;
  readonly duration: number;
  /** Fires automatically (time-based) without a worker */
  readonly auto?: boolean;
  /** Where the token moves after an auto transition (default: stays at placeId) */
  readonly targetPlaceId?: P;
}

/** Routes a token to a specific storage place based on a tag (e.g., item type) */
export interface StorageRoute<P extends string = string, T extends string = string> {
  readonly tokenTag: T;
  readonly toPlaceId: P;
}

/** Declarative workflow definition */
export interface WorkflowDef<P extends string = string, C extends string = string, T extends string = string> {
  readonly places: readonly Place<P>[];
  readonly transitions: readonly Transition<P, C>[];
  readonly defaultStorageId?: P;
  readonly storageRoutes?: readonly StorageRoute<P, T>[];
}
