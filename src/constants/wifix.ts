export const WIFIX_KEEPALIVE_QUERY = "02010f0d0a03050e";
export const WIFIX_KEEPALIVE_PATH = `/keepalive?${WIFIX_KEEPALIVE_QUERY}`;
export const WIFIX_DEFAULT_PORT = "1000";
export const WIFIX_DEFAULT_SCHEME = "http://";

export const CAMPUS_PORTAL_URL =
  "https://auth.iiitkottayam.ac.in:1442/fgtauth?06654743c24164e4";

export const WIFIX_PORTAL_PRESETS = [
  {
    id: "campus",
    label: "Campus",
    url: CAMPUS_PORTAL_URL,
  },
  {
    id: "nila",
    label: "Nila",
    url: `http://172.16.128.1:1000${WIFIX_KEEPALIVE_PATH}`,
  },
] as const;

export const DEFAULT_MANUAL_PORTAL_URL = WIFIX_PORTAL_PRESETS[0].url;
