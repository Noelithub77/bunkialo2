/**
 * LMS resource tree types (normalized response schema for in-app resources explorer)
 */

export type LmsResourceModuleType =
  | "forum"
  | "attendance"
  | "resource"
  | "folder"
  | "assign"
  | "quiz"
  | "vpl"
  | "unknown";

export interface LmsResourceFileNode {
  id: string;
  name: string;
  url: string;
  fileType: "file";
}

export interface LmsResourceItemNode {
  id: string;
  cmid: string | null;
  title: string;
  moduleType: LmsResourceModuleType;
  typeLabel: string | null;
  fileTypeHint?: "pdf" | "image" | null;
  url: string;
  description: string | null;
  availabilityText: string | null;
  initiallyCollapsed: boolean | null;
  children: LmsResourceFileNode[];
}

export interface LmsResourceSectionNode {
  id: string;
  sectionNumber: number | null;
  title: string;
  initiallyCollapsed: boolean;
  items: LmsResourceItemNode[];
}

export interface LmsCourseResourcesTree {
  courseId: string;
  courseTitle: string;
  sections: LmsResourceSectionNode[];
  fetchedAt: number;
}

export interface LmsResourcesCacheEntry {
  tree: LmsCourseResourcesTree;
  lastSyncTime: number;
}

export interface LmsResourcesState {
  cacheByCourseId: Record<string, LmsResourcesCacheEntry>;
  expandedByCourseId: Record<string, Record<string, boolean>>;
  isLoadingByCourseId: Record<string, boolean>;
  errorByCourseId: Record<string, string | null>;
  lastPrefetchTime: number | null;
  hasHydrated: boolean;
}
