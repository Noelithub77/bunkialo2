import { api, getCurrentBaseUrl } from "@/services/api";
import { checkSession, tryAutoLogin } from "@/services/auth/lms-auth";
import { isLoginHtml } from "@/utils/moodle-url";
export const fetchLmsForumHtml = async (url: string): Promise<string> => {
  const source = new URL(url, getCurrentBaseUrl());
  if (
    source.origin !== new URL(getCurrentBaseUrl()).origin ||
    !source.pathname.startsWith("/mod/forum/")
  )
    throw new Error("Unsupported forum link");
  if (!(await checkSession()) && !(await tryAutoLogin()))
    throw new Error("Please sign in to LMS");
  let result = await api.get<string>(source.href);
  if (isLoginHtml(result.data)) {
    if (!(await tryAutoLogin())) throw new Error("Please sign in to LMS");
    result = await api.get<string>(source.href);
  }
  if (isLoginHtml(result.data)) throw new Error("Please sign in to LMS");
  return result.data;
};
