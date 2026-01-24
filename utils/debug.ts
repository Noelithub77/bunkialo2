// Debug utility for logging with timestamps and categories

const DEBUG_ENABLED = __DEV__; // Only in development

type LogCategory =
  | "AUTH"
  | "COOKIE"
  | "SCRAPER"
  | "API"
  | "STORE"
  | "COURSE_NAME";

const ENABLED_CATEGORIES: LogCategory[] = [
  "AUTH",
  "COOKIE",
  "API",
  "STORE",
  "COURSE_NAME",
];

const CATEGORY_COLORS: Record<LogCategory, string> = {
  AUTH: "\x1b[36m", // cyan
  COOKIE: "\x1b[33m", // yellow
  SCRAPER: "\x1b[90m", // gray (disabled by default)
  API: "\x1b[34m", // blue
  STORE: "\x1b[35m", // magenta
  COURSE_NAME: "\x1b[32m", // green
};

const COLOR_RESET = "\x1b[0m";

const MAX_STRING_LENGTH = 200;
const MAX_ARRAY_LENGTH = 6;
const MAX_OBJECT_KEYS = 12;

const truncate = (value: string): string =>
  value.length > MAX_STRING_LENGTH
    ? `${value.slice(0, MAX_STRING_LENGTH)}...`
    : value;

const sanitize = (value: unknown): unknown => {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return truncate(value);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (value instanceof Error) {
    return { name: value.name, message: truncate(value.message) };
  }
  if (Array.isArray(value)) {
    return value.slice(0, MAX_ARRAY_LENGTH).map(sanitize);
  }
  if (typeof value === "object") {
    const result: Record<string, unknown> = {};
    let count = 0;
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (count >= MAX_OBJECT_KEYS) {
        result._truncated = true;
        break;
      }
      result[key] = sanitize(val);
      count += 1;
    }
    return result;
  }
  return String(value);
};

export const debug = {
  log: (category: LogCategory, message: string, data?: unknown) => {
    if (!DEBUG_ENABLED) return;
    if (!ENABLED_CATEGORIES.includes(category)) return;
    const color = CATEGORY_COLORS[category] ?? "";
    const base = `${color}[${category}]${COLOR_RESET} ${message}`;

    if (data === undefined) {
      console.log(base);
      return;
    }

    const payload = JSON.stringify(sanitize(data));
    console.log(`${base} ${payload}`);
  },

  auth: (message: string, data?: unknown) => debug.log("AUTH", message, data),
  cookie: (message: string, data?: unknown) => debug.log("COOKIE", message, data),
  scraper: (_message: string, _data?: unknown) => {}, // intentionally disabled
  api: (message: string, data?: unknown) => debug.log("API", message, data),
  store: (message: string, data?: unknown) => debug.log("STORE", message, data),
  courseName: (message: string, data?: unknown) =>
    debug.log("COURSE_NAME", message, data),
};
