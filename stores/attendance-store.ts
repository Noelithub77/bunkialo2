import * as scraper from '@/services/scraper'
import type { AttendanceState, CourseAttendance, CourseStats } from '@/types'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { zustandStorage } from './storage'

interface AttendanceActions {
  fetchAttendance: () => Promise<void>
  clearAttendance: () => void
}

export const useAttendanceStore = create<AttendanceState & AttendanceActions>()(
  persist(
    (set) => ({
      courses: [],
      isLoading: false,
      lastSyncTime: null,
      error: null,

      fetchAttendance: async () => {
        set({ isLoading: true, error: null })
        try {
          const courses = await scraper.fetchAllAttendance()
          set({
            courses,
            lastSyncTime: Date.now(),
            isLoading: false,
          })
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to fetch attendance'
          set({ error: message, isLoading: false })
        }
      },

      clearAttendance: () => {
        set({ courses: [], lastSyncTime: null, error: null })
      },
    }),
    {
      name: 'attendance-storage',
      storage: createJSONStorage(() => zustandStorage),
      partialize: (state) => ({
        courses: state.courses,
        lastSyncTime: state.lastSyncTime,
      }),
    }
  )
)

// Selector for overall attendance stats
export const selectOverallStats = (courses: CourseAttendance[]): CourseStats => {
  const coursesWithAttendance = courses.filter(c => c.totalSessions > 0)
  const totalSessions = coursesWithAttendance.reduce((sum, c) => sum + c.totalSessions, 0)
  const totalAttended = coursesWithAttendance.reduce((sum, c) => sum + c.attended, 0)
  const overallPercentage = totalSessions > 0 ? Math.round((totalAttended / totalSessions) * 100) : 0
  
  return {
    totalCourses: coursesWithAttendance.length,
    totalSessions,
    totalAttended,
    overallPercentage,
  }
}
