import type {
  Course,
  MoodleAjaxRequest,
  MoodleAjaxResponse,
  MoodleCourseApiResponse,
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

    return result.data.courses.map((course: MoodleCourseApiResponse) => ({
      id: String(course.id),
      name: course.fullname || course.shortname,
      shortName: course.shortname,
      url: `${BASE_URL}/course/view.php?id=${course.id}`,
    }));
  } catch (error) {
    debug.scraper(`Course API failed, using HTML fallback: ${String(error)}`);
    return fetchCoursesFromHtml();
  }
};
