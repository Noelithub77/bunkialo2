/**
 * LMS authenticated download types
 */

export type LmsDownloadFailureReason =
  | "reauth-failed"
  | "http-error"
  | "session-login-page"
  | "network-error";

export interface LmsDownloadSuccess {
  success: true;
  uri: string;
  fileName: string;
  status: number;
  contentType: string | null;
}

export interface LmsDownloadFailure {
  success: false;
  reason: LmsDownloadFailureReason;
  message: string;
  status?: number;
}

export type LmsDownloadResult = LmsDownloadSuccess | LmsDownloadFailure;

export interface LmsDownloadProgress {
  totalBytesWritten: number;
  totalBytesExpected: number | null;
  fraction: number | null;
}

export interface LmsDownloadOptions {
  destination?: "downloads" | "preview-cache";
  maxBytes?: number;
  cacheKey?: string;
  onProgress?: (progress: LmsDownloadProgress) => void;
}
