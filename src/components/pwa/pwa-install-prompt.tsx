import { ConfirmModal } from "@/components/modals/confirm-modal";
import { usePwaInstallStore } from "@/stores/pwa-install-store";
import { useEffect, useRef, useState } from "react";

type PromptKind = "auto" | "manual";

interface PwaInstallPromptProps {
  isLoggedIn: boolean;
}

export function PwaInstallPrompt({
  isLoggedIn,
}: PwaInstallPromptProps): React.JSX.Element | null {
  const canInstall = usePwaInstallStore((state) => state.canInstall);
  const isIos = usePwaInstallStore((state) => state.isIos);
  const isInstalled = usePwaInstallStore((state) => state.isInstalled);
  const autoPromptDismissed = usePwaInstallStore(
    (state) => state.autoPromptDismissed,
  );
  const isPromptRequested = usePwaInstallStore(
    (state) => state.isPromptRequested,
  );
  const clearPromptRequest = usePwaInstallStore(
    (state) => state.clearPromptRequest,
  );
  const dismissAutoPrompt = usePwaInstallStore(
    (state) => state.dismissAutoPrompt,
  );
  const initialize = usePwaInstallStore((state) => state.initialize);
  const install = usePwaInstallStore((state) => state.install);

  const [visible, setVisible] = useState(false);
  const [promptKind, setPromptKind] = useState<PromptKind>("auto");
  const autoPromptShown = useRef(false);

  useEffect(() => {
    if (typeof window !== "undefined") initialize();
  }, [initialize]);

  useEffect(() => {
    if (!isLoggedIn) {
      autoPromptShown.current = false;
      return;
    }
    if (
      !autoPromptShown.current &&
      !autoPromptDismissed &&
      !isInstalled &&
      (canInstall || isIos)
    ) {
      autoPromptShown.current = true;
      setPromptKind("auto");
      setVisible(true);
    }
  }, [autoPromptDismissed, canInstall, isInstalled, isIos, isLoggedIn]);

  useEffect(() => {
    if (!isPromptRequested || isInstalled || (!canInstall && !isIos)) return;
    clearPromptRequest();
    setPromptKind("manual");
    setVisible(true);
  }, [
    canInstall,
    clearPromptRequest,
    isInstalled,
    isIos,
    isPromptRequested,
  ]);

  if (typeof window === "undefined" || isInstalled) return null;

  const isIosPrompt = isIos && !canInstall;
  const close = (): void => setVisible(false);
  const handleCancel = (): void => {
    if (promptKind === "auto") dismissAutoPrompt();
    close();
  };
  const handleConfirm = (): void => {
    if (isIosPrompt) {
      if (promptKind === "auto") dismissAutoPrompt();
      close();
      return;
    }

    close();
    void install().then(() => {
      if (promptKind === "auto") dismissAutoPrompt();
    });
  };

  return (
    <ConfirmModal
      visible={visible}
      title={isIosPrompt ? "Add Bunkialo to Home Screen" : "Install Bunkialo"}
      message={
        isIosPrompt
          ? "Open the Share menu in Safari, then choose Add to Home Screen."
          : "Keep Bunkialo one tap away in its own app window."
      }
      confirmText={isIosPrompt ? "Got it" : "Install"}
      cancelText={isIosPrompt ? "Later" : "Not now"}
      icon="download-outline"
      onCancel={handleCancel}
      onConfirm={handleConfirm}
    />
  );
}
