/**
 * Moodle LMS API response schemas
 */

/**
 * Moodle Course API Response (from core_course_get_enrolled_courses_by_timeline_classification)
 * @example
 * {
 *   id: 97,
 *   fullname: "Club Election 2025",
 *   shortname: "CLUB2025",
 *   idnumber: "",
 *   summary: "Course summary",
 *   summaryformat: 1,
 *   startdate: 1735689600000,
 *   enddate: 1738368000000,
 *   visible: true,
 *   fullnamedisplay: "Club Election 2025",
 *   viewurl: "https://lmsug24.iiitkottayam.ac.in/course/view.php?id=97",
 *   courseimage: "",
 *   progress: null,
 *   hasprogress: false,
 *   isfavourite: false,
 *   hidden: false,
 *   timeaccess: 1737494400000,
 *   showshortname: false,
 *   coursecategory: "1"
 * }
 */
export interface MoodleCourseApiResponse {
  id: number;
  fullname: string;
  shortname: string;
  idnumber: string;
  summary: string;
  summaryformat: number;
  startdate: number;
  enddate: number;
  visible: boolean;
  fullnamedisplay: string;
  viewurl: string;
  courseimage: string;
  progress: number | null;
  hasprogress: boolean;
  isfavourite: boolean;
  hidden: boolean;
  timeaccess: number | null;
  showshortname: boolean;
  coursecategory: string;
}

/**
 * Timeline data response from Moodle API
 * @example
 * {
 *   courses: [{ id: 97, fullname: "Club Election 2025", ... }],
 *   nextoffset: 0
 * }
 */
export interface MoodleCourseTimelineData {
  courses: MoodleCourseApiResponse[];
  nextoffset: number;
}

/**
 * Moodle AJAX API response wrapper
 * @example
 * {
 *   error: false,
 *   data: { courses: [...], nextoffset: 0 }
 * }
 */
export interface MoodleAjaxResponse<T = unknown> {
  error: boolean;
  exception?: {
    errorcode: string;
    message: string;
    type: string;
  };
  data: T;
}

export interface MoodleAjaxRequest {
  index: number;
  methodname: string;
  args: Record<string, unknown>;
}

export type MoodleTimelineClassification =
  | "inprogress"
  | "past"
  | "future"
  | "all";

export interface MoodleCourseTimelineArgs {
  offset: number;
  limit: number;
  classification: MoodleTimelineClassification;
  sort: "fullname" | "lastaccess" | "shortname";
}
