import { facultyPhotoKey } from "@/utils/faculty-photo-cache";

// Cache Storage persists across browser restarts. When the source disallows
// CORS, leave rendering to the browser rather than storing an unreadable image.
export const cacheFacultyPhoto = async (
  url: string,
): Promise<string | undefined> => {
  if (typeof caches === "undefined") return undefined;
  try {
    const cache = await caches.open("faculty-photos-v1");
    const key = new URL(
      `/faculty-photo-cache/${facultyPhotoKey(url)}`,
      location.origin,
    ).href;
    let response = await cache.match(key);
    if (!response) {
      response = await fetch(url);
      if (
        !response.ok ||
        !response.headers.get("content-type")?.startsWith("image/")
      )
        return undefined;
      await cache.put(key, response.clone());
    }
    return URL.createObjectURL(await response.blob());
  } catch {
    return undefined;
  }
};

export const getCachedFacultyPhoto = async (
  url: string,
): Promise<string | undefined> => {
  if (typeof caches === "undefined") return undefined;
  const cache = await caches.open("faculty-photos-v1");
  const key = new URL(
    `/faculty-photo-cache/${facultyPhotoKey(url)}`,
    location.origin,
  ).href;
  const response = await cache.match(key);
  return response ? URL.createObjectURL(await response.blob()) : undefined;
};
