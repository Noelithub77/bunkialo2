import { Platform, Linking } from "react-native";
import { getContentUriAsync } from "expo-file-system/legacy";
import { startActivityAsync } from "expo-intent-launcher";
import { downloadLmsResourceWithSession } from "@/services/lms-download";
export const openLmsFileOutside = async (
  url: string,
  name: string,
): Promise<void> => {
  const result = await downloadLmsResourceWithSession(url, name);
  if (!result.success) throw new Error(result.message);
  if (Platform.OS === "web") return; // The cached blob is handed to the browser's Downloads UI.
  if (Platform.OS === "android") {
    const uri = result.uri.startsWith("content://")
      ? result.uri
      : await getContentUriAsync(result.uri);
    await startActivityAsync("android.intent.action.VIEW", {
      data: uri,
      type: result.contentType?.split(";")[0] || "*/*",
      flags: 1,
    });
  } else await Linking.openURL(result.uri);
};
