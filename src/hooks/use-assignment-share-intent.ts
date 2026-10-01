import { isRunningInExpoGo } from "expo";
import { useIncomingShare, type UseIncomingShareResult } from "expo-sharing";
import { useLinkingURL } from "expo-linking";
import { router, usePathname, useRootNavigationState } from "expo-router";
import { useEffect, useRef } from "react";
import { Toast } from "@/components/shared/ui/molecules/toast";
import { useAuthStore } from "@/stores/auth-store";
import { useAssignmentShareStore } from "@/stores/assignment-share-store";
import {
  isSupportedAssignmentShare,
  normalizeSharedFileUri,
  SHARED_ASSIGNMENT_ROUTE,
} from "@/utils/assignment-share";

// Expo Go has no app-specific iOS share group; querying native payloads throws.
const emptyIncomingShare: UseIncomingShareResult = {
  sharedPayloads: [],
  resolvedSharedPayloads: [],
  clearSharedPayloads: () => {},
  refreshSharePayloads: async () => {},
  isResolving: false,
  error: null,
};
const useAssignmentIncomingShare = isRunningInExpoGo()
  ? () => emptyIncomingShare
  : useIncomingShare;

export function useAssignmentShareIntent() {
  const {
    resolvedSharedPayloads,
    clearSharedPayloads,
    refreshSharePayloads,
    error,
  } = useAssignmentIncomingShare();
  const incomingUrl = useLinkingURL();
  const navigation = useRootNavigationState();
  const pathname = usePathname();
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn);
  const isCheckingAuth = useAuthStore((state) => state.isCheckingAuth);
  const files = useAssignmentShareStore((state) => state.files);
  const shareId = useAssignmentShareStore((state) => state.shareId);
  const routedShare = useRef<number | null>(null);
  const lastIntent = useRef<typeof resolvedSharedPayloads | null>(null);

  useEffect(() => {
    if (
      !navigation?.key ||
      resolvedSharedPayloads.length === 0 ||
      lastIntent.current === resolvedSharedPayloads
    )
      return;
    lastIntent.current = resolvedSharedPayloads;
    const incoming = resolvedSharedPayloads.map((file) => ({
      uri: normalizeSharedFileUri(file.contentUri ?? ""),
      name: file.originalName ?? "",
      mimeType: file.contentMimeType ?? file.mimeType,
      size: file.contentSize,
    }));
    if (incoming.length === 0 || !incoming.every(isSupportedAssignmentShare)) {
      Toast.show("Share images or PDF files to upload to an assignment.", {
        type: "warning",
      });
    } else {
      useAssignmentShareStore.getState().setSharedFiles(incoming);
    }
    clearSharedPayloads();
    void refreshSharePayloads();
  }, [
    navigation?.key,
    clearSharedPayloads,
    refreshSharePayloads,
    resolvedSharedPayloads,
  ]);

  useEffect(() => {
    if (
      !navigation?.key ||
      isCheckingAuth ||
      !isLoggedIn ||
      files.length === 0 ||
      routedShare.current === shareId
    )
      return;
    // The auth redirect owns navigation from login; wait for it to finish.
    if (pathname === "/login") return;
    routedShare.current = shareId;
    if (pathname !== SHARED_ASSIGNMENT_ROUTE)
      router.push(SHARED_ASSIGNMENT_ROUTE);
  }, [
    files.length,
    isCheckingAuth,
    isLoggedIn,
    navigation?.key,
    pathname,
    shareId,
  ]);

  useEffect(() => {
    if (incomingUrl?.startsWith("bunkialo://expo-sharing"))
      refreshSharePayloads();
  }, [incomingUrl, refreshSharePayloads]);

  useEffect(() => {
    if (error)
      Toast.show(`Could not receive shared file: ${error.message}`, {
        type: "error",
      });
  }, [error]);
}
