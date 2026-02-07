import { useWifixLogStore } from "@/stores/wifix-log-store";
import type { DashboardLog } from "@/types";

export const wifixLogger = {
  log: (message: string, type: DashboardLog["type"] = "info") => {
    try {
      const store = useWifixLogStore.getState();
      store.addLog(message, type);
    } catch (error) {
      console.debug("Wifix logging not available:", error);
    }
  },

  info: (message: string) => wifixLogger.log(message, "info"),
  success: (message: string) => wifixLogger.log(message, "success"),
  error: (message: string) => wifixLogger.log(message, "error"),
};
