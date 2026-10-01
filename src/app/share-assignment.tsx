import { Toast } from "@/components/shared/ui/molecules/toast";
import { Container } from "@/components/ui/container";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { getCurrentBaseUrl } from "@/services/api";
import { uploadAssignmentDraftFiles } from "@/services/assignment";
import { useAssignmentShareStore } from "@/stores/assignment-share-store";
import { useAssignmentStore } from "@/stores/assignment-store";
import { useAuthStore } from "@/stores/auth-store";
import { useDashboardStore } from "@/stores/dashboard-store";
import type { AssignmentEditSession } from "@/types";
import {
  getAssignmentViewUrl,
  getSharedAssignmentTargets,
  type SharedAssignmentTarget,
} from "@/utils/assignment-share";
import { clampUploadProgress } from "@/utils/upload-progress";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";

export default function ShareAssignmentScreen() {
  const theme = useColorScheme() === "dark" ? Colors.dark : Colors.light;
  const files = useAssignmentShareStore((state) => state.files);
  const shareId = useAssignmentShareStore((state) => state.shareId);
  const events = useDashboardStore((state) => state.events);
  const hydrated = useDashboardStore((state) => state.hasHydrated);
  const dashboardError = useDashboardStore((state) => state.error);
  const isOffline = useAuthStore((state) => state.isOffline);
  const [selected, setSelected] = useState<SharedAssignmentTarget | null>(null);
  const [draftSession, setDraftSession] =
    useState<AssignmentEditSession | null>(null);
  const [phase, setPhase] = useState<
    "idle" | "uploading" | "ready" | "submitting" | "submitted"
  >("idle");
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const operation = useRef(0);
  const busyRef = useRef(false);
  const uploadAbort = useRef<AbortController | null>(null);
  const targets = useMemo(() => getSharedAssignmentTargets(events), [events]);
  const selectedDetails = useAssignmentStore((state) =>
    selected
      ? state.detailsByAssignmentId[selected.assignmentId]?.data
      : undefined,
  );
  const busy = phase === "uploading" || phase === "submitting";

  const refreshTargets = async () => {
    if (isOffline) return;
    setRefreshing(true);
    try {
      await useDashboardStore.getState().fetchDashboard({ silent: true });
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!hydrated || isOffline) return;
    const lastSync = useDashboardStore.getState().lastSyncTime;
    if (!lastSync || Date.now() - lastSync > 60_000) void refreshTargets();
    // Refresh once on opening or after reconnecting; cached deadlines display immediately.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, isOffline]);

  useEffect(() => {
    operation.current += 1;
    busyRef.current = false;
    setSelected(null);
    setDraftSession(null);
    setPhase("idle");
    setProgress(null);
    setError(null);
    return () => {
      operation.current += 1;
      uploadAbort.current?.abort();
    };
  }, [shareId]);

  const selectAssignment = async (target: SharedAssignmentTarget) => {
    if (busyRef.current || files.length === 0) return;
    if (isOffline) {
      Toast.show("Connect to the internet to upload shared files.", {
        type: "warning",
      });
      return;
    }
    const attempt = ++operation.current;
    const controller = new AbortController();
    uploadAbort.current = controller;
    busyRef.current = true;
    setSelected(target);
    setPhase("uploading");
    setError(null);
    setProgress(null);
    try {
      const store = useAssignmentStore.getState();
      await store.fetchAssignmentDetails(target.assignmentId);
      if (operation.current !== attempt) return;
      const details =
        useAssignmentStore.getState().detailsByAssignmentId[target.assignmentId]
          ?.data;
      if (!details?.canEditSubmission)
        throw new Error("This assignment is not accepting uploads right now.");
      const session = await store.startEditSession(target.assignmentId, {
        force: true,
      });
      if (operation.current !== attempt) return;
      if (!session)
        throw new Error(
          useAssignmentStore.getState().errorByAssignmentId[
            target.assignmentId
          ] ?? "Could not open submission options.",
        );
      const uploaded = await uploadAssignmentDraftFiles(session, files, {
        signal: controller.signal,
        onProgress: (fraction) => {
          if (operation.current === attempt)
            setProgress(clampUploadProgress(fraction));
        },
      });
      if (operation.current !== attempt) return;
      setDraftSession(uploaded);
      setPhase("ready");
    } catch (cause) {
      if (operation.current !== attempt) return;
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not upload shared files.",
      );
      setPhase("idle");
    } finally {
      if (operation.current === attempt) busyRef.current = false;
    }
  };

  const submit = async () => {
    if (!selected || !draftSession || busyRef.current || phase !== "ready")
      return;
    if (isOffline) {
      Toast.show("Connect to the internet to submit.", { type: "warning" });
      return;
    }
    const attempt = ++operation.current;
    busyRef.current = true;
    setPhase("submitting");
    setError(null);
    const result = await useAssignmentStore
      .getState()
      .submitAssignment(
        selected.assignmentId,
        { assignmentId: selected.assignmentId },
        { draftSession },
      );
    if (operation.current !== attempt) return;
    busyRef.current = false;
    if (result.success) {
      setPhase("submitted");
      useAssignmentShareStore.getState().clearSharedFiles();
      Toast.show(result.message, { type: "success" });
    } else {
      setPhase("ready");
      setError(result.message);
    }
  };

  const openLms = async () => {
    if (!selected) return;
    try {
      await Linking.openURL(
        getAssignmentViewUrl(getCurrentBaseUrl(), selected.assignmentId),
      );
    } catch {
      Toast.show("Could not open assignment on LMS.", { type: "error" });
    }
  };

  const close = () => {
    if (busy) return;
    useAssignmentShareStore.getState().clearSharedFiles();
    router.replace("/(tabs)");
  };

  return (
    <Container>
      <View className="flex-row items-center gap-3 px-4 py-3">
        <Pressable
          accessibilityLabel="Close shared upload"
          disabled={busy}
          onPress={close}
          className="h-11 w-11 items-center justify-center rounded-full"
          style={{
            backgroundColor: theme.backgroundSecondary,
            opacity: busy ? 0.5 : 1,
          }}
        >
          <Ionicons name="arrow-back" size={22} color={theme.text} />
        </Pressable>
        <Text className="text-xl font-bold" style={{ color: theme.text }}>
          Share to assignment
        </Text>
      </View>
      <ScrollView
        contentContainerClassName="gap-4 px-4 pb-8"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void refreshTargets()}
            tintColor={theme.text}
          />
        }
      >
        {files.length > 0 && (
          <View
            className="gap-1 rounded-2xl border p-4"
            style={{
              borderColor: theme.border,
              backgroundColor: theme.backgroundSecondary,
            }}
          >
            <Text
              className="mb-1 text-sm font-semibold"
              style={{ color: theme.text }}
            >
              {files.length} shared file{files.length === 1 ? "" : "s"}
            </Text>
            {files.map((file, index) => (
              <Text
                key={`${file.uri}-${index}`}
                numberOfLines={2}
                className="text-sm"
                style={{ color: theme.textSecondary }}
              >
                {file.name}
              </Text>
            ))}
          </View>
        )}
        {error && (
          <Text
            accessibilityRole="alert"
            className="text-sm"
            style={{ color: Colors.status.danger }}
          >
            {error}
          </Text>
        )}
        {selected && phase !== "idle" ? (
          <View
            className="gap-4 rounded-2xl border p-4"
            style={{
              borderColor: theme.border,
              backgroundColor: theme.backgroundSecondary,
            }}
          >
            <View className="gap-1">
              <Text className="text-lg font-bold" style={{ color: theme.text }}>
                {selectedDetails?.assignmentName ?? selected.name}
              </Text>
              <Text className="text-sm" style={{ color: theme.textSecondary }}>
                {selected.courseName}
              </Text>
              <Text className="text-sm" style={{ color: theme.textSecondary }}>
                {selected.dueAt
                  ? `Due ${new Date(selected.dueAt).toLocaleString()}`
                  : "No deadline"}
              </Text>
            </View>
            {selectedDetails?.descriptionText && (
              <Text className="text-sm" style={{ color: theme.textSecondary }}>
                {selectedDetails.descriptionText}
              </Text>
            )}
            {busy && <ActivityIndicator color={theme.text} />}
            <Text className="text-sm" style={{ color: theme.text }}>
              {phase === "uploading"
                ? progress === null
                  ? "Preparing upload..."
                  : `Uploading ${Math.round(progress * 100)}%`
                : phase === "ready"
                  ? "Files uploaded to a draft. Review the assignment, then tap Submit."
                  : phase === "submitting"
                    ? "Submitting..."
                    : "Submission saved successfully."}
            </Text>
            {phase === "ready" && (
              <Pressable
                accessibilityRole="button"
                onPress={() => void submit()}
                className="items-center rounded-xl px-4 py-3"
                style={{ backgroundColor: Colors.accent }}
              >
                <Text className="font-semibold" style={{ color: Colors.white }}>
                  Submit
                </Text>
              </Pressable>
            )}
            {!busy && (
              <Pressable
                accessibilityRole="button"
                onPress={() => void openLms()}
                className="items-center rounded-xl border px-4 py-3"
                style={{ borderColor: theme.border }}
              >
                <Text className="font-semibold" style={{ color: theme.text }}>
                  Open LMS
                </Text>
              </Pressable>
            )}
            {phase === "ready" && (
              <Pressable
                onPress={() => {
                  setSelected(null);
                  setDraftSession(null);
                  setError(null);
                  setPhase("idle");
                }}
                className="items-center py-2"
              >
                <Text style={{ color: theme.textSecondary }}>
                  Choose another assignment
                </Text>
              </Pressable>
            )}
            {phase === "submitted" && (
              <Pressable onPress={close} className="items-center py-2">
                <Text style={{ color: theme.textSecondary }}>Done</Text>
              </Pressable>
            )}
          </View>
        ) : files.length === 0 ? (
          <Text
            className="py-8 text-center text-sm"
            style={{ color: theme.textSecondary }}
          >
            Share an image or PDF from another app to get started.
          </Text>
        ) : (
          <View className="gap-3">
            <Text className="text-sm" style={{ color: theme.textSecondary }}>
              Choose an assignment to upload a draft. Upcoming deadlines are
              closest first, followed by overdue assignments.
            </Text>
            {isOffline && (
              <Text
                className="text-sm"
                style={{ color: Colors.status.warning }}
              >
                Offline — showing cached deadlines.
              </Text>
            )}
            {dashboardError && (
              <Text className="text-sm" style={{ color: Colors.status.danger }}>
                {dashboardError}
              </Text>
            )}
            {targets.map((target) => (
              <Pressable
                accessibilityRole="button"
                key={target.assignmentId}
                onPress={() => void selectAssignment(target)}
                className="gap-1 rounded-2xl border p-4"
                style={{
                  borderColor: theme.border,
                  backgroundColor: theme.backgroundSecondary,
                }}
              >
                <Text
                  className="text-base font-semibold"
                  style={{ color: theme.text }}
                >
                  {target.name}
                </Text>
                <Text
                  className="text-sm"
                  style={{ color: theme.textSecondary }}
                >
                  {target.courseName}
                </Text>
                <Text
                  className="text-sm"
                  style={{
                    color:
                      target.dueAt && target.dueAt < Date.now()
                        ? Colors.status.warning
                        : theme.textSecondary,
                  }}
                >
                  {target.dueAt
                    ? `${target.dueAt < Date.now() ? "Overdue · " : "Due "}${new Date(target.dueAt).toLocaleString()}`
                    : "No deadline"}
                </Text>
              </Pressable>
            ))}
            {targets.length === 0 && (
              <Text
                className="py-6 text-center text-sm"
                style={{ color: theme.textSecondary }}
              >
                {refreshing || !hydrated
                  ? "Loading assignments..."
                  : "No assignments with pending deadlines. Pull down to refresh."}
              </Text>
            )}
          </View>
        )}
      </ScrollView>
    </Container>
  );
}
