import type {
  Course,
  MoodleAjaxRequest,
  MoodleAjaxResponse,
  MoodleCourseTimelineData,
} from "@/types";
import { debug } from "@/utils/debug";
import {
  getAttr,
  getText,
  parseHtml,
  querySelectorAll,
} from "@/utils/html-parser";
import { api, BASE_URL } from "./api";
import { getSesskey } from "./sesskey";

const fetchCoursesFromHtml = async (): Promise<Course[]> => {
  const response = await api.get<string>("/my/");
  const doc = parseHtml(response.data);
  const courses: Course[] = [];

  for (const link of querySelectorAll(doc, "a")) {
    const href = getAttr(link, "href") || "";
    if (!href.includes("/course/view.php?id=")) continue;

    const name = getText(link);
    const idMatch = href.match(/id=(\d+)/);
    if (!idMatch || !name || name.length <= 3) continue;

    const courseId = idMatch[1];
    if (courses.some((course) => course.id === courseId)) continue;

    courses.push({
      id: courseId,
      name,
      url: href.startsWith("http") ? href : `${BASE_URL}${href}`,
    });
  }

  return courses;
};

export const parseCoursesPayload = (value: unknown): Course[] => {
  if (typeof value !== "object" || value === null) return [];
  const record = value as Record<string, unknown>;
  const data = record.data;
  if (typeof data !== "object" || data === null) return [];
  const courses = (data as Record<string, unknown>).courses;
  if (!Array.isArray(courses)) return [];
  return courses.flatMap((course): Course[] => {
    if (typeof course !== "object" || course === null) return [];
    const item = course as Record<string, unknown>;
    if (typeof item.id !== "number") return [];
    const name = typeof item.fullname === "string"
      ? item.fullname
      : typeof item.shortname === "string"
        ? item.shortname
        : null;
    if (!name) return [];
    return [{
      id: String(item.id),
      name,
      shortName: typeof item.shortname === "string" ? item.shortname : undefined,
      url: typeof item.viewurl === "string"
        ? item.viewurl
        : `${BASE_URL}/course/view.php?id=${item.id}`,
    }];
  });
};

export const fetchCourses = async (): Promise<Course[]> => {
  const sesskey = await getSesskey();
  if (!sesskey) return fetchCoursesFromHtml();

  const payload: MoodleAjaxRequest[] = [
    {
      index: 0,
      methodname: "core_course_get_enrolled_courses_by_timeline_classification",
      args: {
        offset: 0,
        limit: 0,
        classification: "inprogress",
        sort: "fullname",
      },
    },
  ];

  try {
    const response = await api.post<
      MoodleAjaxResponse<MoodleCourseTimelineData>[]
    >(
      `/lib/ajax/service.php?sesskey=${sesskey}&info=core_course_get_enrolled_courses_by_timeline_classification`,
      JSON.stringify(payload),
      { headers: { "Content-Type": "application/json" } },
    );
    const result = response.data[0];

    if (!result || result.error) {
      throw new Error(result?.exception?.message || "Could not fetch courses");
    }

    return parseCoursesPayload(result);
  } catch (error) {
    debug.scraper(`Course API failed, using HTML fallback: ${String(error)}`);
    return fetchCoursesFromHtml();
  }
};
