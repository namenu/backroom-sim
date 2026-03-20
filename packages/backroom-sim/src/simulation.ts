import {
  type World,
  type Worker,
  type ItemType,
  type ItemState,
  type SimConfig,
  type BackroomLayout,
  DEFAULT_CONFIG,
} from "./types";
import type { WorkflowGraph } from "./workflow/graph";
import { DEFAULT_WORKFLOW } from "./kitchen/workflow";
import { perceive, evaluate, execute, DEFAULT_RULES } from "./engine";
import { patchAt, CARDINAL_DIRS, bfsDirection, buildBlockedGrid, log, isTileBlocked, MOVE_TICKS } from "./helpers";

export function createWorld(
  config: SimConfig = DEFAULT_CONFIG,
  layout: BackroomLayout,
  workflow: WorkflowGraph = DEFAULT_WORKFLOW,
): World {
  const stations = layout.stations.map((d) => ({ type: d.type, x: d.x, y: d.y }));
  const stationTileSet = new Set(stations.map((s) => `${s.x},${s.y}`));

  const workers: Worker[] = [];
  for (let i = 0; i < config.workerCount; i++) {
    const spawnX = 2 + (i % (config.workerCount > 6 ? 6 : 4));
    const spawnY = 1 + Math.floor(i / (config.workerCount > 6 ? 6 : 4));
    workers.push(createWorker(i, spawnX, spawnY));
  }
  const world: World = {
    tick: 0,
    cols: layout.cols,
    rows: layout.rows,
    stations,
    stationTileSet,
    items: [],
    workers,
    logs: [],
    nextItemId: 0,
    nextWorkerId: config.workerCount,
    config,
    workflow,
    ordersServed: 0,
  };
  // Spawn initial batch of orders
  spawnOrders(world);
  return world;
}

function createWorker(id: number, gx: number, gy: number): Worker {
  return {
    id, x: gx, y: gy,
    fatigue: 0, carryingItem: null, state: "idle", departing: false, intent: "",
    moveCooldown: 0, workTimer: 0, workDuration: 0, workTargetX: null, workTargetY: null,
  };
}

/**
 * Spawn a batch of steak orders at the order_window stations.
 * Each order places a raw steak in the fridge (simulating "주문 → 냉장고에서 꺼냄").
 * The order ticket appears at the order_window as "ordered" state,
 * and a corresponding raw meat item is placed in the fridge.
 */
function spawnOrders(world: World) {
  const orderWindows = world.stations.filter((s) => s.type === "order_window");
  const fridges = world.stations.filter((s) => s.type === "fridge");
  const types: ItemType[] = ["ribeye", "sirloin", "tenderloin", "tbone"];

  if (orderWindows.length === 0 || fridges.length === 0) return;

  for (let i = 0; i < world.config.orderSize; i++) {
    const fridge = fridges[i % fridges.length];
    // Place raw meat directly in fridge (ready to be picked up for processing)
    world.items.push({
      id: world.nextItemId++,
      type: types[i % types.length],
      state: "raw",
      x: fridge.x, y: fridge.y,
      carriedBy: null,
    });
  }
}

// --- Helpers ---

function isAdjacentTo(wx: number, wy: number, tx: number, ty: number): boolean {
  return Math.abs(wx - tx) + Math.abs(wy - ty) === 1;
}

// --- Worker spawning / despawning ---

function findSpawnFloor(world: World, station: { x: number; y: number }): { x: number; y: number } | null {
  for (const [dx, dy] of CARDINAL_DIRS) {
    const nx = station.x + dx;
    const ny = station.y + dy;
    if (!isTileBlocked(world, nx, ny, -1)) return { x: nx, y: ny };
  }
  return null;
}

function adjustWorkerCount(world: World) {
  const desired = world.config.workerCount;
  let active = 0;
  for (const w of world.workers) if (!w.departing) active++;

  if (active < desired) {
    const entrance = world.stations.find((s) => world.workflow.placeRole(s.type) === "entrance");
    if (!entrance) return;
    const pos = findSpawnFloor(world, entrance);
    if (!pos) return;
    const w = createWorker(world.nextWorkerId++, pos.x, pos.y);
    world.workers.push(w);
    log(world, w.id, "entered");
  } else if (active > desired) {
    const candidates = world.workers
      .filter((w) => !w.departing)
      .sort((a, b) => {
        const sa = a.state === "idle" ? 0 : a.state === "moving" ? 1 : 2;
        const sb = b.state === "idle" ? 0 : b.state === "moving" ? 1 : 2;
        if (sa !== sb) return sa - sb;
        if (a.carryingItem === null && b.carryingItem !== null) return -1;
        if (a.carryingItem !== null && b.carryingItem === null) return 1;
        return 0;
      });
    const victim = candidates[0];
    if (victim) {
      victim.departing = true;
      log(world, victim.id, "departing");
    }
  }
}

function handleDeparting(worker: Worker, world: World) {
  if (worker.state === "working") {
    work(worker, world);
    return;
  }

  if (worker.moveCooldown > 0) {
    worker.moveCooldown--;
    return;
  }

  // Drop carried item
  if (worker.carryingItem !== null) {
    const item = world.items.find((i) => i.id === worker.carryingItem);
    if (item) {
      item.x = worker.x;
      item.y = worker.y;
      item.carriedBy = null;
    }
    worker.carryingItem = null;
  }

  const entrance = world.stations.find((s) => world.workflow.placeRole(s.type) === "entrance");
  if (!entrance) {
    const idx = world.workers.indexOf(worker);
    if (idx >= 0) world.workers.splice(idx, 1);
    return;
  }

  if (isAdjacentTo(worker.x, worker.y, entrance.x, entrance.y)) {
    log(world, worker.id, "left");
    const idx = world.workers.indexOf(worker);
    if (idx >= 0) world.workers.splice(idx, 1);
    return;
  }

  // BFS toward entrance
  const blocked = buildBlockedGrid(world, worker.id);
  const dir = bfsDirection(world.cols, world.rows, blocked, worker.x, worker.y, entrance.x, entrance.y, true);
  if (dir) {
    const nx = worker.x + dir[0];
    const ny = worker.y + dir[1];
    if (!isTileBlocked(world, nx, ny, worker.id)) {
      worker.x = nx;
      worker.y = ny;
      worker.moveCooldown = MOVE_TICKS;
      worker.state = "moving";
      worker.intent = "departing";
    }
  }
}

// --- Agent behavior ---

function tickWorker(worker: Worker, world: World) {
  if (worker.departing) {
    handleDeparting(worker, world);
    return;
  }

  if (worker.state === "working") {
    work(worker, world);
    return;
  }

  if (worker.moveCooldown > 0) {
    worker.moveCooldown--;
    if (worker.moveCooldown > 0) return;
    worker.state = "idle";
  }

  worker.state = "idle";
  decide(worker, world);
  worker.fatigue = Math.min(100, worker.fatigue + 0.02);
}

function decide(worker: Worker, world: World) {
  if (worker.carryingItem !== null) {
    const item = world.items.find((i) => i.id === worker.carryingItem);
    if (!item) { worker.carryingItem = null; return; }
  }

  const perception = perceive(world, worker);
  const action = evaluate(DEFAULT_RULES, perception);
  execute(world, worker, action, perception);

  if (action.kind === "wait") {
    worker.intent = perception.nearestWork || perception.carriedItem ? "blocked" : "idle";
  }
}

// --- Working ---

function work(worker: Worker, world: World) {
  worker.workTimer++;
  if (worker.workTimer >= worker.workDuration) {
    const item = world.items.find((i) => i.id === worker.carryingItem);
    if (item) {
      for (const [dx, dy] of CARDINAL_DIRS) {
        const station = world.stations.find(
          (s) => s.x === worker.x + dx && s.y === worker.y + dy,
        );
        if (!station) continue;
        const transition = world.workflow.findTransition(station.type, item.state);
        if (transition) {
          const prevState = item.state;
          item.state = transition.toColor as ItemState;
          item.x = station.x;
          item.y = station.y;
          item.carriedBy = null;
          worker.carryingItem = null;
          log(world, worker.id, `done → ${item.type}[${item.state}]`);
          // Track served orders
          if (item.state === "served") {
            world.ordersServed++;
          }
          break;
        }
      }
      if (worker.carryingItem !== null) {
        item.x = worker.x;
        item.y = worker.y;
        item.carriedBy = null;
        worker.carryingItem = null;
      }
    }
    worker.state = "idle";
    worker.intent = "";
    worker.workTargetX = null;
    worker.workTargetY = null;
  }
}

// --- Auto transitions ---

function fireAutoTransitions(world: World) {
  for (const item of world.items) {
    if (item.carriedBy !== null) continue;
    const stationType = patchAt(world, item.x, item.y);
    if (stationType === "floor") continue;

    for (const t of world.workflow.autoTransitionsAt(stationType)) {
      if (t.fromColor !== item.state) continue;
      if (world.tick % t.duration !== item.id % t.duration) continue;
      item.state = t.toColor as ItemState;
      if (t.targetPlaceId) {
        const targets = world.stations.filter(s => s.type === t.targetPlaceId);
        if (targets.length > 0) {
          const target = targets[item.id % targets.length];
          item.x = target.x;
          item.y = target.y;
        }
      }
      break;
    }
  }
}

// --- Main tick ---

function orderStockCap(world: World): number {
  return world.config.workerCount * world.config.orderSize;
}

function tickOrders(world: World) {
  if (world.tick > 0 && world.tick % world.config.orderInterval === 0) {
    const rawCount = world.items.filter(i => i.state === "raw" || i.state === "ordered").length;
    if (rawCount < orderStockCap(world)) {
      spawnOrders(world);
    }
  }
}

/** Shared tick logic: orders, auto transitions, passive worker updates. */
function tickBase(world: World) {
  world.tick++;
  tickOrders(world);
  fireAutoTransitions(world);
}

export function tickWorld(world: World) {
  tickBase(world);
  adjustWorkerCount(world);
  for (const worker of [...world.workers]) {
    tickWorker(worker, world);
  }
}

/**
 * Passive tick — everything EXCEPT agent decisions.
 * Used by environment where actions are provided externally.
 */
export function tickWorldPassive(world: World) {
  tickBase(world);
  for (const worker of world.workers) {
    if (worker.state === "working") {
      work(worker, world);
    } else if (worker.moveCooldown > 0) {
      worker.moveCooldown--;
      if (worker.moveCooldown === 0) worker.state = "idle";
    }
    worker.fatigue = Math.min(100, worker.fatigue + 0.02);
  }
}
