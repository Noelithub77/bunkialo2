import type { AssignmentUploadLocalFile } from "@/types";
import { create } from "zustand";

interface AssignmentShareStore {
  files: AssignmentUploadLocalFile[];
  shareId: number;
  setSharedFiles: (files: AssignmentUploadLocalFile[]) => void;
  clearSharedFiles: () => void;
}

// Keep incoming files through authentication, but never persist them across accounts.
export const useAssignmentShareStore = create<AssignmentShareStore>((set) => ({
  files: [],
  shareId: 0,
  setSharedFiles: (files) =>
    set((state) => ({ files, shareId: state.shareId + 1 })),
  clearSharedFiles: () => set({ files: [] }),
}));
