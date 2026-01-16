import type { Faculty, FacultyState } from '@/types'
import Fuse, { IFuseOptions } from 'fuse.js'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { zustandStorage } from './storage'

// bundled faculty data
import { faculties as facultyList, topFacultyIds as topIds } from '@/data/faculty'

// fuse.js search config
const FUSE_OPTIONS: IFuseOptions<Faculty> = {
  keys: [
    { name: 'name', weight: 2 },
    { name: 'designation', weight: 1 },
    { name: 'contact.room', weight: 1.5 },
    { name: 'contact.email', weight: 0.8 },
    { name: 'areas', weight: 1 },
  ],
  threshold: 0.4,
  includeScore: true,
  minMatchCharLength: 2,
}

const MAX_RECENT_SEARCHES = 10

interface FacultyActions {
  loadFaculty: () => void
  addRecentSearch: (query: string) => void
  removeRecentSearch: (query: string) => void
  clearRecentSearches: () => void
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
        })
      },

      addRecentSearch: (query: string) => {
        const trimmed = query.trim().toLowerCase()
        if (!trimmed) return

        const current = get().recentSearches
        const filtered = current.filter((s) => s !== trimmed)
        const updated = [trimmed, ...filtered].slice(0, MAX_RECENT_SEARCHES)
        set({ recentSearches: updated })
      },

      removeRecentSearch: (query: string) => {
        set({ recentSearches: get().recentSearches.filter((s) => s !== query) })
      },

      clearRecentSearches: () => {
        set({ recentSearches: [] })
      },
    }),
    {
      name: 'faculty-storage',
      storage: createJSONStorage(() => zustandStorage),
      partialize: (state) => ({
        recentSearches: state.recentSearches,
      }),
    }
  )
)

// cached fuse instance
let fuseInstance: Fuse<Faculty> | null = null
let cachedLength = 0

// get or create fuse instance
const getFuseInstance = (faculties: Faculty[]): Fuse<Faculty> => {
  if (!fuseInstance || cachedLength !== faculties.length) {
    fuseInstance = new Fuse(faculties, FUSE_OPTIONS)
    cachedLength = faculties.length
  }
  return fuseInstance
}

// fuzzy search faculty
export const searchFaculty = (faculties: Faculty[], query: string): Faculty[] => {
  const q = query.trim()
  if (!q || q.length < 2) return []

  const fuse = getFuseInstance(faculties)
  const results = fuse.search(q, { limit: 30 })
  return results.map((r) => r.item)
}

// get top faculty
export const getTopFaculty = (faculties: Faculty[], topIds: string[]): Faculty[] => {
  return topIds
    .map((id) => faculties.find((f) => f.id === id))
    .filter((f): f is Faculty => f !== undefined)
}
