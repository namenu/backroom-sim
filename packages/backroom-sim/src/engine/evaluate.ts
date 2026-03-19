import type { Condition, Action, Intent, Rule, Perception } from "./types";

export function matchCondition(c: Condition, p: Perception): boolean {
  switch (c.kind) {
    case "carrying":
      return p.carriedItem !== null;
    case "notCarrying":
      return p.carriedItem === null;
    case "carriedItemState":
      return p.carriedItem?.state === c.state;
    case "carriedPickupRole":
      return p.carriedPickupRole === c.role;
    case "hasAdjacentStorage":
      return p.adjacentStorageForCarried !== null;
    case "hasAdjacentTransform":
      return p.adjacentTransform !== null;
    case "hasNextStation":
      return p.nearestNextStation !== null;
    case "hasAdjacentReturning":
      return p.adjacentReturning.length > 0;
    case "hasAdjacentReceiving":
      return p.adjacentReceiving.length > 0;
    case "hasAdjacentStorageProcessable":
      return p.adjacentStorageProcessable.length > 0;
    case "hasAdjacentProcessDone":
      return p.adjacentProcessDone.length > 0;
    case "hasGlobalWork":
      return p.nearestWork !== null;
    // --- Pipeline-aware conditions ---
    case "nextStationHasCapacity": {
      const summary = p.pipeline.stations[c.stationType];
      if (!summary || summary.total === 0) return false;
      const occupied = summary.itemCount + summary.workersBusy;
      return occupied < summary.total;
    }
    case "stationOverloaded": {
      const summary = p.pipeline.stations[c.stationType];
      if (!summary) return false;
      return summary.itemCount >= c.threshold;
    }
    case "itemStateCount": {
      const count = p.pipeline.itemsByState[c.state] ?? 0;
      if (c.min !== undefined && count < c.min) return false;
      if (c.max !== undefined && count > c.max) return false;
      return true;
    }
  }
}

/**
 * Resolve a rule intent into a low-level action using perception data.
 */
function resolve(intent: Intent, p: Perception): Action {
  switch (intent.kind) {
    case "dropAtAdjacentStorage":
      return { kind: "drop" };

    case "moveToStorage":
      return p.dirToStorage
        ? { kind: "move", dx: p.dirToStorage[0], dy: p.dirToStorage[1] }
        : { kind: "wait" };

    case "workAtAdjacentTransform":
      return { kind: "work" };

    case "moveToNextStation":
      return p.dirToNextStation
        ? { kind: "move", dx: p.dirToNextStation[0], dy: p.dirToNextStation[1] }
        : { kind: "wait" };

    case "pickUpReturning":
      return { kind: "pickup", itemId: p.adjacentReturning[0].item.id };

    case "pickUpReceiving":
      return { kind: "pickup", itemId: p.adjacentReceiving[0].id };

    case "pickUpStorageProcessable":
      return { kind: "pickup", itemId: p.adjacentStorageProcessable[0].item.id };

    case "pickUpProcessDone":
      return { kind: "pickup", itemId: p.adjacentProcessDone[0].item.id };

    case "seekWork":
      return p.dirToWork
        ? { kind: "move", dx: p.dirToWork[0], dy: p.dirToWork[1] }
        : { kind: "wait" };

    case "idle":
      return { kind: "wait" };
  }
}

/**
 * Evaluate rules against perception.
 * Returns a low-level Action ready for execution.
 */
export function evaluate(rules: readonly Rule[], perception: Perception): Action {
  for (const rule of rules) {
    if (rule.when.every((c) => matchCondition(c, perception))) {
      return resolve(rule.then, perception);
    }
  }
  return { kind: "wait" };
}
