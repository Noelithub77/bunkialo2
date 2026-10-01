import { useEffect } from "react";
import { AppState, Platform } from "react-native";
import { useAuthStore } from "@/stores/auth-store";
import { useBunkStore } from "@/stores/bunk-store";
import { useTimetableStore } from "@/stores/timetable-store";
import { syncHomeWidgets } from "@/widgets/sync";

export function useHomeWidgets() {
  useEffect(() => {
    if (Platform.OS === "web") return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let disposed = false;
    let running = false;
    let pending = false;
    const flush = async () => {
      if (running) {
        pending = true;
        return;
      }
      running = true;
      try {
        await syncHomeWidgets();
      } catch (error) {
        console.warn("Widget refresh failed", error);
      } finally {
        running = false;
        if (pending && !disposed) {
          pending = false;
          refresh();
        }
      }
    };
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (!disposed) void flush();
      }, 200);
    };
    const unsubscribe = [
      useTimetableStore.subscribe((state, previous) => {
        if (state.slots !== previous.slots) refresh();
      }),
      useBunkStore.subscribe((state, previous) => {
        if (
          state.courses !== previous.courses ||
          state.hiddenCourses !== previous.hiddenCourses ||
          state.hasHydrated !== previous.hasHydrated
        )
          refresh();
      }),
      useAuthStore.subscribe((state, previous) => {
        if (
          state.isLoggedIn !== previous.isLoggedIn ||
          state.isCheckingAuth !== previous.isCheckingAuth
        )
          refresh();
      }),
      useTimetableStore.persist.onFinishHydration(refresh),
    ];
    const appState = AppState.addEventListener("change", (state) => {
      if (state === "active") refresh();
    });
    refresh();
    return () => {
      disposed = true;
      clearTimeout(timer);
      unsubscribe.forEach((stop) => stop());
      appState.remove();
    };
  }, []);
}
