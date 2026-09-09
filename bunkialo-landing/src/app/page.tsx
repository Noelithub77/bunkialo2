import {
  LandingShell,
  type PlatformTab,
} from "@/components/landing/landing-shell";
import { headers } from "next/headers";
import { userAgent } from "next/server";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined) ??
  "https://bunkialo.noel.is-a.dev";

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

export default async function Home() {
  const requestHeaders = new Headers(await headers());

  return (
    <>
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD for SEO.
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "WebSite",
                "@id": `${siteUrl}/#website`,
                url: siteUrl,
                name: "Bunkialo",
                description:
                  "Bunkialo for IIIT Kottayam students. Track attendance, deadlines, timetable, and academic essentials in one app.",
              },
              {
                "@type": "SoftwareApplication",
                name: "Bunkialo",
                applicationCategory: "EducationalApplication",
                operatingSystem: "Android, iOS",
                offers: {
                  "@type": "Offer",
                  price: "0",
                  priceCurrency: "INR",
                },
              },
              {
                "@type": "Organization",
                name: "Bunkialo",
                url: siteUrl,
              },
            ],
          }),
        }}
      />
      <LandingShell
        initialTab={resolvePlatformTab(requestHeaders)}
      />
    </>
  );
}
