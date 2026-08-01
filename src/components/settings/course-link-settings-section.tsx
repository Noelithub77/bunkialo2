import { useCourseLinkStore } from "@/stores/course-link-store";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { LayoutAnimation, Pressable, Text, View } from "react-native";

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
  const [expanded, setExpanded] = useState(false);
  const linkedCourses = identities.filter(
    (identity) => identity.attendanceCourseId !== null,
  );

  if (linkedCourses.length === 0) return null;

  const toggleExpanded = (): void => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((value) => !value);
  };

  return (
    <View className="mb-3">
      <Pressable
        onPress={toggleExpanded}
        className="mb-2 ml-1 flex-row items-center gap-1"
        accessibilityRole="button"
        accessibilityState={{ expanded }}
      >
        <Ionicons
          name={expanded ? "chevron-down" : "chevron-forward"}
          size={14}
          color={theme.textSecondary}
        />
        <Text
          className="text-xs font-semibold uppercase"
          style={{ color: theme.textSecondary }}
        >
          Course links
        </Text>
      </Pressable>

      {expanded && (
        <View
          className="overflow-hidden rounded-xl border"
          style={{
            borderColor: theme.border,
            backgroundColor: theme.background,
          }}
        >
          {linkedCourses.map((identity, index) => (
            <View
              key={identity.key}
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
                  ? "Automatically matched to LMS"
                  : "Attendance only · no close LMS match"}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
