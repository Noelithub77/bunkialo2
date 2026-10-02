import { getOuterHTML, textContent } from "domutils";
import {
  getAttr,
  getText,
  parseHtml,
  querySelector,
  querySelectorAll,
} from "@/utils/html-parser";
import type { LmsDiscussion, LmsForumPost } from "@/types";
export const parseLmsDiscussions = (
  html: string,
  base: string,
): LmsDiscussion[] => {
  const found = new Map<string, LmsDiscussion>();
  for (const link of querySelectorAll(
    parseHtml(html),
    "a[href*='/mod/forum/discuss.php']",
  )) {
    const url = new URL(getAttr(link, "href") || "", base),
      id = url.searchParams.get("d"),
      title = getText(link).trim();
    if (id && title && url.origin === new URL(base).origin && !found.has(id))
      found.set(id, { id, title, url: url.href });
  }
  return [...found.values()];
};
export const parseLmsForumPosts = (
  html: string,
  base: string,
): LmsForumPost[] =>
  querySelectorAll(parseHtml(html), "[data-region='post'], .forumpost")
    .map((post, index) => {
      const content = querySelector(
        post,
        ".post-content-container, [data-region='post-content'], .posting",
      );
      const body = content
        ? textContent(
            parseHtml(
              getOuterHTML(content).replace(
                /<br\s*\/?\s*>|<\/(?:p|div|li|h[1-6]|tr)>/gi,
                "\n",
              ),
            ),
          )
            .replace(/[ \t]+/g, " ")
            .replace(/\n\s*\n/g, "\n\n")
            .trim()
        : "";
      const attachments = new Map<
        string,
        { id: string; name: string; url: string }
      >();
      for (const link of querySelectorAll(
        post,
        "a[href*='pluginfile.php'],a[href*='forcedownload=1']",
      )) {
        const url = new URL(getAttr(link, "href") || "", base);
        if (url.origin !== new URL(base).origin) continue;
        const name =
          getText(link) ||
          decodeURIComponent(url.pathname.split("/").pop() || "File");
        attachments.set(url.href, { id: url.href, name, url: url.href });
      }
      return {
        id:
          getAttr(post, "data-post-id") || getAttr(post, "id") || String(index),
        title: getText(
          querySelector(
            post,
            "[data-region-content='forum-post-core-subject'],.subject,h3",
          ),
        ),
        author: getText(querySelector(post, "a[href*='/user/']")),
        date: getAttr(querySelector(post, "time"), "datetime"),
        body,
        attachments: [...attachments.values()],
      };
    })
    .filter(
      (post, index, all) =>
        all.findIndex((item) => item.id === post.id) === index,
    );
