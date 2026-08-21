import type {
  BeforeInstallPromptEvent,
  PwaInstallOutcome,
} from "@/types";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { zustandStorage } from "./storage";

interface PwaInstallState {
  autoPromptDismissed: boolean;
  canInstall: boolean;
  deferredPrompt: BeforeInstallPromptEvent | null;
  isIos: boolean;
  isInstalled: boolean;
  isPromptRequested: boolean;
  clearPromptRequest: () => void;
  dismissAutoPrompt: () => void;
  initialize: () => void;
  install: () => Promise<PwaInstallOutcome>;
  requestInstall: () => void;
}

let initialized = false;

const isBeforeInstallPromptEvent = (
  event: Event,
): event is BeforeInstallPromptEvent => {
  const candidate = event as Partial<BeforeInstallPromptEvent>;
  return (
    typeof candidate.prompt === "function" &&
    typeof candidate.userChoice?.then === "function"
  );
};

const isIosBrowser = (): boolean => {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return false;
  }

  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
};

const isStandaloneWindow = (): boolean => {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches;
};

export const usePwaInstallStore = create<PwaInstallState>()(
  persist(
    (set, get) => ({
      autoPromptDismissed: false,
      canInstall: false,
      deferredPrompt: null,
      isIos: false,
      isInstalled: false,
      isPromptRequested: false,

      clearPromptRequest: () => set({ isPromptRequested: false }),

      dismissAutoPrompt: () => set({ autoPromptDismissed: true }),

      initialize: () => {
        if (initialized || typeof window === "undefined") return;
        initialized = true;

        const installed = isStandaloneWindow();
        set({
          isInstalled: installed,
          isIos: isIosBrowser(),
        });

        const handleBeforeInstallPrompt = (event: Event): void => {
          if (!isBeforeInstallPromptEvent(event)) return;
          event.preventDefault();
          set({ canInstall: true, deferredPrompt: event });
        };

        const handleAppInstalled = (): void => {
          set({
            autoPromptDismissed: true,
            canInstall: false,
            deferredPrompt: null,
            isInstalled: true,
          });
        };

        window.addEventListener(
          "beforeinstallprompt",
          handleBeforeInstallPrompt,
        );
        window.addEventListener("appinstalled", handleAppInstalled);
      },

      install: async (): Promise<PwaInstallOutcome> => {
        const prompt = get().deferredPrompt;
        if (!prompt) return "unavailable";

        set({ canInstall: false, deferredPrompt: null });
        try {
          await prompt.prompt();
          const choice = await prompt.userChoice;
          if (choice.outcome === "accepted") {
            set({ isInstalled: true });
            return "accepted";
          }
          return "dismissed";
        } catch {
          return "unavailable";
        }
      },

      requestInstall: () => set({ isPromptRequested: true }),
    }),
    {
      name: "pwa-install-storage-v1",
      storage: createJSONStorage(() => zustandStorage),
      partialize: (state) => ({
        autoPromptDismissed: state.autoPromptDismissed,
      }),
    },
  ),
);
