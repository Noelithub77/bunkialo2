import type { AttendanceRecord, DayOfWeek, SessionType } from "@/types";
import { debug } from "@/utils/debug";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const MONTHS: Record<string, number> = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

const SESSION_TYPE_PRIORITY: Record<SessionType, number> = {
  regular: 1,
  tutorial: 2,
  lab: 3,
};

interface ParsedAttendanceSlot {
  dayOfWeek: DayOfWeek;
  startMinutes: number;
  endMinutes: number;
  startTime: string;
  endTime: string;
  sessionType: SessionType;
  weekKey: string;
  endedAtMs: number;
}

interface SlotCluster {
  dayOfWeek: DayOfWeek;
  count: number;
  startSum: number;
  startSamples: number[];
  endSamples: number[];
  weekKeys: Set<string>;
  sessionTypeCounts: Record<SessionType, number>;
  lastSeenAtMs: number;
}

interface ScoredCluster {
  cluster: SlotCluster;
  score: number;
  weekCoverage: number;
}

export interface InferredRecurringSlot {
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
  sessionType: SessionType;
  occurrenceCount: number;
  weekCount: number;
  dayActiveWeekCount: number;
  totalWeekSpanCount: number;
  dayObservationCount: number;
  score: number;
}

export interface InferredRecurringSlotCandidate extends InferredRecurringSlot {
  slotKey: string;
  selectedByRule: boolean;
}

export interface InferredRecurringResult {
  selectedSlots: InferredRecurringSlot[];
  candidates: InferredRecurringSlotCandidate[];
}

interface InferenceOptions {
  now?: Date;
  startToleranceMinutes?: number;
  totalWeekSpanOverride?: number;
}

const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

type ParseFailureReason =
  | "missing_day"
  | "invalid_day"
  | "missing_date"
  | "invalid_month"
  | "missing_time_range"
  | "invalid_time_range"
  | "invalid_date";

const parseTimeToMinutes = (value: string): number | null => {
  const match = value.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i);
  if (!match) return null;

  const hours12 = Number(match[1]);
  const minutes = match[2] ? Number(match[2]) : 0;
  const meridiem = match[3].toUpperCase();

  if (hours12 < 1 || hours12 > 12 || minutes < 0 || minutes > 59) {
    return null;
  }

  let hours24 = hours12 % 12;
  if (meridiem === "PM") hours24 += 12;
  return hours24 * 60 + minutes;
};

const minutesToTime = (minutes: number): string => {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, minutes));
  const hour = Math.floor(clamped / 60);
  const minute = clamped % 60;
  return `${hour.toString().padStart(2, "0")}:${minute
    .toString()
    .padStart(2, "0")}`;
};

const calculateDurationMinutes = (startMinutes: number, endMinutes: number) =>
  endMinutes - startMinutes;

const getSessionType = (
  desc: string,
  startMinutes: number,
  endMinutes: number,
): SessionType => {
  const lower = desc.toLowerCase();
  if (lower.includes("lab")) return "lab";
  if (lower.includes("tutorial")) return "tutorial";

  if (calculateDurationMinutes(startMinutes, endMinutes) >= 110) {
    return "lab";
  }

  return "regular";
};

const getIsoWeekKey = (date: Date): string => {
  const utcDate = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
  const dayNum = utcDate.getUTCDay() || 7;
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - dayNum);

  const isoYear = utcDate.getUTCFullYear();
  const yearStart = new Date(Date.UTC(isoYear, 0, 1));
  const weekNo = Math.ceil(
    ((utcDate.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
  );

  return `${isoYear}-${weekNo.toString().padStart(2, "0")}`;
};

const getStartOfIsoWeekUtcMs = (timestampMs: number): number => {
  const date = new Date(timestampMs);
  const day = date.getUTCDay() || 7;
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - (day - 1));
  return date.getTime();
};

const getInclusiveIsoWeekSpan = (
  fromTimestampMs: number,
  toTimestampMs: number,
): number => {
  if (toTimestampMs <= fromTimestampMs) return 1;
  const start = getStartOfIsoWeekUtcMs(fromTimestampMs);
  const end = getStartOfIsoWeekUtcMs(toTimestampMs);
  if (end <= start) return 1;
  return Math.floor((end - start) / MS_PER_WEEK) + 1;
};

const parseAttendanceSlot = (
  record: AttendanceRecord,
): { slot: ParsedAttendanceSlot | null; reason?: ParseFailureReason } => {
  const dayMatch = record.date.match(/^([A-Za-z]{3})\s+/);
  if (!dayMatch) return { slot: null, reason: "missing_day" };

  const dayOfWeek = DAY_NAMES.indexOf(dayMatch[1] as (typeof DAY_NAMES)[number]);
  if (dayOfWeek === -1) return { slot: null, reason: "invalid_day" };

  const dateMatch = record.date.match(/(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})/);
  if (!dateMatch) return { slot: null, reason: "missing_date" };

  const day = Number(dateMatch[1]);
  const month = MONTHS[dateMatch[2].toLowerCase()];
  const year = Number(dateMatch[3]);
  if (month === undefined) return { slot: null, reason: "invalid_month" };

  const timeMatch = record.date.match(
    /(\d{1,2}(?::\d{2})?\s*(?:AM|PM))\s*-\s*(\d{1,2}(?::\d{2})?\s*(?:AM|PM))/i,
  );
  if (!timeMatch) return { slot: null, reason: "missing_time_range" };

  const startMinutes = parseTimeToMinutes(timeMatch[1]);
  const endMinutes = parseTimeToMinutes(timeMatch[2]);
  if (startMinutes === null || endMinutes === null || endMinutes <= startMinutes) {
    return { slot: null, reason: "invalid_time_range" };
  }

  const sessionDate = new Date(year, month, day);
  if (Number.isNaN(sessionDate.getTime())) {
    return { slot: null, reason: "invalid_date" };
  }

  const sessionEnd = new Date(year, month, day);
  sessionEnd.setHours(Math.floor(endMinutes / 60), endMinutes % 60, 0, 0);

  return {
    slot: {
      dayOfWeek: dayOfWeek as DayOfWeek,
      startMinutes,
      endMinutes,
      startTime: minutesToTime(startMinutes),
      endTime: minutesToTime(endMinutes),
      sessionType: getSessionType(record.description, startMinutes, endMinutes),
      weekKey: getIsoWeekKey(sessionDate),
      endedAtMs: sessionEnd.getTime(),
    },
  };
};

const median = (values: number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return Math.round((sorted[mid - 1] + sorted[mid]) / 2);
  }
  return sorted[mid];
};

const resolveSessionType = (
  counts: Record<SessionType, number>,
): SessionType => {
  const entries = Object.entries(counts) as [SessionType, number][];
  entries.sort((a, b) => {
    if (a[1] !== b[1]) return b[1] - a[1];
    return SESSION_TYPE_PRIORITY[b[0]] - SESSION_TYPE_PRIORITY[a[0]];
  });
  return entries[0][0];
};

const buildCandidateSlot = (
  cluster: SlotCluster,
  score: number,
  dayActiveWeekCount: number,
  totalWeekSpanCount: number,
  dayObservationCount: number,
): InferredRecurringSlotCandidate => {
  const startMinutes = median(cluster.startSamples);
  let endMinutes = median(cluster.endSamples);
  if (endMinutes <= startMinutes) {
    endMinutes = Math.min(23 * 60 + 59, startMinutes + 55);
  }

  const startTime = minutesToTime(startMinutes);
  const endTime = minutesToTime(endMinutes);

  return {
    slotKey: `${cluster.dayOfWeek}-${startTime}-${endTime}`,
    dayOfWeek: cluster.dayOfWeek,
    startTime,
    endTime,
    sessionType: resolveSessionType(cluster.sessionTypeCounts),
    occurrenceCount: cluster.count,
    weekCount: cluster.weekKeys.size,
    dayActiveWeekCount,
    totalWeekSpanCount,
    dayObservationCount,
    score,
    selectedByRule: false,
  };
};

export const inferRecurringLmsSlotsVerbose = (
  records: AttendanceRecord[],
  options: InferenceOptions = {},
): InferredRecurringResult => {
  if (records.length === 0) return { selectedSlots: [], candidates: [] };

  const nowMs = (options.now ?? new Date()).getTime();
  const startToleranceMinutes = options.startToleranceMinutes ?? 20;

  const parseFailures: Record<ParseFailureReason, number> = {
    missing_day: 0,
    invalid_day: 0,
    missing_date: 0,
    invalid_month: 0,
    missing_time_range: 0,
    invalid_time_range: 0,
    invalid_date: 0,
  };
  const failureSamples: { reason: ParseFailureReason; date: string }[] = [];
  const parsed: ParsedAttendanceSlot[] = [];

  for (const record of records) {
    const outcome = parseAttendanceSlot(record);
    if (outcome.slot) {
      parsed.push(outcome.slot);
      continue;
    }

    if (outcome.reason) {
      parseFailures[outcome.reason] += 1;
      if (failureSamples.length < 5) {
        failureSamples.push({ reason: outcome.reason, date: record.date });
      }
    }
  }

  const parseFailedCount = records.length - parsed.length;
  if (parseFailedCount > 0) {
    debug.timetable("Skipped malformed Moodle attendance rows", {
      totalRows: records.length,
      parsedRows: parsed.length,
      skippedRows: parseFailedCount,
      failures: parseFailures,
      samples: failureSamples,
    });
  }

  if (parsed.length === 0) {
    debug.timetable("No parseable timetable slots found in Moodle response", {
      totalRows: records.length,
      failures: parseFailures,
    });
    return { selectedSlots: [], candidates: [] };
  }

  const pastSlots = parsed.filter((slot) => slot.endedAtMs <= nowMs);
  const observedSlots = pastSlots.length > 0 ? pastSlots : parsed;
  if (pastSlots.length === 0) {
    debug.timetable(
      "No completed sessions found; using all parseable rows for inference",
      { parseableRows: parsed.length },
    );
  }

  const oldestObservedMs = observedSlots.reduce(
    (min, slot) => Math.min(min, slot.endedAtMs),
    observedSlots[0]?.endedAtMs ?? nowMs,
  );
  const latestObservedMs = observedSlots.reduce(
    (max, slot) => Math.max(max, slot.endedAtMs),
    observedSlots[0]?.endedAtMs ?? nowMs,
  );
  const timelineEndMs = Math.max(nowMs, latestObservedMs);
  const computedWeekSpanCount = getInclusiveIsoWeekSpan(
    oldestObservedMs,
    timelineEndMs,
  );
  const totalWeekSpanCount =
    options.totalWeekSpanOverride && options.totalWeekSpanOverride > 0
      ? options.totalWeekSpanOverride
      : computedWeekSpanCount;

  const clustersByDay = new Map<DayOfWeek, SlotCluster[]>();
  const dayWeeks = new Map<DayOfWeek, Set<string>>();

  for (const slot of observedSlots) {
    const clusters = clustersByDay.get(slot.dayOfWeek) ?? [];
    const weekSet = dayWeeks.get(slot.dayOfWeek) ?? new Set<string>();
    weekSet.add(slot.weekKey);
    dayWeeks.set(slot.dayOfWeek, weekSet);

    let bestCluster: SlotCluster | null = null;
    let bestDiff = Number.POSITIVE_INFINITY;

    for (const cluster of clusters) {
      const avgStart = cluster.startSum / cluster.count;
      const diff = Math.abs(avgStart - slot.startMinutes);
      if (diff <= startToleranceMinutes && diff < bestDiff) {
        bestDiff = diff;
        bestCluster = cluster;
      }
    }

    if (bestCluster) {
      bestCluster.count += 1;
      bestCluster.startSum += slot.startMinutes;
      bestCluster.startSamples.push(slot.startMinutes);
      bestCluster.endSamples.push(slot.endMinutes);
      bestCluster.weekKeys.add(slot.weekKey);
      bestCluster.sessionTypeCounts[slot.sessionType] += 1;
      bestCluster.lastSeenAtMs = Math.max(bestCluster.lastSeenAtMs, slot.endedAtMs);
      continue;
    }

    clusters.push({
      dayOfWeek: slot.dayOfWeek,
      count: 1,
      startSum: slot.startMinutes,
      startSamples: [slot.startMinutes],
      endSamples: [slot.endMinutes],
      weekKeys: new Set([slot.weekKey]),
      sessionTypeCounts: {
        regular: slot.sessionType === "regular" ? 1 : 0,
        tutorial: slot.sessionType === "tutorial" ? 1 : 0,
        lab: slot.sessionType === "lab" ? 1 : 0,
      },
      lastSeenAtMs: slot.endedAtMs,
    });
    clustersByDay.set(slot.dayOfWeek, clusters);
  }

  const selected: InferredRecurringSlot[] = [];
  const candidates: InferredRecurringSlotCandidate[] = [];

  for (const [dayOfWeek, clusters] of clustersByDay.entries()) {
    if (clusters.length === 0) continue;

    const activeWeeksForDay = (dayWeeks.get(dayOfWeek) ?? new Set()).size;
    const totalObservations = clusters.reduce((sum, cluster) => sum + cluster.count, 0);

    const scored: ScoredCluster[] = clusters.map((cluster) => {
      const weekCoverage =
        activeWeeksForDay > 0 ? cluster.weekKeys.size / activeWeeksForDay : 0;
      const occurrenceRatio =
        totalObservations > 0 ? cluster.count / totalObservations : 0;
      const score = weekCoverage * 0.75 + occurrenceRatio * 0.25;
      return { cluster, score, weekCoverage };
    });

    scored.sort((a, b) => {
      if (a.score !== b.score) return b.score - a.score;
      if (a.cluster.count !== b.cluster.count) return b.cluster.count - a.cluster.count;
      return b.cluster.lastSeenAtMs - a.cluster.lastSeenAtMs;
    });

    const keepAll = activeWeeksForDay < 3;
    const bestScore = scored[0]?.score ?? 0;
    const scoreCutoff = Math.max(bestScore - 0.2, 0.55);

    const kept = keepAll
      ? scored
      : scored.filter(
          ({ cluster, weekCoverage, score }) =>
            cluster.count >= 2 && weekCoverage >= 0.5 && score >= scoreCutoff,
        );
    const effectiveKept = kept.length > 0 ? kept : scored.slice(0, 1);
    if (!keepAll && kept.length === 0 && scored.length > 0) {
      debug.timetable("No cluster passed strict threshold; using best fallback", {
        dayOfWeek,
        activeWeeksForDay,
        bestScore,
      });
    }

    const selectedClusterSet = new Set(
      effectiveKept.map(({ cluster }) => cluster),
    );

    for (const { cluster, score } of scored) {
      const candidate = buildCandidateSlot(
        cluster,
        score,
        activeWeeksForDay,
        totalWeekSpanCount,
        totalObservations,
      );
      candidate.selectedByRule = selectedClusterSet.has(cluster);
      candidates.push(candidate);

      if (candidate.selectedByRule) {
        selected.push({
          dayOfWeek: candidate.dayOfWeek,
          startTime: candidate.startTime,
          endTime: candidate.endTime,
          sessionType: candidate.sessionType,
          occurrenceCount: candidate.occurrenceCount,
          weekCount: candidate.weekCount,
          dayActiveWeekCount: candidate.dayActiveWeekCount,
          totalWeekSpanCount: candidate.totalWeekSpanCount,
          dayObservationCount: candidate.dayObservationCount,
          score: candidate.score,
        });
      }
    }
  }

  selected.sort((a, b) => {
    if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek;
    return a.startTime.localeCompare(b.startTime);
  });

  candidates.sort((a, b) => {
    if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek;
    return a.startTime.localeCompare(b.startTime);
  });

  return { selectedSlots: selected, candidates };
};

export const inferRecurringLmsSlots = (
  records: AttendanceRecord[],
  options: InferenceOptions = {},
): InferredRecurringSlot[] =>
  inferRecurringLmsSlotsVerbose(records, options).selectedSlots;
