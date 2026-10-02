import { downloadLmsResourceWithSession } from "@/services/lms-download";
import type { PdfAttachmentDocument, AttachmentPreview } from "@/types";
import {
  attachmentPreviewKey,
  withAttachmentPreviewSlot,
} from "@/utils/attachment-preview";
interface PdfPage {
  getViewport(options: { scale: number }): { width: number; height: number };
  render(options: {
    canvas: HTMLCanvasElement;
    canvasContext: CanvasRenderingContext2D;
    viewport: { width: number; height: number };
  }): { promise: Promise<void> };
}
interface PdfDocument {
  numPages: number;
  getPage(page: number): Promise<PdfPage>;
  destroy(): Promise<void>;
}
interface PdfApi {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument(options: {
    data: Uint8Array;
    isEvalSupported: false;
    cMapUrl: string;
    cMapPacked: true;
    standardFontDataUrl: string;
    wasmUrl: string;
  }): { promise: Promise<PdfDocument> };
}
declare global {
  interface Window {
    __bunkialoPdfApi?: PdfApi;
  }
}
let apiPromise: Promise<PdfApi> | null = null;
const loadPdfApi = (): Promise<PdfApi> => {
  if (window.__bunkialoPdfApi) return Promise.resolve(window.__bunkialoPdfApi);
  if (!apiPromise)
    apiPromise = new Promise<PdfApi>((resolve, reject) => {
      const script = document.createElement("script");
      script.type = "module";
      script.src = "/pdf-preview/loader.mjs";
      script.onload = () =>
        window.__bunkialoPdfApi
          ? resolve(window.__bunkialoPdfApi)
          : reject(new Error("PDF renderer unavailable"));
      script.onerror = () => reject(new Error("PDF renderer unavailable"));
      document.head.append(script);
    }).catch((error) => {
      apiPromise = null;
      throw error;
    });
  return apiPromise;
};
export const pdfAttachmentPreviewsSupported = true;
const docs = new Map<string, Promise<PdfDocument>>();
const getDocument = (
  url: string,
  name: string,
  scope: string,
): Promise<PdfDocument> => {
  const key = attachmentPreviewKey(scope, url);
  const existing = docs.get(key);
  if (existing) return existing;
  const work = (async () => {
    const result = await downloadLmsResourceWithSession(url, name, {
      destination: "preview-cache",
      maxBytes: 25 * 1024 * 1024,
    });
    if (!result.success) throw new Error(result.message);
    const response = await fetch(result.uri);
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (
      bytes.length > 25 * 1024 * 1024 ||
      new TextDecoder().decode(bytes.subarray(0, 5)) !== "%PDF-"
    )
      throw new Error("Invalid PDF");
    const api = await loadPdfApi();
    api.GlobalWorkerOptions.workerSrc = "/pdf-preview/pdf.worker.mjs";
    return api.getDocument({
      data: bytes,
      isEvalSupported: false,
      cMapUrl: "/pdf-preview/cmaps/",
      cMapPacked: true,
      standardFontDataUrl: "/pdf-preview/standard_fonts/",
      wasmUrl: "/pdf-preview/wasm/",
    }).promise;
  })().catch((error) => {
    docs.delete(key);
    throw error;
  });
  docs.set(key, work);
  if (docs.size > 5) {
    const oldest = docs.keys().next().value;
    if (oldest && oldest !== key) {
      const previous = docs.get(oldest);
      docs.delete(oldest);
      void previous?.then((doc) => doc.destroy()).catch(() => {});
    }
  }
  return work;
};
export const getPdfAttachmentDocument = async (
  url: string,
  name: string,
  scope = "",
): Promise<PdfAttachmentDocument> => ({
  uri: url,
  pageCount: (await getDocument(url, name, scope)).numPages,
});
const cacheKey = (url: string, scope: string, index: number, width: number) =>
  `${location.origin}/attachment-preview-cache/${attachmentPreviewKey(scope, url)}-p${index}-w${width}`;
export const readCachedPdfPage = async (
  url: string,
  scope: string,
  index = 0,
  width = 640,
): Promise<AttachmentPreview | null> => {
  if (typeof caches === "undefined") return null;
  const response = await (
    await caches.open("lms-attachment-previews-v1")
  ).match(cacheKey(url, scope, index, width));
  if (!response) return null;
  return {
    uri: URL.createObjectURL(await response.blob()),
    width: Number(response.headers.get("x-preview-width")),
    height: Number(response.headers.get("x-preview-height")),
    updatedAt: Number(response.headers.get("x-preview-updated")),
  };
};
const pending = new Map<string, Promise<AttachmentPreview | null>>();
export const createPdfPagePreview = (
  url: string,
  name: string,
  scope: string,
  index = 0,
  width = 640,
): Promise<AttachmentPreview | null> => {
  const key = cacheKey(url, scope, index, width),
    existing = pending.get(key);
  if (existing) return existing;
  const work = withAttachmentPreviewSlot(async () => {
    const cached = await readCachedPdfPage(url, scope, index, width);
    if (cached) return cached;
    const pdf = await getDocument(url, name, scope),
      page = await pdf.getPage(index + 1),
      original = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({
      scale: Math.min(width / original.width, 2400 / original.height),
    });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const context = canvas.getContext("2d");
    if (!context) return null;
    await page.render({ canvas, canvasContext: context, viewport }).promise;
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/png"),
    );
    if (!blob) return null;
    const result = {
      uri: URL.createObjectURL(blob),
      width: canvas.width,
      height: canvas.height,
      updatedAt: Date.now(),
    };
    if (typeof caches !== "undefined")
      await (
        await caches.open("lms-attachment-previews-v1")
      ).put(
        key,
        new Response(blob, {
          headers: {
            "content-type": "image/png",
            "x-preview-width": String(result.width),
            "x-preview-height": String(result.height),
            "x-preview-updated": String(result.updatedAt),
          },
        }),
      );
    return result;
  })
    .catch(() => null)
    .finally(() => pending.delete(key));
  pending.set(key, work);
  return work;
};
export const readCachedAttachmentPreview = (url: string, scope: string) =>
  readCachedPdfPage(url, scope);
export const createAttachmentPreview = (
  url: string,
  name: string,
  scope: string,
) => createPdfPagePreview(url, name, scope);
