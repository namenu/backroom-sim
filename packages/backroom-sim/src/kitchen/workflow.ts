import type { StationType, ItemState, ItemType } from "../types";
import type { WorkflowDef } from "../workflow/types";
import { WorkflowGraph } from "../workflow/graph";

type PlaceId = Exclude<StationType, "floor">;

/**
 * Steak recipe workflow — models a full steak cooking pipeline.
 *
 * 1. 주문 접수 (order_window)  — orders arrive here
 * 2. 냉장고에서 꺼냄 (fridge)   — meat storage
 * 3. 정량대로 자름 (cutting_board) — raw → portioned
 * 4. 화구에서 굽기 (burner)     — portioned → seared
 * 5. 레스팅 (resting_rack)     — seared → rested
 * 6. 플레이팅 (plating_station) — rested → plated
 * 7. 서빙 (pass)              — plated → served
 * 8. 자동 반납 (dish_return)   — served → dirty (auto)
 * 9. 설거지 (sink)             — dirty → clean
 */
export const DEFAULT_WORKFLOW_DEF: WorkflowDef<PlaceId, ItemState, ItemType> = {
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
    // 3. 고기 자르기 — cutting_board에서 raw → portioned (120 ticks)
    { id: "portion", placeId: "cutting_board", fromColor: "raw", toColor: "portioned", duration: 120 },
    // 4. 굽기 — burner에서 portioned → seared (180 ticks, ~3분)
    { id: "sear", placeId: "burner", fromColor: "portioned", toColor: "seared", duration: 180 },
    // 5. 레스팅 — resting_rack에서 seared → rested (60 ticks)
    { id: "rest", placeId: "resting_rack", fromColor: "seared", toColor: "rested", duration: 60 },
    // 6. 플레이팅 — plating_station에서 rested → plated (40 ticks)
    { id: "plate", placeId: "plating_station", fromColor: "rested", toColor: "plated", duration: 40 },
    // 7. 서빙 — pass에서 plated → served (20 ticks)
    { id: "serve", placeId: "pass", fromColor: "plated", toColor: "served", duration: 20 },
    // 8. 자동 반납 — 손님이 먹고 접시 반납 (100 ticks, auto)
    { id: "return", placeId: "pass", fromColor: "served", toColor: "dirty", duration: 100, auto: true, targetPlaceId: "dish_return" },
    // 9. 설거지 — sink에서 dirty → clean (80 ticks)
    { id: "wash", placeId: "sink", fromColor: "dirty", toColor: "clean", duration: 80 },
  ],
  defaultStorageId: "fridge",
  storageRoutes: [],
};

export const DEFAULT_WORKFLOW = new WorkflowGraph(DEFAULT_WORKFLOW_DEF);
