import path from "node:path";
import dotenv from "dotenv";
import { chromium } from "playwright";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const username = process.env.LMS_TEST_USERNAME;
const password = process.env.LMS_TEST_PASSWORD;
const baseUrl = "https://lmsug24.iiitkottayam.ac.in";

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();

await page.goto(`${baseUrl}/login/index.php`, {
  waitUntil: "domcontentloaded",
});
await page.locator("form#login input[name='username']").fill(username || "");
await page.locator("form#login input[name='password']").fill(password || "");
await page
  .locator("form#login button[type='submit'], form#login input[type='submit']")
  .first()
  .click();
await page.waitForLoadState("domcontentloaded", { timeout: 20000 });

await page.goto(`${baseUrl}/my/courses.php`, { waitUntil: "domcontentloaded" });
await page.waitForLoadState("networkidle").catch(() => {});

const data = await page.evaluate(() => {
  const links = Array.from(document.querySelectorAll("a[href]"))
    .map((a) => a.getAttribute("href") || "")
    .filter((href) => /\/course\/view\.php\?id=\d+/i.test(href));
  return {
    url: location.href,
    title: document.title,
    linksCount: links.length,
    links: links.slice(0, 10),
    hasLoginToken: document.documentElement.innerHTML.includes("logintoken"),
  };
});

console.log(JSON.stringify(data, null, 2));

await context.close();
await browser.close();
