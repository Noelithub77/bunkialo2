import { downloadLmsResourceWithSession } from "@/services/lms-download";
import type {
  DownloadQueueItem,
  DownloadQueueItemStatus,
  DownloadQueueState,
  LmsCourseResourcesTree,
  LmsResourceFileNode,
  LmsResourceItemNode,
} from "@/types";
import { create } from "zustand";

const generateId = () =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const MAX_CONCURRENT = 2;

interface DownloadQueueActions {
  /** Add a single URL to the download queue. */
  enqueue: (params: {
    url: string;
    fileName: string;
    courseId: string;
    courseName: string;
  }) => void;

  /** Add all downloadable resources from a course tree. */
  enqueueAllFromCourse: (tree: LmsCourseResourcesTree) => number;

  /** Remove a single item from the queue. */
  remove: (id: string) => void;

  /** Retry a failed download. */
  retry: (id: string) => void;

  /** Clear completed and failed items. */
  clearFinished: () => void;

  /** Clear the entire queue. */
  clearAll: () => void;
}

type DownloadQueueStore = DownloadQueueState & DownloadQueueActions;

/** Internal: process the queue, downloading up to maxConcurrent items. */
const processQueue = () => {
  const state = useDownloadQueueStore.getState();
  const activeCount = state.items.filter(
    (item) => item.status === "downloading",
  ).length;
  const slotsAvailable = state.maxConcurrent - activeCount;
  if (slotsAvailable <= 0) return;

  const pendingItems = state.items.filter(
    (item) => item.status === "pending",
  );
  const toStart = pendingItems.slice(0, slotsAvailable);

  for (const item of toStart) {
    void downloadItem(item.id);
  }
};

/** Internal: download a single queue item. */
const downloadItem = async (itemId: string) => {
  const store = useDownloadQueueStore;
  const item = store.getState().items.find((i) => i.id === itemId);
  if (!item || item.status !== "pending") return;

  // Mark as downloading
  store.setState((state) => ({
    items: state.items.map((i) =>
      i.id === itemId ? { ...i, status: "downloading" as const, error: null } : i,
    ),
  }));

  const result = await downloadLmsResourceWithSession(
    item.url,
    item.fileName,
    {
      onProgress: (progress) => {
        store.setState((state) => ({
          items: state.items.map((i) =>
            i.id === itemId ? { ...i, progress: progress.fraction } : i,
          ),
        }));
      },
    },
  );

  if (result.success) {
    store.setState((state) => ({
      items: state.items.map((i) =>
        i.id === itemId
          ? {
              ...i,
              status: "completed" as const,
              progress: 1,
              localUri: result.uri,
              contentType: result.contentType,
              completedAt: Date.now(),
            }
          : i,
      ),
    }));
  } else {
    store.setState((state) => ({
      items: state.items.map((i) =>
        i.id === itemId
          ? {
              ...i,
              status: "failed" as const,
              error: result.message,
              progress: null,
            }
          : i,
      ),
    }));
  }

  // Process next in queue
  processQueue();
};

/** Collect all downloadable URLs from a course resource tree. */
const collectDownloadableUrls = (
  tree: LmsCourseResourcesTree,
): { url: string; fileName: string }[] => {
  const results: { url: string; fileName: string }[] = [];

  for (const section of tree.sections) {
    for (const item of section.items) {
      if (item.moduleType === "resource") {
        results.push({ url: item.url, fileName: item.title });
      }
      if (item.moduleType === "folder" && item.children.length > 0) {
        for (const child of item.children) {
          results.push({ url: child.url, fileName: child.name });
        }
      }
    }
  }

  return results;
};

export const useDownloadQueueStore = create<DownloadQueueStore>((set, get) => ({
  items: [],
  maxConcurrent: MAX_CONCURRENT,

  enqueue: (params) => {
    // Skip if already in queue (same URL, not failed)
    const existing = get().items.find(
      (i) => i.url === params.url && i.status !== "failed",
    );
    if (existing) return;

    const newItem: DownloadQueueItem = {
      id: generateId(),
      url: params.url,
      fileName: params.fileName,
      courseId: params.courseId,
      courseName: params.courseName,
      status: "pending",
      progress: null,
      error: null,
      localUri: null,
      contentType: null,
      addedAt: Date.now(),
      completedAt: null,
    };

    set((state) => ({
      items: [...state.items, newItem],
    }));

    processQueue();
  },

  enqueueAllFromCourse: (tree) => {
    const downloadables = collectDownloadableUrls(tree);
    const existingUrls = new Set(
      get()
        .items.filter((i) => i.status !== "failed")
        .map((i) => i.url),
    );

    const newItems: DownloadQueueItem[] = downloadables
      .filter((d) => !existingUrls.has(d.url))
      .map((d) => ({
        id: generateId(),
        url: d.url,
        fileName: d.fileName,
        courseId: tree.courseId,
        courseName: tree.courseTitle,
        status: "pending" as const,
        progress: null,
        error: null,
        localUri: null,
        contentType: null,
        addedAt: Date.now(),
        completedAt: null,
      }));

    if (newItems.length === 0) return 0;

    set((state) => ({
      items: [...state.items, ...newItems],
    }));

    processQueue();
    return newItems.length;
  },

  remove: (id) => {
    set((state) => ({
      items: state.items.filter((i) => i.id !== id),
    }));
  },

  retry: (id) => {
    set((state) => ({
      items: state.items.map((i) =>
        i.id === id
          ? {
              ...i,
              status: "pending" as const,
              error: null,
              progress: null,
              localUri: null,
              completedAt: null,
            }
          : i,
      ),
    }));
    processQueue();
  },

  clearFinished: () => {
    set((state) => ({
      items: state.items.filter(
        (i) => i.status !== "completed" && i.status !== "failed",
      ),
    }));
  },

  clearAll: () => {
    set({ items: [] });
  },
}));

// Selectors
export const selectQueueStats = (items: DownloadQueueItem[]) => {
  const pending = items.filter((i) => i.status === "pending").length;
  const downloading = items.filter((i) => i.status === "downloading").length;
  const completed = items.filter((i) => i.status === "completed").length;
  const failed = items.filter((i) => i.status === "failed").length;
  const total = items.length;

  const totalProgress =
    total > 0
      ? items.reduce((sum, i) => {
          if (i.status === "completed") return sum + 1;
          if (i.status === "downloading" && i.progress !== null)
            return sum + i.progress;
          return sum;
        }, 0) / total
      : 0;

  return { pending, downloading, completed, failed, total, totalProgress };
};
