import { extractCourseName } from "./course-name";
import { getText, parseHtml, querySelectorAll } from "./html-parser";
import { removeElement } from "domutils";

export const assignmentCourseName = (
  value: string | null | undefined,
): string => {
  let name = value?.trim() ?? "";
  for (let index = 0; index < 4; index++) {
    const next = extractCourseName(name);
    if (next === name) break;
    name = next;
  }
  return name || "Course";
};

export const assignmentRelativeDate = (
  timestamp: number,
  now = Date.now(),
): string => {
  const delta = timestamp - now;
  const minutes = Math.floor(Math.abs(delta) / 60000);
  if (minutes < 1) return "now";
  const value =
    minutes >= 1440
      ? `${Math.floor(minutes / 1440)}d`
      : minutes >= 60
        ? `${Math.floor(minutes / 60)}h`
        : `${minutes}m`;
  return delta > 0 ? `in ${value}` : `${value} ago`;
};

export const assignmentDescription = (
  html: string | null,
  fallback: string | null,
): string => {
  if (!html) return fallback?.trim() ?? "";
  const doc = parseHtml(
    html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li|h[1-6])>/gi, "</$1>\n"),
  );
  // Moodle places attachment names and upload timestamps inside the intro.
  for (const node of querySelectorAll(
    doc,
    '[id^="assign_files_tree"], .fileuploadsubmission, .fileuploadsubmissiontime',
  ))
    removeElement(node);
  return doc.children
    .map((node) =>
      node.type === "tag"
        ? getText(node)
        : node.type === "text"
          ? node.data
          : "",
    )
    .join("")
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
};

export const assignmentSubmissionLabel = (value: string | null): string => {
  if (/draft/i.test(value ?? "")) return "Draft";
  if (!value || /no submissions|no submission|not submitted/i.test(value))
    return "Not submitted";
  if (/submitted/i.test(value)) return "Submitted";
  return value.trim();
};
