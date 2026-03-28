import type { World, Station } from "backroom-sim";

export type StationAnimState = "idle" | "processing" | "done";

/** Determine animation state based on items at this station */
export function getStationAnimState(world: World, station: Station): StationAnimState {
  let hasDoneItem = false;
  for (const item of world.items) {
    if (item.x === station.x && item.y === station.y && item.carriedBy === null) {
      if (item.processTimer > 0) return "processing";
      if (item.processTimer === 0) hasDoneItem = true;
    }
  }
  return hasDoneItem ? "done" : "idle";
}

/** Get frame index for animation */
export function getStationFrame(
  animState: StationAnimState,
  globalFrame: number,
  framesPerState?: { idle?: number; processing?: number; done?: number },
): number {
  const defaults = { idle: 1, processing: 4, done: 2 };
  const frames = { ...defaults, ...framesPerState };
  const speeds = { idle: 1, processing: 8, done: 12 };

  const totalFrames = frames[animState];
  const speed = speeds[animState];
  return Math.floor(globalFrame / speed) % totalFrames;
}

/** Get asset filename for station in given anim state and frame (without extension) */
export function getStationAssetName(
  baseAsset: string,
  animState: StationAnimState,
  frame: number,
): string {
  if (animState === "processing") return `${baseAsset}_processing_${frame}`;
  if (animState === "done") return `${baseAsset}_done_${frame}`;
  return baseAsset;
}
