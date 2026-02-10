"use client";

import { ArrowUpRight, QrCode } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import Image from "next/image";
import { useEffect, useState } from "react";
import {
  SiAndroid,
  SiApple,
  SiExpo,
  SiGoogleplay,
} from "react-icons/si";

import { AnimatedLogo } from "@/components/landing/animated-logo";
import { LandingSplash } from "@/components/landing/landing-splash";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export type PlatformTab = "android" | "ios";

export interface LandingShellProps {
  expUrl: string;
  initialTab: PlatformTab;
  qrUrl: string;
}

const PLAY_STORE_URL =
  "https://play.google.com/store/apps/details?id=com.codialo.Bunkialo2";
const BUY_ME_COFFEE_UPI_URL = "upi://pay?pa=noelmcv7@oksbi&cu=INR";
const DEVELOPER_LINKEDIN_URL = "https://www.linkedin.com/in/noel-georgi/";
const IDEAS_BY_LINKS = [
  {
    name: "Srimoney",
    href: "https://www.linkedin.com/in/srimoneyshankar-ajith-a5a6831ba/",
  },
  {
    name: "Niranjan V",
    href: "https://www.linkedin.com/in/niranjan-vasudevan/",
  },
];

function normalizePlatformTab(value: string): PlatformTab {
  return value === "ios" ? "ios" : "android";
}

export function LandingShell({ expUrl, initialTab, qrUrl }: LandingShellProps) {
  const shouldReduceMotion = useReducedMotion();
  const [activeTab, setActiveTab] = useState<PlatformTab>(initialTab);
  const [showSplash, setShowSplash] = useState(true);
  const [isMobileClient, setIsMobileClient] = useState(false);

  const shouldShowQrPanel = !isMobileClient;

  useEffect(() => {
    const timeoutId = window.setTimeout(
      () => setShowSplash(false),
      shouldReduceMotion ? 280 : 1500,
    );

    return () => window.clearTimeout(timeoutId);
  }, [shouldReduceMotion]);

  useEffect(() => {
    const normalizedUa = window.navigator.userAgent.toLowerCase();
    setIsMobileClient(
      normalizedUa.includes("android") ||
        normalizedUa.includes("iphone") ||
        normalizedUa.includes("ipad") ||
        normalizedUa.includes("ipod"),
    );
  }, []);

  return (
    <>
      <LandingSplash show={showSplash} />
      <main className="landing-page h-[100svh] overflow-hidden px-2 py-2 sm:px-8 sm:py-6">
        <motion.div
          className="landing-shell mx-auto grid h-full w-full max-w-6xl gap-3 overflow-hidden rounded-3xl p-3 sm:gap-6 sm:p-6 lg:grid-cols-[1.14fr_0.86fr] lg:gap-7 lg:p-8"
          initial={shouldReduceMotion ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: shouldReduceMotion ? 0.2 : 0.55 }}
        >
          <section className="min-w-0 flex min-h-0 flex-col gap-3 sm:gap-5">
            <motion.div
              className="flex flex-wrap items-center gap-3"
              initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                delay: shouldReduceMotion ? 0 : 0.1,
                duration: 0.4,
              }}
            >
              <div className="size-16 shrink-0 rounded-2xl border border-white/20 bg-white/5 p-2.5 shadow-[0_0_30px_rgba(255,255,255,0.08)]">
                <AnimatedLogo mode="idle" />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant="outline"
                  className="rounded-full border-white/20 bg-black/25 px-2.5 py-1 text-[10px] tracking-[0.16em] text-white/70 uppercase"
                >
                  Public release
                </Badge>
              </div>
            </motion.div>

            <motion.div
              className="space-y-2 sm:space-y-3"
              initial={shouldReduceMotion ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                delay: shouldReduceMotion ? 0 : 0.18,
                duration: 0.45,
              }}
            >
              <h1 className="font-display text-[2.25rem] leading-[0.92] tracking-tight text-white sm:text-5xl lg:text-6xl">
                Bunkialo
              </h1>
              <p className="max-w-xl text-[13px] leading-relaxed text-white/72 sm:text-base">
                Your IIIT Kottayam academic companion with attendance, timeline,
                bunk planning, and assignment tracking in one fast app
                experience.
              </p>
            </motion.div>

            <Separator className="bg-white/10" />

            <Tabs
              value={activeTab}
              onValueChange={(value) =>
                setActiveTab(normalizePlatformTab(value))
              }
              className="w-full gap-3"
            >
              <TabsList
                variant="line"
                className="grid h-auto w-full grid-cols-2 justify-start gap-2 rounded-none bg-transparent p-0"
              >
                <TabsTrigger
                  value="android"
                  className={cn(
                    "h-10 min-w-0 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm text-white/70 data-[state=active]:border-white/35 data-[state=active]:bg-white/12 data-[state=active]:text-white",
                  )}
                >
                  <SiAndroid className="size-4 text-white/80" />
                  Android
                </TabsTrigger>
                <TabsTrigger
                  value="ios"
                  className="h-10 min-w-0 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm text-white/70 data-[state=active]:border-white/35 data-[state=active]:bg-white/12 data-[state=active]:text-white"
                >
                  <SiApple className="size-3.5 text-white/80" />
                  iOS
                </TabsTrigger>
              </TabsList>

              <TabsContent value="android" className="mt-0 space-y-3">
                <motion.div
                  className="space-y-4"
                  initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: activeTab === "android" ? 1 : 0.9, y: 0 }}
                  transition={{ duration: shouldReduceMotion ? 0.2 : 0.32 }}
                >
                  <Card className="landing-card border-white/14 bg-white/[0.04] py-0">
                    <CardHeader className="px-5 pt-5 pb-3">
                      <CardTitle className="font-display text-xl text-white">
                        Android Install
                      </CardTitle>
                      <CardDescription className="text-white/65">
                        Please drop a review too!
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2 px-5 pb-5 sm:space-y-3">
                      <motion.div
                        whileHover={
                          shouldReduceMotion ? undefined : { y: -1.5 }
                        }
                      >
                        <Button asChild size="lg" className="w-full rounded-xl">
                          <a
                            href={PLAY_STORE_URL}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <SiGoogleplay className="size-4 text-neutral-900" />
                            Open in Play Store
                            <ArrowUpRight className="size-4 opacity-75" />
                          </a>
                        </Button>
                      </motion.div>
                    </CardContent>
                  </Card>
                </motion.div>
              </TabsContent>

              <TabsContent value="ios" className="mt-0 space-y-3">
                <motion.div
                  className="space-y-4"
                  initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: activeTab === "ios" ? 1 : 0.9, y: 0 }}
                  transition={{ duration: shouldReduceMotion ? 0.2 : 0.32 }}
                >
                  <Card className="landing-card border-white/14 bg-white/[0.04] py-0">
                    <CardHeader className="px-5 pt-5 pb-3">
                      <CardTitle className="font-display text-xl text-white">
                        iOS Install
                      </CardTitle>
                      <CardDescription className="text-white/65">
                        As publishing on app store is like 10k/year, I can only
                        afford serving over Expo Go
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3 px-5 pb-5">
                      <motion.div
                        whileHover={
                          shouldReduceMotion ? undefined : { y: -1.5 }
                        }
                      >
                        <Button asChild size="lg" className="w-full rounded-xl">
                          <a href={expUrl}>
                            <SiExpo className="size-4 text-neutral-900" />
                            Open in Expo Go
                            <ArrowUpRight className="size-4 opacity-75" />
                          </a>
                        </Button>
                      </motion.div>
                    </CardContent>
                  </Card>
                </motion.div>
              </TabsContent>
            </Tabs>

            <motion.div
              className="mt-auto rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3 backdrop-blur-sm"
              initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                delay: shouldReduceMotion ? 0 : 0.24,
                duration: 0.38,
              }}
            >
              <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                <div className="space-y-1.5 text-xs text-white/65">
                  <p className="leading-relaxed">
                  Made by{" "}
                  <a
                    href={DEVELOPER_LINKEDIN_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="text-white/80 underline underline-offset-2 transition-colors hover:text-white"
                  >
                    Noel Georgi
                  </a>
                  </p>
                  <p className="leading-relaxed">
                  Ideas by{" "}
                  <a
                    href={IDEAS_BY_LINKS[0].href}
                    target="_blank"
                    rel="noreferrer"
                    className="text-white/80 underline underline-offset-2 transition-colors hover:text-white"
                  >
                    {IDEAS_BY_LINKS[0].name}
                  </a>
                  {" & "}
                  <a
                    href={IDEAS_BY_LINKS[1].href}
                    target="_blank"
                    rel="noreferrer"
                    className="text-white/80 underline underline-offset-2 transition-colors hover:text-white"
                  >
                    {IDEAS_BY_LINKS[1].name}
                  </a>
                  </p>
                </div>
                <div className="sm:justify-self-end">
                  <Button
                    asChild
                    size="sm"
                    className="h-9 rounded-xl border-0 px-4 text-sm font-semibold text-neutral-950 shadow-[0_8px_24px_rgba(255,171,0,0.28)] transition-all hover:brightness-95"
                    style={{ backgroundColor: "#FFAB00" }}
                  >
                    <a href={BUY_ME_COFFEE_UPI_URL}>Buy me a coffee</a>
                  </Button>
                </div>
              </div>
            </motion.div>
          </section>

          {shouldShowQrPanel ? (
            <motion.aside
              className="min-w-0 flex h-full flex-col gap-4"
              initial={shouldReduceMotion ? false : { opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{
                delay: shouldReduceMotion ? 0 : 0.16,
                duration: 0.45,
              }}
            >
              <Card className="landing-card h-full border-white/14 bg-white/[0.04] py-0">
                <CardHeader className="space-y-2 px-5 pt-5 pb-3">
                  <Badge
                    variant="outline"
                    className="w-fit rounded-full border-white/25 bg-white/8 text-[10px] tracking-[0.16em] text-white/75 uppercase"
                  >
                    QR Install
                  </Badge>
                  <CardTitle className="font-display text-2xl text-white">
                    Scan & Launch
                  </CardTitle>
                  <CardDescription className="text-white/62">
                    Scan the QR with Expo Go to open Bunkialo instantly.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 px-5 pb-5">
                  <a
                    href={expUrl}
                    className="group block rounded-2xl border border-white/12 bg-black/35 p-3 transition-colors hover:border-white/30"
                  >
                    <div className="relative aspect-square overflow-hidden rounded-xl border border-white/10 bg-white p-3">
                      <Image
                        src={qrUrl}
                        alt="Bunkialo QR code"
                        fill
                        unoptimized
                        sizes="(max-width: 768px) 80vw, 28vw"
                        className="object-contain p-3"
                      />
                    </div>
                    <div className="mt-2.5 flex items-center gap-2 text-xs text-white/72">
                      <QrCode className="size-3.5" />
                      Tap QR block to open link directly
                    </div>
                  </a>
                </CardContent>
              </Card>
            </motion.aside>
          ) : null}
        </motion.div>
      </main>
    </>
  );
}
