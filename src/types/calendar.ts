/**
 * Calendar types
 */

export interface CalendarDot {
  key: string;
  color: string;
}

export interface CalendarMarking {
  dots: CalendarDot[];
  selected?: boolean;
}

export type MarkedDates = Record<string, CalendarMarking>;
