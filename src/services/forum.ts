import type {
  ForumDiscussion,
  ForumDiscussionWithCourse,
  ForumInfo,
  MoodleAjaxRequest,
  MoodleAjaxResponse,
} from "@/types";
import { debug } from "@/utils/debug";
import { api } from "./api";
import { fetchCourses } from "./scraper";

/** Extract sesskey from the Moodle dashboard page. */
const getSesskey = async (): Promise<string | null> => {
  const response = await api.get<string>("/my/");
  const match = response.data.match(/"sesskey":"([^"]+)"/);
  return match?.[1] ?? null;
};

interface MoodleForumsResponse {
  error: boolean;
  exception?: { message: string };
  data: ForumInfo[];
}

interface MoodleDiscussionsResponse {
  error: boolean;
  exception?: { message: string };
  data: {
    discussions: ForumDiscussion[];
  };
}

/** Fetch all forums for a set of course ids. */
const fetchForumsByCourses = async (
  sesskey: string,
  courseIds: number[],
): Promise<ForumInfo[]> => {
  const payload: MoodleAjaxRequest[] = [
    {
      index: 0,
      methodname: "mod_forum_get_forums_by_courses",
      args: { courseids: courseIds },
    },
  ];

  const response = await api.post<MoodleForumsResponse[]>(
    `/lib/ajax/service.php?sesskey=${sesskey}&info=mod_forum_get_forums_by_courses`,
    JSON.stringify(payload),
    { headers: { "Content-Type": "application/json" } },
  );

  const data = response.data;
  if (!Array.isArray(data) || data[0]?.error) {
    throw new Error(
      data[0]?.exception?.message ?? "Failed to fetch forums",
    );
  }

  return data[0]?.data ?? [];
};

/** Fetch recent discussions for a single forum. */
const fetchForumDiscussions = async (
  sesskey: string,
  forumId: number,
  limit = 5,
): Promise<ForumDiscussion[]> => {
  const payload: MoodleAjaxRequest[] = [
    {
      index: 0,
      methodname: "mod_forum_get_forum_discussions",
      args: {
        forumid: forumId,
        sortby: "timemodified",
        sortdirection: "DESC",
        page: 0,
        perpage: limit,
      },
    },
  ];

  const response = await api.post<MoodleDiscussionsResponse[]>(
    `/lib/ajax/service.php?sesskey=${sesskey}&info=mod_forum_get_forum_discussions`,
    JSON.stringify(payload),
    { headers: { "Content-Type": "application/json" } },
  );

  const data = response.data;
  if (!Array.isArray(data) || data[0]?.error) {
    return [];
  }

  return data[0]?.data?.discussions ?? [];
};

/** Fetch recent forum discussions across all enrolled courses. */
export const fetchAllForumDiscussions = async (
  maxPerForum = 5,
): Promise<ForumDiscussionWithCourse[]> => {
  debug.scraper("=== FETCHING FORUM DISCUSSIONS ===");

  const sesskey = await getSesskey();
  if (!sesskey) {
    throw new Error("Session key not found");
  }

  const courses = await fetchCourses();
  if (courses.length === 0) {
    return [];
  }

  const courseIds = courses.map((c) => Number(c.id));
  const courseNameById = new Map(
    courses.map((c) => [Number(c.id), c.name]),
  );

  let forums: ForumInfo[];
  try {
    forums = await fetchForumsByCourses(sesskey, courseIds);
  } catch {
    debug.scraper("Forum API not available, returning empty");
    return [];
  }

  if (forums.length === 0) {
    return [];
  }

  debug.scraper(`Found ${forums.length} forums across ${courses.length} courses`);

  const allDiscussions: ForumDiscussionWithCourse[] = [];

  // Fetch discussions in batches of 3 to avoid overloading
  const batchSize = 3;
  for (let i = 0; i < forums.length; i += batchSize) {
    const batch = forums.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      batch.map((forum) => fetchForumDiscussions(sesskey, forum.id, maxPerForum)),
    );

    for (let j = 0; j < results.length; j++) {
      const result = results[j];
      const forum = batch[j];
      if (result.status !== "fulfilled" || !forum) continue;

      for (const discussion of result.value) {
        allDiscussions.push({
          ...discussion,
          courseId: forum.course,
          courseName: courseNameById.get(forum.course) ?? `Course ${forum.course}`,
          forumName: forum.name,
        });
      }
    }
  }

  // Sort by most recent first
  allDiscussions.sort((a, b) => b.timemodified - a.timemodified);

  debug.scraper(`Found ${allDiscussions.length} total forum discussions`);
  return allDiscussions;
};
