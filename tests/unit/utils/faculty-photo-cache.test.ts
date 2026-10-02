import { describe, expect, test } from "bun:test";
import { faculties } from "@/data/faculty";
import { hostelGroups } from "@/data/hostels";
import {
  createFacultyPhotoCache,
  facultyPhotoQueue,
} from "@/utils/faculty-photo-cache";
import type { FacultyPhotoStorage } from "@/types";

const fixture = () => {
  const files = new Set<string>();
  let downloads = 0;
  let valid = true;
  const storage: FacultyPhotoStorage = {
    directory: "file:///documents/faculty-photos-v1/",
    exists: async (path) => files.has(path),
    prepareDirectory: async () => {},
    remove: async (path) => {
      files.delete(path);
    },
    move: async (from, to) => {
      files.delete(from);
      files.add(to);
    },
    download: async (_, path) => {
      downloads++;
      files.add(path);
      return valid;
    },
  };
  return {
    files,
    storage,
    count: () => downloads,
    fail: () => {
      valid = false;
    },
    recover: () => {
      valid = true;
    },
  };
};

describe("persistent faculty photos", () => {
  test("default wardens are first and every unique photo is queued", () => {
    const queue = facultyPhotoQueue(faculties, hostelGroups);
    const defaultIds = hostelGroups.find((h) => h.id === "manimala")!.wardenIds;
    expect(queue.slice(0, defaultIds.length)).toEqual(
      defaultIds.map((id) => faculties.find((f) => f.id === id)!.imageUrl!),
    );
    expect(new Set(queue)).toEqual(
      new Set(faculties.map((f) => f.imageUrl).filter(Boolean) as string[]),
    );
  });
  test("concurrent requests download once, then reuse the file after a restart", async () => {
    const f = fixture();
    const cache = createFacultyPhotoCache(f.storage);
    const [first, second] = await Promise.all([
      cache("https://example.com/a.jpg"),
      cache("https://example.com/a.jpg"),
    ]);
    expect(first).toBe(second);
    expect(first).toStartWith("file:///documents/");
    expect(f.count()).toBe(1);
    expect(
      await createFacultyPhotoCache(f.storage)("https://example.com/a.jpg"),
    ).toBe(first);
    expect(f.count()).toBe(1);
  });
  test("invalid or interrupted downloads never become cached and can be retried", async () => {
    const f = fixture();
    f.fail();
    const cache = createFacultyPhotoCache(f.storage);
    expect(await cache("https://example.com/a.jpg")).toBeUndefined();
    expect(f.files.size).toBe(0);
    f.recover();
    expect(await cache("https://example.com/a.jpg")).toBeDefined();
    expect(f.count()).toBe(2);
  });
  test("changed source URLs get a new file and missing cached files are refetched", async () => {
    const f = fixture();
    const cache = createFacultyPhotoCache(f.storage);
    const old = await cache("https://example.com/a.jpg");
    expect(await cache("https://example.com/b.jpg")).not.toBe(old);
    f.files.delete(old!);
    expect(await cache("https://example.com/a.jpg")).toBe(old);
    expect(f.count()).toBe(3);
  });
});
