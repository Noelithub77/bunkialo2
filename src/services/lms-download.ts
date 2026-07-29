import { getCurrentBaseUrl } from "@/services/api";
import { checkSession, tryAutoLogin } from "@/services/auth/lms-auth";
import { cookieStore } from "@/services/cookie-store";
import type {
  LmsDownloadFailure,
  LmsDownloadFailureReason,
  LmsDownloadOptions,
  LmsDownloadResult,
  LmsDownloadSuccess,
} from "@/types";
import { debug } from "@/utils/debug";
import { isLoginHtml } from "@/utils/moodle-url";
import { File, Paths } from "expo-file-system";
import { fetch as expoFetch } from "expo/fetch";

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

    if (cookieHeader) {
      headers.Cookie = cookieHeader;
    }

    const response = await expoFetch(currentUrl, {
      method: "GET",
      headers,
      redirect: "manual",
    });

    const setCookie = response.headers.get("set-cookie");
    if (setCookie) {
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
  const targetFile = new File(Paths.cache, fileName);
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
        ? totalBytesWritten / totalBytesExpected
        : null,
    });
  };

  const streamReader = response.body?.getReader();
  if (!streamReader) {
    const bytes = await response.bytes();
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
    (contentDisposition.includes(".html") || contentDisposition.includes(".htm"));
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

export const downloadLmsResourceWithSession = async (
  url: string,
  preferredName: string,
  options?: LmsDownloadOptions,
): Promise<LmsDownloadResult> => {
  const absoluteUrl = toAbsoluteLmsUrl(url);

  try {
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
