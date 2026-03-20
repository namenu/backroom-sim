import type { WorkflowDef } from "../workflow/types";
import { WorkflowGraph } from "../workflow/graph";

/**
 * Steak recipe workflow — models a full steak cooking pipeline.
 *
 * Worker-active (worker blocked for full duration):
 *   portion:  cutting_board  raw → portioned       120t
 *   plate:    plating_station rested → plated       40t
 *   serve:    pass           plated → served         2t
 *   wash:     sink           dirty → clean           80t
 *
 * Place + auto (worker places in 2t, station processes independently):
 *   sear:     burner         portioned → seared    180t (2t + 178t auto)
 *   rest:     resting_rack   seared → rested        60t (2t + 58t auto)
 *
 * Auto-only (no worker needed):
 *   return:   pass           served → dirty         100t (moves to dish_return)
 */
export const DEFAULT_WORKFLOW_DEF: WorkflowDef = {
  places: [
    { id: "order_window", role: "intake" },
    { id: "fridge", role: "storage" },
    { id: "cutting_board", role: "process" },
    { id: "burner", role: "process" },
    { id: "resting_rack", role: "process" },
    { id: "plating_station", role: "process" },
    { id: "pass", role: "output" },
    { id: "dish_return", role: "return" },
    { id: "sink", role: "process" },
    { id: "entrance", role: "entrance" },
  ],
  transitions: [
    // Worker-active: worker stays and works for full duration
    { id: "portion",    placeId: "cutting_board",   fromColor: "raw",        toColor: "portioned", duration: 120 },
    // Place + auto: worker places (2t), burner cooks by itself
    { id: "place-sear", placeId: "burner",          fromColor: "portioned",  toColor: "searing",   duration: 2 },
    { id: "sear",       placeId: "burner",          fromColor: "searing",    toColor: "seared",    duration: 178, auto: true },
    // Place + auto: worker places (2t), meat rests by itself
    { id: "place-rest", placeId: "resting_rack",    fromColor: "seared",     toColor: "resting",   duration: 2 },
    { id: "rest",       placeId: "resting_rack",    fromColor: "resting",    toColor: "rested",    duration: 58,  auto: true },
    // Worker-active: worker plates the dish
    { id: "plate",      placeId: "plating_station", fromColor: "rested",     toColor: "plated",    duration: 40 },
    // Worker-active: quick handoff
    { id: "serve",      placeId: "pass",            fromColor: "plated",     toColor: "served",    duration: 2 },
    // Auto-only: customer eats, dishes return
    { id: "return",     placeId: "pass",            fromColor: "served",     toColor: "dirty",     duration: 100, auto: true, targetPlaceId: "dish_return" },
    // Worker-active: worker scrubs dishes
    { id: "wash",       placeId: "sink",            fromColor: "dirty",      toColor: "clean",     duration: 80 },
  ],
  defaultStorageId: "fridge",
  storageRoutes: [],
};

export const DEFAULT_WORKFLOW = new WorkflowGraph(DEFAULT_WORKFLOW_DEF);
