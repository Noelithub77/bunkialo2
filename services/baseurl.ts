const DEFAULT_BASE_URL = "https://lmsug24.iiitkottayam.ac.in";

// Roll numbers start with 20XX (e.g., REDACTED_LMS_USERNAME)
const extractYearSuffix = (username: string): string | null => {
  const cleaned = username.trim();
  if (!cleaned) return null;
  const match = cleaned.match(/^20(\d{2})/);
  return match ? match[1] : null;
};

const getBaseUrlFromUsername = (username: string): string => {
  const yearSuffix = extractYearSuffix(username);
  if (!yearSuffix) {
    return DEFAULT_BASE_URL;
  }
  return `https://lmsug${yearSuffix}.iiitkottayam.ac.in`;
};

export const getBaseUrl = (username?: string | null): string => {
  if (!username) {
    return DEFAULT_BASE_URL;
  }
  return getBaseUrlFromUsername(username);
};
