import { SHARED_ASSIGNMENT_ROUTE } from "@/utils/assignment-share";

export function redirectSystemPath({
  path,
}: {
  path: string;
  initial: boolean;
}) {
  // iOS uses a dataUrl deep link to wake the app after its share extension runs.
  // The share-intent hook reads the original URL and retrieves the shared files.
  if (path.startsWith("bunkialo://dataUrl=")) return SHARED_ASSIGNMENT_ROUTE;
  return path;
}
