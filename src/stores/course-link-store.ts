import type { CourseIdentity } from "@/types";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { zustandStorage } from "./storage";

interface CourseLinkState {
  identities: CourseIdentity[];
  setIdentities: (identities: CourseIdentity[]) => void;
  clearCourseLinks: () => void;
}

export const useCourseLinkStore = create<CourseLinkState>()(
  persist(
    (set) => ({
      identities: [],
      setIdentities: (identities) => set({ identities }),
      clearCourseLinks: () => set({ identities: [] }),
    }),
    {
      name: "course-link-storage-sqlite-v2",
      storage: createJSONStorage(() => zustandStorage),
    },
  ),
);
