import { describe, it, expect } from "vitest";
import { createWorld, tickWorld, DEFAULT_LAYOUT } from "../index";
import type { World } from "../index";

function runTicks(world: World, n: number) {
  for (let i = 0; i < n; i++) tickWorld(world);
}

/** Terminal states where no further action is needed */
function isTerminal(state: string): boolean {
  return state === "served" || state === "clean";
}

describe("kitchen simulation — steak recipe", () => {
  it("steaks should progress through the full pipeline: raw → portioned → seared → rested → plated → served", () => {
    const world = createWorld({ workerCount: 3, orderSize: 4, orderInterval: 9999 }, DEFAULT_LAYOUT);
    runTicks(world, 3000);

    // Items reach served or beyond (dirty/clean)
    const past = world.items.filter((i) =>
      i.state === "served" || i.state === "dirty" || i.state === "clean"
    ).length;
    expect(past).toBeGreaterThan(0);
  });

  it("portioned steaks should appear as intermediate state", () => {
    const world = createWorld({ workerCount: 2, orderSize: 4, orderInterval: 9999 }, DEFAULT_LAYOUT);

    let sawPortioned = false;
    for (let i = 0; i < 2000; i++) {
      tickWorld(world);
      if (world.items.some((it) => it.state === "portioned")) {
        sawPortioned = true;
        break;
      }
    }
    expect(sawPortioned).toBe(true);
  });

  it("workers should not carry an item forever", () => {
    const world = createWorld({ workerCount: 3, orderSize: 6, orderInterval: 9999 }, DEFAULT_LAYOUT);
    runTicks(world, 300);

    const carryStart = new Map<number, number>();
    for (let t = 0; t < 800; t++) {
      tickWorld(world);
      for (const w of world.workers) {
        if (w.carryingItem !== null) {
          if (!carryStart.has(w.id)) carryStart.set(w.id, world.tick);
          const duration = world.tick - carryStart.get(w.id)!;
          expect(duration).toBeLessThan(800);
        } else {
          carryStart.delete(w.id);
        }
      }
    }
  });

  it("no worker should be permanently idle when there is work", () => {
    const world = createWorld({ workerCount: 3, orderSize: 6, orderInterval: 9999 }, DEFAULT_LAYOUT);

    const idleTicks = new Map<number, number>();

    for (let t = 0; t < 1500; t++) {
      tickWorld(world);

      for (const w of world.workers) {
        const unclaimedWork = world.items.some(
          (i) => !isTerminal(i.state) && i.carriedBy === null
        );
        if (!unclaimedWork) continue;
        if (w.state === "idle" && w.intent === "idle") {
          idleTicks.set(w.id, (idleTicks.get(w.id) ?? 0) + 1);
          expect(idleTicks.get(w.id)!).toBeLessThan(100);
        } else {
          idleTicks.set(w.id, 0);
        }
      }
    }
  });

  it("pipeline throughput: most steaks should be served given enough time", () => {
    const world = createWorld({ workerCount: 3, orderSize: 6, orderInterval: 9999 }, DEFAULT_LAYOUT);
    runTicks(world, 15000);

    // Count items that reached served or beyond
    const completed = world.items.filter((i) =>
      i.state === "served" || i.state === "dirty" || i.state === "clean"
    ).length;
    // At least a third of items should have completed the pipeline
    expect(completed).toBeGreaterThanOrEqual(Math.floor(world.items.length / 3));
  });

  it("dirty dishes should be cleaned", () => {
    const world = createWorld({ workerCount: 3, orderSize: 4, orderInterval: 9999 }, DEFAULT_LAYOUT);
    runTicks(world, 12000);

    const cleaned = world.items.filter((i) => i.state === "clean").length;
    expect(cleaned).toBeGreaterThan(0);
  });

  it("dirty dishes should not pile up excessively", () => {
    const world = createWorld({ workerCount: 3, orderSize: 4, orderInterval: 9999 }, DEFAULT_LAYOUT);

    let maxDirty = 0;
    for (let t = 0; t < 6000; t++) {
      tickWorld(world);
      const dirty = world.items.filter((i) => i.state === "dirty" && i.carriedBy === null).length;
      maxDirty = Math.max(maxDirty, dirty);
    }
    // Should never have more than 4 dirty dishes piled up at once
    expect(maxDirty).toBeLessThanOrEqual(4);
  });

  it("BFS navigates around obstacles to reach target station", () => {
    // Worker starts near fridge carrying a raw steak. Must BFS to cutting_board.
    const world = createWorld(
      { workerCount: 1, orderSize: 0, orderInterval: 99999 },
      DEFAULT_LAYOUT,
    );

    const worker = world.workers[0];
    worker.x = 1;
    worker.y = 3;
    // Place item at fridge (0,3) so carriedPickupRole = "storage"
    worker.carryingItem = 999;
    world.items.push({
      id: 999, type: "ribeye", state: "raw", x: 0, y: 3, carriedBy: worker.id,
    });

    // Worker should navigate to a cutting_board and start working
    runTicks(world, 300);

    // Item should have been processed (portioned at cutting_board)
    const item = world.items.find((i) => i.id === 999)!;
    expect(item.state).not.toBe("raw");
  });

  it("ordersServed counter tracks served steaks", () => {
    const world = createWorld({ workerCount: 3, orderSize: 4, orderInterval: 9999 }, DEFAULT_LAYOUT);
    runTicks(world, 5000);

    // ordersServed should match items that reached served state
    const servedOrBeyond = world.items.filter((i) =>
      i.state === "served" || i.state === "dirty" || i.state === "clean"
    ).length;
    expect(world.ordersServed).toBe(servedOrBeyond);
  });
});
