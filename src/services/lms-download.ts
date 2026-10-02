import { getCurrentBaseUrl } from "@/services/api";
import {
  checkSession,
  getCredentials,
  tryAutoLogin,
} from "@/services/auth/lms-auth";
import { cookieStore } from "@/services/cookie-store";
import type {
  LmsDownloadFailure,
  LmsDownloadFailureReason,
  LmsDownloadOptions,
  LmsDownloadResult,
} from "@/types";
import { debug } from "@/utils/debug";
import { isLoginHtml } from "@/utils/moodle-url";
import { File, Paths } from "expo-file-system";
import { fetch as expoFetch } from "expo/fetch";

import { attachmentPreviewKey } from "@/utils/attachment-preview";
import {
  lookupSavedLmsFile,
  rememberLmsFile,
  persistLmsDownload,
} from "@/services/saved-lms-files";

const LMS_USER_AGENT =
  "Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 Chrome/91.0.4472.120 Mobile";
const MAX_REDIRECTS = 10;

const CONTENT_TYPE_EXTENSION_MAP: Record<string, string> = {
  "application/pdf": ".pdf",
  "application/zip": ".zip",
  "application/x-zip-compressed": ".zip",
  "application/msword": ".doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    ".docx",
  "application/vnd.ms-powerpoint": ".ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation":
    ".pptx",
  "application/vnd.ms-excel": ".xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
  "text/plain": ".txt",
  "text/csv": ".csv",
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/webp": ".webp",
  "text/html": ".html",
};

const sanitizeFileName = (value: string): string =>
  value
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const getExtensionFromPath = (url: string): string => {
  const cleanUrl = url.split("?")[0]?.split("#")[0] ?? "";
  const lastSegment = cleanUrl.split("/").pop() ?? "";
  const match = lastSegment.match(/\.([a-zA-Z0-9]{1,8})$/);
  return match ? `.${match[1].toLowerCase()}` : "";
};

const parseFileNameFromContentDisposition = (
  value: string | undefined,
): string | null => {
  if (!value) return null;

  // RFC 5987 filename*=UTF-8''encoded-name.ext
  const utfMatch = value.match(/filename\*\s*=\s*UTF-8''([^;]+)/i);
  if (utfMatch?.[1]) {
    try {
      return sanitizeFileName(
        decodeURIComponent(utfMatch[1].replace(/["']/g, "")),
      );
    } catch {
      return sanitizeFileName(utfMatch[1].replace(/["']/g, ""));
    }
  }

  const plainMatch = value.match(/filename\s*=\s*"?([^";]+)"?/i);
  if (plainMatch?.[1]) {
    return sanitizeFileName(plainMatch[1]);
  }

  return null;
};

const toAbsoluteLmsUrl = (url: string): string => {
  const baseUrl = getCurrentBaseUrl();
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (url.startsWith("//")) return `https:${url}`;
  if (url.startsWith("/")) return `${baseUrl}${url}`;
  return `${baseUrl}/${url.replace(/^\.?\//, "")}`;
};

const buildFailure = (
  reason: LmsDownloadFailureReason,
  message: string,
  status?: number,
): LmsDownloadFailure => ({
  success: false,
  reason,
  message,
  ...(status !== undefined ? { status } : {}),
});

const ensureAuthenticatedSession = async (): Promise<boolean> => {
  const hasValidSession = await checkSession();
  if (hasValidSession) return true;

  const reauthSuccess = await tryAutoLogin();
  return reauthSuccess;
};

const getHeaderValue = (headers: Headers, name: string): string | null =>
  headers.get(name);

const buildFinalFileName = (
  preferredName: string,
  absoluteUrl: string,
  headers: Headers,
): string => {
  const fromDisposition = parseFileNameFromContentDisposition(
    getHeaderValue(headers, "content-disposition") ?? undefined,
  );
  if (fromDisposition) return fromDisposition;

  const preferredBase = sanitizeFileName(preferredName) || "lms-resource";
  const extFromPath = getExtensionFromPath(absoluteUrl);
  const contentType = (
    getHeaderValue(headers, "content-type") || ""
  ).toLowerCase();
  const bareContentType = contentType.split(";")[0]?.trim() ?? "";
  const extFromContentType = CONTENT_TYPE_EXTENSION_MAP[bareContentType] ?? "";
  const extension = extFromPath || extFromContentType;

  if (extension && !preferredBase.toLowerCase().endsWith(extension)) {
    return `${preferredBase}${extension}`;
  }

  return preferredBase;
};

type ResolvedFetchResult = {
  response: Response;
  resolvedUrl: string;
};

const isRedirectStatus = (status: number): boolean =>
  status === 301 ||
  status === 302 ||
  status === 303 ||
  status === 307 ||
  status === 308;

const resolveWithCookieRedirects = async (
  absoluteUrl: string,
): Promise<ResolvedFetchResult> => {
  let currentUrl = absoluteUrl;

  for (
    let redirectCount = 0;
    redirectCount <= MAX_REDIRECTS;
    redirectCount += 1
  ) {
    const cookieHeader = cookieStore.getCookieHeader();
    const headers: Record<string, string> = {
      "User-Agent": LMS_USER_AGENT,
      Accept: "*/*",
    };

    if (
      cookieHeader &&
      new URL(currentUrl).origin === new URL(getCurrentBaseUrl()).origin
    ) {
      headers.Cookie = cookieHeader;
    }

    const response = await expoFetch(currentUrl, {
      method: "GET",
      headers,
      redirect: "manual",
    });

    const setCookie = response.headers.get("set-cookie");
    if (
      setCookie &&
      new URL(currentUrl).origin === new URL(getCurrentBaseUrl()).origin
    ) {
      cookieStore.setCookiesFromHeader(setCookie);
    }

    if (!isRedirectStatus(response.status)) {
      return {
        response,
        resolvedUrl: currentUrl,
      };
    }

    const location = response.headers.get("location");
    if (!location) {
      return {
        response,
        resolvedUrl: currentUrl,
      };
    }

    currentUrl = new URL(location, currentUrl).toString();
  }

  throw new Error("Too many redirects while downloading LMS resource");
};

const downloadResponseToFile = async (
  response: Response,
  fileName: string,
  options?: LmsDownloadOptions,
): Promise<string> => {
  const targetFile = new File(
    Paths.cache,
    "lms-files",
    attachmentPreviewKey("cache", options?.cacheKey ?? fileName),
    fileName,
  );
  targetFile.create({ intermediates: true, overwrite: true });

  const contentLength = Number.parseInt(
    response.headers.get("content-length") ?? "",
    10,
  );
  const totalBytesExpected =
    Number.isFinite(contentLength) && contentLength > 0 ? contentLength : null;

  const emitProgress = (totalBytesWritten: number) => {
    options?.onProgress?.({
      totalBytesWritten,
      totalBytesExpected,
      fraction: totalBytesExpected
        ? Math.min(1, Math.max(0, totalBytesWritten / totalBytesExpected))
        : null,
    });
  };

  const streamReader = response.body?.getReader();
  if (!streamReader) {
    const bytes = await response.bytes();
    if (options?.maxBytes && bytes.length > options.maxBytes) {
      targetFile.delete();
      throw new Error("File too large for a preview");
    }
    targetFile.write(bytes);
    emitProgress(bytes.length);
    return targetFile.uri;
  }

  const handle = targetFile.open();
  let totalBytesWritten = 0;

  try {
    while (true) {
      const chunk = await streamReader.read();
      if (chunk.done) break;
      const value = chunk.value;
      if (!value || value.length === 0) continue;
      handle.writeBytes(value);
      totalBytesWritten += value.length;
      if (options?.maxBytes && totalBytesWritten > options.maxBytes) {
        await streamReader.cancel();
        throw new Error("File too large for a preview");
      }
      emitProgress(totalBytesWritten);
    }
  } finally {
    handle.close();
  }

  return targetFile.uri;
};

const performDownloadAttempt = async (
  absoluteUrl: string,
  preferredName: string,
  options?: LmsDownloadOptions,
): Promise<LmsDownloadResult> => {
  const { response, resolvedUrl } =
    await resolveWithCookieRedirects(absoluteUrl);

  debug.api("LMS download fetch result", {
    sourceUrl: absoluteUrl,
    resolvedUrl,
    status: response.status,
    contentType: response.headers.get("content-type"),
    hasCookies: cookieStore.hasCookies(),
    cookieCount: cookieStore.getCookieCount(),
  });

  if (response.status < 200 || response.status >= 300) {
    return buildFailure(
      "http-error",
      `Download request failed with status ${response.status}`,
      response.status,
    );
  }

  const contentType = (
    response.headers.get("content-type") || ""
  ).toLowerCase();
  const contentDisposition = (
    response.headers.get("content-disposition") || ""
  ).toLowerCase();
  const isAttachmentHtml =
    (contentDisposition.includes("attachment") ||
      contentDisposition.includes("filename=")) &&
    (contentDisposition.includes(".html") ||
      contentDisposition.includes(".htm"));
  if (
    !isAttachmentHtml &&
    (contentType.includes("text/html") ||
      contentType.includes("application/xhtml"))
  ) {
    const html = await response.text();
    if (isLoginHtml(html)) {
      return buildFailure(
        "session-login-page",
        "LMS returned login page instead of file",
      );
    }
    return buildFailure(
      "http-error",
      "LMS returned an HTML page instead of a downloadable file",
    );
  }

  if (
    options?.maxBytes &&
    Number(response.headers.get("content-length")) > options.maxBytes
  )
    return buildFailure("http-error", "File too large for a preview");

  const finalFileName = buildFinalFileName(
    preferredName,
    resolvedUrl,
    response.headers,
  );

  const fileUri = await downloadResponseToFile(
    response,
    finalFileName,
    options,
  );

  return {
    success: true,
    uri: fileUri,
    fileName: finalFileName,
    status: response.status,
    contentType: contentType || null,
  };
};

const downloadOnce = async (
  url: string,
  preferredName: string,
  options?: LmsDownloadOptions,
): Promise<LmsDownloadResult> => {
  const absoluteUrl = toAbsoluteLmsUrl(url);

  try {
    if (new URL(absoluteUrl).origin !== new URL(getCurrentBaseUrl()).origin)
      return buildFailure("http-error", "Unsupported LMS file origin");
    const scope = (await getCredentials())?.username || "";
    const key = attachmentPreviewKey(scope, absoluteUrl);
    const cached = await lookupSavedLmsFile(key);
    if (cached) {
      const saved =
        options?.destination === "preview-cache"
          ? cached
          : await persistLmsDownload(key, cached);
      options?.onProgress?.({
        totalBytesWritten: 0,
        totalBytesExpected: null,
        fraction: 1,
      });
      return {
        success: true,
        uri: saved.uri,
        fileName: saved.fileName,
        status: 200,
        contentType: saved.contentType,
      };
    }
    options = { ...options, cacheKey: key };
    const sessionOk = await ensureAuthenticatedSession();
    if (!sessionOk) {
      return buildFailure(
        "reauth-failed",
        "Could not refresh LMS session. Please re-login.",
      );
    }

    let result = await performDownloadAttempt(
      absoluteUrl,
      preferredName,
      options,
    );
    if (!result.success && result.reason === "session-login-page") {
      debug.api("LMS download hit login page, attempting one re-auth retry", {
        url: absoluteUrl,
      });
      const reloginSuccess = await tryAutoLogin();
      if (!reloginSuccess) {
        return buildFailure(
          "reauth-failed",
          "Could not refresh LMS session. Please re-login.",
        );
      }
      result = await performDownloadAttempt(
        absoluteUrl,
        preferredName,
        options,
      );
    }

    if (result.success) {
      const record = {
        uri: result.uri,
        fileName: result.fileName,
        contentType: result.contentType,
        downloadedAt: Date.now(),
        location: "preview-cache" as const,
      };
      rememberLmsFile(key, record);
      if (options?.destination !== "preview-cache") {
        const saved = await persistLmsDownload(key, record);
        result = { ...result, uri: saved.uri, fileName: saved.fileName };
      }
    }
    return result;
  } catch (error) {
    debug.api("LMS direct download exception", {
      url: absoluteUrl,
      error:
        error instanceof Error
          ? { name: error.name, message: error.message }
          : String(error),
    });
    return buildFailure(
      "network-error",
      error instanceof Error ? error.message : "Download failed",
    );
  }
};

const pendingDownloads = new Map<string, Promise<LmsDownloadResult>>();
export const downloadLmsResourceWithSession = async (
  url: string,
  name: string,
  options?: LmsDownloadOptions,
): Promise<LmsDownloadResult> => {
  const absoluteUrl = toAbsoluteLmsUrl(url);
  const key = attachmentPreviewKey(
    (await getCredentials())?.username || "",
    absoluteUrl,
  );
  let work = pendingDownloads.get(key);
  if (!work) {
    work = downloadOnce(absoluteUrl, name, {
      ...options,
      destination: "preview-cache",
    }).finally(() => pendingDownloads.delete(key));
    pendingDownloads.set(key, work);
  }
  const result = await work;
  if (!result.success) return result;
  if (options?.destination === "preview-cache") return result;
  try {
    const cached = await lookupSavedLmsFile(key);
    if (!cached) throw new Error("Saved file is unavailable");
    const saved = await persistLmsDownload(key, cached);
    options?.onProgress?.({
      fraction: 1,
      totalBytesWritten: 0,
      totalBytesExpected: null,
    });
    return { ...result, uri: saved.uri, fileName: saved.fileName };
  } catch (error) {
    return buildFailure(
      "network-error",
      error instanceof Error ? error.message : "Could not save download",
    );
  }
};
