import * as FileSystem from "expo-file-system/legacy";
import {
  createFacultyPhotoCache,
  facultyPhotoKey,
} from "@/utils/faculty-photo-cache";

// Documents survives restarts and app updates. Recompute its path each launch:
// iOS can move the sandbox when installing a new binary.
const directory = FileSystem.documentDirectory
  ? `${FileSystem.documentDirectory}faculty-photos-v1/`
  : null;

export const cacheFacultyPhoto = createFacultyPhotoCache({
  directory,
  exists: async (path) => {
    const info = await FileSystem.getInfoAsync(path);
    return info.exists && !info.isDirectory && info.size > 0;
  },
  prepareDirectory: async () => {
    if (directory)
      await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
  },
  remove: (path) => FileSystem.deleteAsync(path, { idempotent: true }),
  move: (from, to) => FileSystem.moveAsync({ from, to }),
  download: async (url, path) => {
    const download = FileSystem.createDownloadResumable(url, path);
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const result = await Promise.race([
        download.downloadAsync(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            void download
              .pauseAsync()
              .finally(() => reject(new Error("Photo download timed out")))
              .catch(() => undefined);
          }, 15000);
        }),
      ]);
      if (!result || result.status !== 200) return false;
      const headers = Object.fromEntries(
        Object.entries(result.headers).map(([key, value]) => [
          key.toLowerCase(),
          value,
        ]),
      );
      const info = await FileSystem.getInfoAsync(path);
      return Boolean(
        headers["content-type"]?.toLowerCase().startsWith("image/") &&
        info.exists &&
        !info.isDirectory &&
        info.size > 0,
      );
    } finally {
      if (timer) clearTimeout(timer);
    }
  },
});

export const getCachedFacultyPhoto = async (
  url: string,
): Promise<string | undefined> => {
  if (!directory) return undefined;
  const path = `${directory}${facultyPhotoKey(url)}.img`;
  const info = await FileSystem.getInfoAsync(path);
  return info.exists && !info.isDirectory && info.size > 0 ? path : undefined;
};
