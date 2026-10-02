import { requireOptionalNativeModule } from "expo-modules-core";
import { downloadLmsResourceWithSession } from "@/services/lms-download";
import type { AttachmentPreview, PdfAttachmentDocument } from "@/types";
import {
  attachmentPreviewKey,
  withAttachmentPreviewSlot,
} from "@/utils/attachment-preview";
interface PreviewNative {
  getCachedPreview(key: string): Promise<AttachmentPreview | null>;
  getPageCount(uri: string): Promise<number>;
  renderPage(
    uri: string,
    key: string,
    index: number,
    width: number,
  ): Promise<AttachmentPreview | null>;
}
const renderer =
  requireOptionalNativeModule<PreviewNative>("AttachmentPreview");
export const pdfAttachmentPreviewsSupported = Boolean(renderer);
const pending = new Map<string, Promise<AttachmentPreview | null>>();
const pageKey = (url: string, scope: string, index: number, width: number) =>
  `${attachmentPreviewKey(scope, url)}-p${index}-w${width}`;
export const getPdfAttachmentDocument = async (
  url: string,
  name: string,
  _scope = "",
): Promise<PdfAttachmentDocument> => {
  if (!renderer) throw new Error("PDF renderer unavailable");
  const result = await downloadLmsResourceWithSession(url, name, {
    destination: "preview-cache",
    maxBytes: 25 * 1024 * 1024,
  });
  if (!result.success) throw new Error(result.message);
  return {
    uri: result.uri,
    pageCount: await renderer.getPageCount(result.uri),
  };
};
export const readCachedPdfPage = async (
  url: string,
  scope: string,
  index = 0,
  width = 640,
) => renderer?.getCachedPreview(pageKey(url, scope, index, width)) ?? null;
export const createPdfPagePreview = (
  url: string,
  name: string,
  scope: string,
  index = 0,
  width = 640,
): Promise<AttachmentPreview | null> => {
  if (!renderer) return Promise.resolve(null);
  const key = pageKey(url, scope, index, width),
    existing = pending.get(key);
  if (existing) return existing;
  const work = withAttachmentPreviewSlot(async () => {
    const cached = await renderer.getCachedPreview(key);
    if (cached) return cached;
    const document = await getPdfAttachmentDocument(url, name);
    return renderer.renderPage(document.uri, key, index, width);
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
