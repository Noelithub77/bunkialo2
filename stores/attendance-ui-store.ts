import type { AttendanceRecord, CourseBunkData } from "@/types";
import { create } from "zustand";

// discriminated union for all modal states
export type ModalState =
  | { type: "dl-input"; courseId: string; record: AttendanceRecord }
  | { type: "dl-input-bunk"; courseId: string; bunkId: string }
  | { type: "presence-input"; courseId: string; record: AttendanceRecord }
  | { type: "presence-input-bunk"; courseId: string; bunkId: string }
  | { type: "course-edit"; course: CourseBunkData }
  | { type: "add-bunk"; course: CourseBunkData }
  | { type: "create-course" }
  | { type: "changes" }
  | { type: "duty-leave-list" }
  | { type: "unknown-status" }
  | { type: "slot-conflict" }
  | { type: "confirm-remove-dl"; courseId: string; bunkId: string }
  | { type: "confirm-remove-present"; courseId: string; bunkId: string }
  | {
      type: "confirm-unknown-absent";
      courseId: string;
      record: AttendanceRecord;
    }
  | null;

export type TabType = "absences" | "courses";

interface AttendanceUIState {
  activeTab: TabType;
  showTooltip: boolean;
  isEditMode: boolean;
  showFabMenu: boolean;
  activeModal: ModalState;
}

interface AttendanceUIActions {
  setActiveTab: (tab: TabType) => void;
  setShowTooltip: (show: boolean) => void;
  setIsEditMode: (edit: boolean) => void;
  toggleEditMode: () => void;
  setShowFabMenu: (show: boolean) => void;
  openModal: (modal: ModalState) => void;
  closeModal: () => void;
  resetUI: () => void;
}

const initialState: AttendanceUIState = {
  activeTab: "absences",
  showTooltip: false,
  isEditMode: false,
  showFabMenu: false,
  activeModal: null,
};

export const useAttendanceUIStore = create<
  AttendanceUIState & AttendanceUIActions
>()((set) => ({
  ...initialState,

  setActiveTab: (tab) => set({ activeTab: tab, showFabMenu: false }),
  setShowTooltip: (show) => set({ showTooltip: show }),
  setIsEditMode: (edit) => set({ isEditMode: edit }),
  toggleEditMode: () => set((state) => ({ isEditMode: !state.isEditMode })),
  setShowFabMenu: (show) => set({ showFabMenu: show }),
  openModal: (modal) => set({ activeModal: modal }),
  closeModal: () => set({ activeModal: null }),
  resetUI: () => set(initialState),
}));

// selectors for modal type checks
export const selectIsModalOpen =
  (type: NonNullable<ModalState>["type"]) => (state: AttendanceUIState) =>
    state.activeModal?.type === type;

export const selectModalPayload = <T extends NonNullable<ModalState>["type"]>(
  state: AttendanceUIState,
  type: T,
): Extract<ModalState, { type: T }> | null => {
  if (state.activeModal?.type === type) {
    return state.activeModal as Extract<ModalState, { type: T }>;
  }
  return null;
};
