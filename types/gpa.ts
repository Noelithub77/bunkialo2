/**
 * GPA-related types
 */

export type GradeLetter = "A" | "A-" | "B" | "B-" | "C" | "C-" | "D" | "F";

export interface SemesterGpaEntry {
  id: string;
  label: string;
  sgpa: number | null;
  credits: number | null;
}

export interface GpaCourseItem {
  courseId: string;
  courseName: string;
  courseCode: string;
  credits: number;
  grade: GradeLetter;
}
