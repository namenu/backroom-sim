import type { Rule } from "./types";

/**
 * Default agent ruleset — evaluated top-to-bottom, first match wins.
 *
 * 9 rules encoding the full backroom worker behavior:
 *   Rules 1-4: carrying an item → route/process/store
 *   Rules 5-8: not carrying → pick up from adjacent stations
 *   Rule 9:    nothing nearby → scan globally for work
 *   Fallback:  idle
 */
export const DEFAULT_RULES: readonly Rule[] = [
  // === Carrying: raw item from receiving → store ===
  {
    name: "store-raw-at-adjacent",
    when: [
      { kind: "carrying" },
      { kind: "carriedItemState", state: "raw" },
      { kind: "carriedPickupRole", role: "intake" },
      { kind: "hasAdjacentStorage" },
    ],
    then: { kind: "dropAtAdjacentStorage" },
  },
  {
    name: "move-to-storage",
    when: [
      { kind: "carrying" },
      { kind: "carriedItemState", state: "raw" },
      { kind: "carriedPickupRole", role: "intake" },
    ],
    then: { kind: "moveToStorage" },
  },

  // === Carrying: adjacent station can transform → work ===
  {
    name: "work-at-adjacent",
    when: [{ kind: "carrying" }, { kind: "hasAdjacentTransform" }],
    then: { kind: "workAtAdjacentTransform" },
  },

  // === Carrying: route to next processing station ===
  {
    name: "move-to-next-station",
    when: [{ kind: "carrying" }, { kind: "hasNextStation" }],
    then: { kind: "moveToNextStation" },
  },

  // === Not carrying: pick up from adjacent stations (priority order) ===
  {
    name: "pickup-returning",
    when: [{ kind: "notCarrying" }, { kind: "hasAdjacentReturning" }],
    then: { kind: "pickUpReturning" },
  },
  {
    name: "pickup-receiving",
    when: [{ kind: "notCarrying" }, { kind: "hasAdjacentReceiving" }],
    then: { kind: "pickUpReceiving" },
  },
  {
    name: "pickup-storage-processable",
    when: [{ kind: "notCarrying" }, { kind: "hasAdjacentStorageProcessable" }],
    then: { kind: "pickUpStorageProcessable" },
  },
  {
    name: "pickup-process-done",
    when: [{ kind: "notCarrying" }, { kind: "hasAdjacentProcessDone" }],
    then: { kind: "pickUpProcessDone" },
  },

  // === Not carrying: scan globally ===
  {
    name: "seek-work",
    when: [{ kind: "notCarrying" }, { kind: "hasGlobalWork" }],
    then: { kind: "seekWork" },
  },

  // === Fallback ===
  {
    name: "idle",
    when: [],
    then: { kind: "idle" },
  },
];
