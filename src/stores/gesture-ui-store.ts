import { create } from "zustand";

interface GestureUiState {
  isHorizontalContentGestureActive: boolean;
  setHorizontalContentGestureActive: (active: boolean) => void;
}

export const useGestureUiStore = create<GestureUiState>((set) => ({
  isHorizontalContentGestureActive: false,
  setHorizontalContentGestureActive: (active) =>
    set({ isHorizontalContentGestureActive: active }),
}));
