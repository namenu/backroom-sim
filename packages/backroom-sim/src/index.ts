export { createWorld, tickWorld, tickWorldPassive } from "./simulation";
export { DEFAULT_LAYOUT } from "./defaultLayout";
export { DEFAULT_CONFIG } from "./types";
export type {
  World,
  Worker,
  Station,
  StationType,
  ItemType,
  ItemState,
  Item,
  BackroomLayout,
  SimConfig,
  LogEntry,
  Recipe,
  StationMeta,
  ChartStageDef,
  RewardMilestone,
} from "./types";

// Workflow (abstract)
export { WorkflowGraph } from "./workflow";
export type { Place, Transition, WorkflowDef, PlaceRole, StorageRoute } from "./workflow";

// Default workflow + recipe
export { DEFAULT_WORKFLOW, DEFAULT_WORKFLOW_DEF } from "./kitchen";
export { STEAK_RECIPE, STEAK_LAYOUT, STEAK_CONFIG } from "./kitchen";

// Backroom (original) recipe
export { BACKROOM_WORKFLOW, BACKROOM_WORKFLOW_DEF } from "./backroom";
export { BACKROOM_RECIPE, BACKROOM_LAYOUT, BACKROOM_CONFIG } from "./backroom";

// Rule engine
export { DEFAULT_RULES, perceive, evaluate, execute, matchCondition } from "./engine";
export type { Rule, Condition, Action, Intent, Perception, PipelineSnapshot, StationSummary } from "./engine";

// Environment (agent interface)
export { BackroomEnv } from "./env";
export { AgentAction, ACTION_COUNT, OBS_SIZE } from "./env";
export type { Observation, StepResult, EnvConfig } from "./env";
