import { describe, it, expect } from "vitest";
import { createWorld, tickWorld, DEFAULT_LAYOUT } from "../index";
import type { World } from "../index";

function runTicks(world: World, n: number) {
  for (let i = 0; i < n; i++) tickWorld(world);
}

/** Terminal states where no further action is needed */
function isTerminal(state: string): boolean {
  return state === "served" || state === "stored";
}

describe("backroom simulation", () => {
  it("items should progress through the full pipeline: raw → chopped → cooked → served", () => {
    const world = createWorld({ workerCount: 3, deliverySize: 4, deliveryInterval: 9999 }, DEFAULT_LAYOUT);
    runTicks(world, 2000);

    // Items reach served or beyond (dirty/clean/stored)
    const past = world.items.filter((i) =>
      i.state === "served" || i.state === "dirty" || i.state === "clean" || i.state === "stored"
    ).length;
    expect(past).toBeGreaterThan(0);
  });

  it("chopped items should appear as intermediate state", () => {
    const world = createWorld({ workerCount: 2, deliverySize: 4, deliveryInterval: 9999 }, DEFAULT_LAYOUT);

    let sawChopped = false;
    for (let i = 0; i < 1500; i++) {
      tickWorld(world);
      if (world.items.some((it) => it.state === "chopped")) {
        sawChopped = true;
        break;
      }
    }
    expect(sawChopped).toBe(true);
  });

  it("workers should not carry an item forever", () => {
    const world = createWorld({ workerCount: 3, deliverySize: 6, deliveryInterval: 9999 }, DEFAULT_LAYOUT);
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
    const world = createWorld({ workerCount: 3, deliverySize: 6, deliveryInterval: 9999 }, DEFAULT_LAYOUT);

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

  it("pipeline throughput: most food items should be served given enough time", () => {
    const world = createWorld({ workerCount: 3, deliverySize: 6, deliveryInterval: 9999 }, DEFAULT_LAYOUT);
    runTicks(world, 12000);

    // Count items that reached served or beyond
    const completed = world.items.filter((i) =>
      i.state === "served" || i.state === "dirty" || i.state === "clean" || i.state === "stored"
    ).length;
    // At least a third of items should have completed the pipeline
    expect(completed).toBeGreaterThanOrEqual(Math.floor(world.items.length / 3));
  });

  it("dirty dishes should be cleaned and stored", () => {
    const world = createWorld({ workerCount: 3, deliverySize: 4, deliveryInterval: 9999 }, DEFAULT_LAYOUT);
    runTicks(world, 10000);

    const stored = world.items.filter((i) => i.state === "stored").length;
    expect(stored).toBeGreaterThan(0);
  });

  it("dirty dishes should not pile up excessively", () => {
    const world = createWorld({ workerCount: 3, deliverySize: 4, deliveryInterval: 9999 }, DEFAULT_LAYOUT);

    let maxDirty = 0;
    for (let t = 0; t < 5000; t++) {
      tickWorld(world);
      const dirty = world.items.filter((i) => i.state === "dirty" && i.carriedBy === null).length;
      maxDirty = Math.max(maxDirty, dirty);
    }
    // Should never have more than 4 dirty dishes piled up at once
    expect(maxDirty).toBeLessThanOrEqual(4);
  });

  it("BFS navigates around obstacles to reach target station", () => {
    // Default layout. Worker starts at (1,4) carrying a raw item
    // picked up from a shelf. Must BFS around stations to reach prep_table.
    const world = createWorld(
      { workerCount: 1, deliverySize: 0, deliveryInterval: 99999 },
      DEFAULT_LAYOUT,
    );

    const worker = world.workers[0];
    worker.x = 1;
    worker.y = 4;
    // Place item at shelf (0,4) so carriedPickupRole = "storage"
    worker.carryingItem = 999;
    world.items.push({
      id: 999, type: "onion", state: "raw", x: 0, y: 4, carriedBy: worker.id,
    });

    // Worker should navigate to a prep_table and start working
    runTicks(world, 200);

    // Item should have been processed (chopped at prep_table)
    const item = world.items.find((i) => i.id === 999)!;
    expect(item.state).not.toBe("raw");
  });
});
