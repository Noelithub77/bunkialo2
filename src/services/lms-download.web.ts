import { getCurrentBaseUrl } from "@/services/api";
import type {
  LmsDownloadFailure,
  LmsDownloadOptions,
  LmsDownloadResult,
} from "@/types";

const failure = (message: string, status?: number): LmsDownloadFailure => ({
  success: false,
  reason: status ? "http-error" : "network-error",
  message,
  ...(status ? { status } : {}),
});

const toRelayUrl = (value: string): string => {
  const url = new URL(value, getCurrentBaseUrl());
  return `/api/lms${url.pathname}${url.search}`;
};

export const downloadLmsResourceWithSession = async (
  url: string,
  preferredName: string,
  options?: LmsDownloadOptions,
): Promise<LmsDownloadResult> => {
  try {
    const response = await fetch(toRelayUrl(url), { credentials: "same-origin" });
    if (!response.ok) return failure(`Download failed with status ${response.status}.`, response.status);
    const blob = await response.blob();
    options?.onProgress?.({
      fraction: 1,
      totalBytesExpected: blob.size,
      totalBytesWritten: blob.size,
    });
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = preferredName;
    link.click();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    return {
      success: true,
      uri: objectUrl,
      fileName: preferredName,
      status: response.status,
      contentType: response.headers.get("content-type"),
    };
  } catch (error) {
    return failure(error instanceof Error ? error.message : "Download failed.");
  }
};
