import { downloadLmsResourceWithSession } from "@/services/lms-download";
export const openLmsFileOutside = async (
  url: string,
  name: string,
): Promise<void> => {
  const tab = window.open("about:blank", "_blank");
  if (tab) tab.opener = null;
  try {
    const result = await downloadLmsResourceWithSession(url, name);
    if (!result.success) throw new Error(result.message);
    if (tab) tab.location.href = result.uri;
    else window.location.href = result.uri;
  } catch (error) {
    tab?.close();
    throw error;
  }
};
