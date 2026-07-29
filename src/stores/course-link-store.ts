import type { CourseIdentity, ManualCourseLink } from "@/types";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { zustandStorage } from "./storage";

interface CourseLinkState {
  identities: CourseIdentity[];
  manualLinks: ManualCourseLink[];
  setIdentities: (identities: CourseIdentity[]) => void;
  setManualLink: (link: ManualCourseLink) => void;
  clearCourseLinks: () => void;
}

export const useCourseLinkStore = create<CourseLinkState>()(
  persist(
    (set) => ({
      identities: [],
      manualLinks: [],
      setIdentities: (identities) => set({ identities }),
      setManualLink: (link) =>
        set((state) => ({
          manualLinks: [
            ...state.manualLinks.filter(
              (saved) =>
                !(
                  saved.termId === link.termId &&
                  saved.attendanceCourseId === link.attendanceCourseId
                ),
            ),
            link,
          ],
          identities: state.identities.map((identity) =>
            identity.termId === link.termId &&
            identity.attendanceCourseId === link.attendanceCourseId
              ? {
                  ...identity,
                  lmsCourseId: link.lmsCourseId,
                  mappingSource: "manual",
                }
              : identity,
          ),
        })),
      clearCourseLinks: () => set({ identities: [], manualLinks: [] }),
    }),
    {
      name: "course-link-storage-sqlite-v1",
      storage: createJSONStorage(() => zustandStorage),
    },
  ),
);
