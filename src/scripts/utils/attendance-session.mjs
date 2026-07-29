const DEFAULT_BASE_URL = "https://attendance.iiitkottayam.ac.in";

export const createAttendanceSession = ({
  baseUrl = process.env.ATTENDANCE_BASE_URL || DEFAULT_BASE_URL,
  email = process.env.ATTENDANCE_TEST_EMAIL,
  password = process.env.ATTENDANCE_TEST_PASSWORD,
} = {}) => {
  if (!email || !password) {
    throw new Error(
      "Missing ATTENDANCE_TEST_EMAIL or ATTENDANCE_TEST_PASSWORD.",
    );
  }

  let accessToken = null;
  let refreshToken = null;

  const request = async (path, options = {}) => {
    const headers = { Accept: "application/json", ...options.headers };
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    const response = await fetch(`${baseUrl}${path}`, { ...options, headers });
    return response;
  };

  const login = async () => {
    const response = await request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(`Attendance login failed (${response.status}).`);
    if (body.needs2fa || body.needsEmailOtp) {
      throw new Error("Live test requires an interactive verification code.");
    }
    accessToken = body.access ?? body.accessToken;
    refreshToken = body.refresh ?? body.refreshToken;
    if (!accessToken || !refreshToken) {
      throw new Error("Attendance login returned incomplete tokens.");
    }
    return {
      status: response.status,
      setCookie: response.headers.has("set-cookie"),
    };
  };

  const refresh = async (token = refreshToken) => {
    const response = await fetch(`${baseUrl}/api/auth/refresh`, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ refresh: token }),
    });
    const body = await response.json().catch(() => ({}));
    if (response.ok) {
      accessToken = body.access ?? body.accessToken;
      refreshToken = body.refresh ?? body.refreshToken;
    }
    return { status: response.status, body };
  };

  const logout = async () => {
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
