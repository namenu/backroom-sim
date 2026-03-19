import type { World, Worker } from "../types";
import type { Action, Perception } from "../engine/types";
import { perceive } from "../engine/perceive";
import { AgentAction } from "./types";

const DIR_MAP: Record<number, [number, number]> = {
  [AgentAction.MOVE_N]: [0, -1],
  [AgentAction.MOVE_S]: [0, 1],
  [AgentAction.MOVE_W]: [-1, 0],
  [AgentAction.MOVE_E]: [1, 0],
};

/**
 * Resolve an agent action into an executable low-level Action.
 *
 * Movement: direct direction mapping.
 * PICKUP/DROP/WORK: uses perception to find the best adjacent target.
 * Invalid actions (e.g., PICKUP with nothing adjacent) resolve to WAIT.
 */
export function resolveAgentAction(
  agentAction: AgentAction,
  world: World,
  worker: Worker,
): { action: Action; perception: Perception } {
  const perception = perceive(world, worker);

  const dir = DIR_MAP[agentAction];
  if (dir) {
    return { action: { kind: "move", dx: dir[0], dy: dir[1] }, perception };
  }

  switch (agentAction) {
    case AgentAction.PICKUP: {
      // Priority: returning > receiving > storage > process-done
      const sources = [
        ...perception.adjacentReturning.map((p) => p.item),
        ...perception.adjacentReceiving,
        ...perception.adjacentStorageProcessable.map((p) => p.item),
        ...perception.adjacentProcessDone.map((p) => p.item),
      ];
      if (sources.length > 0 && perception.carriedItem === null) {
        return {
          action: { kind: "pickup", itemId: sources[0].id },
          perception,
        };
      }
      return { action: { kind: "wait" }, perception };
    }

    case AgentAction.DROP: {
      if (perception.carriedItem && perception.adjacentStorageForCarried) {
        return { action: { kind: "drop" }, perception };
      }
      return { action: { kind: "wait" }, perception };
    }

    case AgentAction.WORK: {
      if (perception.carriedItem && perception.adjacentTransform) {
        return { action: { kind: "work" }, perception };
      }
      return { action: { kind: "wait" }, perception };
    }

    case AgentAction.WAIT:
    default:
      return { action: { kind: "wait" }, perception };
  }
}
