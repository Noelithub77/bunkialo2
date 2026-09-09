import type {
  DesktopDayOfWeek,
  DesktopSessionType,
  DesktopTimetableSlot,
} from "../../shared/desktop";

export interface DesktopSessionObservation {
  courseId: string;
  courseName: string;
  date: string;
  endTime: string;
  startTime: string;
  topic: string;
}

interface ParsedObservation extends DesktopSessionObservation {
  dayOfWeek: DesktopDayOfWeek;
  endedAtMs: number;
  endMinutes: number;
  sessionType: DesktopSessionType;
  startMinutes: number;
  weekKey: string;
}

interface SlotCluster {
  count: number;
  dayOfWeek: DesktopDayOfWeek;
  endSamples: number[];
  lastSeenAtMs: number;
  sessionTypeCounts: Record<DesktopSessionType, number>;
  startSamples: number[];
  startSum: number;
  weekKeys: Set<string>;
}

interface CandidateSlot {
  dayActiveWeekCount: number;
  dayOfWeek: DesktopDayOfWeek;
  endTime: string;
  occurrenceCount: number;
  score: number;
  selectedByRule: boolean;
  sessionType: DesktopSessionType;
  slotKey: string;
  startTime: string;
  totalWeekSpanCount: number;
}

interface ChosenSlot {
  candidate: CandidateSlot;
  courseId: string;
  courseName: string;
}

const START_TOLERANCE_MINUTES = 20;
const AUTO_SLOT_START_CONFLICT_WINDOW_MINUTES = 120;
const SESSION_TYPE_PRIORITY: Record<DesktopSessionType, number> = {
  regular: 1,
  tutorial: 2,
  lab: 3,
};

const timeMinutes = (value: string): number => {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
};

const minutesToTime = (value: number): string => {
  const minutes = Math.max(0, Math.min(23 * 60 + 59, value));
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
};

const parseDate = (value: string): Date | null => {
  const dateOnly = value.match(/^(\d{4}-\d{2}-\d{2})/);
  const parsed = new Date(dateOnly ? `${dateOnly[1]}T00:00:00Z` : value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const isoWeekKey = (date: Date): string => {
  const value = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = value.getUTCDay() || 7;
  value.setUTCDate(value.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(value.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((value.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${value.getUTCFullYear()}-${String(week).padStart(2, "0")}`;
};

const sessionType = (
  topic: string,
  startMinutes: number,
  endMinutes: number,
): DesktopSessionType => {
  const lowerTopic = topic.toLowerCase();
  if (lowerTopic.includes("lab")) return "lab";
  if (lowerTopic.includes("tutorial")) return "tutorial";
  return endMinutes - startMinutes >= 110 ? "lab" : "regular";
};

const parseObservation = (
  observation: DesktopSessionObservation,
): ParsedObservation | null => {
  const date = parseDate(observation.date);
  const startMinutes = timeMinutes(observation.startTime);
  const endMinutes = timeMinutes(observation.endTime);
  if (!date || endMinutes <= startMinutes) return null;
  const endedAtMs = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    Math.floor(endMinutes / 60),
    endMinutes % 60,
  );
  return {
    ...observation,
    dayOfWeek: date.getUTCDay() as DesktopDayOfWeek,
    endedAtMs,
    endMinutes,
    sessionType: sessionType(observation.topic, startMinutes, endMinutes),
    startMinutes,
    weekKey: isoWeekKey(date),
  };
};

const median = (values: number[]): number => {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[middle - 1] + sorted[middle]) / 2)
    : sorted[middle];
};

const resolveSessionType = (
  counts: Record<DesktopSessionType, number>,
): DesktopSessionType => {
  const entries = Object.entries(counts) as [DesktopSessionType, number][];
  entries.sort((left, right) =>
    left[1] !== right[1]
      ? right[1] - left[1]
      : SESSION_TYPE_PRIORITY[right[0]] - SESSION_TYPE_PRIORITY[left[0]],
  );
  return entries[0][0];
};

const buildCandidate = (
  cluster: SlotCluster,
  score: number,
  dayActiveWeekCount: number,
  totalWeekSpanCount: number,
): CandidateSlot => {
  const startTime = minutesToTime(median(cluster.startSamples));
  let endMinutes = median(cluster.endSamples);
  const startMinutes = timeMinutes(startTime);
  if (endMinutes <= startMinutes) endMinutes = Math.min(23 * 60 + 59, startMinutes + 55);
  const endTime = minutesToTime(endMinutes);
  return {
    dayActiveWeekCount,
    dayOfWeek: cluster.dayOfWeek,
    endTime,
    occurrenceCount: cluster.count,
    score,
    selectedByRule: false,
    sessionType: resolveSessionType(cluster.sessionTypeCounts),
    slotKey: `${cluster.dayOfWeek}-${startTime}-${endTime}`,
    startTime,
    totalWeekSpanCount,
  };
};

const isOutlier = (candidate: CandidateSlot): boolean =>
  candidate.occurrenceCount / Math.max(candidate.totalWeekSpanCount, 1) <= 0.34;

const overlaps = (first: CandidateSlot, second: CandidateSlot): boolean =>
  first.startTime < second.endTime && second.startTime < first.endTime;

const rank = (candidate: CandidateSlot): number =>
  candidate.occurrenceCount / Math.max(candidate.totalWeekSpanCount, 1);

const weekSpan = (observations: ParsedObservation[], now: Date): number => {
  if (observations.length === 0) return 1;
  const oldest = Math.min(...observations.map((item) => item.endedAtMs));
  const latest = Math.max(now.getTime(), ...observations.map((item) => item.endedAtMs));
  const oldestWeek = new Date(oldest);
  const latestWeek = new Date(latest);
  const start = new Date(Date.UTC(oldestWeek.getUTCFullYear(), oldestWeek.getUTCMonth(), oldestWeek.getUTCDate()));
  const end = new Date(Date.UTC(latestWeek.getUTCFullYear(), latestWeek.getUTCMonth(), latestWeek.getUTCDate()));
  const startDay = start.getUTCDay() || 7;
  const endDay = end.getUTCDay() || 7;
  start.setUTCDate(start.getUTCDate() - startDay + 1);
  end.setUTCDate(end.getUTCDate() - endDay + 1);
  return Math.max(1, Math.floor((end.getTime() - start.getTime()) / 604800000) + 1);
};

const inferCourseSlots = (
  observations: ParsedObservation[],
  totalWeekSpanCount: number,
  now: Date,
): ChosenSlot[] => {
  const past = observations.filter((item) => item.endedAtMs <= now.getTime());
  const observed = past.length > 0 ? past : observations;
  const clustersByDay = new Map<DesktopDayOfWeek, SlotCluster[]>();
  const weeksByDay = new Map<DesktopDayOfWeek, Set<string>>();

  for (const item of observed) {
    const clusters = clustersByDay.get(item.dayOfWeek) ?? [];
    const weeks = weeksByDay.get(item.dayOfWeek) ?? new Set<string>();
    weeks.add(item.weekKey);
    weeksByDay.set(item.dayOfWeek, weeks);
    const existing = clusters.find((cluster) =>
      Math.abs(cluster.startSum / cluster.count - item.startMinutes) <= START_TOLERANCE_MINUTES,
    );
    if (existing) {
      existing.count += 1;
      existing.startSum += item.startMinutes;
      existing.startSamples.push(item.startMinutes);
      existing.endSamples.push(item.endMinutes);
      existing.weekKeys.add(item.weekKey);
      existing.sessionTypeCounts[item.sessionType] += 1;
      existing.lastSeenAtMs = Math.max(existing.lastSeenAtMs, item.endedAtMs);
    } else {
      clusters.push({
        count: 1,
        dayOfWeek: item.dayOfWeek,
        endSamples: [item.endMinutes],
        lastSeenAtMs: item.endedAtMs,
        sessionTypeCounts: {
          lab: item.sessionType === "lab" ? 1 : 0,
          regular: item.sessionType === "regular" ? 1 : 0,
          tutorial: item.sessionType === "tutorial" ? 1 : 0,
        },
        startSamples: [item.startMinutes],
        startSum: item.startMinutes,
        weekKeys: new Set([item.weekKey]),
      });
      clustersByDay.set(item.dayOfWeek, clusters);
    }
  }

  const chosen = new Set<string>();
  const candidatesByDay = new Map<DesktopDayOfWeek, CandidateSlot[]>();
  for (const [day, clusters] of clustersByDay) {
    const activeWeeks = weeksByDay.get(day)?.size ?? 0;
    const totalObservations = clusters.reduce((sum, cluster) => sum + cluster.count, 0);
    const scored = clusters.map((cluster) => {
      const weekCoverage = activeWeeks > 0 ? cluster.weekKeys.size / activeWeeks : 0;
      const occurrenceRatio = totalObservations > 0 ? cluster.count / totalObservations : 0;
      return { cluster, score: weekCoverage * 0.75 + occurrenceRatio * 0.25 };
    }).sort((left, right) =>
      left.score !== right.score
        ? right.score - left.score
        : left.cluster.count !== right.cluster.count
          ? right.cluster.count - left.cluster.count
          : right.cluster.lastSeenAtMs - left.cluster.lastSeenAtMs,
    );
    const bestScore = scored[0]?.score ?? 0;
    const scoreCutoff = Math.max(bestScore - 0.2, 0.55);
    const keepAll = activeWeeks < 3;
    const kept = keepAll
      ? scored
      : scored.filter(({ cluster, score }) =>
          cluster.count >= 2
          && cluster.weekKeys.size / Math.max(activeWeeks, 1) >= 0.5
          && score >= scoreCutoff,
        );
    const selectedClusters = new Set((kept.length > 0 ? kept : scored.slice(0, 1)).map(({ cluster }) => cluster));
    const candidates = scored.map(({ cluster, score }) => {
      const candidate = buildCandidate(cluster, score, activeWeeks, totalWeekSpanCount);
      candidate.selectedByRule = selectedClusters.has(cluster);
      return candidate;
    });
    candidatesByDay.set(day, candidates);
  }

  for (const candidates of candidatesByDay.values()) {
    const selectedByRule = candidates.filter((candidate) => candidate.selectedByRule);
    const selected = selectedByRule.filter((candidate) => !isOutlier(candidate));
    const effectiveSelected = selected.length > 0 ? selected : selectedByRule.slice(0, 1);
    for (const candidate of effectiveSelected) chosen.add(candidate.slotKey);
    for (const alternative of candidates.filter((candidate) => !candidate.selectedByRule && !isOutlier(candidate))) {
      let nearest = effectiveSelected[0];
      let nearestDifference = Number.POSITIVE_INFINITY;
      for (const candidate of effectiveSelected) {
        const difference = Math.abs(timeMinutes(candidate.startTime) - timeMinutes(alternative.startTime));
        if (difference < nearestDifference) {
          nearest = candidate;
          nearestDifference = difference;
        }
      }
      if (!nearest || nearestDifference > AUTO_SLOT_START_CONFLICT_WINDOW_MINUTES || !overlaps(nearest, alternative)) {
        chosen.add(alternative.slotKey);
      } else if (alternative.occurrenceCount > nearest.occurrenceCount) {
        chosen.delete(nearest.slotKey);
        chosen.add(alternative.slotKey);
      }
    }
  }

  const result: ChosenSlot[] = [];
  for (const candidate of [...candidatesByDay.values()].flat()) {
    if (chosen.has(candidate.slotKey)) {
      result.push({ candidate, courseId: observations[0].courseId, courseName: observations[0].courseName });
    }
  }
  return result;
};

export const resolveDesktopTimetable = (
  observations: DesktopSessionObservation[],
  now = new Date(),
): DesktopTimetableSlot[] => {
  const parsed = observations.flatMap((item) => {
    const result = parseObservation(item);
    return result ? [result] : [];
  });
  const totalWeekSpanCount = weekSpan(parsed, now);
  const byCourse = new Map<string, ParsedObservation[]>();
  for (const item of parsed) {
    const course = byCourse.get(item.courseId) ?? [];
    course.push(item);
    byCourse.set(item.courseId, course);
  }

  const automatic: ChosenSlot[] = [];
  for (const courseObservations of byCourse.values()) {
    automatic.push(...inferCourseSlots(courseObservations, totalWeekSpanCount, now));
  }

  const deduplicated = new Map<string, ChosenSlot>();
  for (const item of automatic) {
    deduplicated.set(`${item.candidate.dayOfWeek}-${item.candidate.startTime}-${item.courseId}`, item);
  }
  const slots = [...deduplicated.values()].sort((left, right) =>
    left.candidate.dayOfWeek - right.candidate.dayOfWeek
    || left.candidate.startTime.localeCompare(right.candidate.startTime)
    || left.courseName.localeCompare(right.courseName),
  );
  const removed = new Set<string>();
  for (let firstIndex = 0; firstIndex < slots.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < slots.length; secondIndex += 1) {
      const first = slots[firstIndex];
      const second = slots[secondIndex];
      if (first.candidate.dayOfWeek !== second.candidate.dayOfWeek || first.courseId === second.courseId) continue;
      if (first.candidate.startTime >= second.candidate.endTime || second.candidate.startTime >= first.candidate.endTime) continue;
      const preferred = rank(first.candidate) >= rank(second.candidate) ? first : second;
      const alternative = preferred === first ? second : first;
      removed.add(`${alternative.candidate.dayOfWeek}-${alternative.candidate.startTime}-${alternative.courseId}`);
    }
  }

  return slots
    .filter((item) => !removed.has(`${item.candidate.dayOfWeek}-${item.candidate.startTime}-${item.courseId}`))
    .map((item) => ({
      id: `desktop-${item.courseId}-${item.candidate.dayOfWeek}-${item.candidate.startTime}-${item.candidate.endTime}`,
      courseId: item.courseId,
      courseName: item.courseName,
      dayOfWeek: item.candidate.dayOfWeek,
      startTime: item.candidate.startTime,
      endTime: item.candidate.endTime,
      sessionType: item.candidate.sessionType,
    }));
};
