import {
  savedFilesReady,
  useSavedLmsFileStore,
} from "@/stores/saved-lms-file-store";
import type { SavedLmsFile } from "@/types";
export const savedFileCacheUrl = (key: string) =>
  `${location.origin}/lms-saved-files/${key}`;
export const readSavedLmsBlob = async (key: string): Promise<Blob | null> => {
  if (typeof caches === "undefined") return null;
  const result = await (
    await caches.open("lms-saved-files-v1")
  ).match(savedFileCacheUrl(key));
  return result ? result.blob() : null;
};
export const lookupSavedLmsFile = async (
  key: string,
): Promise<SavedLmsFile | null> => {
  await savedFilesReady();
  const record = useSavedLmsFileStore.getState().records[key];
  if (!record) return null;
  const blob = await readSavedLmsBlob(key);
  if (blob) return { ...record, uri: URL.createObjectURL(blob) };
  useSavedLmsFileStore.getState().remove(key);
  return null;
};
export const rememberLmsFile = (key: string, record: SavedLmsFile): void =>
  useSavedLmsFileStore.getState().save(key, record);
export const persistLmsDownload = async (
  key: string,
  record: SavedLmsFile,
): Promise<SavedLmsFile> => {
  if (record.location === "browser-cache") return record;
  const link = document.createElement("a");
  link.href = record.uri;
  link.download = record.fileName;
  link.click();
  const saved = { ...record, location: "browser-cache" as const };
  rememberLmsFile(key, saved);
  return saved;
};
