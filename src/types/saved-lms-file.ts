export interface SavedLmsFile {
  uri: string;
  fileName: string;
  contentType: string | null;
  downloadedAt: number;
  location: "preview-cache" | "app-files" | "downloads" | "browser-cache";
}
