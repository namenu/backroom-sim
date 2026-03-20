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
| SimConfig | workerCount=3, deliverySize=6, deliveryInterval=600 |

## Decision Variable

The **(x, y) position** of each station on the grid, subject to:

- Entrance is pinned at (0, 0).
- Receiving stations must be on the top edge (y = 0).
- No two stations may overlap.
- All non-station tiles must form a connected walkable region (every station must be reachable).

## Objective

Maximize **throughput** (items reaching `served` per unit time) while maintaining high **station utilization** (fraction of time each processing station is occupied).

## Evaluation

A candidate layout is evaluated by running the simulation headlessly:

```typescript
const world = createWorld(DEFAULT_CONFIG, layout, DEFAULT_WORKFLOW);
for (let t = 0; t < 5000; t++) {
  tickWorld(world);
}
// measure: served count, station utilization, worker idle ratio
```

### Metrics

| Metric | Definition |
|--------|-----------|
| throughput | items reaching `served` / total ticks |
| station_utilization | per station type: ticks occupied / total ticks |
| worker_idle_ratio | per worker: idle ticks / total ticks |

### Baseline

The hand-crafted `DEFAULT_LAYOUT` serves as the baseline to beat.

## Implementation Notes

- The simulation runs without a viewer: `createWorld` + `tickWorld` are headless.
- `BackroomLayout` is the only input that varies; workflow and config are constant.
- Connectivity validation: BFS from entrance to all station-adjacent tiles.
- Each layout evaluation is independent and can be parallelized.
- The existing `BackroomEnv` is a worker-level gym wrapper. Layout optimization requires a separate environment.
