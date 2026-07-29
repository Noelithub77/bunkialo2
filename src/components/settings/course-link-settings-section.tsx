import { fetchCourses } from "@/services/lms-courses";
import { useCourseLinkStore } from "@/stores/course-link-store";
import { useAttendanceStore } from "@/stores/attendance-store";
import type { Course } from "@/types";
import { useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";

interface CourseLinkSettingsSectionProps {
  theme: {
    text: string;
    textSecondary: string;
    border: string;
    background: string;
  };
}

export function CourseLinkSettingsSection({
  theme,
}: CourseLinkSettingsSectionProps) {
  const identities = useCourseLinkStore((state) => state.identities);
  const setManualLink = useCourseLinkStore((state) => state.setManualLink);
  const [selectedAttendanceId, setSelectedAttendanceId] = useState<
    string | null
  >(null);
  const [lmsCourses, setLmsCourses] = useState<Course[]>([]);
  const linkedCourses = identities.filter(
    (identity) => identity.attendanceCourseId !== null,
  );

  const open = async (attendanceCourseId: string): Promise<void> => {
    setSelectedAttendanceId(attendanceCourseId);
    setLmsCourses(await fetchCourses());
  };

  if (linkedCourses.length === 0) return null;

  return (
    <>
      <Text
        className="mb-2 ml-1 text-xs font-semibold uppercase"
        style={{ color: theme.textSecondary }}
      >
        Course links
      </Text>
      <View
        className="mb-6 overflow-hidden rounded-xl border"
        style={{ borderColor: theme.border }}
      >
        {linkedCourses.map((identity, index) => (
          <Pressable
            key={identity.key}
            onPress={() =>
              identity.attendanceCourseId &&
              void open(identity.attendanceCourseId)
            }
            className="px-4 py-3"
            style={
              index
                ? { borderTopWidth: 1, borderTopColor: theme.border }
                : undefined
            }
          >
            <Text
              className="text-sm font-semibold"
              style={{ color: theme.text }}
            >
              {identity.code} · {identity.name}
            </Text>
            <Text className="text-xs" style={{ color: theme.textSecondary }}>
              {identity.lmsCourseId
                ? `LMS course ${identity.lmsCourseId} · ${identity.mappingSource}`
                : "Attendance only · tap to change"}
            </Text>
          </Pressable>
        ))}
      </View>
      <Modal
        visible={selectedAttendanceId !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedAttendanceId(null)}
      >
        <View className="flex-1 justify-end bg-black/50">
          <Pressable
            className="absolute inset-0"
            onPress={() => setSelectedAttendanceId(null)}
          />
          <View
            className="max-h-[70%] rounded-t-[28px] p-6"
            style={{ backgroundColor: theme.background }}
          >
            <Text
              className="mb-4 text-xl font-bold"
              style={{ color: theme.text }}
            >
              Select LMS course
            </Text>
            <Pressable
              onPress={() => {
                const identity = identities.find(
                  (item) => item.attendanceCourseId === selectedAttendanceId,
                );
                if (!identity || !selectedAttendanceId) return;
                setManualLink({
                  termId: identity.termId,
                  attendanceCourseId: selectedAttendanceId,
                  lmsCourseId: null,
                });
                useAttendanceStore.setState((state) => ({
                  courses: state.courses.map((saved) =>
                    saved.attendanceCourseId === selectedAttendanceId
                      ? { ...saved, lmsCourseId: null, mappingSource: "manual" }
                      : saved,
                  ),
                }));
                setSelectedAttendanceId(null);
              }}
              className="mb-2 rounded-xl border px-4 py-3"
              style={{ borderColor: theme.border }}
            >
              <Text
                className="text-sm font-semibold"
                style={{ color: theme.text }}
              >
                Attendance only
              </Text>
            </Pressable>
            <ScrollView>
              {lmsCourses.map((course) => (
                <Pressable
                  key={course.id}
                  onPress={() => {
                    const identity = identities.find(
                      (item) =>
                        item.attendanceCourseId === selectedAttendanceId,
                    );
                    if (!identity || !selectedAttendanceId) return;
                    setManualLink({
                      termId: identity.termId,
                      attendanceCourseId: selectedAttendanceId,
                      lmsCourseId: course.id,
                    });
                    useAttendanceStore.setState((state) => ({
                      courses: state.courses.map((saved) =>
                        saved.attendanceCourseId === selectedAttendanceId
                          ? {
                              ...saved,
                              lmsCourseId: course.id,
                              mappingSource: "manual",
                            }
                          : saved,
                      ),
                    }));
                    setSelectedAttendanceId(null);
                  }}
                  className="border-b py-4"
                  style={{ borderColor: theme.border }}
                >
                  <Text
                    className="text-sm font-semibold"
                    style={{ color: theme.text }}
                  >
                    {course.shortName ?? course.name}
                  </Text>
                  <Text
                    className="text-xs"
                    style={{ color: theme.textSecondary }}
                  >
                    {course.name}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}
