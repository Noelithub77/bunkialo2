const DEFAULT_BASE_URL = "https://attendance.iiitkottayam.ac.in";

interface AttendanceSessionOptions {
  baseUrl?: string;
  email?: string;
  password?: string;
}

interface TokenResponse {
  access?: string;
  accessToken?: string;
  refresh?: string;
  refreshToken?: string;
  needs2fa?: boolean;
  needsEmailOtp?: boolean;
}

export interface AttendanceRefreshResult {
  status: number;
  body: unknown;
}

export interface AttendanceSession {
  login: () => Promise<{ status: number; setCookie: boolean }>;
  logout: () => Promise<void>;
  refresh: (token?: string | null) => Promise<AttendanceRefreshResult>;
  request: (path: string, options?: RequestInit) => Promise<Response>;
  getRefreshToken: () => string | null;
}

const isTokenResponse = (value: unknown): value is TokenResponse =>
  typeof value === "object" && value !== null;

const parseJson = async (response: Response): Promise<unknown> => {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return {};
  }
};

export const createAttendanceSession = ({
  baseUrl = process.env.ATTENDANCE_BASE_URL || DEFAULT_BASE_URL,
  email = process.env.ATTENDANCE_TEST_EMAIL,
  password = process.env.ATTENDANCE_TEST_PASSWORD,
}: AttendanceSessionOptions = {}): AttendanceSession => {
  if (!email || !password) {
    throw new Error(
      "Missing ATTENDANCE_TEST_EMAIL or ATTENDANCE_TEST_PASSWORD.",
    );
  }

  let accessToken: string | null = null;
  let refreshToken: string | null = null;

  const request = async (
    path: string,
    options: RequestInit = {},
  ): Promise<Response> => {
    const headers = new Headers(options.headers);
    if (!headers.has("Accept")) headers.set("Accept", "application/json");
    if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
    return fetch(`${baseUrl}${path}`, { ...options, headers });
  };

  const login = async (): Promise<{ status: number; setCookie: boolean }> => {
    const response = await request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const body = await parseJson(response);
    if (!response.ok) throw new Error(`Attendance login failed (${response.status}).`);
    if (isTokenResponse(body) && (body.needs2fa || body.needsEmailOtp)) {
      throw new Error("Live test requires an interactive verification code.");
    }
    if (!isTokenResponse(body)) throw new Error("Attendance login returned invalid JSON.");
    accessToken = body.access ?? body.accessToken ?? null;
    refreshToken = body.refresh ?? body.refreshToken ?? null;
    if (!accessToken || !refreshToken) {
      throw new Error("Attendance login returned incomplete tokens.");
    }
    return {
      status: response.status,
      setCookie: response.headers.has("set-cookie"),
    };
  };

  const refresh = async (
    token: string | null = refreshToken,
  ): Promise<AttendanceRefreshResult> => {
    const response = await fetch(`${baseUrl}/api/auth/refresh`, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ refresh: token }),
    });
    const body = await parseJson(response);
    if (response.ok && isTokenResponse(body)) {
      accessToken = body.access ?? body.accessToken ?? null;
      refreshToken = body.refresh ?? body.refreshToken ?? null;
    }
    return { status: response.status, body };
  };

  const logout = async (): Promise<void> => {
    if (!refreshToken) return;
    await fetch(`${baseUrl}/api/auth/logout`, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ refresh: refreshToken }),
    });
    accessToken = null;
    refreshToken = null;
  };

  return {
    login,
    logout,
    refresh,
    request,
    getRefreshToken: () => refreshToken,
  };
};
