import type { AcademicEvent } from "@/types";

export const isRedactedCalendarTitle = (title: string): boolean =>
  /^(busy|private(?: event)?|confidential)$/i.test(title.trim());

// Legacy cached feeds had no visibility field. Keep them hidden until a fresh
// feed confirms public visibility, so private placeholders never flash on screen.
export const isVisibleAcademicEvent = (event: AcademicEvent): boolean =>
  event.origin !== "google-calendar" ||
  (event.visibility === "public" &&
    typeof event.title === "string" &&
    !isRedactedCalendarTitle(event.title));
