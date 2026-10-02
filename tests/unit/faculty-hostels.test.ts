import { describe, expect, test } from "bun:test";
import { faculties } from "@/data/faculty";
import { hostelGroups } from "@/data/hostels";

describe("official faculty and hostel roster", () => {
  test("has unique faculty and hostel IDs, including the default shared roster", () => {
    expect(new Set(faculties.map((faculty) => faculty.id)).size).toBe(
      faculties.length,
    );
    expect(new Set(hostelGroups.map((group) => group.id)).size).toBe(
      hostelGroups.length,
    );
    const defaultGroup = hostelGroups.find((group) => group.id === "manimala");
    expect(defaultGroup?.name).toBe("Manimala & MJ Apartment");
    expect(defaultGroup?.wardenIds.length).toBeGreaterThan(0);
  });

  test("every warden resolves to an existing faculty profile and official contact", () => {
    for (const group of hostelGroups) {
      expect(group.wardenIds.length).toBeGreaterThan(0);
      expect(new Set(group.wardenIds).size).toBe(group.wardenIds.length);
      for (const id of group.wardenIds) {
        const faculty = faculties.find((record) => record.id === id);
        expect(faculty).toBeDefined();
        expect(
          faculty?.hostelRoles?.find((entry) => entry.hostelId === group.id)
            ?.role,
        ).toMatch(/warden/i);
        expect(faculty?.contact.email).toMatch(
          /^[^@\s]+@iiitkottayam\.ac\.in$/,
        );
        expect(faculty?.contact.phone).toMatch(/^\+91\d{10}$/);
      }
    }
  });
});
