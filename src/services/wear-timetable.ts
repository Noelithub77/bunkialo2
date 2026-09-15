import WearTimetable from "../../modules/wear-timetable";
import type {
  WearTimetablePayload,
  WearTimetableSlot,
  WearTimetableSource,
} from "../../shared/wear-timetable";
import { Colors } from "@/constants/theme";
import { useBunkStore } from "@/stores/bunk-store";
import { useTimetableStore } from "@/stores/timetable-store";

export type WearSyncResult =
  | { ok: true; payload: WearTimetablePayload }
  | { ok: false; message: string };

const courseColor = (courseId: string): string => {
  const course = useBunkStore.getState().courses.find(
    (item) => item.courseId === courseId,
  );
  return course?.config?.color ?? Colors.courseColors[0];
};

const currentSlots = (includeManual: boolean): WearTimetableSlot[] =>
  useTimetableStore.getState().slots
    .filter((slot) => includeManual || !slot.isManual)
    .map((slot) => ({
    id: slot.id,
    courseId: slot.courseId,
    courseName: slot.courseName,
    courseColor: courseColor(slot.courseId),
    dayOfWeek: slot.dayOfWeek,
    startTime: slot.startTime,
    endTime: slot.endTime,
    sessionType: slot.sessionType,
  }));

export const buildWearTimetablePayload = (
  source: WearTimetableSource,
): WearTimetablePayload => ({
  version: 1,
  source,
  updatedAt: Date.now(),
  slots: source === "template" ? [] : currentSlots(source === "manual"),
});

export const syncWearTimetable = async (
  source: WearTimetableSource,
): Promise<WearSyncResult> => {
  const payload = buildWearTimetablePayload(source);
  if (!WearTimetable) {
    return {
      ok: false,
      message: "Wear sync is available in the Android app build, not Expo Go.",
    };
  }

  try {
    if (!(await WearTimetable.isAvailable())) {
      return {
        ok: false,
        message: "No Wear OS companion is available on this phone.",
      };
    }
    await WearTimetable.sendTimetable(JSON.stringify(payload));
    return { ok: true, payload };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error
        ? error.message
        : "The timetable could not be sent to Wear OS.",
    };
  }
};
