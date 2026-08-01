import { createLmsSession, loadEnvFromRoot } from "../../helpers/lms-session";
import type { LmsSession } from "../../helpers/lms-session";
import * as cheerio from "cheerio";
import type { CheerioAPI } from "cheerio";
import type { Element } from "domhandler";

loadEnvFromRoot();
interface ResourceItem {
  id: string;
  moduleType: string;
  title: string;
  url: string | null;
  childrenCount: number;
}

interface ResourceSection {
  id: string;
  title: string;
  items: ResourceItem[];
}

interface ResourceTree {
  courseId: string;
  courseTitle: string;
  sections: ResourceSection[];
}

interface FolderFile {
  name: string;
  url: string;
}

let session: LmsSession;
let BASE_URL = "";

function normalizeText(value: string | undefined): string {
  return (value || "").replace(/\s+/g, " ").trim();
}

function deriveModuleType(className: string): string {
  const match = (className || "").match(/modtype_([a-z0-9_]+)/i);
  return match?.[1]?.toLowerCase() || "unknown";
}

function parseSectionTitle($: CheerioAPI, section: Element): string {
  return normalizeText(
    $(section)
      .find("h3.sectionname, .course-section-header h3, .sectionname, h3")
      .first()
      .text(),
  );
}

function parseItemTitle($: CheerioAPI, activity: Element): string {
  const instName = $(activity).find(".instancename").first();
  const typeLabel = normalizeText(instName.find(".accesshide").text());
  let title = normalizeText(instName.text());

  if (typeLabel && title.toLowerCase().endsWith(typeLabel.toLowerCase())) {
    title = title.slice(0, title.length - typeLabel.length).trim();
  }

  if (title) return title;

  const linkText = normalizeText(
    $(activity).find("a.aalink, a[href*='/mod/']").first().text(),
  );
  return linkText || "Untitled item";
}

function parseCourseTree(html: string, courseId: string): ResourceTree {
  const $ = cheerio.load(html);
  const sections: ResourceSection[] = [];

  let sectionNodes = $("li.section.course-section.main");
  if (sectionNodes.length === 0) {
    sectionNodes = $("li.course-section");
  }

  sectionNodes.each((sectionIndex, section) => {
    const sectionId = $(section).attr("id") || `section-${sectionIndex}`;
    const sectionTitle =
      parseSectionTitle($, section) || `Section ${sectionIndex + 1}`;

    const items: ResourceItem[] = [];
    $(section)
      .find("li.activity")
      .each((itemIndex, activity) => {
        const id =
          $(activity).attr("id") || `${sectionId}-item-${itemIndex + 1}`;
        const className = $(activity).attr("class") || "";
        const moduleType = deriveModuleType(className);

        const href =
          $(activity).find("a.aalink[href]").first().attr("href") ||
          $(activity).find("a[href*='/mod/'][href]").first().attr("href") ||
          "";

        const url = session.toAbsoluteUrl(href);
        const title = parseItemTitle($, activity);

        items.push({
          id,
          moduleType,
          title,
          url,
          childrenCount: 0,
        });
      });

    sections.push({
      id: sectionId,
      title: sectionTitle,
      items,
    });
  });

  const courseTitle =
    normalizeText($("h1").first().text()) || `Course ${courseId}`;
  return { courseId, courseTitle, sections };
}

async function parseFolderFiles(folderUrl: string): Promise<FolderFile[]> {
  const response = await session.fetchWithSession(folderUrl);
  const html = await response.text();
  const $ = cheerio.load(html);

  const files: FolderFile[] = [];
  const seen = new Set<string>();

  $("main .foldertree a[href], .foldertree a[href]").each((index, link) => {
    const href = $(link).attr("href");
    const url = href ? session.toAbsoluteUrl(href) : null;
    if (!url || seen.has(url)) return;
    seen.add(url);

    const name = normalizeText($(link).text()) || `File ${index + 1}`;
    files.push({ name, url });
  });

  return files;
}

function validateTree(tree: ResourceTree): string[] {
  const errors: string[] = [];

  for (const section of tree.sections) {
    if (!section.id) {
      errors.push("Section id missing");
    }

    for (const item of section.items) {
      if (!item.id) {
        errors.push(`Item id missing in section ${section.id}`);
      }
      if (!item.url || !item.url.startsWith("http")) {
        errors.push(`Invalid URL for item ${item.id}`);
      }
    }
  }

  return errors;
}

async function analyzeCourse(courseId: number): Promise<void> {
  console.log(`\n[2] COURSE ${courseId}`);

  const courseRes = await session.fetchWithSession(
    `${BASE_URL}/course/view.php?id=${courseId}`,
  );
  const html = await courseRes.text();

  const tree = parseCourseTree(html, String(courseId));

  const moduleCounts: Record<string, number> = {};
  let folderCount = 0;
  let folderFileCount = 0;

  for (const section of tree.sections) {
    for (const item of section.items) {
      moduleCounts[item.moduleType] = (moduleCounts[item.moduleType] || 0) + 1;

      if (item.moduleType === "folder") {
        folderCount += 1;
        if (!item.url) {
          item.childrenCount = 0;
          continue;
        }
        const files = await parseFolderFiles(item.url);
        item.childrenCount = files.length;
        folderFileCount += files.length;
      }
    }
  }

  const errors = validateTree(tree);

  console.log(`  Title: ${tree.courseTitle}`);
  console.log(`  Sections: ${tree.sections.length}`);
  console.log(
    `  Modules: ${tree.sections.reduce((sum, s) => sum + s.items.length, 0)}`,
  );
  console.log(`  Module type counts: ${JSON.stringify(moduleCounts)}`);
  console.log(`  Folders: ${folderCount} (files: ${folderFileCount})`);

  if (errors.length > 0) {
    console.log(`  Validation errors: ${errors.length}`);
    errors.forEach((error) => {
      console.log(`    - ${error}`);
    });
    throw new Error(`Validation failed for course ${courseId}`);
  }

  console.log("  Validation: OK (stable IDs + URLs)");
}

async function main() {
  session = createLmsSession();
  BASE_URL = session.baseUrl;

  console.log("======================================");
  console.log("  LMS RESOURCES SCRAPER TEST");
  console.log("======================================");

  try {
    console.log("\n[1] LOGIN");
    const loginOk = await session.login();
    const cookieCount = await session.getCookieCount();
    console.log(`  Result: ${loginOk ? "SUCCESS" : "FAILED"} (cookies=${cookieCount})`);
    if (!loginOk) {
      process.exit(1);
    }

    await analyzeCourse(119);
    await analyzeCourse(123);

    console.log("\n======================================");
    console.log("  DONE");
    console.log("======================================");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("\n[ERROR]", message);
    process.exit(1);
  }
}

main();
