import type { World, Worker, ItemState } from "../types";

/**
 * Per-worker reward state — tracks what changed between ticks.
 */
export interface RewardState {
  /** Was the worker carrying an item last tick? */
  wasCarrying: boolean;
  /** Item states snapshot (id → state) for items this worker touched */
  itemStates: Map<number, ItemState>;
  /** Was the worker working last tick? */
  wasWorking: boolean;
}

export function initialRewardState(): RewardState {
  return {
    wasCarrying: false,
    itemStates: new Map(),
    wasWorking: false,
  };
}

// ─── Reward constants ───────────────────────────────────────

const REWARD_TICK = -0.01;           // time pressure
const REWARD_PICKUP = 0.5;           // picked up an item
const REWARD_WORK_COMPLETE = 2.0;    // completed a processing step
const REWARD_SERVE = 5.0;            // item reached "served"
const REWARD_STORE = 1.0;            // item stored (cycle complete)
// Available for future reward shaping:
// const REWARD_INVALID = -0.1;         // wasted action
// const STATE_PROGRESS = { raw: 0, chopped: 1, cooked: 2, served: 3, dirty: 4, clean: 5, stored: 6 };

/**
 * Compute reward for a single worker after one tick.
 *
 * Call AFTER tickWorld but BEFORE updating reward state.
 */
export function computeReward(
  world: World,
  worker: Worker,
  prev: RewardState,
): { reward: number; next: RewardState } {
  let reward = REWARD_TICK;

  const isCarrying = worker.carryingItem !== null;
  const isWorking = worker.state === "working";

  // Pickup reward: wasn't carrying → now carrying
  if (isCarrying && !prev.wasCarrying) {
    reward += REWARD_PICKUP;
  }

  // Work completion: was working → now idle (finished)
  if (prev.wasWorking && !isWorking) {
    reward += REWARD_WORK_COMPLETE;

    // Check if the completed work produced a "served" or "stored" item
    for (const item of world.items) {
      const prevState = prev.itemStates.get(item.id);
      if (prevState === undefined) continue;
      if (prevState !== item.state) {
        if (item.state === "served") reward += REWARD_SERVE;
        if (item.state === "stored") reward += REWARD_STORE;
      }
    }
  }

  // Update reward state
  const nextItemStates = new Map<number, ItemState>();
  // Track items near the worker or being carried
  if (worker.carryingItem !== null) {
    const item = world.items.find((i) => i.id === worker.carryingItem);
    if (item) nextItemStates.set(item.id, item.state);
  }
  // Track adjacent items
  for (const item of world.items) {
    if (item.carriedBy !== null) continue;
    const dist = Math.abs(item.x - worker.x) + Math.abs(item.y - worker.y);
    if (dist <= 1) nextItemStates.set(item.id, item.state);
  }

  return {
    reward,
    next: {
      wasCarrying: isCarrying,
      itemStates: nextItemStates,
      wasWorking: isWorking,
    },
  };
}
