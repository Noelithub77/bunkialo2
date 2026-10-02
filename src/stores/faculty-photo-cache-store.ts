import { create } from "zustand";

// The files are persistent; URIs are rediscovered instead of persisting an iOS
// sandbox path, which can change when a new app binary is installed.
export const useFacultyPhotoCacheStore = create<{
  photos: Record<string, string>;
}>(() => ({ photos: {} }));
