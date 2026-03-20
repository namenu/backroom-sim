import type { World, WorkflowDef } from "../index";
import { tickWorld } from "../index";
import { MOVE_TICKS } from "../helpers";

export function runTicks(world: World, n: number) {
  for (let i = 0; i < n; i++) tickWorld(world);
}

/** Derive time bounds from workflow and layout so tests don't use magic numbers. */
export function deriveBounds(workflow: WorkflowDef, cols: number, rows: number) {
  const pipelineTime = workflow.transitions.reduce((s, t) => s + t.duration, 0);
  const numSteps = workflow.transitions.filter((t) => !t.auto).length;
  const maxTraversal = (cols + rows) * MOVE_TICKS;
  const oneItemTime = pipelineTime + numSteps * maxTraversal;
  return { pipelineTime, numSteps, maxTraversal, oneItemTime };
}

/** Terminal colors: states with no outgoing non-auto transition */
export function terminalStates(workflow: WorkflowDef): Set<string> {
  const consumed = new Set(workflow.transitions.filter((t) => !t.auto).map((t) => t.fromColor));
  const allOutputs = new Set(workflow.transitions.map((t) => t.toColor));
  const terminals = new Set<string>();
  for (const s of allOutputs) {
    if (!consumed.has(s)) terminals.add(s);
  }
  return terminals;
}
