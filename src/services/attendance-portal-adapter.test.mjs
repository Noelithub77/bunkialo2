// Run: npm run test
//
// The adapter's whole job is to emit records the EXISTING pipeline can read.
// So these tests import the real downstream parsers rather than restating the
// expected format: if the format drifts, 16 call sites break silently and these
// fail loudly.
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  toCourseAttendance,
  resolveCourseId,
} from "./attendance-portal-adapter.ts";
import {
  parseTimeSlot,
  isAttendanceRecordCompleted,
  getCanonicalRecordDescription,
  buildRecordKey,
} from "../utils/attendance-helpers.ts";
import { inferRecurringLmsSlots } from "../utils/timetable-inference.ts";

const session = (over = {}) => ({
  sessionId: "s1",
  date: "2026-01-01",
  startTime: "09:00",
  endTime: "09:55",
  section: "A",
  topic: "Intro",
  status: "PRESENT",
  ...over,
});

const portalCourse = (over = {}) => ({
  courseId: "p-1",
  courseCode: "CS101",
  courseName: "Data Structures",
  present: 1,
  total: 1,
  percentage: 100,
  ...over,
});

const firstRecord = (sessions, course = portalCourse()) =>
  toCourseAttendance(course, sessions, []).records[0];

test("emits a date string the real time-slot parser can read", () => {
  const record = firstRecord([session()]);
  assert.equal(parseTimeSlot(record.date), "9:00AM - 9:55AM");
});

test("emits a date string the real completion check can read", () => {
  // 1 Jan 2026 is in the past relative to any plausible run date.
  const record = firstRecord([session()]);
  assert.equal(isAttendanceRecordCompleted(record), true);
});

test("a session that has not happened yet is not marked completed", () => {
  const record = firstRecord([session({ date: "2099-01-01" })]);
  assert.equal(isAttendanceRecordCompleted(record), false);
});

test("derives the weekday name from the date rather than trusting input", () => {
  // 2026-01-01 is a Thursday. timetable-inference reads dayOfWeek off this name.
  const record = firstRecord([session()]);
  assert.match(record.date, /^Thu 1 Jan 2026 /);
});

test("formats a real portal payload", () => {
  // Captured live 2026-08-01: the portal sends a calendar date pinned to UTC
  // midnight and 24-hour HH:MM times. 31 Jul 2026 is a Friday.
  const record = firstRecord([
    session({
      date: "2026-07-31T00:00:00.000Z",
      startTime: "11:30",
      endTime: "13:30",
    }),
  ]);
  assert.equal(record.date, "Fri 31 Jul 2026 11:30AM - 1:30PM");
});

test("the UTC-midnight date is read as a calendar date, not converted", () => {
  // Converting "...T00:00:00.000Z" through local time rolls the day back for
  // anyone west of UTC, which silently moves the class to the wrong weekday.
  // These two must agree in every timezone.
  const iso = firstRecord([session({ date: "2026-07-31T00:00:00.000Z" })]);
  const plain = firstRecord([session({ date: "2026-07-31" })]);
  assert.equal(iso.date, plain.date);
  assert.match(iso.date, /^Fri 31 Jul 2026 /);
});

test("tolerates seconds on the clock times", () => {
  const record = firstRecord([
    session({ startTime: "11:30:00", endTime: "13:30:00" }),
  ]);
  assert.equal(parseTimeSlot(record.date), "11:30AM - 1:30PM");
});

test("rejects a meridiem time rather than misreading it", () => {
  // The portal sends 24-hour only. If that ever changes, sessions get dropped
  // and attendance looks short — which is louder than a silent 12-hour misparse.
  const course = toCourseAttendance(
    portalCourse(),
    [session({ startTime: "9:00 AM", endTime: "9:55 AM" })],
    [],
  );
  assert.equal(course.records.length, 0);
});

test("formats afternoon times as PM", () => {
  const record = firstRecord([
    session({ startTime: "14:00", endTime: "15:50" }),
  ]);
  assert.equal(parseTimeSlot(record.date), "2:00PM - 3:50PM");
});

test("formats noon and midnight without a zero hour", () => {
  const noon = firstRecord([session({ startTime: "12:00", endTime: "12:55" })]);
  assert.equal(parseTimeSlot(noon.date), "12:00PM - 12:55PM");

  const midnight = firstRecord([
    session({ startTime: "00:10", endTime: "00:55" }),
  ]);
  assert.equal(parseTimeSlot(midnight.date), "12:10AM - 12:55AM");
});

test("drops a session it cannot parse rather than emitting a bad string", () => {
  const course = toCourseAttendance(
    portalCourse(),
    [session(), session({ sessionId: "s2", startTime: "not a time" })],
    [],
  );
  assert.equal(course.records.length, 1);
});

// --- the real timetable pipeline, unmodified ---

test("the real inference engine recovers a weekly slot from portal sessions", () => {
  // Four consecutive Thursdays, 9:00-9:55.
  const sessions = ["2026-01-01", "2026-01-08", "2026-01-15", "2026-01-22"].map(
    (date, i) => session({ sessionId: `s${i}`, date }),
  );

  const { records } = toCourseAttendance(portalCourse(), sessions, []);
  const slots = inferRecurringLmsSlots(records, {
    now: new Date(2026, 0, 29),
  });

  assert.equal(slots.length, 1);
  assert.equal(slots[0].dayOfWeek, 4); // Thursday
  assert.equal(slots[0].startTime, "09:00");
  assert.equal(slots[0].endTime, "09:55");
  assert.equal(slots[0].sessionType, "regular");
});

test("the real inference engine still auto-detects labs by duration", () => {
  const sessions = ["2026-01-02", "2026-01-09", "2026-01-16", "2026-01-23"].map(
    (date, i) =>
      session({ sessionId: `s${i}`, date, startTime: "14:00", endTime: "16:00" }),
  );

  const { records } = toCourseAttendance(portalCourse(), sessions, []);
  const slots = inferRecurringLmsSlots(records, {
    now: new Date(2026, 0, 29),
  });

  assert.equal(slots[0].sessionType, "lab");
});

// --- status mapping ---

test("maps every portal status onto an app status", () => {
  const statuses = ["PRESENT", "ABSENT", "LATE", "EXCUSED", "DUTY_LEAVE"];
  const { records } = toCourseAttendance(
    portalCourse(),
    statuses.map((status, i) => session({ sessionId: `s${i}`, status })),
    [],
  );

  assert.deepEqual(
    records.map((r) => r.status),
    ["Present", "Absent", "Late", "Excused", "Excused"],
  );
});

test("an unrecognised status degrades to Unknown rather than throwing", () => {
  const record = firstRecord([session({ status: "SOMETHING_NEW" })]);
  assert.equal(record.status, "Unknown");
});

// --- summary figures ---

test("marks courses as portal-sourced", () => {
  // bunk-store's semester auto-drop is a Moodle-era heuristic. The portal only
  // ever returns the active term, so the flag lets that heuristic stand down.
  const course = toCourseAttendance(portalCourse(), [], []);
  assert.equal(course.source, "portal");
});

test("derives the percentage when the payload omits it", () => {
  // Live payload keys are courseId, courseCode, courseName, total, present,
  // dlCredited. Percentage is not guaranteed.
  const { percentage: _drop, ...withoutPercentage } = portalCourse({
    present: 3,
    total: 4,
  });
  const course = toCourseAttendance(withoutPercentage, [], []);
  assert.equal(course.percentage, 75);
});

test("a course with no sessions yet reports zero rather than NaN", () => {
  const { percentage: _drop, ...withoutPercentage } = portalCourse({
    present: 0,
    total: 0,
  });
  const course = toCourseAttendance(withoutPercentage, [], []);
  assert.equal(course.percentage, 0);
});

test("copies the portal's own totals instead of recomputing them", () => {
  // The portal counts EXCUSED as absent; the app does not. Recomputing here
  // would make Bunkialo disagree with the figure the student sees officially.
  const course = toCourseAttendance(
    portalCourse({ present: 7, total: 10, percentage: 70 }),
    [session({ status: "EXCUSED" })],
    [],
  );

  assert.equal(course.attended, 7);
  assert.equal(course.totalSessions, 10);
  assert.equal(course.percentage, 70);
});

test("builds a course name the existing extractors can split", () => {
  const course = toCourseAttendance(portalCourse(), [], []);
  assert.equal(course.courseName, "CS101 Data Structures");
});

// --- record key stability ---

test("record identity survives a faculty editing the session topic", () => {
  const before = firstRecord([session({ topic: "Intro" })]);
  const after = firstRecord([session({ topic: "Intro (revised)" })]);

  assert.equal(
    buildRecordKey(before.date, getCanonicalRecordDescription(before)),
    buildRecordKey(after.date, getCanonicalRecordDescription(after)),
  );
});

// --- malformed input ---

test("a session ending before it starts produces no timetable slot", () => {
  const sessions = ["2026-01-01", "2026-01-08", "2026-01-15", "2026-01-22"].map(
    (date, i) =>
      session({ sessionId: `s${i}`, date, startTime: "13:30", endTime: "11:30" }),
  );

  const { records } = toCourseAttendance(portalCourse(), sessions, []);
  const slots = inferRecurringLmsSlots(records, { now: new Date(2026, 0, 29) });

  // The string is emitted, but the inference parser rejects the range rather
  // than inventing a negative-duration class.
  assert.equal(slots.length, 0);
});

test("an out-of-range clock time is rejected", () => {
  const course = toCourseAttendance(
    portalCourse(),
    [
      session({ startTime: "25:00", endTime: "26:00" }),
      session({ sessionId: "s2", startTime: "09:70", endTime: "10:00" }),
    ],
    [],
  );
  assert.equal(course.records.length, 0);
});

test("an empty session list yields an empty record list", () => {
  const course = toCourseAttendance(portalCourse(), [], []);
  assert.deepEqual(course.records, []);
});

test("a missing topic does not break the record", () => {
  const record = firstRecord([session({ topic: null })]);
  assert.equal(record.description, "");
});

test("sessions arriving out of order still infer one slot", () => {
  const dates = ["2026-01-22", "2026-01-01", "2026-01-15", "2026-01-08"];
  const sessions = dates.map((date, i) => session({ sessionId: `s${i}`, date }));

  const { records } = toCourseAttendance(portalCourse(), sessions, []);
  const slots = inferRecurringLmsSlots(records, { now: new Date(2026, 0, 29) });

  assert.equal(slots.length, 1);
  assert.equal(slots[0].dayOfWeek, 4);
});

// --- course identity join ---

test("resolves a portal course onto the matching Moodle course id", () => {
  const id = resolveCourseId(portalCourse({ courseCode: "CS101" }), [
    { courseId: "4821", courseCode: "MA102" },
    { courseId: "4977", courseCode: "CS101" },
  ]);
  assert.equal(id, "4977");
});

test("matches course codes despite spacing and case differences", () => {
  const id = resolveCourseId(portalCourse({ courseCode: "cs 101" }), [
    { courseId: "4977", courseCode: "CS-101" },
  ]);
  assert.equal(id, "4977");
});

test("falls back to a stable code-derived id when Moodle has no match", () => {
  const args = [portalCourse({ courseCode: "CS101" }), []];
  assert.equal(resolveCourseId(...args), "portal:CS101");
  // Stable across runs: a second call must produce the same key, or every sync
  // would orphan the previous sync's bunk records.
  assert.equal(resolveCourseId(...args), "portal:CS101");
});

test("picks a deterministic match when two Moodle courses share a code", () => {
  const args = [
    portalCourse({ courseCode: "CS101" }),
    [
      { courseId: "first", courseCode: "CS101" },
      { courseId: "second", courseCode: "CS101" },
    ],
  ];
  // Must not alternate between syncs, or bunk records would migrate course to
  // course on every refresh.
  assert.equal(resolveCourseId(...args), "first");
  assert.equal(resolveCourseId(...args), "first");
});

test("a portal course with a blank code still gets a stable id", () => {
  const id = resolveCourseId(portalCourse({ courseCode: "  " }), []);
  assert.equal(id, "portal:p-1");
});

test("ignores Moodle courses whose code could not be extracted", () => {
  const id = resolveCourseId(portalCourse({ courseCode: "CS101" }), [
    { courseId: "4821", courseCode: "" },
  ]);
  assert.equal(id, "portal:CS101");
});
