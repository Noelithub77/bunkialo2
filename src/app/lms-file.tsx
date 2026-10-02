import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Image } from "expo-image";
import { AttachmentZoom } from "@/components/lms/attachment-zoom";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { Container } from "@/components/ui/container";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useLmsAttachmentScope } from "@/hooks/use-lms-attachment-scope";
import { downloadLmsResourceWithSession } from "@/services/lms-download";
import {
  createPdfPagePreview,
  getPdfAttachmentDocument,
} from "@/services/attachment-preview";
import { openLmsFileOutside } from "@/services/open-lms-file";
import { Toast } from "@/components/shared/ui/molecules/toast";
import type { AttachmentPreview } from "@/types";
function PdfPage({
  url,
  name,
  scope,
  index,
  onZoom,
}: {
  url: string;
  name: string;
  scope: string;
  index: number;
  onZoom: (uri: string) => void;
}) {
  const [page, setPage] = useState<AttachmentPreview | null>(null),
    [failed, setFailed] = useState(false),
    [retry, setRetry] = useState(0);
  const { width } = useWindowDimensions();
  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    void createPdfPagePreview(url, name, scope, index, 1200).then((result) => {
      if (!cancelled) {
        setPage(result);
        setFailed(!result);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [url, name, scope, index, retry]);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        page ? `Zoom page ${index + 1}` : `Retry page ${index + 1}`
      }
      onPress={() => (page ? onZoom(page.uri) : setRetry((n) => n + 1))}
      className="mx-3 mb-3 overflow-hidden rounded-lg bg-white"
      style={{
        height: page
          ? ((width - 24) * page.height) / page.width
          : (width - 24) * 1.4,
      }}
    >
      {page ? (
        <Image
          source={{ uri: page.uri }}
          contentFit="contain"
          style={{ width: "100%", height: "100%" }}
        />
      ) : (
        <View className="flex-1 items-center justify-center">
          {failed ? (
            <Ionicons name="refresh" size={25} color="#777" />
          ) : (
            <ActivityIndicator color="#777" />
          )}
        </View>
      )}
    </Pressable>
  );
}
export default function LmsFileScreen() {
  const {
    url = "",
    name = "File",
    kind = "pdf",
  } = useLocalSearchParams<{ url: string; name: string; kind: string }>();
  const scope = useLmsAttachmentScope();
  const theme = useColorScheme() === "dark" ? Colors.dark : Colors.light;
  const [count, setCount] = useState(0),
    [error, setError] = useState(""),
    [image, setImage] = useState(""),
    [zoom, setZoom] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    if (scope === null) return;
    let cancelled = false;
    void (async () => {
      const saved = await downloadLmsResourceWithSession(url, name, {
        destination: Platform.OS === "web" ? "preview-cache" : "downloads",
      });
      if (!saved.success) throw new Error(saved.message);
      if (kind === "pdf") {
        const doc = await getPdfAttachmentDocument(url, name, scope);
        if (!cancelled) setCount(doc.pageCount);
      } else if (!cancelled) setImage(saved.uri);
    })().catch((err) => {
      if (!cancelled)
        setError(err instanceof Error ? err.message : "Could not open file");
    });
    return () => {
      cancelled = true;
    };
  }, [url, name, kind, scope]);
  const outside = useCallback(async () => {
    setBusy(true);
    try {
      await openLmsFileOutside(url, name);
    } catch (err) {
      Toast.show(err instanceof Error ? err.message : "Could not open file", {
        type: "error",
      });
    } finally {
      setBusy(false);
    }
  }, [url, name]);
  return (
    <Container>
      <View className="min-h-16 flex-row items-center gap-3 px-3 py-2">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => router.back()}
          className="h-11 w-11 items-center justify-center"
        >
          <Ionicons name="arrow-back" size={23} color={theme.text} />
        </Pressable>
        <Text
          className="flex-1 text-[14px] font-semibold"
          numberOfLines={2}
          style={{ color: theme.text }}
        >
          {name}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open outside"
          onPress={() => void outside()}
          disabled={busy}
          className="min-h-11 flex-row items-center gap-1.5 px-2"
        >
          <Text className="text-[12px]" style={{ color: theme.textSecondary }}>
            Open outside
          </Text>
          {busy ? (
            <ActivityIndicator size="small" />
          ) : (
            <Ionicons
              name="open-outline"
              size={17}
              color={theme.textSecondary}
            />
          )}
        </Pressable>
      </View>
      {error ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text style={{ color: theme.textSecondary }}>{error}</Text>
        </View>
      ) : kind === "pdf" && count > 0 ? (
        <FlatList
          data={Array.from({ length: count }, (_, i) => i)}
          keyExtractor={String}
          initialNumToRender={2}
          maxToRenderPerBatch={2}
          windowSize={3}
          renderItem={({ item }) => (
            <PdfPage
              url={url}
              name={name}
              scope={scope || ""}
              index={item}
              onZoom={setZoom}
            />
          )}
          ListFooterComponent={
            <Text
              className="mb-4 text-center text-xs"
              style={{ color: theme.textSecondary }}
            >
              {count} {count === 1 ? "page" : "pages"}
            </Text>
          }
        />
      ) : image ? (
        <Pressable className="flex-1" onPress={() => setZoom(image)}>
          <Image
            source={{ uri: image }}
            contentFit="contain"
            style={{ width: "100%", height: "100%" }}
          />
        </Pressable>
      ) : (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={theme.textSecondary} />
        </View>
      )}
      {zoom !== "" && <AttachmentZoom uri={zoom} onClose={() => setZoom("")} />}
    </Container>
  );
}
