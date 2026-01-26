/**
 * Academic calendar types
 */

export type AcademicTermId = "even-2025-26" | "odd-2026-27";

export type AcademicEventCategory =
  | "academic"
  | "exam"
  | "holiday"
  | "committee"
  | "project"
  | "sports"
  | "festival"
  | "admin"
  | "result";

export interface AcademicTermInfo {
  id: AcademicTermId;
  title: string;
  shortTitle: string;
  semesterLabel: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
}

export interface AcademicEvent {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
  category: AcademicEventCategory;
  termId: AcademicTermId;
  note?: string;
  isTentative?: boolean;
}
