import type { Faculty, HostelGroup } from "@/types";

export const facultyPhotoKey = (url: string): string => {
  // Two independent hashes keep filenames short and stable across app updates.
  let first = 2166136261;
  let second = 5381;
  for (const character of url) {
    first = Math.imul(first ^ character.charCodeAt(0), 16777619);
    second = Math.imul(second, 33) ^ character.charCodeAt(0);
  }
  return `${(first >>> 0).toString(16)}-${(second >>> 0).toString(16)}`;
};

export const facultyPhotoQueue = (
  faculties: Faculty[],
  hostels: HostelGroup[],
): string[] => {
  const defaultWardens =
    hostels.find((hostel) => hostel.id === "manimala")?.wardenIds ?? [];
  const byId = new Map(faculties.map((faculty) => [faculty.id, faculty]));
  return [
    ...new Set(
      [
        ...defaultWardens.map((id) => byId.get(id)?.imageUrl),
        ...faculties.map((faculty) => faculty.imageUrl),
      ].filter((url): url is string => Boolean(url)),
    ),
  ];
};

export const createFacultyPhotoCache = (
  storage: import("@/types").FacultyPhotoStorage,
) => {
  const inFlight = new Map<string, Promise<string | undefined>>();
  return (url: string): Promise<string | undefined> => {
    const pending = inFlight.get(url);
    if (pending) return pending;
    const task = (async () => {
      if (!storage.directory) return undefined;
      const destination = `${storage.directory}${facultyPhotoKey(url)}.img`;
      const temporary = `${destination}.part`;
      try {
        if (await storage.exists(destination)) return destination;
        await storage.prepareDirectory();
        await storage.remove(temporary);
        if (!(await storage.download(url, temporary)))
          throw new Error("Invalid faculty photo");
        await storage.move(temporary, destination);
        return destination;
      } catch {
        await storage.remove(temporary).catch(() => undefined);
        return undefined;
      }
    })().finally(() => inFlight.delete(url));
    inFlight.set(url, task);
    return task;
  };
};
