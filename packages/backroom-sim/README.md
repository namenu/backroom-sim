# @ramen/backroom-sim

Agent-based kitchen workflow simulation. Simple reactive agents + declarative workflow graph = emergent behavior.

## Architecture

```
workflow/          Abstract workflow layer (domain-agnostic)
├── types.ts       Place, Transition, WorkflowDef (generic, type-safe)
└── graph.ts       WorkflowGraph — indexed queries over the workflow

kitchen/           Domain binding
└── workflow.ts    KITCHEN_WORKFLOW_DEF — the single source of truth

engine/            Agent behavior (perceive → evaluate → execute)
├── perceive.ts    World × Worker → Perception (pure, queries workflow)
├── evaluate.ts    Rules × Perception → Action (first-match)
├── execute.ts     Action → World mutation
└── rules.ts       DEFAULT_RULES (9 rules, priority-ordered)

simulation.ts      Tick loop, spatial movement, worker state machine
defaultLayout.ts   12×9 grid station placement
types.ts           Domain types (Station, Item, Worker, World)
```

## Design Principles

From Resnick's *Turtles, Termites, and Traffic Jams*:

- **Agent complexity ↓** — Workers follow fixed local rules. Never made smarter.
- **Environment complexity ↑** — Layout, workflow, rules are the design levers.
- **Emergence** — Complex coordination arises from simple agents in a well-designed environment.

## Workflow Layer

The workflow is modeled as a **declarative graph** inspired by Timed Colored Petri Nets:

| Concept | Petri Net | Code |
|---------|-----------|------|
| Where tokens reside | Place | `Place` with role (intake/storage/process/output/return) |
| State transformation | Transition | `Transition` with fromColor → toColor + duration |
| Item state | Token color | `"raw"` → `"chopped"` → `"cooked"` → `"served"` |
| Worker | Shared resource | Enables transport + firing |

The workflow definition is **type-safe** — place IDs, colors, and token tags are validated at compile time:

```typescript
const def: WorkflowDef<KitchenPlaceId, ItemState, ItemType> = {
  places: [
    { id: "prep_table", role: "process" },
    // { id: "prep_tabel" } → compile error
  ],
  transitions: [
    { id: "chop", placeId: "prep_table", fromColor: "raw", toColor: "chopped", duration: 60 },
    // fromColor: "rwa" → compile error
  ],
};
```

The workflow graph answers routing queries:
- `nextPlaceFor(color)` — where should this token go next?
- `findTransition(placeId, color)` — can this place process this token?
- `isTerminal(color)` — is processing complete?
- `storageFor(tag)` — which storage place for this token type?
- `placeRole(id)` — what role does this place play?

## Agent Layer

Workers are **stateless reactive agents** — no memory, no planning. Each tick:

```
idle  → perceive(world, worker) → evaluate(rules, perception) → execute(action)
moving  → greedy pathfinding with wall-follow fallback
working → timer countdown → apply transition
```

The agent layer and workflow layer are **decoupled**:
- Agents query the workflow graph for routing decisions
- Agents handle physical transport (spatial, non-deterministic)
- The workflow defines *what* gets processed; agents determine *how* and *when*

## Usage

```typescript
import { createWorld, tickWorld, DEFAULT_LAYOUT } from "@ramen/backroom-sim";

const world = createWorld(
  { workerCount: 3, deliverySize: 6, deliveryInterval: 600 },
  DEFAULT_LAYOUT,
);

for (let i = 0; i < 4000; i++) {
  tickWorld(world);
}
```

Custom workflow:

```typescript
import { WorkflowGraph, KITCHEN_WORKFLOW } from "@ramen/backroom-sim";

// Use default kitchen workflow
const world = createWorld(config, layout);

// Or provide a custom workflow
const customWorkflow = new WorkflowGraph(myWorkflowDef);
const world = createWorld(config, layout, customWorkflow);
```

## Testing

```bash
npm run test          # vitest run
npm run test:watch    # vitest watch
```

14 tests across two suites (12×9 default layout + 40×28 stress test).
