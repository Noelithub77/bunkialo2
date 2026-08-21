import type { Credentials } from "@/types";
import axios, { type AxiosRequestConfig } from "axios";
import { getBaseUrl } from "./baseurl";

const DEFAULT_BASE_URL = "https://lmsug24.iiitkottayam.ac.in";
let currentBaseUrl = DEFAULT_BASE_URL;
let reauthEnabled = true;
let reauthPromise: Promise<boolean> | null = null;

const toRelayUrl = (value: string, baseUrl: string): string => {
  const upstream = new URL(value, baseUrl);
  return `/api/lms${upstream.pathname}${upstream.search}`;
};

export const api = axios.create({
  baseURL: "/api/lms",
  headers: { Accept: "text/html,application/xhtml+xml,application/json,*/*" },
  timeout: 30_000,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  if (config.url) config.url = toRelayUrl(config.url, currentBaseUrl);
  config.baseURL = undefined;
  return config;
});

api.interceptors.response.use(async (response) => {
  if (
    reauthEnabled &&
    typeof response.data === "string" &&
    !response.config.headers?.["X-Retry-After-Reauth"] &&
    (/name=["']logintoken["']/i.test(response.data) || /id=["']login["']/i.test(response.data))
  ) {
    reauthPromise ??= import("./auth/lms-auth")
      .then(({ tryAutoLogin }) => tryAutoLogin())
      .finally(() => {
        reauthPromise = null;
      });
    if (await reauthPromise) {
      const retry: AxiosRequestConfig = {
        ...response.config,
        headers: { ...response.config.headers, "X-Retry-After-Reauth": "true" },
      };
      return api.request(retry);
    }
  }
  return response;
});

export const updateBaseUrl = (username?: string): void => {
  currentBaseUrl = getBaseUrl(username);
};

export const getCurrentBaseUrl = (): string => currentBaseUrl;
export const clearCookies = (): void => undefined;
export const setReauthEnabled = (enabled: boolean): void => {
  reauthEnabled = enabled;
};
export const getDebugInfo = (): {
  baseUrl: string;
  cookieCount: number;
  cookies: Record<string, string>;
} => ({ baseUrl: currentBaseUrl, cookieCount: 0, cookies: {} });
export const BASE_URL = DEFAULT_BASE_URL;

export const getWebCredentials = async (): Promise<Credentials | null> => null;
