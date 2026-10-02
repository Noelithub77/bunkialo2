import { useEffect, useRef, useState, type ComponentRef } from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useLmsAttachmentScope } from "@/hooks/use-lms-attachment-scope";
import { useSavedLmsFileStore } from "@/stores/saved-lms-file-store";
import { getCurrentBaseUrl } from "@/services/api";
import { lookupSavedLmsFile } from "@/services/saved-lms-files";
import { downloadLmsResourceWithSession } from "@/services/lms-download";
import {
  createAttachmentPreview,
  pdfAttachmentPreviewsSupported,
} from "@/services/attachment-preview";
import { openLmsFileOutside } from "@/services/open-lms-file";
import {
  attachmentPreviewKind,
  attachmentPreviewKey,
} from "@/utils/attachment-preview";
import { Toast } from "@/components/shared/ui/molecules/toast";
import type { AttachmentPreview, LmsAttachment } from "@/types";
export function LmsAttachmentCard({
  attachment,
  color,
  scrollOffset = 0,
  previewHeight = 220,
  kindHint,
}: {
  attachment: LmsAttachment;
  color: string;
  scrollOffset?: number;
  previewHeight?: number;
  kindHint?: "pdf" | "image";
}) {
  const theme = useColorScheme() === "dark" ? Colors.dark : Colors.light;
  const scope = useLmsAttachmentScope();
  const kind =
    kindHint || attachmentPreviewKind(attachment.name, attachment.url);
  const absoluteUrl = new URL(attachment.url, getCurrentBaseUrl()).href;
  const key = attachmentPreviewKey(scope || "", absoluteUrl);
  const saved = useSavedLmsFileStore((state) => state.records[key]);
  const [preview, setPreview] = useState<AttachmentPreview | null>(null),
    [busy, setBusy] = useState(false);
  const [top, setTop] = useState<number | null>(null);
  const ref = useRef<ComponentRef<typeof View>>(null);
  const { height } = useWindowDimensions();
  const requested = useRef(false);
  useEffect(() => {
    if (scope !== null) void lookupSavedLmsFile(key);
  }, [key, scope]);
  useEffect(() => {
    const frame = requestAnimationFrame(() =>
      ref.current?.measureInWindow((_x, y) => setTop(y + scrollOffset)),
    );
    return () => cancelAnimationFrame(frame);
  }, [attachment.url]);
  const visible =
    top !== null &&
    top - scrollOffset <= height + 250 &&
    top - scrollOffset >= -previewHeight - 250;
  useEffect(() => {
    if (requested.current || !visible || scope === null) return;
    if (!kind || (kind === "pdf" && !pdfAttachmentPreviewsSupported)) return;
    requested.current = true;
    let cancelled = false;
    void (async () => {
      if (kind === "pdf") {
        const result = await createAttachmentPreview(
          absoluteUrl,
          attachment.name,
          scope,
        );
        if (!cancelled) setPreview(result);
      } else {
        const result = await downloadLmsResourceWithSession(
          absoluteUrl,
          attachment.name,
          { destination: "preview-cache", maxBytes: 25 * 1024 * 1024 },
        );
        if (result.success && !cancelled)
          setPreview({
            uri: result.uri,
            width: 640,
            height: 480,
            updatedAt: Date.now(),
          });
      }
    })();
    return () => {
      cancelled = true;
      requested.current = false;
    };
  }, [
    absoluteUrl,
    attachment.name,
    height,
    kind,
    previewHeight,
    scope,
    visible,
  ]);
  const open = async () => {
    if (busy) return;
    if (
      kind === "image" ||
      (kind === "pdf" && pdfAttachmentPreviewsSupported)
    ) {
      router.push({
        pathname: "/lms-file",
        params: { url: absoluteUrl, name: attachment.name, kind: kind, color },
      });
      return;
    }
    setBusy(true);
    try {
      await openLmsFileOutside(absoluteUrl, attachment.name);
    } catch (error) {
      Toast.show(
        error instanceof Error ? error.message : "Could not open file",
        { type: "error" },
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <View
      ref={ref}
      onLayout={() =>
        ref.current?.measureInWindow((_x, y) => setTop(y + scrollOffset))
      }
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open ${attachment.name}`}
        onPress={() => void open()}
        className="overflow-hidden rounded-2xl border"
        style={{
          backgroundColor: theme.backgroundSecondary,
          borderColor: theme.border,
        }}
      >
        {preview && (
          <View
            className="overflow-hidden border-b bg-white"
            style={{ height: previewHeight, borderColor: theme.border }}
          >
            <Image
              source={{ uri: preview.uri }}
              contentFit={kind === "pdf" ? "cover" : "contain"}
              contentPosition="top"
              style={{ width: "100%", height: "100%" }}
              alt={`${attachment.name} first page preview`}
              accessibilityLabel={`${attachment.name} first page preview`}
            />
          </View>
        )}
        <View className="min-h-16 flex-row items-center gap-3 px-3.5 py-3">
          <View
            className="h-9 w-9 items-center justify-center rounded-xl"
            style={{ backgroundColor: `${color}18` }}
          >
            <Ionicons
              name={
                kind === "image" ? "image-outline" : "document-text-outline"
              }
              size={20}
              color={color}
            />
          </View>
          <Text
            className="flex-1 text-[13px] font-medium leading-5"
            style={{ color: theme.text }}
            numberOfLines={2}
          >
            {attachment.name}
          </Text>
          {busy ? (
            <ActivityIndicator color={color} />
          ) : (
            <Ionicons
              name={
                saved && saved.location !== "preview-cache"
                  ? "checkmark-circle-outline"
                  : "open-outline"
              }
              size={19}
              color={
                saved && saved.location !== "preview-cache"
                  ? color
                  : theme.textSecondary
              }
            />
          )}
        </View>
      </Pressable>
    </View>
  );
}
