/** Refresh faculty and grouped hostel wardens from IIIT Kottayam's official pages. */
import { chromium } from "playwright";
import { writeFileSync, renameSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { format } from "prettier";

const BASE = "https://www.iiitkottayam.ac.in/";
const FACULTY_URL = `${BASE}#!/faculty`;
const HOSTEL_URL = `${BASE}#!/campus/hostel`;
const DATA_DIR = new URL("../data/", import.meta.url);
const TOP_IDS = [
  "prof-ashok-s",
  "dr-shajulin-benedict",
  "dr-ebin-deni-raj",
  "dr-p-victer-paul",
  "dr-divya-sindhu-lekha",
];
const clean = (value) => value?.replace(/\s+/g, " ").trim() || null;
const idFor = (name) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
const emailFor = (value) =>
  clean(value)
    ?.replace(/^Email\s*:?\s*/i, "")
    .replace(/\s+at\s+/gi, "@")
    .replace(/\s+dot\s+/gi, ".")
    .replace(/\s+/g, "") || null;
const linkFor = (value) => {
  const link = clean(value);
  if (!link) return null;
  // Some faculty links have an institute prefix before a second absolute URL.
  const absolute = link.match(/https?:\/\/[^\s]+/g);
  return absolute?.at(-1) || new URL(link, BASE).href;
};

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.goto(FACULTY_URL, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await page.waitForSelector(".custom-card-header h5", { timeout: 60000 });
  // Angular renders the complete directory; no scrolling/lazy loading is required.
  const rawFaculty = await page.evaluate(() =>
    Array.from(
      document.querySelectorAll(".col.s12.m6.flex.ng-scope"),
      (card) => {
        const text = (el) =>
          el?.textContent?.replace(/\s+/g, " ").trim() || null;
        const subheads = card.querySelectorAll(".custom-card-sub-head");
        const contact = { phone: null, email: null, room: null };
        let link = null;
        let linkText = null;
        for (const chip of card.querySelectorAll(".chip")) {
          // Ignore ng-show-hidden chips so stale placeholders cannot become contacts.
          if (chip.classList.contains("ng-hide")) continue;
          const icon = text(chip.querySelector("i"));
          const value = text(chip)
            ?.replace(icon || "", "")
            .trim();
          if (icon === "contact_phone") contact.phone = value;
          if (icon === "email") contact.email = value;
          if (icon === "location_on")
            contact.room = value?.replace(/^Room\s*No\s*:?\s*/i, "");
          if (icon === "insert_link") {
            link = chip.querySelector("a")?.getAttribute("href");
            linkText = text(chip.querySelector("a"));
          }
        }
        return {
          name: text(card.querySelector("h5")),
          designation: text(subheads[1]),
          additionalRole: text(subheads[0]),
          qualification: text(subheads[2]),
          imageUrl: card.querySelector(".custom-image")?.getAttribute("src"),
          areas: Array.from(card.querySelectorAll("li.ng-scope"), text).filter(
            Boolean,
          ),
          contact,
          page: { text: linkText, link },
        };
      },
    ),
  );
  const parsedFaculty = rawFaculty
    .filter((f) => f.name)
    .map((f) => ({
      id: idFor(f.name),
      ...f,
      designation: f.designation || "Faculty",
      imageUrl: f.imageUrl ? new URL(f.imageUrl.trim(), BASE).href : null,
      contact: {
        phone: clean(f.contact.phone),
        email: emailFor(f.contact.email),
        room: clean(f.contact.room),
      },
      page: { text: f.page.text, link: linkFor(f.page.link) },
    }));
  // The official directory repeats some identical entries (e.g. Anitha Ambat).
  const facultyMap = new Map();
  for (const faculty of parsedFaculty) {
    const existing = facultyMap.get(faculty.id);
    if (
      existing?.contact.email &&
      faculty.contact.email &&
      existing.contact.email !== faculty.contact.email
    ) {
      throw new Error(
        `Conflicting faculty ID ${faculty.id}; retaining bundled data.`,
      );
    }
    if (!existing || (!existing.contact.email && faculty.contact.email))
      facultyMap.set(faculty.id, faculty);
  }
  const faculties = [...facultyMap.values()];
  if (faculties.length < 30) {
    throw new Error(
      "Faculty page is incomplete or contains duplicate IDs; retaining bundled data.",
    );
  }

  await page.goto(HOSTEL_URL, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await page.waitForSelector("#hostel table", { timeout: 60000 });
  const rawGroups = await page.evaluate(() => {
    const groups = [];
    let group = null;
    // Document order associates each live roster with its preceding residence heading.
    // Commented-out historical tables are excluded by the DOM parser.
    for (const el of document.querySelectorAll("#hostel h5, #hostel tr")) {
      const text = el.textContent.replace(/\s+/g, " ").trim();
      if (el.tagName === "H5") {
        group = null;
        if (/Halls? of Residence/i.test(text)) {
          const names = text
            .replace(/^.*?\s-\s*/, "")
            .split(",")
            .map((name) => name.trim().replace(/\s+Hostel$/i, ""));
          group = { names, wardens: [] };
          groups.push(group);
        }
      } else if (group) {
        const cells = Array.from(el.querySelectorAll("td"));
        const values = cells.map((cell) =>
          cell.textContent.replace(/\s+/g, " ").trim(),
        );
        if (values.length >= 5 && /warden/i.test(values[2])) {
          group.wardens.push({
            name: values[1],
            role: values[2],
            phone: values[3],
            email: values[4],
            imageUrl: cells[1].querySelector("img")?.getAttribute("src"),
          });
        }
      }
    }
    return groups;
  });
  if (
    !rawGroups.length ||
    rawGroups.some((group) => !group.names.length || !group.wardens.length)
  ) {
    throw new Error("Hostel roster is incomplete; retaining bundled data.");
  }
  const wardenIds = new Set();
  const hostelGroups = rawGroups.map((group) => ({
    id: idFor(group.names[0]),
    name: group.names.join(" & "),
    wardenIds: group.wardens.map((warden) => {
      const email = emailFor(warden.email);
      if (!email || !/^[^@]+@iiitkottayam\.ac\.in$/.test(email))
        throw new Error(`Invalid warden email for ${warden.name}`);
      let faculty = faculties.find(
        (f) => f.contact.email?.toLowerCase() === email.toLowerCase(),
      );
      const id = faculty?.id || idFor(warden.name);
      // Prefer the listed mobile number for the call button; never concatenate two phone numbers.
      const phones = warden.phone
        .replace(/^Contact\s*No\s*:?\s*/i, "")
        .split(",")
        .map((p) => p.trim());
      const mobile = phones.find((p) => /^\d{10}$/.test(p));
      const phone = mobile
        ? `+91${mobile}`
        : phones[0].replace(/\(0\)\s*/g, "").replace(/[^\d+]/g, "");
      // Wardens remain ordinary faculty records; groups only reference their IDs.
      if (!faculty) {
        faculty = {
          id,
          name: clean(warden.name),
          designation: "Faculty",
          additionalRole: null,
          qualification: null,
          imageUrl: warden.imageUrl
            ? new URL(warden.imageUrl.trim(), BASE).href
            : null,
          areas: [],
          contact: { phone, email, room: null },
          page: { text: "Hostel", link: HOSTEL_URL },
        };
        faculties.push(faculty);
      }
      faculty.hostelRoles ??= [];
      faculty.hostelRoles.push({
        hostelId: idFor(group.names[0]),
        role: clean(warden.role),
      });
      // Faculty cards and the existing profile share the official warden contact.
      faculty.contact.phone = phone;
      wardenIds.add(id);
      return id;
    }),
  }));
  if (
    !hostelGroups.some((g) => g.id === "manimala") ||
    new Set(hostelGroups.map((g) => g.id)).size !== hostelGroups.length
  ) {
    throw new Error(
      "Default Manimala group missing or duplicate hostel IDs; retaining bundled data.",
    );
  }
  const topIds = TOP_IDS.filter((id) => faculties.some((f) => f.id === id));
  // Stable output: unchanged source pages do not create monthly timestamp-only commits.
  const outputs = [
    [
      "faculty.ts",
      `// Auto-generated by src/scripts/fetch-faculty.mjs\n// Source: ${FACULTY_URL}\nimport type { Faculty } from "@/types";\n\nexport const faculties: Faculty[] = ${JSON.stringify(faculties, null, 2)};\n\nexport const topFacultyIds: string[] = ${JSON.stringify(topIds)};\n`,
    ],
    [
      "hostels.ts",
      `// Auto-generated by src/scripts/fetch-faculty.mjs\n// Source: ${HOSTEL_URL}\nimport type { HostelGroup } from "@/types";\n\nexport const hostelGroups: HostelGroup[] = ${JSON.stringify(hostelGroups, null, 2)};\n`,
    ],
  ];
  // Validate both pages before writing either snapshot.
  for (const [name, content] of outputs)
    writeFileSync(
      new URL(`${name}.tmp`, DATA_DIR),
      await format(content, { parser: "typescript" }),
    );
  for (const [name] of outputs)
    renameSync(
      fileURLToPath(new URL(`${name}.tmp`, DATA_DIR)),
      fileURLToPath(new URL(name, DATA_DIR)),
    );
  console.log(
    `Updated ${faculties.length} faculty, ${hostelGroups.length} hostel groups, ${wardenIds.size} wardens.`,
  );
} finally {
  await browser.close();
}
