import { Platform } from "react-native";
import { File, Directory, Paths } from "expo-file-system";
import { requireOptionalNativeModule } from "expo-modules-core";
import {
  useSavedLmsFileStore,
  savedFilesReady,
} from "@/stores/saved-lms-file-store";
import type { SavedLmsFile } from "@/types";
interface DownloadsNative {
  getSavedDownload(key: string): Promise<Omit<SavedLmsFile, "location"> | null>;
  saveDownload(
    uri: string,
    key: string,
    name: string,
    mime: string,
  ): Promise<Omit<SavedLmsFile, "location">>;
}
const native =
  requireOptionalNativeModule<DownloadsNative>("AttachmentPreview");
export const lookupSavedLmsFile = async (
  key: string,
): Promise<SavedLmsFile | null> => {
  await savedFilesReady();
  const published = await native?.getSavedDownload(key).catch(() => null);
  if (published) {
    const record: SavedLmsFile = { ...published, location: "downloads" };
    useSavedLmsFileStore.getState().save(key, record);
    return record;
  }
  const record = useSavedLmsFileStore.getState().records[key];
  if (!record) return null;
  try {
    if (record.location !== "downloads" && new File(record.uri).exists)
      return record;
  } catch {}
  useSavedLmsFileStore.getState().remove(key);
  return null;
};
export const rememberLmsFile = (key: string, record: SavedLmsFile): void =>
  useSavedLmsFileStore.getState().save(key, record);
const persistOnce = async (
  key: string,
  record: SavedLmsFile,
): Promise<SavedLmsFile> => {
  if (record.location === "downloads" || record.location === "app-files")
    return record;
  let saved: SavedLmsFile;
  if (native && Number(Platform.Version) >= 29)
    saved = {
      ...(await native.saveDownload(
        record.uri,
        key,
        record.fileName,
        record.contentType || "application/octet-stream",
      )),
      location: "downloads",
    };
  else {
    const folder = new Directory(Paths.document, "lms-downloads", key);
    folder.create({ intermediates: true, idempotent: true });
    const target = new File(folder, record.fileName);
    if (target.exists) target.delete();
    new File(record.uri).copy(target);
    saved = { ...record, uri: target.uri, location: "app-files" };
  }
  rememberLmsFile(key, saved);
  return saved;
};

// Browser implementation uses a same-origin CacheStorage key; never fetched on native.
export const savedFileCacheUrl = (key: string) => `lms-saved-files/${key}`;

const promotions = new Map<string, Promise<SavedLmsFile>>();
export const persistLmsDownload = (
  key: string,
  record: SavedLmsFile,
): Promise<SavedLmsFile> => {
  const existing = promotions.get(key);
  if (existing) return existing;
  const work = persistOnce(key, record).finally(() => promotions.delete(key));
  promotions.set(key, work);
  return work;
};
