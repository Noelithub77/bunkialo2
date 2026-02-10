"use client";

import {
  Apple,
  ArrowUpRight,
  Check,
  Copy,
  Download,
  QrCode,
  Smartphone,
} from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import Image from "next/image";
import { useEffect, useState } from "react";

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

function normalizePlatformTab(value: string): PlatformTab {
  return value === "ios" ? "ios" : "android";
}

export function LandingShell({ expUrl, initialTab, qrUrl }: LandingShellProps) {
  const shouldReduceMotion = useReducedMotion();
  const [activeTab, setActiveTab] = useState<PlatformTab>(initialTab);
  const [showSplash, setShowSplash] = useState(true);
  const [isMobileClient, setIsMobileClient] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">(
    "idle",
  );

  const shouldShowQrPanel = !isMobileClient || activeTab === "ios";

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

  useEffect(() => {
    if (copyState !== "copied") {
      return;
    }

    const timeoutId = window.setTimeout(() => setCopyState("idle"), 1800);
    return () => window.clearTimeout(timeoutId);
  }, [copyState]);

  async function handleCopyUrl() {
    if (!navigator.clipboard) {
      setCopyState("error");
      return;
    }

    try {
      await navigator.clipboard.writeText(expUrl);
      setCopyState("copied");
    } catch {
      setCopyState("error");
    }
  }

  return (
    <>
      <LandingSplash show={showSplash} />
      <main className="landing-page h-dvh overflow-hidden px-3 py-3 sm:px-8 sm:py-6">
        <motion.div
          className="landing-shell mx-auto grid h-full w-full max-w-6xl gap-4 overflow-hidden rounded-3xl p-4 sm:gap-6 sm:p-6 lg:grid-cols-[1.14fr_0.86fr] lg:gap-7 lg:p-8"
          initial={shouldReduceMotion ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: shouldReduceMotion ? 0.2 : 0.55 }}
        >
          <section className="min-w-0 flex flex-col gap-4 sm:gap-5">
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
                  Production Channel
                </Badge>
              </div>
            </motion.div>

            <motion.div
              className="space-y-3"
              initial={shouldReduceMotion ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                delay: shouldReduceMotion ? 0 : 0.18,
                duration: 0.45,
              }}
            >
              <h1 className="font-display text-[2.65rem] leading-[0.92] tracking-tight text-white sm:text-5xl lg:text-6xl">
                Bunkialo
              </h1>
              <p className="max-w-xl text-sm leading-relaxed text-white/72 sm:text-base">
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
              className="w-full gap-4"
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
                  <Smartphone className="size-4" />
                  Android
                </TabsTrigger>
                <TabsTrigger
                  value="ios"
                  className="h-10 min-w-0 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm text-white/70 data-[state=active]:border-white/35 data-[state=active]:bg-white/12 data-[state=active]:text-white"
                >
                  <Apple className="size-4" />
                  iOS
                </TabsTrigger>
              </TabsList>

              <TabsContent value="android" className="mt-0 space-y-4">
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
                        Install from Play Store or launch the production Expo
                        channel directly.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3 px-5 pb-5">
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
                            <Download className="size-4" />
                            Open in Play Store
                            <ArrowUpRight className="size-4 opacity-75" />
                          </a>
                        </Button>
                      </motion.div>
                      <Button
                        asChild
                        size="lg"
                        variant="secondary"
                        className="w-full rounded-xl border border-white/15 bg-white/10 text-white hover:bg-white/16"
                      >
                        <a href={expUrl}>
                          Open Production in Expo Go
                          <ArrowUpRight className="size-4 opacity-70" />
                        </a>
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              </TabsContent>

              <TabsContent value="ios" className="mt-0 space-y-4">
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
                        Open the production update instantly with Expo Go.
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
                            Open in Expo Go
                            <ArrowUpRight className="size-4 opacity-75" />
                          </a>
                        </Button>
                      </motion.div>
                      <Button
                        size="lg"
                        variant="secondary"
                        onClick={handleCopyUrl}
                        className="w-full rounded-xl border border-white/15 bg-white/10 text-white hover:bg-white/16"
                      >
                        {copyState === "copied" ? (
                          <>
                            <Check className="size-4" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="size-4" />
                            Copy Expo Link
                          </>
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              </TabsContent>
            </Tabs>
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
                    Scan the production QR with Expo Go to open Bunkialo
                    instantly.
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
                        alt="Bunkialo production QR code"
                        fill
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
