/**
 * Environment interface types.
 *
 * Action space: 8 discrete actions (per worker, per tick)
 * Observation space: local 7×7 grid view + agent state = 198 floats
 */

// ─── Actions ────────────────────────────────────────────────

export const AgentAction = {
  MOVE_N: 0,
  MOVE_S: 1,
  MOVE_W: 2,
  MOVE_E: 3,
  PICKUP: 4,
  DROP: 5,
  WORK: 6,
  WAIT: 7,
} as const;

export type AgentAction = (typeof AgentAction)[keyof typeof AgentAction];

export const ACTION_COUNT = 8;

// ─── Observations ───────────────────────────────────────────

/** View radius: 3 → 7×7 grid */
export const VIEW_RADIUS = 3;
export const VIEW_SIZE = VIEW_RADIUS * 2 + 1; // 7

/**
 * Per-cell channels:
 *   [0] stationType  — 0=OOB, 1=floor, 2..12=station types (normalized /12)
 *   [1] hasItem      — 0 or 1
 *   [2] itemState    — 0=none, 1..7=raw..stored (normalized /7)
 *   [3] hasWorker    — 0=no, 1=other worker present
 */
export const CELL_CHANNELS = 4;

/**
 * Agent-level features (appended after grid):
 *   [0] carryingItemType   — 0=none, 1..4=onion..soup_base (normalized /4)
 *   [1] carryingItemState  — 0=none, 1..7=raw..stored (normalized /7)
 */
export const AGENT_FEATURES = 2;

export const OBS_SIZE = VIEW_SIZE * VIEW_SIZE * CELL_CHANNELS + AGENT_FEATURES;

export type Observation = Float32Array;

// ─── Environment ────────────────────────────────────────────

export interface StepResult {
  /** One observation per active worker */
  observations: Observation[];
  /** One reward per active worker */
  rewards: number[];
  /** True when episode ends (e.g., tick limit) */
  done: boolean;
  /** Extra info for logging */
  info: {
    tick: number;
    itemsByState: Record<string, number>;
  };
}
