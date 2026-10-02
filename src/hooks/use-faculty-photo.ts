import { useEffect, useState } from "react";
import { AppState } from "react-native";
import { faculties } from "@/data/faculty";
import { hostelGroups } from "@/data/hostels";
import {
  cacheFacultyPhoto,
  getCachedFacultyPhoto,
} from "@/services/faculty-photo-cache";
import { useFacultyPhotoCacheStore } from "@/stores/faculty-photo-cache-store";
import { facultyPhotoQueue } from "@/utils/faculty-photo-cache";

let running = false;
let complete = false;

const cachePhotos = async (): Promise<void> => {
  if (running || complete) return;
  running = true;
  let allCached = true;
  try {
    for (const url of facultyPhotoQueue(faculties, hostelGroups)) {
      if (
        AppState.currentState !== "active" &&
        AppState.currentState !== null
      ) {
        allCached = false;
        break;
      }
      if (useFacultyPhotoCacheStore.getState().photos[url]) continue;
      const uri = await cacheFacultyPhoto(url);
      if (uri)
        useFacultyPhotoCacheStore.setState((state) => ({
          photos: { ...state.photos, [url]: uri },
        }));
      else allCached = false;
    }
    complete = allCached;
  } finally {
    running = false;
  }
};

export const useFacultyPhotoCaching = (): void => {
  useEffect(() => {
    // Never hold up startup or scrolling; download one image at a time.
    const start = () => {
      void cachePhotos();
    };
    const timer = setTimeout(start, 2000);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") start();
    });
    return () => {
      clearTimeout(timer);
      subscription.remove();
    };
  }, []);
};

export const useFacultyPhoto = (url?: string | null): string | undefined => {
  const local = useFacultyPhotoCacheStore((state) =>
    url ? state.photos[url] : undefined,
  );
  const [checkedUrl, setCheckedUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!url || local) return;
    let active = true;
    void getCachedFacultyPhoto(url)
      .then((uri) => {
        if (!active) return;
        if (uri)
          useFacultyPhotoCacheStore.setState((state) => ({
            photos: { ...state.photos, [url]: uri },
          }));
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setCheckedUrl(url);
      });
    return () => {
      active = false;
    };
  }, [url, local]);
  // Check persistent storage before allowing any remote image request.
  return local ?? (checkedUrl === url ? (url ?? undefined) : undefined);
};
