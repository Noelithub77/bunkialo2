const DEFAULT_BASE_URL = "https://lmsug24.iiitkottayam.ac.in";

const getBaseUrlFromUsername = (username: string): string => {
  const yearMatch = username.match(/^20(\d{2})/);
  if (!yearMatch) {
    return DEFAULT_BASE_URL;
  }
  const yearSuffix = yearMatch[1];
  return `https://lmsug${yearSuffix}.iiitkottayam.ac.in`;
};

export const getBaseUrl = (username?: string): string => {
  if (!username) {
    return DEFAULT_BASE_URL;
  }
  return getBaseUrlFromUsername(username);
};
