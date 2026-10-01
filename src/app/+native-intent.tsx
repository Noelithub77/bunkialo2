import { SHARED_ASSIGNMENT_ROUTE } from "@/utils/assignment-share";

export function redirectSystemPath({
  path,
}: {
  path: string;
  initial: boolean;
}) {
  // SDK 58 sharing wakes iOS through expo-sharing; preserve older dataUrl links.
  // The incoming-share hook retrieves the native file payloads.
  if (
    path.startsWith("bunkialo://dataUrl=") ||
    path.startsWith("bunkialo://expo-sharing")
  )
    return SHARED_ASSIGNMENT_ROUTE;
  return path;
}
