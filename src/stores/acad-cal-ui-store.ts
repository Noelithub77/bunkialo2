import type { AcademicEvent } from "@/types";
import { create } from "zustand";

// modal payload types
type ModalState =
    | { type: "event-editor"; event: CalendarEvent | null; mode: EditorMode }
    | { type: "changes" }
    | { type: "export" }
    | null;

export type CalendarEvent = AcademicEvent & { source: "base" | "custom" };
export type EditorMode = "create" | "edit-base" | "edit-custom";
export type ViewMode = "calendar" | "upnext";

interface AcadCalUIState {
    viewMode: ViewMode;
    selectedDate: string;
    isEditMode: boolean;
    showFabMenu: boolean;
    activeModal: ModalState;

    setViewMode: (mode: ViewMode) => void;
    setSelectedDate: (date: string) => void;
    toggleEditMode: () => void;
    setEditMode: (value: boolean) => void;
    setShowFabMenu: (show: boolean) => void;
    openModal: (modal: ModalState) => void;
    closeModal: () => void;
    reset: () => void;
}

export const useAcadCalUIStore = create<AcadCalUIState>((set) => ({
    viewMode: "upnext",
    selectedDate: "",
    isEditMode: false,
    showFabMenu: false,
    activeModal: null,

    setViewMode: (mode) => set({ viewMode: mode }),
    setSelectedDate: (date) => set({ selectedDate: date }),
    toggleEditMode: () => set((s) => ({ isEditMode: !s.isEditMode })),
    setEditMode: (value) => set({ isEditMode: value }),
    setShowFabMenu: (show) => set({ showFabMenu: show }),
    openModal: (modal) => set({ activeModal: modal }),
    closeModal: () => set({ activeModal: null }),
    reset: () =>
        set({
            viewMode: "upnext",
            isEditMode: false,
            showFabMenu: false,
            activeModal: null,
        }),
}));
