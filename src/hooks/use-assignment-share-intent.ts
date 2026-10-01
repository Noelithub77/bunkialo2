import { useShareIntent } from "expo-share-intent";
import Constants from "expo-constants";
import { router, usePathname, useRootNavigationState } from "expo-router";
import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import { Toast } from "@/components/shared/ui/molecules/toast";
import { useAuthStore } from "@/stores/auth-store";
import { useAssignmentShareStore } from "@/stores/assignment-share-store";
import {
  isSupportedAssignmentShare,
  normalizeSharedFileUri,
  SHARED_ASSIGNMENT_ROUTE,
} from "@/utils/assignment-share";

export function useAssignmentShareIntent() {
  const { hasShareIntent, shareIntent, resetShareIntent, error } =
    useShareIntent({
      disabled: Platform.OS === "web" || Constants.appOwnership === "expo",
      resetOnBackground: false,
      scheme: "bunkialo",
    });
  const navigation = useRootNavigationState();
  const pathname = usePathname();
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn);
  const isCheckingAuth = useAuthStore((state) => state.isCheckingAuth);
  const files = useAssignmentShareStore((state) => state.files);
  const shareId = useAssignmentShareStore((state) => state.shareId);
  const routedShare = useRef<number | null>(null);
  const lastIntent = useRef<typeof shareIntent | null>(null);

  useEffect(() => {
    if (
      !navigation?.key ||
      !hasShareIntent ||
      lastIntent.current === shareIntent
    )
      return;
    lastIntent.current = shareIntent;
    const incoming = (shareIntent.files ?? []).map((file) => ({
      uri: normalizeSharedFileUri(file.path),
      name: file.fileName,
      mimeType: file.mimeType,
      size: file.size,
    }));
    if (incoming.length === 0 || !incoming.every(isSupportedAssignmentShare)) {
      Toast.show("Share images or PDF files to upload to an assignment.", {
        type: "warning",
      });
    } else {
      useAssignmentShareStore.getState().setSharedFiles(incoming);
    }
    resetShareIntent();
  }, [hasShareIntent, navigation?.key, resetShareIntent, shareIntent]);

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
    if (error)
      Toast.show(`Could not receive shared file: ${error}`, { type: "error" });
  }, [error]);
}
