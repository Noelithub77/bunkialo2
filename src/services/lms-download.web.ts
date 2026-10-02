import { getCurrentBaseUrl } from "@/services/api";
import { getCredentials } from "@/services/auth/lms-auth";
import { attachmentPreviewKey } from "@/utils/attachment-preview";
import {
  lookupSavedLmsFile,
  rememberLmsFile,
  persistLmsDownload,
  savedFileCacheUrl,
} from "@/services/saved-lms-files";
import type {
  LmsDownloadOptions,
  LmsDownloadResult,
  SavedLmsFile,
} from "@/types";
const pending = new Map<string, Promise<LmsDownloadResult>>();
const fetchFile = async (
  url: URL,
  name: string,
  key: string,
  maxBytes?: number,
): Promise<LmsDownloadResult> => {
  const response = await fetch(`/api/lms${url.pathname}${url.search}`, {
    credentials: "same-origin",
  });
  if (!response.ok) throw new Error(`Download failed (${response.status})`);
  if (maxBytes && Number(response.headers.get("content-length")) > maxBytes)
    throw new Error("File too large for a preview");
  const reader = response.body?.getReader();
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let size = 0;
  if (reader) {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (maxBytes && size > maxBytes) {
        await reader.cancel();
        throw new Error("File too large for a preview");
      }
      chunks.push(new Uint8Array(chunk.value));
    }
  } else chunks.push(new Uint8Array(await response.arrayBuffer()));
  const type =
    response.headers.get("content-type") || "application/octet-stream";
  if (type.includes("text/html") && !/\.html?$/i.test(name))
    throw new Error("LMS returned a page instead of a file");
  const blob = new Blob(chunks, { type });
  if (maxBytes && blob.size > maxBytes)
    throw new Error("File too large for a preview");
  const disposition = response.headers.get("content-disposition");
  const actualName = disposition?.match(
    /filename\*?=(?:UTF-8'')?"?([^";]+)/i,
  )?.[1];
  const fileName =
    (actualName ? decodeURIComponent(actualName) : name).replace(
      /[<>:"/\\|?*\x00-\x1F]/g,
      "",
    ) || "file";
  if (typeof caches !== "undefined")
    await (
      await caches.open("lms-saved-files-v1")
    ).put(
      savedFileCacheUrl(key),
      new Response(blob, { headers: { "content-type": type } }),
    );
  const record: SavedLmsFile = {
    uri: URL.createObjectURL(blob),
    fileName,
    contentType: type,
    downloadedAt: Date.now(),
    location: "preview-cache",
  };
  rememberLmsFile(key, record);
  return {
    success: true,
    uri: record.uri,
    fileName,
    status: response.status,
    contentType: type,
  };
};
export const downloadLmsResourceWithSession = async (
  value: string,
  name: string,
  options?: LmsDownloadOptions,
): Promise<LmsDownloadResult> => {
  try {
    const url = new URL(value, getCurrentBaseUrl());
    if (url.origin !== new URL(getCurrentBaseUrl()).origin)
      throw new Error("Unsupported LMS file origin");
    const key = attachmentPreviewKey(
      (await getCredentials())?.username || "",
      url.href,
    );
    let cached = await lookupSavedLmsFile(key);
    if (!cached) {
      let work = pending.get(key);
      if (!work) {
        work = fetchFile(url, name, key, options?.maxBytes).finally(() =>
          pending.delete(key),
        );
        pending.set(key, work);
      }
      const result = await work;
      if (!result.success) return result;
      cached = {
        uri: result.uri,
        fileName: result.fileName,
        contentType: result.contentType,
        downloadedAt: Date.now(),
        location: "preview-cache",
      };
    }
    const saved =
      options?.destination === "preview-cache"
        ? cached
        : await persistLmsDownload(key, cached);
    options?.onProgress?.({
      fraction: 1,
      totalBytesExpected: null,
      totalBytesWritten: 0,
    });
    return {
      success: true,
      uri: saved.uri,
      fileName: saved.fileName,
      status: 200,
      contentType: saved.contentType,
    };
  } catch (error) {
    return {
      success: false,
      reason: "network-error",
      message: error instanceof Error ? error.message : "Download failed",
    };
  }
};
