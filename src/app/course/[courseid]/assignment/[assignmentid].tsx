import { LmsAttachmentCard } from "@/components/lms/attachment-card";
import { scheduleDeferredTask } from "@/utils/scheduling";
import { Toast } from "@/components/shared/ui/molecules/toast";
import { Container } from "@/components/ui/container";
import { ASSIGNMENT_STALE_MS } from "@/constants/assignment";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { getCurrentBaseUrl } from "@/services/api";
import { useAssignmentStore } from "@/stores/assignment-store";
import { useAuthStore } from "@/stores/auth-store";
import type { AssignmentUploadLocalFile } from "@/types";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState, type ComponentRef } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  RefreshControl,
  Text,
  TextInput,
  View,
} from "react-native";
import { useDashboardStore } from "@/stores/dashboard-store";
import { useLmsResourcesStore } from "@/stores/lms-resources-store";
import { fetchAssignmentCourseName } from "@/services/assignment";
import {
  assignmentCourseName,
  assignmentDescription,
  assignmentRelativeDate,
  assignmentSubmissionLabel,
} from "@/utils/assignment-presentation";
import {
  KeyboardAwareScrollView,
  KeyboardStickyView,
} from "react-native-keyboard-controller";
import { useBunkStore } from "@/stores/bunk-store";
import { useCourseLinkStore } from "@/stores/course-link-store";
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
  return `${Number(size.toFixed(size >= 10 ? 0 : 1))} ${units[unitIndex]}`;
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
  const [showUpload, setShowUpload] = useState(false);
  const [exactDates, setExactDates] = useState<Record<string, boolean>>({});
  const [descriptionExpanded, setDescriptionExpanded] = useState(true);
  const [showDetails, setShowDetails] = useState(false);
  const scrollRef = useRef<ComponentRef<typeof KeyboardAwareScrollView>>(null);
  const [resolvedCourseName, setResolvedCourseName] = useState<{
    courseId: string;
    name: string;
  } | null>(null);
  const [now, setNow] = useState(Date.now());
  const [onlineText, setOnlineText] = useState("");
  const [files, setFiles] = useState<AssignmentUploadLocalFile[]>([]);
  const [hasSeededOnlineText, setHasSeededOnlineText] = useState(false);

  useEffect(() => {
    setOnlineText("");
    setFiles([]);
    setShowUpload(false);
    setExactDates({});
    setDescriptionExpanded(true);
    setShowDetails(false);
    setHasSeededOnlineText(false);
  }, [assignmentId]);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!assignmentId || !hasHydrated) return;
    const stale =
      !entry || Date.now() - entry.lastSyncTime > ASSIGNMENT_STALE_MS;
    if (!stale) return;
    void fetchAssignmentDetails(assignmentId, { silent: Boolean(entry) });
  }, [assignmentId, entry, fetchAssignmentDetails, hasHydrated]);

  useEffect(() => {
    if (!assignmentId || !details?.canEditSubmission) return;
    const task = scheduleDeferredTask(() => {
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
  const dueIsOverdue = Boolean(dueAtForDisplay && dueAtForDisplay < now);
  const resolvedCourseId = details?.courseId ?? courseId;
  const timelineCourseName = useDashboardStore(
    (state) =>
      state.events.find((event) => String(event.course.id) === resolvedCourseId)
        ?.course.fullname,
  );
  const resourceCourseName = useLmsResourcesStore(
    (state) => state.cacheByCourseId[resolvedCourseId]?.tree.courseTitle,
  );
  const knownCourseName =
    timelineCourseName || resourceCourseName || details?.courseName;
  const breadcrumbCourse = assignmentCourseName(
    resolvedCourseName?.courseId === resolvedCourseId
      ? resolvedCourseName.name
      : knownCourseName,
  );
  useEffect(() => {
    if (
      !resolvedCourseId ||
      assignmentCourseName(knownCourseName) !== "Course" ||
      isOffline
    )
      return;
    let active = true;
    void fetchAssignmentCourseName(resolvedCourseId)
      .then((name) => {
        if (active) setResolvedCourseName({ courseId: resolvedCourseId, name });
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [resolvedCourseId, knownCourseName, isOffline]);
  const description = assignmentDescription(
    details?.descriptionHtml ?? null,
    details?.descriptionText ?? null,
  );
  const submissionLabel = assignmentSubmissionLabel(
    details?.submissionStatusText ?? null,
  );
  const statusColor =
    submissionLabel === "Submitted"
      ? "#34D399"
      : submissionLabel === "Draft"
        ? "#A78BFA"
        : "#FB923C";
  const hasPayload = files.length > 0 || onlineText.trim().length > 0;
  const dateLabel = (key: string, timestamp: number) =>
    exactDates[key]
      ? formatDateTime(timestamp)
      : assignmentRelativeDate(timestamp, now);
  const toggleDate = (key: string) =>
    setExactDates((current) => ({ ...current, [key]: !current[key] }));
  const linkedCourseKey = useCourseLinkStore(
    (state) =>
      state.identities.find(
        (identity) => identity.lmsCourseId === resolvedCourseId,
      )?.key,
  );
  const courseColor =
    useBunkStore(
      (state) =>
        state.courses.find(
          (course) =>
            course.courseId === linkedCourseKey ||
            course.courseId === resolvedCourseId,
        )?.config?.color,
    ) ||
    Colors.courseColors[
      (Number(resolvedCourseId) || 0) % Colors.courseColors.length
    ];
  useEffect(() => {
    if (!showUpload) return;
    const frame = requestAnimationFrame(() =>
      scrollRef.current?.scrollToEnd({ animated: true }),
    );
    return () => cancelAnimationFrame(frame);
  }, [showUpload]);
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
    setShowUpload(true);
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
      setShowUpload(false);
      return;
    }

    Toast.show(result.message, { type: "error" });
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

  const [attachmentScrollOffset, setAttachmentScrollOffset] = useState(0);

  return (
    <Container className="relative">
      <KeyboardAwareScrollView
        ref={scrollRef}
        onScroll={(event) =>
          setAttachmentScrollOffset(event.nativeEvent.contentOffset.y)
        }
        scrollEventThrottle={100}
        className="flex-1"
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        bottomOffset={24}
        contentContainerClassName="px-5 pb-6"
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={() => {
              if (assignmentId) void refreshAssignmentDetails(assignmentId);
            }}
            tintColor={theme.text}
          />
        }
      >
        <View className="mb-7 mt-3 gap-5">
          <View className="flex-row items-center justify-between gap-4">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back"
              onPress={() => router.back()}
              className="h-11 w-11 items-center justify-center rounded-full"
              style={{ backgroundColor: theme.backgroundSecondary }}
            >
              <Ionicons name="arrow-back" size={21} color={theme.text} />
            </Pressable>
            {dueAtForDisplay && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Toggle due date"
                onPress={() => toggleDate("due")}
                className="max-w-[80%] flex-row items-center gap-2 rounded-full px-3.5 py-2.5"
                style={{
                  backgroundColor: `${dueIsOverdue ? Colors.status.danger : courseColor}18`,
                }}
              >
                <Ionicons
                  name="time-outline"
                  size={16}
                  color={dueIsOverdue ? Colors.status.danger : courseColor}
                />
                <Text
                  className="text-[12px] font-semibold"
                  style={{
                    color: dueIsOverdue ? Colors.status.danger : courseColor,
                  }}
                >
                  Due {dateLabel("due", dueAtForDisplay)}
                </Text>
              </Pressable>
            )}
          </View>
          <View
            className="gap-3 rounded-[24px] p-4"
            style={{
              backgroundColor: `${courseColor}0A`,
              borderWidth: 1,
              borderColor: `${courseColor}18`,
            }}
          >
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={`Course: ${breadcrumbCourse}`}
              disabled={!resolvedCourseId}
              onPress={openCourseResources}
              className="flex-row items-center gap-2 self-start"
            >
              <Ionicons name="school-outline" size={15} color={courseColor} />
              <Text
                className="shrink text-[12px] font-medium leading-[18px]"
                style={{ color: theme.textSecondary }}
                numberOfLines={2}
              >
                {breadcrumbCourse}
              </Text>
              <Ionicons
                name="chevron-forward"
                size={12}
                color={theme.textSecondary}
              />
            </Pressable>
            <Text
              className="text-[26px] font-bold leading-[33px] tracking-tight"
              style={{ color: theme.text }}
            >
              {breadcrumbAssignment.replace(/_/g, " ")}
            </Text>
            {details?.openedAt && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Toggle opened date"
                onPress={() => toggleDate("opened")}
                className="flex-row items-center gap-1.5 self-start py-1"
              >
                <Ionicons
                  name="calendar-outline"
                  size={13}
                  color={theme.textSecondary}
                />
                <Text
                  className="text-[11px]"
                  style={{ color: theme.textSecondary }}
                >
                  Opened {dateLabel("opened", details.openedAt)}
                </Text>
              </Pressable>
            )}
          </View>
        </View>
        {!entry && isLoading && (
          <View className="items-center py-12">
            <ActivityIndicator color={theme.textSecondary} />
          </View>
        )}
        {!entry && error && !isLoading && (
          <View
            className="items-center gap-3 rounded-2xl p-4"
            style={{ backgroundColor: `${Colors.status.danger}12` }}
          >
            <Text
              className="text-center text-[13px]"
              style={{ color: Colors.status.danger }}
            >
              {error}
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                if (assignmentId) void refreshAssignmentDetails(assignmentId);
              }}
            >
              <Text style={{ color: theme.text }}>Retry</Text>
            </Pressable>
          </View>
        )}
        {details && (
          <View className="gap-5">
            {description !== "" && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Toggle assignment instructions"
                accessibilityState={{ expanded: descriptionExpanded }}
                onPress={() => setDescriptionExpanded((value) => !value)}
                className="gap-3 rounded-[22px] p-4"
                style={{
                  backgroundColor: `${courseColor}0C`,
                  borderLeftWidth: 3,
                  borderLeftColor: courseColor,
                }}
              >
                <View className="flex-row items-center justify-between">
                  <Text
                    className="text-[11px] font-semibold uppercase tracking-wider"
                    style={{ color: courseColor }}
                  >
                    Instructions
                  </Text>
                  <Ionicons
                    name={descriptionExpanded ? "chevron-up" : "chevron-down"}
                    size={14}
                    color={courseColor}
                  />
                </View>
                <Text
                  className="text-[14px] leading-[23px]"
                  numberOfLines={descriptionExpanded ? undefined : 5}
                  style={{ color: theme.text }}
                >
                  {description}
                </Text>
              </Pressable>
            )}
            {details.resources.length > 0 && (
              <View className="gap-2.5">
                <Text
                  className="text-[11px] font-semibold uppercase tracking-wider"
                  style={{ color: theme.textSecondary }}
                >
                  Assignment files
                </Text>
                {details.resources.map((resource) => (
                  <LmsAttachmentCard
                    key={resource.id}
                    attachment={{ ...resource, name: resource.name || "File" }}
                    color={courseColor}
                    scrollOffset={attachmentScrollOffset}
                    previewHeight={240}
                  />
                ))}
              </View>
            )}
            <View
              className="gap-4 rounded-[22px] p-4"
              style={{ backgroundColor: theme.backgroundSecondary }}
            >
              <Text
                className="text-[12px] font-semibold"
                style={{ color: theme.textSecondary }}
              >
                Your submission
              </Text>
              <View className="flex-row items-center gap-2.5">
                <View
                  className="h-8 w-8 items-center justify-center rounded-full"
                  style={{ backgroundColor: `${statusColor}18` }}
                >
                  <Ionicons
                    name={
                      submissionLabel === "Submitted"
                        ? "checkmark-done-outline"
                        : submissionLabel === "Draft"
                          ? "document-outline"
                          : "cloud-upload-outline"
                    }
                    size={17}
                    color={statusColor}
                  />
                </View>
                <Text
                  className="flex-1 text-[13px] font-semibold"
                  style={{ color: theme.text }}
                >
                  {submissionLabel}
                </Text>
                {details.gradingStatusText &&
                  !/not graded/i.test(details.gradingStatusText) && (
                    <Text
                      className="shrink text-[11px]"
                      style={{ color: "#34D399" }}
                    >
                      {details.gradingStatusText}
                    </Text>
                  )}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Assignment details"
                  accessibilityState={{ expanded: showDetails }}
                  onPress={() => setShowDetails((value) => !value)}
                  className="min-h-11 flex-row items-center gap-1.5 pl-2"
                >
                  <Text
                    className="text-[12px]"
                    style={{ color: theme.textSecondary }}
                  >
                    Details
                  </Text>
                  <Ionicons
                    name={showDetails ? "chevron-up" : "chevron-down"}
                    size={14}
                    color={theme.textSecondary}
                  />
                </Pressable>
              </View>
              {(details.submittedFiles ?? []).map((file) => (
                <LmsAttachmentCard
                  key={file.id}
                  attachment={file}
                  color={courseColor}
                  scrollOffset={attachmentScrollOffset}
                  previewHeight={150}
                />
              ))}
              {showDetails && (
                <View
                  className="gap-3 border-t pt-3"
                  style={{ borderColor: theme.border }}
                >
                  {[
                    [
                      "Opened",
                      details.openedAt
                        ? formatDateTime(details.openedAt)
                        : null,
                    ],
                    [
                      "Due",
                      dueAtForDisplay ? formatDateTime(dueAtForDisplay) : null,
                    ],
                    [
                      "Closes",
                      details.cutoffAt
                        ? formatDateTime(details.cutoffAt)
                        : null,
                    ],
                    [
                      "Available from",
                      details.allowSubmissionsFrom
                        ? formatDateTime(details.allowSubmissionsFrom)
                        : null,
                    ],
                    ["Submission", details.submissionStatusText],
                    ["Grading", details.gradingStatusText],
                  ]
                    .filter(([, value]) => value)
                    .map(([label, value]) => (
                      <View key={label} className="gap-1">
                        <Text
                          className="text-[10px]"
                          style={{ color: theme.textSecondary }}
                        >
                          {label}
                        </Text>
                        <Text
                          className="text-[12px] leading-[18px]"
                          style={{ color: theme.text }}
                        >
                          {value}
                        </Text>
                      </View>
                    ))}
                </View>
              )}
              {showUpload && canEditSubmission && (
                <View className="gap-3">
                  {isLoadingEdit ? (
                    <ActivityIndicator
                      size="small"
                      color={theme.textSecondary}
                    />
                  ) : (
                    <>
                      {supportsFileSubmission && (
                        <View className="gap-2.5">
                          <View className="flex-row items-center justify-between gap-2">
                            <Text
                              className="flex-1 text-[11px]"
                              style={{ color: theme.textSecondary }}
                            >
                              {[
                                effectiveMaxFiles !== null
                                  ? `${effectiveMaxFiles} ${effectiveMaxFiles === 1 ? "file" : "files"}`
                                  : null,
                                maxFileSizeLabel,
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </Text>
                            <Pressable
                              accessibilityRole="button"
                              accessibilityLabel="Close upload"
                              disabled={isSubmitting}
                              onPress={() => setShowUpload(false)}
                              className="h-8 w-8 items-center justify-center"
                            >
                              <Ionicons
                                name="close"
                                size={17}
                                color={theme.textSecondary}
                              />
                            </Pressable>
                          </View>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel="Choose files"
                            disabled={
                              isSubmitting || !editSession || !canEditSubmission
                            }
                            onPress={() => void addFiles()}
                            className="flex-row items-center justify-center gap-2 rounded-xl border py-3"
                            style={{
                              borderColor: theme.border,
                              backgroundColor: theme.background,
                            }}
                          >
                            <Ionicons
                              name="attach"
                              size={18}
                              color={theme.text}
                            />
                            <Text
                              className="text-[13px] font-medium"
                              style={{ color: theme.text }}
                            >
                              Choose files
                            </Text>
                          </Pressable>
                          {files.map((file) => (
                            <View
                              key={`${file.uri}-${file.name}`}
                              className="flex-row items-center gap-2 rounded-xl px-3 py-2"
                              style={{ backgroundColor: theme.background }}
                            >
                              <Ionicons
                                name={getFileIconName(file.name)}
                                size={17}
                                color={courseColor}
                              />
                              <Text
                                className="flex-1 text-[12px]"
                                numberOfLines={1}
                                style={{ color: theme.text }}
                              >
                                {file.name}
                              </Text>
                              <Pressable
                                accessibilityRole="button"
                                accessibilityLabel={`Remove ${file.name}`}
                                disabled={isSubmitting}
                                onPress={() => removeFile(file.uri)}
                                className="h-8 w-8 items-center justify-center"
                              >
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
                      {supportsOnlineTextSubmission && (
                        <TextInput
                          accessibilityLabel="Submission text"
                          multiline
                          editable={!isSubmitting}
                          value={onlineText}
                          onChangeText={setOnlineText}
                          placeholder="Submission text"
                          placeholderTextColor={theme.textSecondary}
                          className="min-h-[120px] rounded-xl border px-3 py-2 text-[13px]"
                          style={{
                            color: theme.text,
                            borderColor: theme.border,
                            backgroundColor: theme.background,
                            textAlignVertical: "top",
                          }}
                        />
                      )}
                      {!supportsFileSubmission &&
                        !supportsOnlineTextSubmission && (
                          <Text
                            className="text-[12px]"
                            style={{ color: theme.textSecondary }}
                          >
                            Submission unavailable
                          </Text>
                        )}
                    </>
                  )}
                  {(isSubmitting || uploadProgress !== null) && (
                    <View className="gap-2">
                      <View
                        className="h-1 overflow-hidden rounded-full"
                        style={{ backgroundColor: theme.border }}
                      >
                        <View
                          className="h-1 rounded-full"
                          style={{
                            width: `${Math.round((clampUploadProgress(uploadProgress) ?? 0) * 100)}%`,
                            backgroundColor: courseColor,
                          }}
                        />
                      </View>
                      <Text
                        className="text-right text-[11px]"
                        style={{ color: theme.textSecondary }}
                      >
                        {uploadProgress !== null
                          ? `${Math.round((clampUploadProgress(uploadProgress) ?? 0) * 100)}%`
                          : "Submitting…"}
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          </View>
        )}
      </KeyboardAwareScrollView>
      {details && (
        <KeyboardStickyView>
          <View
            className="flex-row items-center gap-3 border-t px-5 py-4"
            style={{
              backgroundColor: theme.background,
              borderColor: `${courseColor}22`,
            }}
          >
            <View className="flex-1">
              {canEditSubmission && !showUpload && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    supportsFileSubmission && !supportsOnlineTextSubmission
                      ? "Add files"
                      : "Edit submission"
                  }
                  disabled={isSubmitting}
                  onPress={() => {
                    if (supportsFileSubmission && !supportsOnlineTextSubmission)
                      void addFiles();
                    else setShowUpload(true);
                  }}
                  className="min-h-[56px] flex-row items-center justify-center gap-2 rounded-xl py-3.5"
                  style={{ backgroundColor: courseColor }}
                >
                  <Ionicons name="add" size={18} color={Colors.black} />
                  <Text
                    className="text-[13px] font-semibold"
                    style={{ color: Colors.black }}
                  >
                    {supportsFileSubmission && !supportsOnlineTextSubmission
                      ? "Add files"
                      : supportsOnlineTextSubmission && !supportsFileSubmission
                        ? "Write submission"
                        : supportsFileSubmission && supportsOnlineTextSubmission
                          ? "Add files or text"
                          : "Add submission"}
                  </Text>
                </Pressable>
              )}
              {showUpload && canEditSubmission && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Submit assignment"
                  disabled={
                    isSubmitting ||
                    isLoadingEdit ||
                    !editSession ||
                    !hasPayload ||
                    !canEditSubmission ||
                    isOffline
                  }
                  onPress={() => void handleSubmit()}
                  className="min-h-[56px] items-center justify-center rounded-xl py-3.5"
                  style={{
                    backgroundColor: courseColor,
                    opacity:
                      !hasPayload ||
                      isSubmitting ||
                      isLoadingEdit ||
                      !editSession ||
                      isOffline
                        ? 0.4
                        : 1,
                  }}
                >
                  {isSubmitting ? (
                    <ActivityIndicator size="small" color={Colors.black} />
                  ) : (
                    <Text
                      className="text-[13px] font-semibold"
                      style={{ color: Colors.black }}
                    >
                      Submit
                    </Text>
                  )}
                </Pressable>
              )}
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open assignment in LMS"
              onPress={() => void openOnLms()}
              className="min-h-[56px] flex-row items-center justify-center gap-1.5 rounded-xl border px-3 py-2"
              style={{
                borderColor: `${courseColor}30`,
                backgroundColor: `${courseColor}0A`,
              }}
            >
              <Text
                className="text-[12px] font-medium"
                style={{ color: theme.textSecondary }}
              >
                LMS
              </Text>
              <MaterialCommunityIcons
                name="arrow-top-right"
                size={18}
                color={theme.textSecondary}
              />
            </Pressable>
          </View>
        </KeyboardStickyView>
      )}
    </Container>
  );
}
