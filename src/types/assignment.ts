/**
 * Assignment detail/submission types
 */

export type AssignmentSubmissionPluginType = "file" | "onlinetext";

export interface AssignmentBreadcrumb {
  courseId: string | null;
  courseName: string;
  assignmentName: string;
}

export interface AssignmentDetails {
  assignmentId: string;
  courseId: string | null;
  courseName: string;
  assignmentName: string;
  openedAt: number | null;
  dueAt: number | null;
  cutoffAt: number | null;
  allowSubmissionsFrom: number | null;
  descriptionHtml: string | null;
  descriptionText: string | null;
  resources: { id: string; name: string; url: string }[];
  submissionStatusText: string | null;
  gradingStatusText: string | null;
  timeRemainingText: string | null;
  maxFiles: number | null;
  maxBytes: number | null;
  acceptedFileTypes: string[];
  supportsFileSubmission: boolean;
  supportsOnlineTextSubmission: boolean;
  canEditSubmission: boolean;
  editSubmissionUrl: string | null;
  fetchedAt: number;
}

export interface AssignmentFileDraft {
  itemId: string;
  fileName: string;
  author: string | null;
  license: string | null;
}

export interface AssignmentUploadLocalFile {
  uri: string;
  name: string;
  mimeType?: string | null;
  size?: number | null;
}

export interface AssignmentEditSession {
  assignmentId: string;
  courseId: string | null;
  editUrl: string;
  formActionUrl: string;
  sesskey: string;
  userId: string | null;
  draftItemId: string | null;
  hiddenFields: Record<string, string>;
  supportsFileSubmission: boolean;
  supportsOnlineTextSubmission: boolean;
  onlineTextDraftHtml: string | null;
  onlineTextFieldName: string | null;
  acceptedFileTypes: string[];
  maxFiles: number | null;
  maxBytes: number | null;
  uploadRepositoryId: string | null;
  fileManagerClientId: string | null;
  fileManagerContextId: string | null;
  fileManagerEnv: string;
  defaultAuthor: string | null;
  defaultLicense: string | null;
  fetchedAt: number;
}

export interface AssignmentSubmissionPayload {
  assignmentId: string;
  onlineTextHtml?: string | null;
  files?: AssignmentUploadLocalFile[];
}

export type AssignmentSubmitResult =
  | {
      success: true;
      message: string;
      submittedAt: number;
    }
  | {
      success: false;
      reason: "auth" | "validation" | "network" | "server";
      message: string;
    };
