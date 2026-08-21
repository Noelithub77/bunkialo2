export type StoredCookie = {
  name: string;
  value: string;
};

const parseCookie = (header: string): StoredCookie | null => {
  const firstPart = header.split(";", 1)[0];
  if (!firstPart) return null;
  const separator = firstPart.indexOf("=");
  if (separator <= 0) return null;

  const name = firstPart.slice(0, separator).trim();
  const value = firstPart.slice(separator + 1).trim();
  return name ? { name, value } : null;
};

export const updateCookies = (
  current: StoredCookie[],
  headers: Headers,
): StoredCookie[] => {
  const next = new Map(current.map((cookie) => [cookie.name, cookie]));
  for (const header of headers.getSetCookie()) {
    const cookie = parseCookie(header);
    if (!cookie) continue;
    if (cookie.value) next.set(cookie.name, cookie);
    else next.delete(cookie.name);
  }
  return [...next.values()];
};

export const cookieHeader = (cookies: StoredCookie[]): string =>
  cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ");
