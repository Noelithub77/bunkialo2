import type { Metadata } from "next";
import { IBM_Plex_Mono, Manrope, Sora } from "next/font/google";
import "./globals.css";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined) ??
  "https://bunkialo.noel.is-a.dev";

const metadataBase = new URL(siteUrl);

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  weight: ["400", "500"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase,
  title: {
    default: "Bunkialo",
    template: "%s | Bunkialo",
  },
  description:
    "Bunkialo for IIIT Kottayam students. Track attendance, deadlines, timetable, and academic essentials in one app.",
  applicationName: "Bunkialo",
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
      "max-video-preview": -1,
    },
  },
  icons: {
    icon: "/logo.svg",
    shortcut: "/logo.svg",
    apple: "/logo.svg",
  },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "Bunkialo",
    title: "Bunkialo",
    description:
      "Track attendance, deadlines, timetable, and academic essentials in one app for IIIT Kottayam students.",
    locale: "en_US",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Bunkialo",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Bunkialo",
    description:
      "Track attendance, deadlines, timetable, and academic essentials in one app for IIIT Kottayam students.",
    images: ["/twitter-image"],
  },
  verification: {
    google: "F8EjEKdTKrOUlEi3lWHqBQCcEP-moqmm9LiTl69ZC68",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${manrope.variable} ${sora.variable} ${ibmPlexMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
