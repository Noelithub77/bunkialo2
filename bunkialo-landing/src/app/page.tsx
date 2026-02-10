import { headers } from "next/headers";
import { userAgent } from "next/server";
import {
  LandingShell,
  type PlatformTab,
} from "@/components/landing/landing-shell";

const EXPO_QR_URL =
  "https://qr.expo.dev/eas-update?projectId=7cbe49d9-9827-4df3-b86e-849443804d63&channel=production&runtimeVersion=0.1.0";

const EXPO_URL_ENDPOINT = `${EXPO_QR_URL}&format=url`;

const EXPO_URL_FALLBACK =
  "exp://u.expo.dev/7cbe49d9-9827-4df3-b86e-849443804d63?runtime-version=0.1.0&channel-name=production";

function resolvePlatformTab(requestHeaders: Headers): PlatformTab {
  const parsedAgent = userAgent({ headers: requestHeaders });
  const normalizedOs = parsedAgent.os.name?.toLowerCase() ?? "";
  const normalizedUa = parsedAgent.ua.toLowerCase();

  if (
    normalizedOs.includes("ios") ||
    normalizedUa.includes("iphone") ||
    normalizedUa.includes("ipad") ||
    normalizedUa.includes("ipod")
  ) {
    return "ios";
  }

  if (normalizedOs.includes("android") || normalizedUa.includes("android")) {
    return "android";
  }

  return "android";
}

async function getProductionExpUrl(): Promise<string> {
  try {
    const response = await fetch(EXPO_URL_ENDPOINT, {
      next: { revalidate: 300 },
    });

    if (!response.ok) {
      return EXPO_URL_FALLBACK;
    }

    const resolvedUrl = (await response.text()).trim();

    return resolvedUrl.startsWith("exp://") ? resolvedUrl : EXPO_URL_FALLBACK;
  } catch {
    return EXPO_URL_FALLBACK;
  }
}

export default async function Home() {
  const requestHeaders = new Headers(await headers());
  const expUrl = await getProductionExpUrl();

  return (
    <LandingShell
      expUrl={expUrl}
      initialTab={resolvePlatformTab(requestHeaders)}
      qrUrl={EXPO_QR_URL}
    />
  );
}
