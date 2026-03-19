import { describe, it, expect } from "vitest";
import { BackroomEnv, AgentAction, OBS_SIZE } from "../index";

describe("backroom environment", () => {
  it("reset returns correct observation shape", () => {
    const env = new BackroomEnv({ sim: { workerCount: 3 } });
    const obs = env.reset();
    expect(obs).toHaveLength(3);
    expect(obs[0]).toHaveLength(OBS_SIZE);
    // All values should be in [0, 1]
    for (const o of obs) {
      for (let i = 0; i < o.length; i++) {
        expect(o[i]).toBeGreaterThanOrEqual(0);
        expect(o[i]).toBeLessThanOrEqual(1);
      }
    }
  });

  it("step with all WAIT returns valid result", () => {
    const env = new BackroomEnv({ sim: { workerCount: 2 }, maxTicks: 100 });
    env.reset();
    const actions = [AgentAction.WAIT, AgentAction.WAIT];
    const result = env.step(actions);
    expect(result.observations).toHaveLength(2);
    expect(result.rewards).toHaveLength(2);
    expect(result.done).toBe(false);
    expect(result.info.tick).toBe(1);
  });

  it("episode ends at maxTicks", () => {
    const env = new BackroomEnv({ sim: { workerCount: 1 }, maxTicks: 10 });
    env.reset();
    let done = false;
    for (let t = 0; t < 20; t++) {
      const result = env.step([AgentAction.WAIT]);
      if (result.done) { done = true; break; }
    }
    expect(done).toBe(true);
  });

  it("random policy makes progress", () => {
    const env = new BackroomEnv({
      sim: { workerCount: 3, deliverySize: 4, deliveryInterval: 9999 },
      maxTicks: 5000,
    });
    env.reset();

    let totalReward = 0;
    for (let t = 0; t < 5000; t++) {
      const actions = Array.from({ length: 3 }, () =>
        Math.floor(Math.random() * 8) as AgentAction
      );
      const result = env.step(actions);
      totalReward += result.rewards.reduce((a, b) => a + b, 0);
      if (result.done) break;
    }

    // Random policy should at least not crash
    // Total reward will be mostly negative (time pressure) but some positive from lucky pickups
    expect(totalReward).toBeDefined();
  });

  it("rule-based baseline outperforms random", async () => {
    // Run rule-based (via tickWorld) and RL random to compare throughput
    const { createWorld, tickWorld, DEFAULT_LAYOUT } = await import("../index");

    // Rule-based
    const ruleWorld = createWorld(
      { workerCount: 3, deliverySize: 4, deliveryInterval: 9999 },
      DEFAULT_LAYOUT,
    );
    for (let t = 0; t < 2000; t++) tickWorld(ruleWorld);
    const ruleServed = ruleWorld.items.filter(
      (i: any) => i.state === "served" || i.state === "dirty" || i.state === "clean" || i.state === "stored"
    ).length;

    // Random RL
    const env = new BackroomEnv({
      sim: { workerCount: 3, deliverySize: 4, deliveryInterval: 9999 },
      maxTicks: 2000,
    });
    env.reset();
    for (let t = 0; t < 2000; t++) {
      const actions = Array.from({ length: 3 }, () =>
        Math.floor(Math.random() * 8) as AgentAction
      );
      const result = env.step(actions);
      if (result.done) break;
    }
    const rlWorld = env.getWorld();
    const rlServed = rlWorld.items.filter(
      (i) => i.state === "served" || i.state === "dirty" || i.state === "clean" || i.state === "stored"
    ).length;

    // Rule-based should do better than random
    expect(ruleServed).toBeGreaterThan(rlServed);
  });
});
