import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { zustandStorage } from "@/stores/storage";

type CourseFeedbackDefaults = Record<
  string,
  {
    grade: string;
    textResponse: string;
  }
>;

interface FeedbackAutofillState {
  courseDefaults: CourseFeedbackDefaults;
  setCourseDefault: (
    courseId: string,
    grade: string,
    textResponse: string,
  ) => void;
  ensureCourseDefault: (courseId: string) => void;
  setCourseDefaults: (defaults: CourseFeedbackDefaults) => void;
  clearCourseDefaults: () => void;
}

export const useFeedbackAutofillStore = create<FeedbackAutofillState>()(
  persist(
    (set) => ({
      courseDefaults: {},

      setCourseDefault: (courseId, grade, textResponse) => {
        const id = courseId.trim();
        if (!id) return;

        const normalizedGrade = /^[0-5]$/.test(grade.trim())
          ? grade.trim()
          : "3";

        set((state) => ({
          courseDefaults: {
            ...state.courseDefaults,
            [id]: {
              grade: normalizedGrade,
              textResponse,
            },
          },
        }));
      },

      ensureCourseDefault: (courseId) => {
        const id = courseId.trim();
        if (!id) return;
        set((state) => {
          const existing = state.courseDefaults[id];
          if (existing) {
            const normalizedGrade = /^[0-5]$/.test(existing.grade)
              ? existing.grade
              : "3";
            const normalizedText =
              existing.textResponse.length > 0 ? existing.textResponse : "_";

            if (
              normalizedGrade === existing.grade &&
              normalizedText === existing.textResponse
            ) {
              return state;
            }

            return {
              courseDefaults: {
                ...state.courseDefaults,
                [id]: {
                  grade: normalizedGrade,
                  textResponse: normalizedText,
                },
              },
            };
          }

          return {
            courseDefaults: {
              ...state.courseDefaults,
              [id]: { grade: "3", textResponse: "_" },
            },
          };
        });
      },

      setCourseDefaults: (defaults) => {
        const sanitized: CourseFeedbackDefaults = {};
        for (const [courseId, value] of Object.entries(defaults)) {
          const id = courseId.trim();
          if (!id) continue;
          const normalizedGrade = /^[0-5]$/.test(String(value.grade).trim())
            ? String(value.grade).trim()
            : "3";
          const normalizedText = String(value.textResponse ?? "");
          sanitized[id] = {
            grade: normalizedGrade,
            textResponse: normalizedText.length > 0 ? normalizedText : "_",
          };
        }

        set({ courseDefaults: sanitized });
      },

      clearCourseDefaults: () => set({ courseDefaults: {} }),
    }),
    {
      name: "bunkialo-feedback-autofill-storage-sqlite-v1",
      storage: createJSONStorage(() => zustandStorage),
      partialize: (state) => ({
        courseDefaults: state.courseDefaults,
      }),
    },
  ),
);
