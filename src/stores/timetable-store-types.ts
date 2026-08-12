import type { TimetableState } from "@/types";

export interface TimetableActions {
  generateTimetable: () => void;
  clearTimetable: () => void;
  resolveConflict: (
    conflictIndex: number,
    keep: "preferred" | "alternative" | "keep-outlier" | "ignore-outlier",
  ) => void;
  resolveAllPreferred: () => void;
  revertConflictResolution: (conflictId: string) => void;
  clearConflicts: () => void;
}

export type TimetableStoreState = TimetableState & TimetableActions;
