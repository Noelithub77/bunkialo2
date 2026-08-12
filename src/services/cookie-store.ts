// Simple in-memory cookie store for session management
// Works in React Native without native dependencies

import { debug } from "@/utils/debug";

interface Cookie {
  name: string;
  value: string;
  domain?: string;
  path?: string;
  expires?: Date;
}

class CookieStore {
  private cookies: Map<string, Cookie> = new Map();

  // Parse Set-Cookie header and store cookies
  setCookiesFromHeader(
    setCookieHeader: string | string[] | undefined,
    requestUrl?: string,
  ) {
    if (!setCookieHeader) return;

    const headers = Array.isArray(setCookieHeader)
      ? setCookieHeader
      : [setCookieHeader];

    debug.cookie(`Received ${headers.length} Set-Cookie header(s)`);

    for (const header of headers) {
      const cookie = this.parseCookie(header, requestUrl);
      if (cookie) {
        const key = `${cookie.domain ?? ""}|${cookie.path ?? "/"}|${cookie.name}`;
        this.cookies.set(key, cookie);
        debug.cookie(`Stored cookie: ${cookie.name}`);
      }
    }

    debug.cookie(`Total cookies stored: ${this.cookies.size}`);
  }

  // Parse a single Set-Cookie header
  private parseCookie(header: string, requestUrl?: string): Cookie | null {
    const parts = header.split(";").map((p) => p.trim());
    if (parts.length === 0) return null;

    const [nameValue, ...attributes] = parts;
    const eqIndex = nameValue.indexOf("=");
    if (eqIndex === -1) return null;

    const name = nameValue.substring(0, eqIndex).trim();
    const value = nameValue.substring(eqIndex + 1).trim();
    if (!name) return null;

    let requestHost: string | undefined;
    try {
      requestHost = requestUrl ? new URL(requestUrl).hostname : undefined;
    } catch {
      requestHost = undefined;
    }
    const cookie: Cookie = { name, value, domain: requestHost, path: "/" };

    for (const attr of attributes) {
      const [key, val] = attr.split("=");
      const keyLower = key?.toLowerCase().trim();

      if (keyLower === "domain") cookie.domain = val?.trim();
      if (keyLower === "path") cookie.path = val?.trim();
      if (keyLower === "expires" && val) {
        const parsed = new Date(val.trim());
        if (!Number.isNaN(parsed.getTime())) {
          cookie.expires = parsed;
        }
      }
      if (keyLower === "max-age" && val) {
        const seconds = Number(val);
        if (Number.isFinite(seconds)) {
          cookie.expires = new Date(Date.now() + seconds * 1000);
        }
      }
    }

    return cookie;
  }

  // Get cookie header string for requests
  getCookieHeader(requestUrl?: string): string {
    const now = new Date();
    const validCookies: string[] = [];
    let request: URL | null = null;
    try {
      request = requestUrl ? new URL(requestUrl) : null;
    } catch {
      request = null;
    }

    for (const [key, cookie] of this.cookies) {
      // Skip expired cookies
      if (cookie.expires && cookie.expires < now) {
        debug.cookie(`Cookie expired: ${cookie.name}`);
        this.cookies.delete(key);
        continue;
      }
      if (request && cookie.domain) {
        const domain = cookie.domain.replace(/^\./, "").toLowerCase();
        const host = request.hostname.toLowerCase();
        if (host !== domain && !host.endsWith(`.${domain}`)) continue;
      }
      if (request && cookie.path && !request.pathname.startsWith(cookie.path)) {
        continue;
      }
      validCookies.push(`${cookie.name}=${cookie.value}`);
    }

    debug.cookie(`Attached ${validCookies.length} cookie(s)`);
    return validCookies.join("; ");
  }

  // Clear all cookies
  clear() {
    const count = this.cookies.size;
    this.cookies.clear();
    debug.cookie(`Cleared ${count} cookies`);
  }

  // Check if we have any cookies
  hasCookies(): boolean {
    return this.cookies.size > 0;
  }

  // Get all cookies for debugging
  getAllCookies(): Record<string, string> {
    const result: Record<string, string> = {};
    for (const cookie of this.cookies.values()) {
      result[cookie.name] = "[redacted]";
    }
    return result;
  }

  // Get cookie count
  getCookieCount(): number {
    return this.cookies.size;
  }
}

// Singleton instance
export const cookieStore = new CookieStore();
