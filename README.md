# Station Placement Optimization

## Problem

Given a fixed grid and a fixed item-processing workflow, find the **station placement** that maximizes throughput and station utilization.

The grid dimensions, workflow transitions, and station **counts** are all fixed. Only station **positions** on the grid change.

Workers are driven by the built-in rule-based engine (`DEFAULT_RULES`). They are not part of the optimization — the agent designs the floor plan, not the worker policy.

## Fixed Parameters

| Component | Value |
|-----------|-------|
| Grid size | 12 x 9 |
| Workflow | raw -[150]-> chopped -[300]-> cooked -[30]-> served -[80,auto]-> dirty -[100]-> clean -[20]-> stored |
| Station counts | 1 entrance, 4 receiving, 3 shelf, 2 fridge, 4 prep_table, 2 stove, 4 counter, 2 returning, 2 sink, 1 trash |
| Worker behavior | Rule-based (`DEFAULT_RULES`) |
| SimConfig | `workerCount=3, orderSize=4, orderInterval=400` |

### Workflow Detail

```
receiving (intake)
  └─ raw ─[150t, worker]──▸ prep_table ──▸ chopped
                             └─[300t, worker]──▸ stove ──▸ cooked
                                                  └─[30t, worker]──▸ counter ──▸ served
                                                                      └─[80t, auto → returning]──▸ dirty
                                                                        └─[100t, worker]──▸ sink ──▸ clean
                                                                                            └─[20t, worker]──▸ shelf ──▸ stored
```

All transitions are **worker-active** (worker blocked for full duration) except `served → dirty` which is **auto** (counter processes independently, item teleports to returning station).

## Decision Variable

The **(x, y) position** of each station on the grid, subject to:

- Entrance is pinned at (0, 0).
- Receiving (intake) stations must be on the top edge (y = 0).
- No two stations may overlap.
- All non-station tiles must form a connected walkable region (every station must be reachable).

### Search Space

- Grid: 12 × 9 = 108 tiles
- Stations: 25 tiles occupied, 83 walkable tiles
- Constrained stations: 1 entrance pinned at (0,0), 4 receiving pinned to y=0 row (11 choices each)
- Free stations: 20 stations placed on remaining ~83 tiles
- Connectivity constraint further prunes the space significantly
- Effective search space: large but tractable for metaheuristic methods

## Objective

Maximize the **fitness score**, a weighted combination of throughput, station utilization, and worker efficiency.

### Fitness Function

```
fitness = throughput × 1000 + avgUtilization × 0.5 + avgWorkerIdle × (−0.3)
```

| Weight | Parameter | Description |
|--------|-----------|-------------|
| `throughputWeight = 1.0` | `throughput × 1000` | Items reaching `served` per tick, scaled by 1000 |
| `utilizationWeight = 0.5` | `avgUtilization × 0.5` | Mean fraction of time each processing station is occupied |
| `idlePenalty = −0.3` | `avgWorkerIdle × (−0.3)` | Mean fraction of time each worker is idle (penalty) |

Throughput dominates the fitness. Utilization and idle ratio act as tiebreakers.

## Evaluation

A candidate layout is evaluated by running the simulation headlessly for 5000 ticks:

```typescript
const world = createWorld(BACKROOM_CONFIG, layout, BACKROOM_WORKFLOW, BACKROOM_RECIPE);
for (let t = 0; t < 5000; t++) {
  tickWorld(world);
}
// measure: served count, station utilization, worker idle ratio
```

### Metrics

| Metric | Definition |
|--------|-----------|
| `throughput` | items reaching `served` / total ticks |
| `station_utilization` | per station type: ticks occupied / total ticks |
| `worker_idle_ratio` | per worker: idle ticks / total ticks |
| `fitness` | combined score (see formula above) |

### Baseline (DEFAULT_LAYOUT)

The hand-crafted `BACKROOM_LAYOUT` serves as the baseline to beat:

| Metric | Value |
|--------|-------|
| **fitness** | **2.872** |
| throughput | 0.0028 (14 served / 5000 ticks) |
| avgUtilization | 0.147 |
| avgWorkerIdle | 0.005 |

Per-station utilization (baseline):
| Station | Utilization |
|---------|------------|
| receiving | 87.3% |
| stove | 29.7% |
| shelf | 27.0% |
| returning | 21.4% |
| sink | 12.1% |
| prep_table | 9.3% |
| counter | 7.6% |
| fridge | 0.0% |

**Observation**: `prep_table` (150t) and `stove` (300t) are the main bottlenecks. The layout's job is to minimize worker travel time between these stations.

### Success Criteria

| Level | Condition |
|-------|-----------|
| Minimum | Beat baseline fitness (> 2.872) |
| Good | ≥ 15% improvement over baseline |
| Excellent | ≥ 30% improvement over baseline |

## How to Run

### Evaluate a single layout

```bash
# Baseline (no input → evaluates DEFAULT_LAYOUT)
npx tsx scripts/evaluate-layout.ts < /dev/null

# Custom layout (JSON via stdin)
echo '{"layout": {"cols":12,"rows":9,"stations":[...]}, "recipe":"backroom"}' \
  | npx tsx scripts/evaluate-layout.ts
```

### Run the GA optimizer

```bash
python -m optimizer                          # defaults: pop=30, gen=50
python -m optimizer --generations 100        # more generations
python -m optimizer --population 50 --seed 42 --output results.json
```

### Batch evaluation (multiple layouts in one call)

```bash
echo '{"batch":[{"id":0,"layout":{...}},{"id":1,"layout":{...}}],"recipe":"backroom"}' \
  | npx tsx scripts/evaluate-layout.ts
```

## Implementation Notes

- The simulation runs without a viewer: `createWorld` + `tickWorld` are headless.
- `BackroomLayout` is the only input that varies; workflow and config are constant.
- Connectivity validation: BFS from entrance to all station-adjacent tiles.
- Each layout evaluation is independent and can be parallelized.
- A single evaluation (5000 ticks) takes ~50ms — budget allows thousands of evaluations.
- The existing `BackroomEnv` is a worker-level gym wrapper. Layout optimization requires a separate environment.
- The Python optimizer (`optimizer/`) bridges to the TS simulation via subprocess (`npx tsx`).

## Key Source Files

| File | Description |
|------|-------------|
| `packages/backroom-sim/src/backroom/recipe.ts` | `BACKROOM_RECIPE`, `BACKROOM_LAYOUT`, `BACKROOM_CONFIG` |
| `packages/backroom-sim/src/backroom/workflow.ts` | `BACKROOM_WORKFLOW` — transition definitions |
| `packages/backroom-sim/src/optimizer/evaluate.ts` | `evaluateLayout()` — fitness computation |
| `packages/backroom-sim/src/optimizer/validate.ts` | `validateLayout()` — constraint checking |
| `packages/backroom-sim/src/simulation.ts` | `createWorld()`, `tickWorld()` — simulation core |
| `scripts/evaluate-layout.ts` | CLI bridge (stdin JSON → stdout JSON) |
| `optimizer/ga.py` | Genetic algorithm implementation |
| `optimizer/evaluate.py` | Python → TS subprocess bridge |
