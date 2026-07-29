import type {
  Course,
  CourseIdentity,
  ManualCourseLink,
  PortalCourseSummary,
} from "@/types";
import Fuse from "fuse.js";

const normalizeCode = (value: string): string =>
  value.toUpperCase().replace(/[^A-Z0-9]/g, "");

const normalizeName = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export const makeCourseKey = (termId: string, code: string): string =>
  `${termId}:${normalizeCode(code)}`;

export const matchCourses = (
  portalCourses: PortalCourseSummary[],
  lmsCourses: Course[],
  manualLinks: ManualCourseLink[],
): CourseIdentity[] => {
  const manualByAttendanceId = new Map(
    manualLinks.map((link) => [link.attendanceCourseId, link]),
  );
  const fuzzy = new Fuse(lmsCourses, {
    keys: ["name"],
    includeScore: true,
    threshold: 0.24,
    ignoreLocation: true,
  });

  return portalCourses.map((portalCourse) => {
    const manual = manualByAttendanceId.get(portalCourse.courseId);
    if (manual) {
      return {
        key: makeCourseKey(portalCourse.termId, portalCourse.code),
        termId: portalCourse.termId,
        code: portalCourse.code,
        name: portalCourse.name,
        lmsCourseId: manual.lmsCourseId,
        attendanceCourseId: portalCourse.courseId,
        mappingSource: "manual",
      };
    }

    const codeMatch = lmsCourses.find((course) => {
      const shortName = course.shortName ?? "";
      return (
        normalizeCode(shortName) === normalizeCode(portalCourse.code) ||
        normalizeCode(course.name).includes(normalizeCode(portalCourse.code))
      );
    });
    if (codeMatch) {
      return {
        key: makeCourseKey(portalCourse.termId, portalCourse.code),
        termId: portalCourse.termId,
        code: portalCourse.code,
        name: portalCourse.name,
        lmsCourseId: codeMatch.id,
        attendanceCourseId: portalCourse.courseId,
        mappingSource: "code",
      };
    }

    const normalizedPortalName = normalizeName(portalCourse.name);
    const results = fuzzy.search(normalizedPortalName, {
      limit: 2,
    });
    const first = results[0];
    const second = results[1];
    const unique =
      first?.score !== undefined &&
      first.score <= 0.2 &&
      normalizedPortalName.split(" ").length >= 2 &&
      (second?.score === undefined || second.score - first.score >= 0.08);

    return {
      key: makeCourseKey(portalCourse.termId, portalCourse.code),
      termId: portalCourse.termId,
      code: portalCourse.code,
      name: portalCourse.name,
      lmsCourseId: unique && first ? first.item.id : null,
      attendanceCourseId: portalCourse.courseId,
      mappingSource: unique ? "name" : "unresolved",
    };
  });
};
