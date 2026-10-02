export type AttachmentPreviewKind = "pdf" | "image" | null;
export const attachmentPreviewKind = (
  name: string,
  url: string,
): AttachmentPreviewKind => {
  const value = `${name} ${url.split(/[?#]/)[0]}`.toLowerCase();
  if (/\.pdf(?:\s|$)/.test(value)) return "pdf";
  if (/\.(?:png|jpe?g|webp|gif|bmp)(?:\s|$)/.test(value)) return "image";
  return null;
};
export const attachmentPreviewKey = (scope: string, url: string): string => {
  let first = 2166136261,
    second = 5381;
  for (const char of `${scope}\0${url}`) {
    first = Math.imul(first ^ char.charCodeAt(0), 16777619);
    second = Math.imul(second, 33) ^ char.charCodeAt(0);
  }
  return `v1-${(first >>> 0).toString(16)}-${(second >>> 0).toString(16)}`;
};
// Two previews at most, independently of the assignment's critical fetch path.
let active = 0;
const waiting: (() => void)[] = [];
export const withAttachmentPreviewSlot = async <T>(
  work: () => Promise<T>,
): Promise<T> => {
  if (active >= 2) await new Promise<void>((resolve) => waiting.push(resolve));
  else active++;
  try {
    return await work();
  } finally {
    const next = waiting.shift();
    if (next) next();
    else active--;
  }
};

export const resolveAttachmentUrl = (
  value: string,
  base: string,
): { url: string; isLms: boolean } | null => {
  try {
    const url = new URL(value, base);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return { url: url.href, isLms: url.origin === new URL(base).origin };
  } catch {
    return null;
  }
};
