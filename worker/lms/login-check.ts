export const extractLoginToken = (html: string): string | null => {
  const patterns = [
    /name=["']logintoken["'][^>]*value=["']([^"']+)["']/i,
    /value=["']([^"']+)["'][^>]*name=["']logintoken["']/i,
  ];

  for (const pattern of patterns) {
    const token = html.match(pattern)?.[1];
    if (token) return token;
  }
  return null;
};

export const isLmsLoginPage = (html: string): boolean =>
  /name=["']logintoken["']/i.test(html) ||
  /<form[^>]*id=["']login["']/i.test(html);

export const isLmsLoginSuccessful = (html: string): boolean => {
  const hasSession =
    /"sesskey":"[^"]+"/i.test(html) ||
    /href=["'][^"']*logout/i.test(html) ||
    /class=["'][^"']*usermenu/i.test(html);
  const hasError = /loginerrors|alert-danger|loginerrormessage/i.test(html);
  return hasSession && !isLmsLoginPage(html) && !hasError;
};

export const getLmsOrigin = (username: string): string => {
  const year = username.trim().match(/^20(\d{2})/)?.[1];
  return year
    ? `https://lmsug${year}.iiitkottayam.ac.in`
    : "https://lmsug24.iiitkottayam.ac.in";
};

const ALLOWED_PATHS = [
  "/course/",
  "/lib/ajax/",
  "/login/",
  "/mod/",
  "/my/",
  "/pluginfile.php",
  "/repository/",
];

export const isAllowedLmsPath = (path: string): boolean =>
  ALLOWED_PATHS.some((prefix) => path.startsWith(prefix));
