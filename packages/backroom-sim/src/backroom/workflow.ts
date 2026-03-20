import type { WorkflowDef } from "../workflow/types";
import { WorkflowGraph } from "../workflow/graph";

/**
 * Backroom workflow — the original multi-stage processing pipeline.
 *
 * raw → chopped (prep_table) → cooked (stove) → served (counter)
 * → dirty (auto return) → clean (sink) → stored (shelf)
 */
export const BACKROOM_WORKFLOW_DEF: WorkflowDef<string, string, string> = {
  places: [
    { id: "receiving", role: "intake" },
    { id: "shelf", role: "storage" },
    { id: "fridge", role: "storage" },
    { id: "prep_table", role: "process" },
    { id: "stove", role: "process" },
    { id: "counter", role: "output" },
    { id: "returning", role: "return" },
    { id: "sink", role: "process" },
    { id: "trash" },
    { id: "entrance", role: "entrance" },
  ],
  transitions: [
    { id: "chop", placeId: "prep_table", fromColor: "raw", toColor: "chopped", duration: 150 },
    { id: "cook", placeId: "stove", fromColor: "chopped", toColor: "cooked", duration: 300 },
    { id: "serve", placeId: "counter", fromColor: "cooked", toColor: "served", duration: 30 },
    { id: "return", placeId: "counter", fromColor: "served", toColor: "dirty", duration: 80, auto: true, targetPlaceId: "returning" },
    { id: "wash", placeId: "sink", fromColor: "dirty", toColor: "clean", duration: 100 },
    { id: "shelve", placeId: "shelf", fromColor: "clean", toColor: "stored", duration: 20 },
  ],
  defaultStorageId: "shelf",
  storageRoutes: [{ tokenTag: "pork", toPlaceId: "fridge" }],
};

export const BACKROOM_WORKFLOW = new WorkflowGraph(BACKROOM_WORKFLOW_DEF);
