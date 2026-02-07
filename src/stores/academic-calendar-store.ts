import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { AcademicEvent, AcademicEventOverride } from "@/types";

interface AcademicCalendarState {
  overrides: Record<string, AcademicEventOverride>;
  customEvents: AcademicEvent[];
  setBaseOverride: (id: string, override: AcademicEventOverride) => void;
  clearBaseOverride: (id: string) => void;
  hideBaseEvent: (id: string, hidden: boolean) => void;
  addCustomEvent: (event: Omit<AcademicEvent, "id">) => string;
  updateCustomEvent: (
    id: string,
    update: Partial<Omit<AcademicEvent, "id">>,
  ) => void;
  removeCustomEvent: (id: string) => void;
  resetCalendar: () => void;
}

const DEFAULT_STATE = {
  overrides: {},
  customEvents: [],
};

const createId = (prefix: string): string =>
  `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

export const useAcademicCalendarStore = create<AcademicCalendarState>()(
  persist(
    (set, get) => ({
      ...DEFAULT_STATE,

      setBaseOverride: (id, override) =>
        set((state) => ({
          overrides: {
            ...state.overrides,
            [id]: {
              ...state.overrides[id],
              ...override,
            },
          },
        })),

      clearBaseOverride: (id) =>
        set((state) => {
          if (!state.overrides[id]) return state;
          const next = { ...state.overrides };
          delete next[id];
          return { overrides: next };
        }),

      hideBaseEvent: (id, hidden) =>
        set((state) => ({
          overrides: {
            ...state.overrides,
            [id]: {
              ...state.overrides[id],
              hidden,
            },
          },
        })),

      addCustomEvent: (event) => {
        const id = createId("custom-event");
        const nextEvent: AcademicEvent = { ...event, id };
        set((state) => ({
          customEvents: [...state.customEvents, nextEvent],
        }));
        return id;
      },

      updateCustomEvent: (id, update) =>
        set((state) => ({
          customEvents: state.customEvents.map((event) =>
            event.id === id ? { ...event, ...update, id } : event,
          ),
        })),

      removeCustomEvent: (id) =>
        set((state) => ({
          customEvents: state.customEvents.filter((event) => event.id !== id),
        })),

      resetCalendar: () => {
        const state = get();
        if (
          Object.keys(state.overrides).length === 0 &&
          state.customEvents.length === 0
        ) {
          return;
        }
        set({ ...DEFAULT_STATE });
      },
    }),
    {
      name: "academic-calendar-storage",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
