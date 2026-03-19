import type { World, Worker } from "../types";
import type { Action, Perception } from "./types";
import { log, isTileBlocked, MOVE_TICKS } from "../helpers";

export function execute(
  world: World,
  worker: Worker,
  action: Action,
  p: Perception,
): void {
  switch (action.kind) {
    case "move": {
      const nx = worker.x + action.dx;
      const ny = worker.y + action.dy;
      if (!isTileBlocked(world, nx, ny, worker.id)) {
        worker.x = nx;
        worker.y = ny;
        worker.moveCooldown = Math.round(MOVE_TICKS * (1 + worker.fatigue * 0.005));
        worker.state = "moving";
      }
      break;
    }

    case "pickup": {
      const item = world.items.find((i) => i.id === action.itemId);
      if (!item) break;
      item.carriedBy = worker.id;
      worker.carryingItem = item.id;
      log(world, worker.id, `pickup ${item.type}[${item.state}]`);
      break;
    }

    case "drop": {
      const station = p.adjacentStorageForCarried;
      if (!station) break;
      const item = world.items.find((i) => i.id === p.carriedItem?.id);
      if (!item) break;
      item.x = station.x;
      item.y = station.y;
      item.carriedBy = null;
      worker.carryingItem = null;
      worker.intent = "";
      log(world, worker.id, `stored ${item.type}`);
      break;
    }

    case "work": {
      const transform = p.adjacentTransform;
      if (!transform) break;
      worker.state = "working";
      worker.intent = `${transform.rule.toState}:${p.carriedItem!.type}`;
      worker.workTimer = 0;
      worker.workDuration = transform.rule.duration;
      worker.workTargetX = transform.station.x;
      worker.workTargetY = transform.station.y;
      break;
    }

    case "wait":
      // Brief cooldown to avoid expensive per-tick re-perception when idle
      worker.moveCooldown = 5;
      break;
  }
}
