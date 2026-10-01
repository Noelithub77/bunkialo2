import { Toast } from "@/components/shared/ui/molecules/toast";
import { Container } from "@/components/ui/container";
import { ASSIGNMENT_STALE_MS } from "@/constants/assignment";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { getCurrentBaseUrl } from "@/services/api";
import { useAssignmentStore } from "@/stores/assignment-store";
import { useAuthStore } from "@/stores/auth-store";
import type { AssignmentUploadLocalFile } from "@/types";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  InteractionManager,
  Linking,
  Pressable,
  RefreshControl,
  Text,
  TextInput,
  Platform,
  View,
} from "react-native";
import { formatSyncTime } from "@/course/utils/course-utils";
import { downloadLmsResourceWithSession } from "@/services/lms-download";
import { getContentUriAsync } from "expo-file-system/legacy";
import { startActivityAsync } from "expo-intent-launcher";
import { isAvailableAsync, shareAsync } from "expo-sharing";
import { debug } from "@/utils/debug";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { clampUploadProgress } from "@/utils/upload-progress";
import { getAssignmentViewUrl } from "@/utils/assignment-share";

const formatDateTime = (timestamp: number | null): string => {
  if (!timestamp) return "Not available";
  return new Date(timestamp).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const formatMaxBytes = (value: number | null): string | null => {
  if (!value || value <= 0) return null;
  const units = ["B", "KB", "MB", "GB"];
  let size = value;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[unitIndex]}`;
};

const normalizeParam = (value: string | string[] | undefined): string =>
  Array.isArray(value) ? (value[0] ?? "") : (value ?? "");

export default function AssignmentDetailScreen() {
  const { courseid, assignmentid, fallbackDueAt } = useLocalSearchParams<{
    courseid?: string | string[];
    assignmentid?: string | string[];
    fallbackDueAt?: string | string[];
  }>();
  const courseId = normalizeParam(courseid);
  const assignmentId = normalizeParam(assignmentid);
  const fallbackDueAtMs = useMemo(() => {
    const raw = normalizeParam(fallbackDueAt);
    if (!raw) return null;
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }, [fallbackDueAt]);

  const colorScheme = useColorScheme();
  const isOffline = useAuthStore((state) => state.isOffline);
  const isDark = colorScheme === "dark";
  const theme = isDark ? Colors.dark : Colors.light;

  const hasHydrated = useAssignmentStore((state) => state.hasHydrated);
  const fetchAssignmentDetails = useAssignmentStore(
    (state) => state.fetchAssignmentDetails,
  );
  const refreshAssignmentDetails = useAssignmentStore(
    (state) => state.refreshAssignmentDetails,
  );
  const startEditSession = useAssignmentStore(
    (state) => state.startEditSession,
  );
  const submitAssignment = useAssignmentStore(
    (state) => state.submitAssignment,
  );

  const entry = useAssignmentStore((state) =>
    assignmentId ? state.detailsByAssignmentId[assignmentId] : undefined,
  );
  const editSession = useAssignmentStore((state) =>
    assignmentId ? state.editSessionByAssignmentId[assignmentId] : undefined,
  );
  const isLoading = useAssignmentStore((state) =>
    assignmentId
      ? (state.isLoadingByAssignmentId[assignmentId] ?? false)
      : false,
  );
  const isSubmitting = useAssignmentStore((state) =>
    assignmentId
      ? (state.isSubmittingByAssignmentId[assignmentId] ?? false)
      : false,
  );
  const isLoadingEdit = useAssignmentStore(
    (state) => state.isLoadingEditByAssignmentId[assignmentId] ?? false,
  );
  const uploadProgress = useAssignmentStore((state) =>
    assignmentId
      ? (state.uploadProgressByAssignmentId[assignmentId] ?? null)
      : null,
  );
  const error = useAssignmentStore((state) =>
    assignmentId ? (state.errorByAssignmentId[assignmentId] ?? null) : null,
  );

  const details = entry?.data;
  const supportsFileSubmission = Boolean(
    details?.supportsFileSubmission || editSession?.supportsFileSubmission,
  );
  const supportsOnlineTextSubmission = Boolean(
    details?.supportsOnlineTextSubmission ||
    editSession?.supportsOnlineTextSubmission,
  );
  const canEditSubmission = Boolean(details?.canEditSubmission);
  const effectiveMaxFiles = details?.maxFiles ?? editSession?.maxFiles ?? null;
  const effectiveMaxBytes = details?.maxBytes ?? editSession?.maxBytes ?? null;
  const [onlineText, setOnlineText] = useState("");
  const [files, setFiles] = useState<AssignmentUploadLocalFile[]>([]);
  const [hasSeededOnlineText, setHasSeededOnlineText] = useState(false);

  const [downloadingUrlSet, setDownloadingUrlSet] = useState<
    Record<string, boolean>
  >({});

  useEffect(() => {
    setOnlineText("");
    setFiles([]);
    setHasSeededOnlineText(false);
  }, [assignmentId]);

  useEffect(() => {
    if (!assignmentId || !hasHydrated) return;
    const stale =
      !entry || Date.now() - entry.lastSyncTime > ASSIGNMENT_STALE_MS;
    if (!stale) return;
    void fetchAssignmentDetails(assignmentId, { silent: Boolean(entry) });
  }, [assignmentId, entry, fetchAssignmentDetails, hasHydrated]);

  useEffect(() => {
    if (!assignmentId || !details?.canEditSubmission) return;
    const task = InteractionManager.runAfterInteractions(() => {
      void startEditSession(assignmentId, { force: false });
    });
    return () => task.cancel();
  }, [assignmentId, details?.canEditSubmission, startEditSession]);

  useEffect(() => {
    if (hasSeededOnlineText) return;
    if (!editSession?.onlineTextDraftHtml) return;
    setOnlineText(editSession.onlineTextDraftHtml);
    setHasSeededOnlineText(true);
  }, [editSession?.onlineTextDraftHtml, hasSeededOnlineText]);

  const dueAtForDisplay = details?.dueAt ?? fallbackDueAtMs;
  const dueIsOverdue = Boolean(dueAtForDisplay && dueAtForDisplay < Date.now());
  const resolvedCourseId = details?.courseId ?? courseId;
  const breadcrumbCourse =
    details?.courseName ?? (courseId ? `Course ${courseId}` : "Course");
  const breadcrumbAssignment =
    details?.assignmentName ??
    (assignmentId ? `Assignment ${assignmentId}` : "Assignment");
  const maxFileSizeLabel = useMemo(
    () => formatMaxBytes(effectiveMaxBytes),
    [effectiveMaxBytes],
  );

  const openOnLms = async () => {
    const url = getAssignmentViewUrl(getCurrentBaseUrl(), assignmentId);

    try {
      const canOpen = await Linking.canOpenURL(url);
      if (!canOpen) {
        throw new Error("Unsupported URL");
      }
      await Linking.openURL(url);
    } catch {
      Toast.show("Could not open assignment on LMS", { type: "error" });
    }
  };

  const openDashboard = () => {
    router.push("/(tabs)");
  };

  const openCourseResources = () => {
    if (!resolvedCourseId) {
      Toast.show("Could not resolve course route", { type: "error" });
      return;
    }
    router.push(`/course/${resolvedCourseId}`);
  };

  const addFiles = async () => {
    if (!supportsFileSubmission) {
      Toast.show("This assignment does not accept file submissions", {
        type: "warning",
      });
      return;
    }

    const result = await DocumentPicker.getDocumentAsync({
      multiple: true,
      copyToCacheDirectory: true,
      type: "*/*",
    });

    if (result.canceled || result.assets.length === 0) return;

    const selected = result.assets.map((asset) => ({
      uri: asset.uri,
      name: asset.name,
      mimeType: asset.mimeType ?? "application/octet-stream",
      size: asset.size,
    }));

    const deduped = new Map<string, AssignmentUploadLocalFile>();
    for (const file of [...files, ...selected]) {
      deduped.set(`${file.uri}|${file.name}`, file);
    }

    let nextFiles = Array.from(deduped.values());
    if (effectiveMaxFiles !== null && nextFiles.length > effectiveMaxFiles) {
      nextFiles = nextFiles.slice(0, effectiveMaxFiles);
      Toast.show(
        `Only ${effectiveMaxFiles} file(s) allowed for this assignment`,
        {
          type: "warning",
        },
      );
    }

    setFiles(nextFiles);
  };

  const removeFile = (uri: string) => {
    setFiles((prev) => prev.filter((item) => item.uri !== uri));
  };

  const handleSubmit = async () => {
    if (!assignmentId) return;
    if (isOffline) {
      Toast.show("You are offline. Submission requires internet.", {
        type: "error",
      });
      return;
    }
    if (!canEditSubmission) {
      Toast.show("Submission is not editable right now.", {
        type: "warning",
      });
      return;
    }

    const hasInput = supportsFileSubmission || supportsOnlineTextSubmission;
    if (!hasInput) {
      Toast.show("No supported submission method found for this assignment.", {
        type: "warning",
      });
      return;
    }

    const hasAnyPayload =
      (supportsFileSubmission && files.length > 0) ||
      (supportsOnlineTextSubmission && onlineText.trim().length > 0);
    if (!hasAnyPayload) {
      Toast.show("Add a file or text before submitting.", {
        type: "warning",
      });
      return;
    }

    const result = await submitAssignment(assignmentId, {
      assignmentId,
      files: supportsFileSubmission ? files : [],
      onlineTextHtml: supportsOnlineTextSubmission ? onlineText : undefined,
    });

    if (result.success) {
      Toast.show(result.message, { type: "success" });
      setFiles([]);
      setOnlineText("");
      setHasSeededOnlineText(false);
      return;
    }

    Toast.show(result.message, { type: "error" });
  };
  const FLAG_GRANT_READ_URI_PERMISSION = 1;

  const normalizeMimeType = (contentType: string | null): string => {
    const baseType = contentType?.split(";")[0]?.trim().toLowerCase();
    return baseType || "*/*";
  };

  const getFileIconName = (name: string): keyof typeof Ionicons.glyphMap => {
    const ext = name.split(".").pop()?.toLowerCase();

    switch (ext) {
      case "pdf":
        return "document-text";

      case "jpg":
      case "jpeg":
      case "png":
      case "gif":
      case "webp":
      case "svg":
        return "image";

      case "mp4":
      case "mov":
      case "avi":
      case "mkv":
        return "videocam";

      case "mp3":
      case "wav":
      case "aac":
        return "musical-notes";

      case "zip":
      case "rar":
      case "7z":
      case "tar":
      case "gz":
        return "archive";

      case "doc":
      case "docx":
        return "document";

      case "ppt":
      case "pptx":
        return "easel";

      case "xls":
      case "xlsx":
      case "csv":
        return "grid";

      case "txt":
      case "md":
        return "document-outline";

      default:
        return "attach";
    }
  };

  const openExternal = async (url: string, preferredName: string) => {
    if (downloadingUrlSet[url]) return;

    setDownloadingUrlSet((prev) => ({ ...prev, [url]: true }));

    try {
      const result = await downloadLmsResourceWithSession(url, preferredName);
      if (!result.success) {
        Toast.show(result.message || "Download failed", { type: "error" });
        setDownloadingUrlSet((prev) => {
          const next = { ...prev };
          delete next[url];
          return next;
        });
        return;
      }
      const mime = normalizeMimeType(result.contentType);

      if (Platform.OS === "android") {
        const contentUri = await getContentUriAsync(result.uri);

        await startActivityAsync("android.intent.action.VIEW", {
          data: contentUri,
          type: mime,
          flags: FLAG_GRANT_READ_URI_PERMISSION,
        });
      } else {
        const canShare = await isAvailableAsync();
        if (canShare) {
          await shareAsync(result.uri, { mimeType: mime });
        } else {
          await Linking.openURL(result.uri);
        }
      }

      Toast.show("Downloaded successfully", { type: "success" });
    } catch (error) {
      debug.api("assignment resource open failed", error);

      Toast.show("Downloaded but could not open file", {
        type: "warning",
      });
    } finally {
      setDownloadingUrlSet((prev) => {
        const next = { ...prev };
        delete next[url];
        return next;
      });
    }
  };

  return (
    <Container className="relative">
      <KeyboardAwareScrollView
        keyboardShouldPersistTaps="handled"
        bottomOffset={24}
        contentContainerClassName="px-4 pb-10"
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={() => {
              if (!assignmentId) return;
              void refreshAssignmentDetails(assignmentId);
            }}
            tintColor={theme.text}
          />
        }
      >
        <View className="mb-4 mt-3 gap-4">
          <View className="flex-row items-center justify-between">
            <Pressable
              onPress={() => router.back()}
              className="h-11 w-11 items-center justify-center rounded-full"
              style={{
                backgroundColor: isDark ? Colors.gray[900] : Colors.white,
              }}
            >
              <Ionicons name="arrow-back" size={21} color={theme.text} />
            </Pressable>

            <View
              className="rounded-full border px-3 py-1.5"
              style={{
                backgroundColor: isDark ? Colors.gray[900] : Colors.white,
                borderColor: theme.border,
              }}
            >
              <Text
                className="text-[10px]"
                style={{ color: theme.textSecondary }}
              >
                {formatSyncTime(entry?.lastSyncTime ?? null)}
              </Text>
            </View>
          </View>

          <View
            className="rounded-2xl border px-4 py-3"
            style={{
              borderColor: theme.border,
              backgroundColor: theme.backgroundSecondary,
            }}
          >
            <View className="flex-row flex-wrap items-center gap-1.5">
              <Pressable
                className="rounded-md px-1 py-0.5"
                onPress={openDashboard}
              >
                <Text
                  className="text-[12px] font-semibold"
                  style={{ color: theme.textSecondary }}
                >
                  Dashboard
                </Text>
              </Pressable>

              <Ionicons
                name="chevron-forward"
                size={12}
                color={theme.textSecondary}
              />

              <Pressable
                className="rounded-md px-1 py-0.5"
                onPress={openCourseResources}
                disabled={!resolvedCourseId}
              >
                <Text
                  className="text-[12px] font-semibold"
                  style={{
                    color: resolvedCourseId
                      ? theme.textSecondary
                      : `${theme.textSecondary}88`,
                  }}
                  numberOfLines={1}
                >
                  {breadcrumbCourse}
                </Text>
              </Pressable>
            </View>

            <Text
              className="mt-1 text-[24px] font-extrabold leading-[30px]"
              style={{ color: theme.text }}
            >
              {breadcrumbAssignment}
            </Text>
          </View>
        </View>

        {!entry && isLoading && (
          <View className="items-center gap-3 py-12">
            <ActivityIndicator size="large" color={theme.text} />
            <Text className="text-sm" style={{ color: theme.textSecondary }}>
              Loading assignment...
            </Text>
          </View>
        )}

        {!entry && error && !isLoading && (
          <View
            className="items-center gap-4 rounded-2xl border p-4"
            style={{
              borderColor: `${Colors.status.danger}55`,
              backgroundColor: `${Colors.status.danger}12`,
            }}
          >
            <Text
              className="text-[14px] text-center"
              style={{ color: Colors.status.danger }}
            >
              {error}
            </Text>
            <Pressable
              className="rounded-full px-4 py-2"
              style={{ backgroundColor: theme.backgroundSecondary }}
              onPress={() => {
                if (!assignmentId) return;
                void refreshAssignmentDetails(assignmentId);
              }}
            >
              <Text
                className="text-[13px] font-semibold"
                style={{ color: theme.text }}
              >
                Retry
              </Text>
            </Pressable>
          </View>
        )}

        {details && (
          <View className="gap-3">
            <View
              className="rounded-2xl border p-4"
              style={{
                borderColor: theme.border,
                backgroundColor: theme.backgroundSecondary,
              }}
            >
              <Text
                className="text-[15px] font-semibold"
                style={{ color: theme.text }}
              >
                Assignment Info
              </Text>
              <View className="mt-2 gap-1.5">
                <Text
                  className="text-[13px]"
                  style={{ color: theme.textSecondary }}
                >
                  Opened: {formatDateTime(details.openedAt)}
                </Text>
                <Text
                  className="text-[13px] font-semibold"
                  style={{
                    color: dueIsOverdue
                      ? Colors.status.danger
                      : theme.textSecondary,
                  }}
                >
                  Due: {formatDateTime(dueAtForDisplay)}
                </Text>
                {details.cutoffAt && (
                  <Text
                    className="text-[13px]"
                    style={{ color: theme.textSecondary }}
                  >
                    Cutoff: {formatDateTime(details.cutoffAt)}
                  </Text>
                )}
                {details.allowSubmissionsFrom && (
                  <Text
                    className="text-[13px]"
                    style={{ color: theme.textSecondary }}
                  >
                    Allow submissions from:{" "}
                    {formatDateTime(details.allowSubmissionsFrom)}
                  </Text>
                )}
              </View>
            </View>

            <View
              className="rounded-2xl border p-4"
              style={{
                borderColor: theme.border,
                backgroundColor: theme.backgroundSecondary,
              }}
            >
              <Text
                className="text-[15px] font-semibold"
                style={{ color: theme.text }}
              >
                Description
              </Text>
              <Text
                className="mt-2 text-[13px] leading-5"
                style={{ color: theme.textSecondary }}
              >
                {details.descriptionText ||
                  "No assignment description provided."}
              </Text>
              {details.resources && details.resources.length > 0 && (
                <View className="mt-3 gap-2">
                  <Text
                    className="text-[15px] font-semibold"
                    style={{ color: theme.text }}
                  >
                    Resources
                  </Text>

                  {details.resources.map((resource) => {
                    const preferredName =
                      resource.name?.trim() ||
                      (() => {
                        const raw =
                          resource.url
                            .split("/")
                            .pop()
                            ?.split("?")[0]
                            .split("#")[0] || "";
                        try {
                          return decodeURIComponent(raw);
                        } catch {
                          return raw;
                        }
                      })() ||
                      "assignment-resource";

                    const iconName = getFileIconName(preferredName);
                    const isDownloading = Boolean(
                      downloadingUrlSet[resource.url],
                    );

                    return (
                      <Pressable
                        key={resource.id}
                        disabled={isDownloading}
                        className="flex-row items-center gap-3 rounded-xl border px-3 py-3"
                        style={{
                          borderColor: theme.border,
                          backgroundColor: theme.background,
                          opacity: isDownloading ? 0.6 : 1,
                        }}
                        onPress={() => {
                          if (isDownloading) return;
                          void openExternal(resource.url, preferredName);
                        }}
                      >
                        <Ionicons
                          name={iconName}
                          size={20}
                          color={Colors.accent}
                        />

                        <View className="flex-1">
                          <Text
                            className="text-[13px] font-medium"
                            style={{ color: theme.text }}
                            numberOfLines={2}
                          >
                            {preferredName}
                          </Text>
                        </View>

                        {isDownloading ? (
                          <ActivityIndicator
                            size="small"
                            color={theme.textSecondary}
                          />
                        ) : (
                          <Ionicons
                            name="download-outline"
                            size={18}
                            color={theme.textSecondary}
                          />
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </View>

            <View
              className="rounded-2xl border p-4"
              style={{
                borderColor: theme.border,
                backgroundColor: theme.backgroundSecondary,
              }}
            >
              <Text
                className="text-[15px] font-semibold"
                style={{ color: theme.text }}
              >
                Submission
              </Text>

              <View className="mt-2 gap-1.5">
                <Text
                  className="text-[13px]"
                  style={{ color: theme.textSecondary }}
                >
                  Status: {details.submissionStatusText || "Not available"}
                </Text>
                <Text
                  className="text-[13px]"
                  style={{ color: theme.textSecondary }}
                >
                  Grading: {details.gradingStatusText || "Not available"}
                </Text>
                <Text
                  className="text-[13px]"
                  style={{ color: theme.textSecondary }}
                >
                  Time remaining: {details.timeRemainingText || "Not available"}
                </Text>
                <Text
                  className="text-[12px]"
                  style={{ color: theme.textSecondary }}
                >
                  Methods: {supportsFileSubmission ? "File" : ""}
                  {supportsFileSubmission && supportsOnlineTextSubmission
                    ? " + "
                    : ""}
                  {supportsOnlineTextSubmission ? "Online text" : ""}
                  {!supportsFileSubmission && !supportsOnlineTextSubmission
                    ? isLoadingEdit
                      ? "Loading..."
                      : "Not editable"
                    : ""}
                </Text>
                {supportsFileSubmission && (
                  <Text
                    className="text-[12px]"
                    style={{ color: theme.textSecondary }}
                  >
                    Limits: {effectiveMaxFiles ?? "?"} file(s)
                    {maxFileSizeLabel ? `, ${maxFileSizeLabel}` : ""}
                  </Text>
                )}
              </View>

              {isLoadingEdit && (
                <Text
                  className="mt-3 text-[12px]"
                  style={{ color: theme.textSecondary }}
                >
                  Loading submission options...
                </Text>
              )}
              {supportsFileSubmission && (
                <View className="mt-3 gap-2">
                  <Pressable
                    className="rounded-xl border px-3 py-2.5"
                    style={{
                      borderColor: theme.border,
                      backgroundColor: theme.background,
                    }}
                    onPress={() => void addFiles()}
                  >
                    <Text
                      className="text-[13px] font-semibold"
                      style={{ color: theme.text }}
                    >
                      Add File
                    </Text>
                  </Pressable>

                  {files.length > 0 && (
                    <View className="gap-2">
                      {files.map((file) => (
                        <View
                          key={`${file.uri}-${file.name}`}
                          className="flex-row items-center justify-between rounded-xl border px-3 py-2"
                          style={{
                            borderColor: theme.border,
                            backgroundColor: theme.background,
                          }}
                        >
                          <Text
                            className="flex-1 pr-2 text-[12px]"
                            numberOfLines={1}
                            style={{ color: theme.text }}
                          >
                            {file.name}
                          </Text>
                          <Pressable onPress={() => removeFile(file.uri)}>
                            <Ionicons
                              name="close-circle-outline"
                              size={18}
                              color={theme.textSecondary}
                            />
                          </Pressable>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              )}

              {supportsOnlineTextSubmission && (
                <View className="mt-3">
                  <TextInput
                    multiline
                    value={onlineText}
                    onChangeText={setOnlineText}
                    placeholder="Write submission text..."
                    placeholderTextColor={theme.textSecondary}
                    className="min-h-[120px] rounded-xl border px-3 py-2 text-[13px]"
                    style={{
                      color: theme.text,
                      borderColor: theme.border,
                      backgroundColor: theme.background,
                      textAlignVertical: "top",
                    }}
                  />
                </View>
              )}

              {(isSubmitting || uploadProgress !== null) && (
                <Text
                  className="mt-3 text-[12px]"
                  style={{ color: theme.textSecondary }}
                >
                  {uploadProgress !== null
                    ? `Uploading ${Math.round((clampUploadProgress(uploadProgress) ?? 0) * 100)}%`
                    : "Submitting..."}
                </Text>
              )}

              <View className="mt-3 flex-row items-center gap-2">
                <Pressable
                  className="flex-1 items-center rounded-xl px-3 py-2.5"
                  style={{
                    backgroundColor: canEditSubmission
                      ? Colors.accent
                      : theme.background,
                    borderColor: theme.border,
                    borderWidth: canEditSubmission ? 0 : 1,
                    opacity: isSubmitting ? 0.7 : 1,
                  }}
                  disabled={
                    isSubmitting ||
                    isLoadingEdit ||
                    !editSession ||
                    !canEditSubmission
                  }
                  onPress={() => void handleSubmit()}
                >
                  {isSubmitting ? (
                    <ActivityIndicator
                      size="small"
                      color={canEditSubmission ? Colors.white : theme.text}
                    />
                  ) : (
                    <Text
                      className="text-[13px] font-semibold"
                      style={{
                        color: canEditSubmission ? Colors.white : theme.text,
                      }}
                    >
                      Submit
                    </Text>
                  )}
                </Pressable>

                <Pressable
                  className="items-center rounded-xl border px-3 py-2.5"
                  style={{
                    borderColor: theme.border,
                    backgroundColor: theme.background,
                  }}
                  onPress={() => void openOnLms()}
                >
                  <Text
                    className="text-[13px] font-semibold"
                    style={{ color: theme.text }}
                  >
                    Open LMS
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}
      </KeyboardAwareScrollView>
    </Container>
  );
}
