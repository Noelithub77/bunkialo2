export const setPortalBackgroundSync = async (enabled: boolean, notificationsEnabled = true): Promise<void> => {
  if (!enabled) return;
  const response = await fetch("/api/push/preferences", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled: notificationsEnabled }) });
  if (response.status === 404) return; // Compatible with the previous web deployment.
  if (!response.ok) throw new Error("Could not save background notification preference");
};
