import type { World, Worker, ItemState } from "../types";

/**
 * Per-worker reward state — tracks what changed between ticks.
 */
export interface RewardState {
  wasCarrying: boolean;
  itemStates: Map<number, ItemState>;
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

const REWARD_TICK = -0.01;
const REWARD_PICKUP = 0.5;
const REWARD_WORK_COMPLETE = 2.0;

/**
 * Compute reward for a single worker after one tick.
 * Milestone rewards are read from world.recipe.rewardMilestones.
 */
export function computeReward(
  world: World,
  worker: Worker,
  prev: RewardState,
): { reward: number; next: RewardState } {
  let reward = REWARD_TICK;

  const isCarrying = worker.carryingItem !== null;
  const isWorking = worker.state === "working";

  if (isCarrying && !prev.wasCarrying) {
    reward += REWARD_PICKUP;
  }

  if (prev.wasWorking && !isWorking) {
    reward += REWARD_WORK_COMPLETE;

    // Recipe-defined milestone rewards
    const milestones = world.recipe.rewardMilestones;
    for (const item of world.items) {
      const prevState = prev.itemStates.get(item.id);
      if (prevState === undefined) continue;
      if (prevState !== item.state) {
        for (const m of milestones) {
          if (item.state === m.state) {
            reward += m.reward;
          }
        }
      }
    }
  }

  const nextItemStates = new Map<number, ItemState>();
  if (worker.carryingItem !== null) {
    const item = world.items.find((i) => i.id === worker.carryingItem);
    if (item) nextItemStates.set(item.id, item.state);
  }
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
