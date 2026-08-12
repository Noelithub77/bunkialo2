import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createLmsSession,
  isLoginHtml,
  loadEnvFromRoot,
} from "../../helpers/lms-session";
import type { LmsSession } from "../../helpers/lms-session";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..", "..", "..");

const DEFAULT_BASE_URL = "https://lmsug24.iiitkottayam.ac.in";
const COURSE_IDS = [119, 123];
const MAX_RESOURCE_TESTS_PER_COURSE = 6;
const MAX_FOLDER_FILE_TESTS_PER_COURSE = 6;

loadEnvFromRoot();

import * as cheerio from "cheerio";
interface DownloadTarget {
  title: string;
  url: string;
}

interface DownloadResult extends DownloadTarget {
  kind: "resource" | "folder-file";
  status: number;
  contentType: string;
  loginPage: boolean;
  ok: boolean;
}

interface CourseTargets {
  resources: DownloadTarget[];
  folderFiles: DownloadTarget[];
}

interface FolderFile {
  name: string;
  url: string;
}

let session: LmsSession;
let BASE_URL = "";

const normalizeText = (value: string | undefined): string => (value || "").replace(/\s+/g, " ").trim();

const getContentType = (headers: Headers): string => {
  const value = headers.get("content-type") || "";
  return String(value).toLowerCase();
};

async function login() {
  console.log("\n[1] Logging in...");
  const loggedIn = await session.login();
  const cookieCount = await session.getCookieCount();
  console.log(`  login: ${loggedIn ? "OK" : "FAILED"}, cookies=${cookieCount}`);
  if (!loggedIn) {
    throw new Error("Login failed");
  }
}

async function parseFolderFiles(folderUrl: string): Promise<FolderFile[]> {
  const response = await session.fetchWithSession(folderUrl);
  const html = await response.text();
  const $ = cheerio.load(html);
  const files: FolderFile[] = [];
  const seen = new Set<string>();

  $("main .foldertree a[href], .foldertree a[href]").each((_idx, link) => {
    const href = $(link).attr("href");
    const url = href ? session.toAbsoluteUrl(href) : null;
    if (!url || seen.has(url)) return;
    seen.add(url);
    files.push({
      name: normalizeText($(link).text()) || "file",
      url,
    });
  });

  return files;
}

async function discoverCourseDownloadTargets(courseId: number): Promise<CourseTargets> {
  const response = await session.fetchWithSession(
    `${BASE_URL}/course/view.php?id=${courseId}`,
  );
  const html = await response.text();
  const $ = cheerio.load(html);

  const resourceLinks: DownloadTarget[] = [];
  const folderLinks: DownloadTarget[] = [];

  $("li.activity").each((_i, activity) => {
    const className = $(activity).attr("class") || "";
    const href =
      $(activity).find("a.aalink[href]").first().attr("href") ||
      $(activity).find("a[href*='/mod/'][href]").first().attr("href") ||
      "";

    const url = session.toAbsoluteUrl(href);
    if (!url) return;

    const title = normalizeText($(activity).find(".instancename").first().text());
    if (className.includes("modtype_resource")) {
      resourceLinks.push({ title: title || "resource", url });
    }
    if (className.includes("modtype_folder")) {
      folderLinks.push({ title: title || "folder", url });
    }
  });

  const folderFiles: DownloadTarget[] = [];
  for (const folder of folderLinks) {
    const files = await parseFolderFiles(folder.url);
    for (const file of files) {
      folderFiles.push({ title: file.name, url: file.url });
    }
  }

  return {
    resources: resourceLinks.slice(0, MAX_RESOURCE_TESTS_PER_COURSE),
    folderFiles: folderFiles.slice(0, MAX_FOLDER_FILE_TESTS_PER_COURSE),
  };
}

async function testDownloadTarget(
  kind: DownloadResult["kind"],
  target: DownloadTarget,
): Promise<DownloadResult> {
  const response = await session.fetchWithSession(target.url);
  const status = response.status;
  const contentType = getContentType(response.headers);
  const isHtmlResponse =
    contentType.includes("text/html") || contentType.includes("application/xhtml");
  const bodyText = isHtmlResponse ? await response.text() : null;
  if (!isHtmlResponse) {
    await response.arrayBuffer();
  }
  const loginPage = bodyText ? isLoginHtml(bodyText) : false;

  return {
    kind,
    title: target.title,
    url: target.url,
    status,
    contentType,
    loginPage,
    ok: status >= 200 && status < 300 && !loginPage,
  };
}

async function main() {
  session = createLmsSession({
    baseUrl: process.env.LMS_BASE_URL || DEFAULT_BASE_URL,
  });
  BASE_URL = session.baseUrl;

  console.log("======================================");
  console.log(" LMS AUTH DOWNLOAD TEST");
  console.log("======================================");
  console.log(`Base URL: ${BASE_URL}`);

  await login();

  const allResults: DownloadResult[] = [];

  for (const courseId of COURSE_IDS) {
    console.log(`\n[2] Discovering targets in course ${courseId}...`);
    const targets = await discoverCourseDownloadTargets(courseId);
    console.log(
      `  resources=${targets.resources.length}, folderFiles=${targets.folderFiles.length}`,
    );

    for (const target of targets.resources) {
      const result = await testDownloadTarget("resource", target);
      allResults.push(result);
      console.log(
        `  [resource] ${result.ok ? "OK" : "FAIL"} status=${result.status} login=${result.loginPage} ${target.title}`,
      );
    }

    for (const target of targets.folderFiles) {
      const result = await testDownloadTarget("folder-file", target);
      allResults.push(result);
      console.log(
        `  [folder-file] ${result.ok ? "OK" : "FAIL"} status=${result.status} login=${result.loginPage} ${target.title}`,
      );
    }
  }

  const okCount = allResults.filter((item) => item.ok).length;
  const failCount = allResults.length - okCount;

  const reportPath = path.join(ROOT_DIR, "artifacts", "lms-download-report.json");
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(
    reportPath,
    JSON.stringify(
      {
        baseUrl: BASE_URL,
        testedAt: new Date().toISOString(),
        total: allResults.length,
        ok: okCount,
        failed: failCount,
        results: allResults,
      },
      null,
      2,
    ),
    "utf8",
  );

  console.log("\n======================================");
  console.log(`Summary: total=${allResults.length}, ok=${okCount}, failed=${failCount}`);
  console.log(`Report: ${reportPath}`);
  console.log("======================================");

  if (failCount > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("Fatal:", error instanceof Error ? error.message : String(error));
  process.exit(1);
});
