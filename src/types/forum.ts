/**
 * Moodle forum / discussion types
 */

export interface ForumInfo {
  /** Moodle forum cmid */
  id: number;
  /** Parent course id */
  course: number;
  name: string;
  type: string;
}

export interface ForumDiscussion {
  id: number;
  name: string;
  /** Unix seconds */
  timemodified: number;
  /** Unix seconds */
  created: number;
  usermodified: number;
  userfullname: string;
  subject: string;
  message: string;
  numreplies: number;
  pinned: boolean;
}

export interface ForumPost {
  id: number;
  discussionid: number;
  subject: string;
  message: string;
  /** Unix seconds */
  timecreated: number;
  /** Unix seconds */
  timemodified: number;
  userfullname: string;
}

export interface ForumDiscussionWithCourse extends ForumDiscussion {
  courseId: number;
  courseName: string;
  forumName: string;
}

export interface ForumState {
  discussions: ForumDiscussionWithCourse[];
  isLoading: boolean;
  lastSyncTime: number | null;
  error: string | null;
}
