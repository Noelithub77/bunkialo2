import { describe, it, expect } from "bun:test";
import {
  parseLmsDiscussions,
  parseLmsForumPosts,
} from "../../../src/utils/lms-forum";
describe("Moodle announcements", () => {
  it("keeps unique same-origin discussion links in Moodle order", () => {
    const rows = parseLmsDiscussions(
      `<a href='/mod/forum/discuss.php?d=8'>Update</a><a href='/mod/forum/discuss.php?d=8'>Again</a><a href='https://evil.test/mod/forum/discuss.php?d=2'>Bad</a>`,
      "https://lms.test",
    );
    expect(rows).toEqual([
      {
        id: "8",
        title: "Update",
        url: "https://lms.test/mod/forum/discuss.php?d=8",
      },
    ]);
  });
  it("preserves instruction paragraphs and protected attachments without unrelated navigation", () => {
    const posts = parseLmsForumPosts(
      `<article data-region='post' data-post-id='7' class='forumpost'><h3 data-region-content='forum-post-core-subject'>Assignment update</h3><a href='/user/view.php?id=2'>Teacher</a><time datetime='2026-10-01T10:00:00Z'></time><div class='post-content-container'><p>Read these instructions.</p><p>Bring your work.</p><a href='/pluginfile.php/42/notes.pdf?forcedownload=1'>Notes.pdf</a></div><a href='https://evil.test/pluginfile.php/x.pdf'>Outside</a></article>`,
      "https://lms.test",
    );
    expect(posts).toHaveLength(1);
    expect(posts[0].body).toContain("instructions.\nBring");
    expect(posts[0].author).toBe("Teacher");
    expect(posts[0].attachments).toHaveLength(1);
    expect(posts[0].attachments[0].name).toBe("Notes.pdf");
  });
});
