import {
  type World,
  type SimConfig,
  type BackroomLayout,
  DEFAULT_CONFIG,
} from "../types";
import type { WorkflowGraph } from "../workflow/graph";
import { DEFAULT_WORKFLOW } from "../kitchen/workflow";
import { DEFAULT_LAYOUT } from "../defaultLayout";
import { createWorld, tickWorldPassive } from "../simulation";
import { execute } from "../engine/execute";
import { observe } from "./observe";
import { resolveAgentAction } from "./resolve";
import { computeReward, initialRewardState, type RewardState } from "./reward";
import {
  type Observation,
  type StepResult,
  type AgentAction,
  ACTION_COUNT,
  OBS_SIZE,
} from "./types";

export interface EnvConfig {
  sim?: Partial<SimConfig>;
  layout?: BackroomLayout;
  workflow?: WorkflowGraph;
  maxTicks?: number;
}

const DEFAULT_MAX_TICKS = 5000;

/**
 * Gym-like environment wrapping the backroom simulation.
 *
 * Multi-agent: one observation + action + reward per active worker per step.
 * Workers that are busy (working or in move cooldown) automatically skip.
 */
export class BackroomEnv {
  private world!: World;
  private rewardStates!: Map<number, RewardState>;
  private readonly simConfig: SimConfig;
  private readonly layout: BackroomLayout;
  private readonly workflow: WorkflowGraph;
  private readonly maxTicks: number;

  readonly numAgents: number;
  readonly obsSize = OBS_SIZE;
  readonly actionCount = ACTION_COUNT;

  constructor(envConfig: EnvConfig = {}) {
    this.simConfig = { ...DEFAULT_CONFIG, ...envConfig.sim };
    this.layout = envConfig.layout ?? DEFAULT_LAYOUT;
    this.workflow = envConfig.workflow ?? DEFAULT_WORKFLOW;
    this.maxTicks = envConfig.maxTicks ?? DEFAULT_MAX_TICKS;
    this.numAgents = this.simConfig.workerCount;
  }

  /** Reset environment, return initial observations. */
  reset(): Observation[] {
    this.world = createWorld(this.simConfig, this.layout, this.workflow);
    this.rewardStates = new Map();
    for (const w of this.world.workers) {
      this.rewardStates.set(w.id, initialRewardState());
    }
    return this.world.workers.map((w) => observe(this.world, w));
  }

  /**
   * Step one tick.
   *
   * @param actions One AgentAction per worker (same order as workers array).
   */
  step(actions: AgentAction[]): StepResult {
    const world = this.world;

    // 1. Apply actions for workers that are ready
    for (let i = 0; i < world.workers.length; i++) {
      const worker = world.workers[i];
      if (worker.departing || worker.state === "working" || worker.moveCooldown > 0) {
        continue;
      }
      const agentAction = actions[i] ?? 7; // default WAIT
      const { action, perception } = resolveAgentAction(agentAction, world, worker);
      execute(world, worker, action, perception);
    }

    // 2. Passive tick: deliveries, auto transitions, cooldowns, work completion
    tickWorldPassive(world);

    // 3. Observations + rewards
    const observations: Observation[] = [];
    const rewards: number[] = [];
    for (const worker of world.workers) {
      observations.push(observe(world, worker));
      const prev = this.rewardStates.get(worker.id) ?? initialRewardState();
      const { reward, next } = computeReward(world, worker, prev);
      rewards.push(reward);
      this.rewardStates.set(worker.id, next);
    }

    // 4. Done + info
    const done = world.tick >= this.maxTicks;
    const itemsByState: Record<string, number> = {};
    for (const item of world.items) {
      itemsByState[item.state] = (itemsByState[item.state] ?? 0) + 1;
    }

    return { observations, rewards, done, info: { tick: world.tick, itemsByState } };
  }

  /** Current world (for debugging/visualization). */
  getWorld(): World {
    return this.world;
  }
}
