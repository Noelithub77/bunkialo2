import type {
  LmsCourseResourcesTree,
  LmsResourceFileNode,
  LmsResourceItemNode,
  LmsResourceModuleType,
  LmsResourceSectionNode,
} from "@/types";
import { debug } from "@/utils/debug";
import {
  getAttr,
  getText,
  parseHtml,
  querySelector,
  querySelectorAll,
} from "@/utils/html-parser";
import { isLoginHtml } from "@/utils/moodle-url";
import type { Element } from "domhandler";
import { api, BASE_URL } from "./api";

const normalizeText = (value: string): string =>
  value.replace(/\s+/g, " ").trim();

const toAbsoluteUrl = (href: string): string => {
  if (href.startsWith("http://") || href.startsWith("https://")) {
    return href;
  }

  if (href.startsWith("//")) {
    return `https:${href}`;
  }

  if (href.startsWith("/")) {
    return `${BASE_URL}${href}`;
  }

  return `${BASE_URL}/${href.replace(/^\.?\//, "")}`;
};

const parseSectionNumber = (sectionId: string, dataSectionId: string | null): number | null => {
  if (dataSectionId && /^\d+$/.test(dataSectionId)) {
    return Number(dataSectionId);
  }

  const match = sectionId.match(/section-(\d+)/);
  if (!match) return null;
  return Number(match[1]);
};

const resolveModuleType = (className: string): LmsResourceModuleType => {
  const match = className.match(/modtype_([a-z0-9_]+)/i);
  const modType = match?.[1]?.toLowerCase();

  switch (modType) {
    case "forum":
    case "attendance":
    case "resource":
    case "folder":
    case "assign":
    case "quiz":
    case "vpl":
      return modType;
    default:
      return "unknown";
  }
};

const extractCmid = (activityId: string, activityUrl: string): string | null => {
  const idMatch = activityId.match(/^module-(\d+)$/);
  if (idMatch) return idMatch[1];

  const urlMatch = activityUrl.match(/[?&]id=(\d+)/);
  return urlMatch?.[1] ?? null;
};

const stripTrailingTypeLabel = (title: string, typeLabel: string | null): string => {
  if (!typeLabel) return title;
  if (!title) return title;

  const loweredTitle = title.toLowerCase();
  const loweredType = typeLabel.toLowerCase();

  if (!loweredTitle.endsWith(loweredType)) {
    return title;
  }

  return title.slice(0, title.length - typeLabel.length).trim();
};

const parseFolderFiles = async (
  folderUrl: string,
  parentNodeId: string,
): Promise<LmsResourceFileNode[]> => {
  try {
    const response = await api.get<string>(folderUrl);
    if (isLoginHtml(response.data)) {
      throw new Error("Session expired while fetching folder resources");
    }
    const doc = parseHtml(response.data);
    const links = querySelectorAll(doc, "main .foldertree a[href], .foldertree a[href]");

    const files: LmsResourceFileNode[] = [];
    const seenUrls = new Set<string>();

    for (let index = 0; index < links.length; index += 1) {
      const link = links[index];
      const href = getAttr(link, "href");
      if (!href) continue;

      const url = toAbsoluteUrl(href);
      if (seenUrls.has(url)) continue;
      seenUrls.add(url);

      const nameFromText = normalizeText(getText(link));
      const fallbackName = `File ${index + 1}`;
      const fileName = nameFromText || fallbackName;

      files.push({
        id: `${parentNodeId}-file-${files.length + 1}`,
        name: fileName,
        url,
        fileType: "file",
      });
    }

    return files;
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("Session expired while fetching folder resources")
    ) {
      throw error;
    }
    debug.scraper(`Failed to parse folder files for ${folderUrl}: ${String(error)}`);
    return [];
  }
};

const parseActivityNode = async (
  activity: Element,
  index: number,
): Promise<LmsResourceItemNode> => {
  const className = getAttr(activity, "class") || "";
  const activityId = getAttr(activity, "id") || `module-unknown-${index + 1}`;

  const link = querySelector(activity, "a.aalink[href], a[href*='/mod/'][href]");
  const href = getAttr(link, "href") || "";
  const url = href ? toAbsoluteUrl(href) : `${BASE_URL}/`;

  const instanceNameEl = querySelector(activity, ".instancename");
  const rawTitle = normalizeText(
    getText(instanceNameEl) || getText(link) || `Untitled item ${index + 1}`,
  );

  const rawTypeLabel = normalizeText(
    getText(querySelector(activity, ".instancename .accesshide")),
  );
  const typeLabel = rawTypeLabel || null;

  const title =
    stripTrailingTypeLabel(rawTitle, typeLabel) ||
    normalizeText(getText(link)) ||
    `Untitled item ${index + 1}`;

  const descriptionText = normalizeText(
    getText(querySelector(activity, ".description, .contentafterlink")),
  );
  const availabilityText = normalizeText(
    getText(querySelector(activity, ".availabilityinfo")),
  );

  const activityToggle = querySelector(activity, "[aria-expanded]");
  const activityExpanded = getAttr(activityToggle, "aria-expanded");
  const initiallyCollapsed =
    activityExpanded === "true"
      ? false
      : activityExpanded === "false"
        ? true
        : null;

  const moduleType = resolveModuleType(className);
  const children =
    moduleType === "folder" && href
      ? await parseFolderFiles(url, activityId)
      : [];

  return {
    id: activityId,
    cmid: extractCmid(activityId, url),
    title,
    moduleType,
    typeLabel,
    fileTypeHint: /(?:\/f\/pdf|pdf)/i.test(getAttr(querySelector(activity,"img.activityicon"),"src")||"") ? "pdf" : /\/f\/image/i.test(getAttr(querySelector(activity,"img.activityicon"),"src")||"") ? "image" : null,
    url,
    description: descriptionText || null,
    availabilityText: availabilityText || null,
    initiallyCollapsed,
    children,
  };
};

export const fetchCourseResources = async (
  courseId: string,
): Promise<LmsCourseResourcesTree> => {
  debug.scraper(`=== FETCHING COURSE RESOURCES: ${courseId} ===`);

  const response = await api.get<string>(`/course/view.php?id=${courseId}`);
  if (isLoginHtml(response.data)) {
    throw new Error("Session expired while fetching course resources");
  }
  const doc = parseHtml(response.data);

  const courseTitle =
    normalizeText(getText(querySelector(doc, "h1"))) || `Course ${courseId}`;

  const mainSectionSelector = "li.section.course-section.main";
  const fallbackSectionSelector = "li.course-section";

  const sectionNodes = querySelectorAll(doc, mainSectionSelector);
  const sectionsToParse =
    sectionNodes.length > 0
      ? sectionNodes
      : querySelectorAll(doc, fallbackSectionSelector);

  const sections: LmsResourceSectionNode[] = [];

  for (let sectionIndex = 0; sectionIndex < sectionsToParse.length; sectionIndex += 1) {
    const section = sectionsToParse[sectionIndex];
    const sectionId =
      getAttr(section, "id") ||
      getAttr(section, "data-sectionid") ||
      `section-${sectionIndex}`;

    const sectionName = normalizeText(
      getText(
        querySelector(
          section,
          "h3.sectionname, .course-section-header h3, .sectionname, h3",
        ),
      ),
    );

    const toggle = querySelector(
      section,
      "a.icons-collapse-expand[aria-expanded], button.icons-collapse-expand[aria-expanded], [aria-controls^='coursecontentcollapse'][aria-expanded]",
    );
    const ariaExpanded = getAttr(toggle, "aria-expanded");
    const sectionClassName = getAttr(section, "class") || "";

    const initiallyCollapsed =
      ariaExpanded === "true"
        ? false
        : ariaExpanded === "false"
          ? true
          : sectionClassName.includes("collapsed");

    const activityNodes = querySelectorAll(section, "li.activity");
    const items: LmsResourceItemNode[] = [];

    for (let activityIndex = 0; activityIndex < activityNodes.length; activityIndex += 1) {
      const activity = activityNodes[activityIndex];
      const item = await parseActivityNode(activity, activityIndex);
      items.push(item);
    }

    if (items.length > 0) {
      sections.push({
        id: sectionId,
        sectionNumber: parseSectionNumber(sectionId, getAttr(section, "data-sectionid")),
        title: sectionName || `Section ${sectionIndex + 1}`,
        initiallyCollapsed,
        items,
      });
    }
  }

  debug.scraper(
    `Parsed ${sections.length} sections for course ${courseId} (${courseTitle})`,
  );

  return {
    courseId,
    courseTitle,
    sections,
    fetchedAt: Date.now(),
  };
};
