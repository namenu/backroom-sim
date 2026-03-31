/**
 * CLI bridge for layout evaluation.
 *
 * Usage (stdin JSON → stdout JSON):
 *   echo '{"layout": {...}, "ticks": 5000}' | npx tsx scripts/evaluate-layout.ts
 *
 * Input JSON:
 *   { "layout": BackroomLayout, "ticks"?: number, "recipe"?: "backroom" | "steak" }
 *
 * Output JSON:
 *   { "valid": bool, "errors"?: string[], "metrics"?: FitnessMetrics }
 *
 * Also supports batch mode:
 *   { "batch": [ { "id": 0, "layout": ... }, ... ], "ticks"?: number }
 *   → { "results": [ { "id": 0, "valid": bool, "metrics"?: ... }, ... ] }
 */

import {
  BACKROOM_RECIPE,
  BACKROOM_LAYOUT,
  BACKROOM_CONFIG,
  BACKROOM_STATION_COUNTS,
  BACKROOM_WORKFLOW,
  STEAK_RECIPE,
  STEAK_LAYOUT,
  STEAK_CONFIG,
  DEFAULT_WORKFLOW,
  type BackroomLayout,
} from "../packages/backroom-sim/src/index";
import { validateLayout } from "../packages/backroom-sim/src/optimizer/validate";
import { evaluateLayout, DEFAULT_EVAL_CONFIG } from "../packages/backroom-sim/src/optimizer/evaluate";

function getRecipeConfig(recipeName: string) {
  switch (recipeName) {
    case "steak":
      return { recipe: STEAK_RECIPE, config: STEAK_CONFIG, workflow: DEFAULT_WORKFLOW, defaultLayout: STEAK_LAYOUT, stationCounts: undefined };
    case "backroom":
    default:
      return { recipe: BACKROOM_RECIPE, config: BACKROOM_CONFIG, workflow: BACKROOM_WORKFLOW, defaultLayout: BACKROOM_LAYOUT, stationCounts: BACKROOM_STATION_COUNTS };
  }
}

interface SingleRequest {
  layout?: BackroomLayout;
  ticks?: number;
  recipe?: string;
}

interface BatchItem {
  id: number;
  layout: BackroomLayout;
}

interface BatchRequest {
  batch: BatchItem[];
  ticks?: number;
  recipe?: string;
}

function evaluateSingle(layout: BackroomLayout, recipeName: string, ticks: number) {
  const { recipe, config, workflow, stationCounts } = getRecipeConfig(recipeName);
  const validation = validateLayout(layout, workflow, stationCounts);

  if (!validation.valid) {
    return { valid: false, errors: validation.errors };
  }

  const evalConfig = { ...DEFAULT_EVAL_CONFIG, ticks };
  const metrics = evaluateLayout(layout, config, workflow, recipe, evalConfig);
  return { valid: true, metrics };
}

async function main() {
  // Read all stdin
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer);
  }
  const input = Buffer.concat(chunks).toString("utf-8").trim();

  if (!input) {
    // No input: evaluate default layout as baseline
    const { recipe, config, workflow, defaultLayout } = getRecipeConfig("backroom");
    const evalConfig = { ...DEFAULT_EVAL_CONFIG, ticks: 5000 };
    const metrics = evaluateLayout(defaultLayout, config, workflow, recipe, evalConfig);
    console.log(JSON.stringify({ valid: true, metrics, layout: defaultLayout }, null, 2));
    return;
  }

  const request = JSON.parse(input);

  if ("batch" in request) {
    // Batch mode
    const batch = request as BatchRequest;
    const recipeName = batch.recipe ?? "backroom";
    const ticks = batch.ticks ?? 5000;

    const results = batch.batch.map((item) => {
      const result = evaluateSingle(item.layout, recipeName, ticks);
      return { id: item.id, ...result };
    });

    console.log(JSON.stringify({ results }));
  } else {
    // Single mode
    const single = request as SingleRequest;
    const recipeName = single.recipe ?? "backroom";
    const ticks = single.ticks ?? 5000;

    let usedDefault = false;
    if (!single.layout) {
      const { defaultLayout } = getRecipeConfig(recipeName);
      single.layout = defaultLayout;
      usedDefault = true;
    }

    const result = evaluateSingle(single.layout, recipeName, ticks);
    // Include layout in response when using defaults (for baseline evaluation)
    const output = usedDefault ? { ...result, layout: single.layout } : result;
    console.log(JSON.stringify(output));
  }
}

main().catch((e) => {
  console.error(JSON.stringify({ error: String(e) }));
  process.exit(1);
});
