/**
 * Download queue types for batch resource downloads
 */

export type DownloadQueueItemStatus =
  | "pending"
  | "downloading"
  | "completed"
  | "failed";

export interface DownloadQueueItem {
  id: string;
  url: string;
  fileName: string;
  courseId: string;
  courseName: string;
  status: DownloadQueueItemStatus;
  /** 0-1 fraction, null if unknown */
  progress: number | null;
  error: string | null;
  /** Local file URI after download */
  localUri: string | null;
  contentType: string | null;
  addedAt: number;
  completedAt: number | null;
}

export interface DownloadQueueState {
  items: DownloadQueueItem[];
  maxConcurrent: number;
}
