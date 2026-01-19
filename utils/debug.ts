// Debug utility for logging with timestamps and categories

const DEBUG_ENABLED = __DEV__; // Only in development

type LogCategory =
  | "AUTH"
  | "COOKIE"
  | "SCRAPER"
  | "API"
  | "STORE"
  | "COURSE_NAME";

export const debug = {
  log: (category: LogCategory, message: string, data?: unknown) => {
    if (!DEBUG_ENABLED) return;
    const timestamp = new Date().toISOString().split("T")[1].slice(0, 12);

    // Only log COURSE_NAME category
    if (category === "COURSE_NAME") {
      console.log(`[${timestamp}] [${category}] ${message}`);
      if (data !== undefined) {
        console.log(JSON.stringify(data, null, 2));
      }
    }
  },

  auth: (message: string, data?: unknown) => {}, // debug.log('AUTH', message, data),
  cookie: (message: string, data?: unknown) => {}, // debug.log('COOKIE', message, data),
  scraper: (message: string, data?: unknown) => {}, // debug.log('SCRAPER', message, data),
  api: (message: string, data?: unknown) => {}, // debug.log('API', message, data),
  store: (message: string, data?: unknown) => {}, // debug.log('STORE', message, data),
  courseName: (message: string, data?: unknown) =>
    debug.log("COURSE_NAME", message, data),
};
