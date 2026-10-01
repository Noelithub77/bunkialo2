import type { AssignmentUploadLocalFile, TimelineEvent } from "@/types";
import { parseAssignmentIdFromMoodleUrl } from "@/utils/moodle-url";
import { resolveEventCourseId } from "@/course/utils/event-route";

export const SHARED_ASSIGNMENT_ROUTE = "/share-assignment";

export const normalizeSharedFileUri = (path: string): string =>
  path.startsWith("/") ? `file://${path}` : path;

export const getAssignmentViewUrl = (
  baseUrl: string,
  assignmentId: string,
): string =>
  `${baseUrl.replace(/\/$/, "")}/mod/assign/view.php?id=${encodeURIComponent(assignmentId)}`;

export const isSupportedAssignmentShare = (
  file: AssignmentUploadLocalFile,
): boolean => {
  const mimeType = file.mimeType?.toLowerCase().split(";")[0];
  return Boolean(
    file.uri &&
    file.name &&
    (mimeType?.startsWith("image/") ||
      mimeType === "application/pdf" ||
      ((!mimeType || mimeType === "application/octet-stream") &&
        /\.(pdf|jpe?g|png|gif|webp|heic|heif|bmp|tiff?|svg|avif)$/i.test(
          file.name,
        ))),
  );
};

export interface SharedAssignmentTarget {
  assignmentId: string;
  courseId: string;
  name: string;
  courseName: string;
  dueAt: number | null;
}

/** Upcoming deadlines first, then most recently overdue, then undated tasks. */
export const getSharedAssignmentTargets = (
  events: TimelineEvent[],
  now = Date.now(),
): SharedAssignmentTarget[] => {
  const targets = new Map<string, SharedAssignmentTarget>();
  for (const event of events) {
    if (event.modulename !== "assign") continue;
    const assignmentId =
      parseAssignmentIdFromMoodleUrl(event.url) ??
      parseAssignmentIdFromMoodleUrl(event.action?.url ?? "");
    const courseId = resolveEventCourseId(event);
    if (!assignmentId || !courseId || targets.has(assignmentId)) continue;
    const deadline = (event.timestart || event.timesort) * 1000;
    targets.set(assignmentId, {
      assignmentId,
      courseId,
      name: event.activityname || event.name,
      courseName: event.course.fullname || event.course.shortname,
      dueAt: Number.isFinite(deadline) && deadline > 0 ? deadline : null,
    });
  }
  const group = (dueAt: number | null) =>
    dueAt === null ? 2 : dueAt >= now ? 0 : 1;
  return [...targets.values()].sort((a, b) => {
    const groupDiff = group(a.dueAt) - group(b.dueAt);
    if (groupDiff) return groupDiff;
    if (a.dueAt === null || b.dueAt === null)
      return a.name.localeCompare(b.name);
    return group(a.dueAt) === 1 ? b.dueAt - a.dueAt : a.dueAt - b.dueAt;
  });
};
