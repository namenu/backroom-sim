import type { WorkflowDef } from "../workflow/types";
import { WorkflowGraph } from "../workflow/graph";

/**
 * Factory workflow — complex branching Petri net for production lines.
 *
 * Main production line:
 *   raw → smelted (smelter, 200t) → cooled (cooling_tower, 60t auto)
 *     → pressed (press, 150t) → assembled (assembler, 250t)
 *     → inspected (inspector, 50t auto) → packaged (packaging_unit, 100t)
 *     → shipped (storage_depot, 30t) → COMPLETE
 *
 * Chemical branch:
 *   raw → mixed (chemical_mixer, 180t) → feeds into assembler
 *
 * Recycling loop:
 *   inspected → rejected (inspector, auto) → reclaimed (furnace, 120t)
 *     → recycled (terminal)
 *
 * Cleanup:
 *   shipped → returned (conveyor_hub, 80t auto) → cleaned (pipe_junction, 40t)
 *     → terminal
 */
export const FACTORY_WORKFLOW_DEF: WorkflowDef = {
  places: [
    { id: "storage_depot", role: "intake" },
    { id: "smelter", role: "process" },
    { id: "cooling_tower", role: "process" },
    { id: "chemical_mixer", role: "process" },
    { id: "press", role: "process" },
    { id: "assembler", role: "process" },
    { id: "inspector", role: "process" },
    { id: "furnace", role: "process" },
    { id: "packaging_unit", role: "process" },
    { id: "conveyor_hub", role: "return" },
    { id: "pipe_junction", role: "process" },
    { id: "trash_bin" },
    { id: "entrance", role: "entrance" },
  ],

  transitions: [
    // === Main production line ===
    { id: "smelt",       placeId: "smelter",        fromColor: "raw",       toColor: "smelted",   duration: 200 },
    { id: "cool",        placeId: "cooling_tower",   fromColor: "smelted",   toColor: "cooled",    duration: 60, auto: true },
    { id: "press",       placeId: "press",           fromColor: "cooled",    toColor: "pressed",   duration: 150 },
    { id: "assemble",    placeId: "assembler",       fromColor: "pressed",   toColor: "assembled", duration: 250 },
    { id: "inspect",     placeId: "inspector",       fromColor: "assembled", toColor: "inspected", duration: 50, auto: true },
    { id: "package",     placeId: "packaging_unit",  fromColor: "inspected", toColor: "packaged",  duration: 100 },
    { id: "ship",        placeId: "storage_depot",   fromColor: "packaged",  toColor: "shipped",   duration: 30 },

    // === Chemical branch (mixed → pressed, auto-routed to assembler) ===
    { id: "mix",         placeId: "chemical_mixer",  fromColor: "raw",       toColor: "mixed",     duration: 180 },
    { id: "chem-prep",   placeId: "chemical_mixer",  fromColor: "mixed",     toColor: "pressed",   duration: 20, auto: true, targetPlaceId: "assembler" },

    // === Recycling loop (inspected → rejected → reclaimed → recycled) ===
    { id: "reject",      placeId: "inspector",       fromColor: "inspected", toColor: "rejected",  duration: 10 },
    { id: "reclaim",     placeId: "furnace",          fromColor: "rejected",  toColor: "reclaimed", duration: 120 },
    { id: "recycle",     placeId: "furnace",          fromColor: "reclaimed", toColor: "recycled",  duration: 20, auto: true },

    // === Cleanup (shipped → returned → cleaned) ===
    { id: "return",      placeId: "storage_depot",   fromColor: "shipped",   toColor: "returned",  duration: 80, auto: true, targetPlaceId: "conveyor_hub" },
    { id: "clean",       placeId: "pipe_junction",   fromColor: "returned",  toColor: "cleaned",   duration: 40 },
  ],

  defaultStorageId: "storage_depot",
  storageRoutes: [
    { tokenTag: "chemical", toPlaceId: "chemical_mixer" },
  ],
};

export const FACTORY_WORKFLOW = new WorkflowGraph(FACTORY_WORKFLOW_DEF);
