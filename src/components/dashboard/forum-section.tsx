import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import {
  selectRecentDiscussions,
  useForumStore,
} from "@/stores/forum-store";
import type { ForumDiscussionWithCourse } from "@/types";
import { Ionicons } from "@expo/vector-icons";
import { formatDistanceToNowStrict } from "date-fns";
import { Linking } from "react-native";
import { Pressable, Text, View } from "react-native";
import { getCurrentBaseUrl } from "@/services/api";

const formatTimeAgo = (unixSeconds: number): string => {
  try {
    return formatDistanceToNowStrict(new Date(unixSeconds * 1000), {
      addSuffix: true,
    });
  } catch {
    return "";
  }
};

function ForumDiscussionCard({
  discussion,
}: {
  discussion: ForumDiscussionWithCourse;
}) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = isDark ? Colors.dark : Colors.light;

  const handlePress = () => {
    const baseUrl = getCurrentBaseUrl();
    const url = `${baseUrl}/mod/forum/discuss.php?d=${discussion.id}`;
    void Linking.openURL(url);
  };

  return (
    <Pressable
      onPress={handlePress}
      className="rounded-2xl border px-3.5 py-3"
      style={{
        backgroundColor: theme.backgroundSecondary,
        borderColor: theme.border,
      }}
    >
      <View className="flex-row items-start gap-2.5">
        <View
          className="mt-0.5 h-8 w-8 items-center justify-center rounded-full"
          style={{
            backgroundColor: isDark ? "rgba(99,102,241,0.15)" : "rgba(99,102,241,0.1)",
          }}
        >
          <Ionicons
            name="chatbubbles-outline"
            size={15}
            color={isDark ? "#818cf8" : "#6366f1"}
          />
        </View>

        <View className="flex-1">
          <Text
            className="text-[13px] font-semibold"
            style={{ color: theme.text }}
            numberOfLines={2}
          >
            {discussion.subject || discussion.name}
          </Text>

          <View className="mt-1 flex-row items-center gap-1.5">
            <Text
              className="text-[11px]"
              style={{ color: theme.textSecondary }}
              numberOfLines={1}
            >
              {discussion.courseName}
            </Text>
            <Text className="text-[9px]" style={{ color: theme.textSecondary }}>
              ·
            </Text>
            <Text
              className="text-[11px]"
              style={{ color: theme.textSecondary }}
            >
              {formatTimeAgo(discussion.timemodified)}
            </Text>
          </View>

          {discussion.numreplies > 0 && (
            <View className="mt-1.5 flex-row items-center gap-1">
              <Ionicons
                name="return-down-forward-outline"
                size={11}
                color={theme.textSecondary}
              />
              <Text
                className="text-[10px]"
                style={{ color: theme.textSecondary }}
              >
                {discussion.numreplies}{" "}
                {discussion.numreplies === 1 ? "reply" : "replies"}
              </Text>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}

export function ForumSection() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = isDark ? Colors.dark : Colors.light;

  const discussions = useForumStore((state) => state.discussions);
  const isLoading = useForumStore((state) => state.isLoading);
  const recentDiscussions = selectRecentDiscussions(discussions, 7);

  if (recentDiscussions.length === 0 && !isLoading) {
    return null;
  }

  // Show max 5 in the dashboard
  const displayDiscussions = recentDiscussions.slice(0, 5);

  return (
    <View className="mb-6">
      <View className="mb-3 flex-row items-center gap-2">
        <Ionicons
          name="chatbubbles-outline"
          size={16}
          color={theme.textSecondary}
        />
        <Text
          className="text-lg font-bold tracking-tight"
          style={{ color: theme.text }}
        >
          Forum Activity
        </Text>
        {recentDiscussions.length > 5 && (
          <View
            className="rounded-full px-2 py-0.5"
            style={{
              backgroundColor: isDark
                ? Colors.gray[800]
                : Colors.gray[200],
            }}
          >
            <Text
              className="text-[10px] font-semibold"
              style={{ color: theme.textSecondary }}
            >
              +{recentDiscussions.length - 5} more
            </Text>
          </View>
        )}
      </View>

      <View className="gap-2">
        {displayDiscussions.map((discussion) => (
          <ForumDiscussionCard
            key={`${discussion.id}-${discussion.timemodified}`}
            discussion={discussion}
          />
        ))}
      </View>
    </View>
  );
}
