import { describe, it, expect } from "bun:test";
import {
  attachmentPreviewKind,
  attachmentPreviewKey,
  withAttachmentPreviewSlot,
} from "../../../src/utils/attachment-preview";
describe("attachment previews", () => {
  it("identifies protected file URLs and scopes persisted keys to each account", () => {
    expect(
      attachmentPreviewKind(
        "MPI Part 4.pdf",
        "https://lms.example/pluginfile.php/1/a?forcedownload=1",
      ),
    ).toBe("pdf");
    expect(
      attachmentPreviewKind("photo", "https://lms.example/image.JPG?token=1"),
    ).toBe("image");
    expect(
      attachmentPreviewKind("notes.docx", "/mod/resource/view.php?id=7"),
    ).toBeNull();
    expect(attachmentPreviewKey("alice", "/a.pdf")).not.toBe(
      attachmentPreviewKey("bob", "/a.pdf"),
    );
    expect(attachmentPreviewKey("alice", "/a.pdf")).not.toBe(
      attachmentPreviewKey("alice", "/b.pdf"),
    );
  });
  it("reserves released slots for queued work and recovers after rejection", async () => {
    let active = 0,
      peak = 0;
    const completed: number[] = [];
    const jobs = Array.from({ length: 12 }, (_, index) =>
      withAttachmentPreviewSlot(async () => {
        active++;
        peak = Math.max(peak, active);
        try {
          await new Promise((resolve) => setTimeout(resolve, 2));
          if (index === 3) throw new Error("bad PDF");
          completed.push(index);
        } finally {
          active--;
        }
      }),
    );
    const results = await Promise.allSettled(jobs);
    expect(peak).toBe(2);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
    expect(completed).toHaveLength(11);
    expect(await withAttachmentPreviewSlot(async () => true)).toBe(true);
  });
});
