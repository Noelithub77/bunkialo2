import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Container } from "@/components/ui/container";
import { LmsAttachmentCard } from "@/components/lms/attachment-card";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useLmsAttachmentScope } from "@/hooks/use-lms-attachment-scope";
import { useLmsForumStore } from "@/stores/lms-forum-store";
import { fetchLmsForumHtml } from "@/services/lms-forum";
import { getCurrentBaseUrl } from "@/services/api";
import { parseLmsDiscussions, parseLmsForumPosts } from "@/utils/lms-forum";
export default function LmsForumScreen() {
  const {
    url = "",
    title = "Announcements",
    color = "#A78BFA",
  } = useLocalSearchParams<{ url: string; title: string; color: string }>();
  const [selected, setSelected] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [scroll, setScroll] = useState(0);
  const target = selected || url,
    scope = useLmsAttachmentScope(),
    key = `${scope}:${target}`;
  const page = useLmsForumStore((state) =>
    scope === null ? undefined : state.pages[key],
  );
  const save = useLmsForumStore((state) => state.save);
  const theme = useColorScheme() === "dark" ? Colors.dark : Colors.light;
  const discussions = useMemo(
    () => parseLmsDiscussions(page?.html || "", getCurrentBaseUrl()),
    [page?.html],
  );
  const posts = useMemo(
    () => parseLmsForumPosts(page?.html || "", getCurrentBaseUrl()),
    [page?.html],
  );
  useEffect(() => {
    if (scope === null) return;
    let cancelled = false;
    if (page && Date.now() - page.fetchedAt < 5 * 60 * 1000) return;
    setBusy(true);
    setError("");
    void fetchLmsForumHtml(target)
      .then((html) => {
        if (!cancelled) save(key, html);
      })
      .catch((err) => {
        if (!cancelled)
          setError(
            err instanceof Error ? err.message : "Could not load announcements",
          );
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [key, page, save, target, scope]);
  return (
    <Container>
      <View className="min-h-16 flex-row items-center gap-3 px-3 py-2">
        <Pressable
          accessibilityLabel="Back"
          onPress={() => (selected ? setSelected(null) : router.back())}
          className="h-11 w-11 items-center justify-center"
        >
          <Ionicons name="arrow-back" size={23} color={theme.text} />
        </Pressable>
        <Text
          numberOfLines={2}
          className="flex-1 text-lg font-semibold"
          style={{ color: theme.text }}
        >
          {title}
        </Text>
        <Pressable
          accessibilityLabel="Open forum in LMS"
          onPress={() => void Linking.openURL(target)}
          className="min-h-11 flex-row items-center gap-1 px-2"
        >
          <Text style={{ color: theme.textSecondary }}>LMS</Text>
          <Ionicons name="open-outline" size={17} color={theme.textSecondary} />
        </Pressable>
      </View>
      <ScrollView
        contentContainerClassName="gap-3 px-4 pb-8"
        onScroll={(event) => setScroll(event.nativeEvent.contentOffset.y)}
        scrollEventThrottle={100}
      >
        {busy && !page && <ActivityIndicator color={color} />}
        {error !== "" && (
          <Text style={{ color: theme.textSecondary }}>{error}</Text>
        )}
        {posts.length > 0
          ? posts.map((post) => (
              <View
                key={post.id}
                className="gap-3 rounded-2xl p-4"
                style={{ backgroundColor: theme.backgroundSecondary }}
              >
                <Text
                  className="text-base font-semibold"
                  style={{ color: theme.text }}
                >
                  {post.title}
                </Text>
                <View className="flex-row items-center justify-between gap-2">
                  <Text
                    className="flex-1 text-xs"
                    style={{ color: theme.textSecondary }}
                  >
                    {post.author}
                  </Text>
                  {post.date && (
                    <Text
                      className="text-xs"
                      style={{ color: theme.textSecondary }}
                    >
                      {new Date(post.date).toLocaleDateString(undefined, {
                        day: "numeric",
                        month: "short",
                      })}
                    </Text>
                  )}
                </View>
                {post.body !== "" && (
                  <Text
                    className="text-sm leading-6"
                    style={{ color: theme.text }}
                  >
                    {post.body}
                  </Text>
                )}
                {post.attachments.map((file) => (
                  <LmsAttachmentCard
                    key={file.id}
                    attachment={file}
                    color={color}
                    scrollOffset={scroll}
                  />
                ))}
              </View>
            ))
          : discussions.map((discussion) => (
              <Pressable
                key={discussion.id}
                accessibilityRole="button"
                onPress={() => {
                  setSelected(discussion.url);
                  setScroll(0);
                }}
                className="min-h-16 flex-row items-center gap-3 rounded-2xl p-4"
                style={{ backgroundColor: theme.backgroundSecondary }}
              >
                <Ionicons name="megaphone-outline" size={21} color={color} />
                <Text
                  className="flex-1 text-sm font-medium"
                  style={{ color: theme.text }}
                >
                  {discussion.title}
                </Text>
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={theme.textSecondary}
                />
              </Pressable>
            ))}
        {!busy && page && posts.length === 0 && discussions.length === 0 && (
          <Text
            className="py-8 text-center"
            style={{ color: theme.textSecondary }}
          >
            No announcements
          </Text>
        )}
      </ScrollView>
    </Container>
  );
}
