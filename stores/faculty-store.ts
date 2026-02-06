import type { Faculty, FacultyState } from "@/types";
import Fuse, { IFuseOptions } from "fuse.js";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { zustandStorage } from "./storage";

// bundled faculty data
import {
  faculties as facultyList,
  topFacultyIds as topIds,
} from "@/data/faculty";

// fuse.js search config
const SEARCH_KEYS = [
  { name: "name", weight: 2 },
  { name: "designation", weight: 1 },
  { name: "qualification", weight: 1.2 },
  { name: "contact.room", weight: 1.5 },
  { name: "contact.phone", weight: 1.1 },
  { name: "contact.email", weight: 0.8 },
  { name: "areas", weight: 1.2 },
];

const FUSE_OPTIONS: IFuseOptions<Faculty> = {
  keys: SEARCH_KEYS,
  threshold: 0.4,
  includeScore: true,
  minMatchCharLength: 1,
  ignoreLocation: true, // search anywhere in string
};

const MAX_RECENT_SEARCHES = 10;

interface FacultyActions {
  loadFaculty: () => void;
  addRecentSearch: (query: string) => void;
  removeRecentSearch: (query: string) => void;
  clearRecentSearches: () => void;
}

export const useFacultyStore = create<FacultyState & FacultyActions>()(
  persist(
    (set, get) => ({
      faculties: [],
      topFacultyIds: [],
      recentSearches: [],
      isLoading: false,
      error: null,

      loadFaculty: () => {
        set({
          faculties: facultyList,
          topFacultyIds: topIds,
          isLoading: false,
        });
      },

      addRecentSearch: (query: string) => {
        const trimmed = query.trim().toLowerCase();
        if (!trimmed) return;

        const current = get().recentSearches;
        const filtered = current.filter((s) => s !== trimmed);
        const updated = [trimmed, ...filtered].slice(0, MAX_RECENT_SEARCHES);
        set({ recentSearches: updated });
      },

      removeRecentSearch: (query: string) => {
        set({
          recentSearches: get().recentSearches.filter((s) => s !== query),
        });
      },

      clearRecentSearches: () => {
        set({ recentSearches: [] });
      },
    }),
    {
      name: "faculty-storage",
      storage: createJSONStorage(() => zustandStorage),
      partialize: (state) => ({
        recentSearches: state.recentSearches,
      }),
    },
  ),
);

// pre-built fuse index for instant search
const facultyIndex = Fuse.createIndex(SEARCH_KEYS, facultyList);
const fuseInstance = new Fuse(facultyList, FUSE_OPTIONS, facultyIndex);
const fuseInstanceWithMatches = new Fuse(facultyList, {
  ...FUSE_OPTIONS,
  includeMatches: true,
}, facultyIndex);

type MatchFieldKey =
  | "name"
  | "designation"
  | "qualification"
  | "contact.room"
  | "contact.phone"
  | "contact.email"
  | "areas";

const MATCH_FIELD_LABELS: Record<MatchFieldKey, string> = {
  name: "Name",
  designation: "Designation",
  qualification: "Qualification",
  "contact.room": "Room",
  "contact.phone": "Phone",
  "contact.email": "Email",
  areas: "Area of expertise",
};

export interface FacultySearchResult {
  faculty: Faculty;
  matchedFields: string[];
}

// fuzzy search - instant, no minimum chars
export const searchFaculty = (query: string): Faculty[] => {
  const q = query.trim();
  if (!q) return [];
  return fuseInstance.search(q, { limit: 30 }).map((r) => r.item);
};

export const searchFacultyWithMatches = (query: string): FacultySearchResult[] => {
  const q = query.trim();
  if (!q) return [];

  return fuseInstanceWithMatches.search(q, { limit: 30 }).map((result) => {
    const fields = new Set<string>();

    result.matches?.forEach((match) => {
      const key = match.key as MatchFieldKey | undefined;
      if (key && MATCH_FIELD_LABELS[key]) {
        fields.add(MATCH_FIELD_LABELS[key]);
      }
    });

    return {
      faculty: result.item,
      matchedFields: Array.from(fields),
    };
  });
};

// get top faculty by ids
export const getTopFaculty = (
  faculties: Faculty[],
  topIds: string[],
): Faculty[] => {
  return topIds
    .map((id) => faculties.find((f) => f.id === id))
    .filter((f): f is Faculty => f !== undefined);
};
