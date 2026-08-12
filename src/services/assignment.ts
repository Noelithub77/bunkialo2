import { checkSession, tryAutoLogin } from "@/services/auth/lms-auth";
import { getCurrentBaseUrl } from "@/services/api";
import { ASSIGNMENT_STALE_MS } from "@/constants/assignment";
import type {
  AssignmentDetails,
  AssignmentEditSession,
  AssignmentFileDraft,
  AssignmentSubmitResult,
  AssignmentSubmissionPayload,
  AssignmentUploadLocalFile,
} from "@/types";
import { debug } from "@/utils/debug";
import {
  getQueryParamValue,
  isLoginHtml,
  parseAssignmentIdFromMoodleUrl,
} from "@/utils/moodle-url";
import {
  getAttr,
  getText,
  parseHtml,
  querySelector,
  querySelectorAll,
} from "@/utils/html-parser";
import { getOuterHTML } from "domutils";
import type { Document, Element } from "domhandler";
import { isValid, parse } from "date-fns";
import { api } from "./api";

type FileManagerRepository = {
  id?: string | number;
  type?: string;
};

type FileManagerInitConfig = {
  itemid?: string | number;
  maxbytes?: string | number;
  maxfiles?: string | number;
  areamaxbytes?: string | number;
  client_id?: string;
  context?: { id?: string | number };
  author?: string;
  defaultlicense?: string;
  accepted_types?: string[];
  filepicker?: {
    repositories?: Record<string, FileManagerRepository>;
    accepted_types?: string[];
    defaultlicense?: string;
    author?: string;
  };
};

type AssignmentDateKey = "opened" | "due" | "cutoff" | "allow submissions from";
export const ASSIGNMENT_DETAILS_STALE_MS = ASSIGNMENT_STALE_MS;

const normalizeText = (value: string): string =>
  value.replace(/\s+/g, " ").trim();

const toAbsoluteLmsUrl = (url: string): string => {
  const baseUrl = getCurrentBaseUrl();
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (url.startsWith("//")) return `https:${url}`;
  if (url.startsWith("/")) return `${baseUrl}${url}`;
  return `${baseUrl}/${url.replace(/^\.?\//, "")}`;
};

const parseTimestamp = (value: string | null): number | null => {
  if (!value) return null;

  const parsed = Date.parse(value);
  if (!Number.isNaN(parsed)) return parsed;

  const normalized = normalizeText(value);
  const reference = new Date();
  const knownFormats = [
    "EEEE, d MMMM yyyy, h:mm a",
    "EEEE, dd MMMM yyyy, h:mm a",
    "d MMMM yyyy, h:mm a",
    "dd MMMM yyyy, h:mm a",
    "EEEE, d MMM yyyy, h:mm a",
    "EEEE, dd MMM yyyy, h:mm a",
    "d MMM yyyy, h:mm a",
    "dd MMM yyyy, h:mm a",
  ] as const;

  for (const format of knownFormats) {
    const candidate = parse(normalized, format, reference);
    if (isValid(candidate)) {
      return candidate.getTime();
    }
  }

  return null;
};

const parseTimestampFromDateText = (value: string | null): number | null => {
  if (!value) return null;

  const direct = parseTimestamp(value);
  if (direct) return direct;

  const separatorIndex = value.indexOf(":");
  if (separatorIndex <= 0) return null;

  const stripped = normalizeText(value.slice(separatorIndex + 1));
  const strippedDirect = parseTimestamp(stripped);
  if (strippedDirect) return strippedDirect;

  const withoutTrailingHint = stripped.replace(/\s*\([^)]*\)\s*$/u, "");
  return parseTimestamp(withoutTrailingHint);
};

const parseUnixTimestamp = (
  value: string | null,
  options?: { seconds?: boolean },
): number | null => {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return options?.seconds ? parsed * 1000 : parsed;
};

const resolveAssignmentDateKey = (rawKey: string): AssignmentDateKey | null => {
  const normalizedKey = normalizeText(rawKey)
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/-/g, " ");

  if (
    normalizedKey.startsWith("opened") ||
    normalizedKey.startsWith("opening time")
  ) {
    return "opened";
  }
  if (normalizedKey.startsWith("due") || normalizedKey.startsWith("due date")) {
    return "due";
  }
  if (
    normalizedKey.startsWith("cut off") ||
    normalizedKey.startsWith("cutoff")
  ) {
    return "cutoff";
  }
  if (normalizedKey.startsWith("allow submissions from")) {
    return "allow submissions from";
  }

  return null;
};

const parseNumberValue = (
  value: string | number | null | undefined,
): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

const ensureAuthenticatedSession = async (): Promise<boolean> => {
  const hasSession = await checkSession();
  if (hasSession) return true;

  const relogin = await tryAutoLogin();
  return relogin;
};

const extractJsonObjectAfterMarker = (
  input: string,
  marker: string,
): string | null => {
  const markerIndex = input.indexOf(marker);
  if (markerIndex === -1) return null;

  const start = input.indexOf("{", markerIndex + marker.length);
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < input.length; index += 1) {
    const char = input[index];

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        continue;
      }
      if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === "{") {
      depth += 1;
      continue;
    }

    if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return input.slice(start, index + 1);
      }
    }
  }

  return null;
};

const parseFileManagerConfig = (html: string): FileManagerInitConfig | null => {
  const marker = "M.form_filemanager.init(Y, ";
  const jsonText = extractJsonObjectAfterMarker(html, marker);
  if (!jsonText) return null;

  try {
    return JSON.parse(jsonText) as FileManagerInitConfig;
  } catch (error) {
    debug.scraper(`Could not parse filemanager config JSON: ${String(error)}`);
    return null;
  }
};

const getUploadRepositoryId = (
  config: FileManagerInitConfig | null,
): string | null => {
  if (!config?.filepicker?.repositories) return null;

  for (const [repoKey, repo] of Object.entries(
    config.filepicker.repositories,
  )) {
    if (repo.type !== "upload") continue;
    const rawId = repo.id ?? repoKey;
    return String(rawId);
  }

  return null;
};

const getAcceptedFileTypes = (
  config: FileManagerInitConfig | null,
): string[] => {
  const raw =
    config?.filepicker?.accepted_types ?? config?.accepted_types ?? [];

  const normalized = raw
    .map((type) => normalizeText(String(type).toLowerCase()))
    .filter((type) => type.length > 0);

  return Array.from(new Set(normalized));
};

const getTableRowLabelAndValue = (
  row: Element,
): { label: string; value: string; valueCell: Element | null } | null => {
  const headerCell = querySelector(row, "th");
  const valueCellFromHeader = querySelector(row, "td");

  if (headerCell && valueCellFromHeader) {
    const label = normalizeText(getText(headerCell));
    const value = normalizeText(getText(valueCellFromHeader));
    if (!label || !value) return null;
    return { label, value, valueCell: valueCellFromHeader };
  }

  const cells = querySelectorAll(row, "td");
  if (cells.length < 2) return null;

  const label = normalizeText(getText(cells[0] ?? null));
  const valueCell = cells[cells.length - 1] ?? null;
  const value = normalizeText(getText(valueCell));
  if (!label || !value) return null;

  return { label, value, valueCell };
};

const parseTimestampFromCell = (
  valueCell: Element | null,
  fallbackText: string,
): number | null => {
  const fromDataTimestampNode = valueCell
    ? querySelector(valueCell, "[data-timestamp]")
    : null;
  const fromDataTimestamp = parseUnixTimestamp(
    getAttr(fromDataTimestampNode, "data-timestamp"),
    { seconds: true },
  );
  if (fromDataTimestamp) return fromDataTimestamp;

  const fromDataTimeNode = valueCell
    ? querySelector(valueCell, "[data-time]")
    : null;
  const fromDataTime = parseUnixTimestamp(
    getAttr(fromDataTimeNode, "data-time"),
  );
  if (fromDataTime) return fromDataTime;

  const datetimeNode = valueCell
    ? querySelector(valueCell, "time[datetime]")
    : null;
  const datetimeAttr = getAttr(datetimeNode, "datetime");
  const fromDatetime = parseTimestamp(datetimeAttr);
  if (fromDatetime) return fromDatetime;

  return parseTimestampFromDateText(fallbackText);
};

const parseSubmissionStatusRows = (root: Element): Record<string, string> => {
  const rows = querySelectorAll(root, "tr");
  const map: Record<string, string> = {};

  for (const row of rows) {
    const pair = getTableRowLabelAndValue(row);
    if (!pair) continue;
    map[pair.label.toLowerCase()] = pair.value;
  }

  return map;
};

const parseActivityDates = (
  root: Document | Element,
): Partial<Record<AssignmentDateKey, number>> => {
  const values: Partial<Record<AssignmentDateKey, number>> = {};
  const rows = querySelectorAll(root, "[data-region='activity-dates'] div");

  for (const row of rows) {
    const text = normalizeText(getText(row));
    if (!text.includes(":")) continue;

    const separatorIndex = text.indexOf(":");
    const rawKey = normalizeText(text.slice(0, separatorIndex));
    const rawValue = normalizeText(text.slice(separatorIndex + 1));

    const key = resolveAssignmentDateKey(rawKey);
    if (!key) continue;

    const timestamp = parseTimestampFromDateText(rawValue);
    if (!timestamp) continue;

    values[key] = timestamp;
  }

  return values;
};

const parseActivityDatesFromStatusTables = (
  root: Document | Element,
): Partial<Record<AssignmentDateKey, number>> => {
  const values: Partial<Record<AssignmentDateKey, number>> = {};
  const rows = querySelectorAll(
    root,
    ".submissionstatustable tr, table.generaltable tr",
  );

  for (const row of rows) {
    const pair = getTableRowLabelAndValue(row);
    if (!pair) continue;

    const key = resolveAssignmentDateKey(pair.label);
    if (!key) continue;

    const timestamp = parseTimestampFromCell(pair.valueCell, pair.value);
    if (!timestamp) continue;

    values[key] = timestamp;
  }

  return values;
};

const extractCourseCrumb = (
  doc: Document | Element,
): { courseId: string | null; courseName: string } => {
  const crumbs = querySelectorAll(doc, "nav[aria-label='Navigation bar'] li");
  if (crumbs.length === 0) {
    return { courseId: null, courseName: "Course" };
  }

  for (const crumb of crumbs) {
    const anchor = querySelector(crumb, "a[href*='/course/view.php']");
    if (!anchor) continue;

    const href = getAttr(anchor, "href") ?? "";
    const courseId = getQueryParamValue(href, "id");
    if (!courseId) continue;

    const courseName = normalizeText(getText(crumb)) || "Course";
    return { courseId, courseName };
  }

  return { courseId: null, courseName: "Course" };
};

const extractDescription = (
  doc: Document | Element,
): { html: string | null; text: string | null } => {
  const descriptionNode =
    querySelector(doc, ".activity-description #intro .no-overflow") ??
    querySelector(doc, ".activity-description #intro") ??
    querySelector(doc, "#intro .no-overflow") ??
    querySelector(doc, "#intro");

  if (!descriptionNode) {
    return { html: null, text: null };
  }

  const html = getOuterHTML(descriptionNode);
  const text = normalizeText(getText(descriptionNode));

  return {
    html: html || null,
    text: text || null,
  };
};

const extractEditUrlFromDetails = (
  doc: Document | Element,
  assignmentId: string,
): string | null => {
  const forms = querySelectorAll(doc, "form[action*='/mod/assign/view.php']");
  for (const form of forms) {
    const actionInput = querySelector(form, "input[name='action']");
    const actionValue = getAttr(actionInput, "value");
    if (actionValue !== "editsubmission") continue;

    const formAction = getAttr(form, "action");
    if (!formAction) continue;

    const idInput = querySelector(form, "input[name='id']");
    const formId = getAttr(idInput, "value") ?? assignmentId;
    return toAbsoluteLmsUrl(`${formAction}?id=${formId}&action=editsubmission`);
  }

  const editAnchor = querySelector(doc, "a[href*='action=editsubmission']");
  const href = getAttr(editAnchor, "href");
  return href ? toAbsoluteLmsUrl(href) : null;
};

const getFileExtension = (name: string): string => {
  const match = name.toLowerCase().match(/(\.[a-z0-9]+)$/);
  return match?.[1] ?? "";
};

const validateFileType = (
  fileName: string,
  acceptedTypes: string[],
): { ok: boolean; message?: string } => {
  if (acceptedTypes.length === 0) return { ok: true };
  if (acceptedTypes.includes("*")) return { ok: true };
  if (acceptedTypes.includes("document")) return { ok: true };

  const extension = getFileExtension(fileName);
  if (!extension) {
    return {
      ok: false,
      message: "File extension is required for assignment upload",
    };
  }

  if (!acceptedTypes.includes(extension)) {
    return {
      ok: false,
      message: `File type ${extension} is not allowed`,
    };
  }

  return { ok: true };
};

const resolveOnlineTextFieldName = (form: Element): string | null => {
  const preferredField = querySelector(
    form,
    "textarea[name*='onlinetext'][name$='[text]']",
  );
  const preferredName = getAttr(preferredField, "name");
  if (preferredName) return preferredName;

  const fallbackField = querySelector(form, "textarea[name$='[text]']");
  return getAttr(fallbackField, "name");
};

const getFieldValue = (field: Element | null): string => {
  if (!field) return "";
  if (field.name === "textarea") {
    return getText(field);
  }
  return getAttr(field, "value") ?? "";
};

const toUploadFile = (
  file: AssignmentUploadLocalFile,
): AssignmentUploadLocalFile => {
  const normalizedName = normalizeText(file.name);
  return {
    uri: file.uri,
    name: normalizedName || "submission-file",
    mimeType: file.mimeType ?? "application/octet-stream",
  };
};

const parseJsonData = <T>(value: unknown): T | null => {
  if (value && typeof value === "object") {
    return value as T;
  }
  if (typeof value !== "string") {
    return null;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
};

export const parseAssignmentIdFromUrl = (url: string): string | null =>
  parseAssignmentIdFromMoodleUrl(url);

export const fetchAssignmentDetails = async (
  assignmentId: string,
): Promise<AssignmentDetails> => {
  const response = await api.get<string>(
    `/mod/assign/view.php?id=${assignmentId}`,
  );
  const html = response.data;
  if (isLoginHtml(html)) {
    throw new Error("Session expired while fetching assignment details");
  }
  const doc = parseHtml(html);

  const { courseId, courseName } = extractCourseCrumb(doc);
  const assignmentName =
    normalizeText(getText(querySelector(doc, "h1"))) ||
    `Assignment ${assignmentId}`;
  const description = extractDescription(doc);
  // Extract resource links inside assignment description
  const resourceLinks = querySelectorAll(doc, ".activity-description a[href]");

  const resources = resourceLinks
    .map((link, index) => {
      const href = getAttr(link, "href");
      if (!href) return null;

      return {
        id: `resource-${index + 1}`,
        name: normalizeText(getText(link)) || `File ${index + 1}`,
        url: toAbsoluteLmsUrl(href),
      };
    })
    .filter((item): item is { id: string; name: string; url: string } =>
      Boolean(item),
    );
  const dates = {
    ...parseActivityDatesFromStatusTables(doc),
    ...parseActivityDates(doc),
  };

  const statusTableRoot =
    querySelector(doc, ".submissionstatustable") ??
    querySelector(doc, "table.generaltable");
  const statusRows = statusTableRoot
    ? parseSubmissionStatusRows(statusTableRoot)
    : {};

  const editSubmissionUrl = extractEditUrlFromDetails(doc, assignmentId);
  const canEditSubmission = Boolean(editSubmissionUrl);

  return {
    assignmentId,
    courseId,
    courseName,
    assignmentName,
    openedAt: dates.opened ?? null,
    dueAt: dates.due ?? null,
    cutoffAt: dates.cutoff ?? null,
    allowSubmissionsFrom: dates["allow submissions from"] ?? null,
    descriptionHtml: description.html,
    descriptionText: description.text,
    resources,
    submissionStatusText: statusRows["submission status"] ?? null,
    gradingStatusText: statusRows["grading status"] ?? null,
    timeRemainingText: statusRows["time remaining"] ?? null,
    maxFiles: null,
    maxBytes: null,
    acceptedFileTypes: [],
    supportsFileSubmission: false,
    supportsOnlineTextSubmission: false,
    canEditSubmission,
    editSubmissionUrl,
    fetchedAt: Date.now(),
  };
};

export const startAssignmentEditSession = async (
  assignmentId: string,
): Promise<AssignmentEditSession> => {
  const sessionOk = await ensureAuthenticatedSession();
  if (!sessionOk) {
    throw new Error("Could not refresh LMS session. Please re-login.");
  }

  const editUrl = `/mod/assign/view.php?id=${assignmentId}&action=editsubmission`;
  const response = await api.get<string>(editUrl);
  const html = response.data;
  if (isLoginHtml(html)) {
    throw new Error("Session expired while opening assignment edit page.");
  }
  const doc = parseHtml(html);

  const { courseId } = extractCourseCrumb(doc);

  const forms = querySelectorAll(
    doc,
    "form[action*='/mod/assign/view.php'][method='post']",
  );
  const form =
    forms.find((candidate) => {
      const actionInput = querySelector(candidate, "input[name='action']");
      return getAttr(actionInput, "value") === "savesubmission";
    }) ??
    forms[0] ??
    null;

  if (!form) {
    throw new Error("Could not find assignment submission form");
  }

  const hiddenFields: Record<string, string> = {};
  const hiddenInputs = querySelectorAll(form, "input[type='hidden'][name]");
  for (const input of hiddenInputs) {
    const name = getAttr(input, "name");
    if (!name) continue;
    hiddenFields[name] = getAttr(input, "value") ?? "";
  }

  const sesskey = hiddenFields.sesskey;
  if (!sesskey) {
    throw new Error("Missing sesskey in assignment edit form");
  }

  const fileManagerConfig = parseFileManagerConfig(html);
  const acceptedFileTypes = getAcceptedFileTypes(fileManagerConfig);
  const uploadRepositoryId = getUploadRepositoryId(fileManagerConfig);
  const formAction = getAttr(form, "action") ?? "/mod/assign/view.php";

  const onlineTextFieldName = resolveOnlineTextFieldName(form);
  const onlineTextField = onlineTextFieldName
    ? querySelector(form, `[name="${onlineTextFieldName}"]`)
    : null;

  return {
    assignmentId,
    courseId,
    editUrl: toAbsoluteLmsUrl(editUrl),
    formActionUrl: toAbsoluteLmsUrl(formAction),
    sesskey,
    userId: hiddenFields.userid ?? null,
    draftItemId:
      hiddenFields.files_filemanager ??
      (fileManagerConfig?.itemid !== undefined
        ? String(fileManagerConfig.itemid)
        : null),
    hiddenFields,
    supportsFileSubmission: Boolean(hiddenFields.files_filemanager),
    supportsOnlineTextSubmission: Boolean(onlineTextFieldName),
    onlineTextDraftHtml: onlineTextField
      ? getFieldValue(onlineTextField)
      : null,
    onlineTextFieldName,
    acceptedFileTypes,
    maxFiles: parseNumberValue(fileManagerConfig?.maxfiles),
    maxBytes: parseNumberValue(fileManagerConfig?.maxbytes),
    uploadRepositoryId,
    fileManagerClientId: fileManagerConfig?.client_id ?? null,
    fileManagerContextId:
      fileManagerConfig?.context?.id !== undefined
        ? String(fileManagerConfig.context.id)
        : null,
    fileManagerEnv: "filemanager",
    defaultAuthor:
      fileManagerConfig?.filepicker?.author ??
      fileManagerConfig?.author ??
      null,
    defaultLicense:
      fileManagerConfig?.filepicker?.defaultlicense ??
      fileManagerConfig?.defaultlicense ??
      null,
    fetchedAt: Date.now(),
  };
};

type RepositoryUploadResponse = {
  error?: string;
  event?: string;
  msg?: string;
  itemid?: string | number;
  file?: string;
  title?: string;
  license?: string;
  author?: string;
};

export const uploadAssignmentDraftFile = async (
  session: AssignmentEditSession,
  localFile: AssignmentUploadLocalFile,
  options?: { onProgress?: (fraction: number | null) => void },
): Promise<AssignmentFileDraft> => {
  if (!session.supportsFileSubmission || !session.draftItemId) {
    throw new Error("Assignment does not support file submissions");
  }
  if (!session.uploadRepositoryId) {
    throw new Error("Upload repository is not available for this assignment");
  }

  const normalizedFile = toUploadFile(localFile);
  const typeValidation = validateFileType(
    normalizedFile.name,
    session.acceptedFileTypes,
  );
  if (!typeValidation.ok) {
    throw new Error(typeValidation.message ?? "File type not allowed");
  }

  const uploadForm = new FormData();
  // React Native FormData accepts a file descriptor object { uri, name, type }.
  // The double-cast satisfies DOM typings that expect a Blob.
  uploadForm.append("repo_upload_file", {
    uri: normalizedFile.uri,
    name: normalizedFile.name,
    type: normalizedFile.mimeType ?? "application/octet-stream",
  } as unknown as Blob);
  uploadForm.append("title", normalizedFile.name);
  uploadForm.append("author", session.defaultAuthor ?? "Bunkialo");
  uploadForm.append("license", session.defaultLicense ?? "unknown");
  for (const acceptedType of session.acceptedFileTypes) {
    uploadForm.append("accepted_types[]", acceptedType);
  }
  uploadForm.append("repo_id", session.uploadRepositoryId);
  uploadForm.append("p", "");
  uploadForm.append("page", "");
  uploadForm.append("env", session.fileManagerEnv);
  uploadForm.append("sesskey", session.sesskey);
  if (session.fileManagerClientId) {
    uploadForm.append("client_id", session.fileManagerClientId);
  }
  uploadForm.append("itemid", session.draftItemId);
  uploadForm.append("maxbytes", String(session.maxBytes ?? -1));
  uploadForm.append("areamaxbytes", "-1");
  if (session.fileManagerContextId) {
    uploadForm.append("ctx_id", session.fileManagerContextId);
  }
  uploadForm.append("savepath", "/");

  const response = await api.post<RepositoryUploadResponse | string>(
    "/repository/repository_ajax.php?action=upload",
    uploadForm,
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
      onUploadProgress: (event) => {
        const total = event.total ?? null;
        const loaded = event.loaded;
        const fraction = total && total > 0 ? loaded / total : null;
        options?.onProgress?.(fraction);
      },
    },
  );

  const payload = parseJsonData<RepositoryUploadResponse>(response.data);
  if (!payload) {
    throw new Error("Assignment upload returned invalid response");
  }

  if (payload.error || payload.event === "error") {
    throw new Error(payload.error || payload.msg || "Assignment upload failed");
  }

  return {
    itemId: String(payload.itemid ?? session.draftItemId),
    fileName: payload.file || payload.title || normalizedFile.name,
    author: payload.author ?? session.defaultAuthor ?? null,
    license: payload.license ?? session.defaultLicense ?? null,
  };
};

export const submitAssignment = async (
  session: AssignmentEditSession,
  payload: AssignmentSubmissionPayload,
  options?: { onProgress?: (fraction: number | null) => void },
): Promise<AssignmentSubmitResult> => {
  const sessionOk = await ensureAuthenticatedSession();
  if (!sessionOk) {
    return {
      success: false,
      reason: "auth",
      message: "Could not refresh LMS session. Please re-login.",
    };
  }

  if (payload.assignmentId !== session.assignmentId) {
    return {
      success: false,
      reason: "validation",
      message: "Assignment mismatch while submitting",
    };
  }

  const files = payload.files ?? [];
  let draftItemIdToSubmit = session.draftItemId;
  const maxFilesLimit =
    session.maxFiles !== null && session.maxFiles >= 0
      ? session.maxFiles
      : null;
  let uploadSession: AssignmentEditSession = session;
  if (files.length > 0) {
    if (!session.supportsFileSubmission || !session.draftItemId) {
      return {
        success: false,
        reason: "validation",
        message: "This assignment does not accept file submissions",
      };
    }

    if (maxFilesLimit !== null && files.length > maxFilesLimit) {
      return {
        success: false,
        reason: "validation",
        message: `Maximum ${maxFilesLimit} file(s) allowed`,
      };
    }

    for (const file of files) {
      try {
        const uploadedDraft = await uploadAssignmentDraftFile(
          uploadSession,
          file,
          {
            onProgress: options?.onProgress,
          },
        );
        draftItemIdToSubmit = uploadedDraft.itemId;
        uploadSession = {
          ...uploadSession,
          draftItemId: uploadedDraft.itemId,
        };
      } catch (error) {
        return {
          success: false,
          reason: "server",
          message:
            error instanceof Error ? error.message : "Failed to upload file",
        };
      }
    }
  }

  const requestParams = new URLSearchParams();
  for (const [name, value] of Object.entries(session.hiddenFields)) {
    requestParams.set(name, value);
  }

  if (session.supportsFileSubmission && draftItemIdToSubmit) {
    requestParams.set("files_filemanager", draftItemIdToSubmit);
  }

  if (session.supportsOnlineTextSubmission && session.onlineTextFieldName) {
    const onlineText =
      payload.onlineTextHtml ?? session.onlineTextDraftHtml ?? "";
    requestParams.set(session.onlineTextFieldName, onlineText);

    const textFieldMatch = session.onlineTextFieldName.match(/^(.*)\[text\]$/);
    if (textFieldMatch?.[1]) {
      const base = textFieldMatch[1];
      if (!requestParams.has(`${base}[format]`)) {
        requestParams.set(`${base}[format]`, "1");
      }
      if (!requestParams.has(`${base}[itemid]`)) {
        requestParams.set(`${base}[itemid]`, draftItemIdToSubmit ?? "0");
      }
    }
  }

  try {
    const response = await api.post<string>(
      session.formActionUrl,
      requestParams.toString(),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      },
    );

    if (isLoginHtml(response.data)) {
      return {
        success: false,
        reason: "auth",
        message: "Session expired while submitting. Please re-login.",
      };
    }

    const doc = parseHtml(response.data);
    const hasSubmissionTable = Boolean(
      querySelector(doc, ".submissionstatustable"),
    );
    if (!hasSubmissionTable) {
      return {
        success: false,
        reason: "server",
        message: "Moodle did not confirm submission save",
      };
    }

    return {
      success: true,
      message: "Submission saved successfully",
      submittedAt: Date.now(),
    };
  } catch (error) {
    return {
      success: false,
      reason: "network",
      message: error instanceof Error ? error.message : "Submission failed",
    };
  }
};

export const fetchAssignmentDetailsWithSession = async (
  assignmentId: string,
): Promise<AssignmentDetails> => {
  const sessionOk = await ensureAuthenticatedSession();
  if (!sessionOk) {
    throw new Error("Could not refresh LMS session. Please re-login.");
  }

  const details = await fetchAssignmentDetails(assignmentId);
  if (!details.canEditSubmission) {
    return details;
  }

  try {
    const editSession = await startAssignmentEditSession(assignmentId);
    return {
      ...details,
      maxFiles: editSession.maxFiles,
      maxBytes: editSession.maxBytes,
      acceptedFileTypes: editSession.acceptedFileTypes,
      supportsFileSubmission: editSession.supportsFileSubmission,
      supportsOnlineTextSubmission: editSession.supportsOnlineTextSubmission,
    };
  } catch (error) {
    debug.scraper(
      `Could not augment assignment details with edit-session metadata: ${String(error)}`,
    );
    return details;
  }
};
