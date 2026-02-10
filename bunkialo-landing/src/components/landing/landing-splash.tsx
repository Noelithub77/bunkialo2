"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { AnimatedLogo } from "@/components/landing/animated-logo";

interface LandingSplashProps {
  show: boolean;
}

export function LandingSplash({ show }: LandingSplashProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <AnimatePresence>
      {show ? (
        <motion.div
          className="landing-splash fixed inset-0 z-50 flex items-center justify-center"
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{
            opacity: 0,
            backdropFilter: shouldReduceMotion ? "blur(0px)" : "blur(18px)",
          }}
          transition={{ duration: shouldReduceMotion ? 0.2 : 0.45 }}
          aria-hidden="true"
        >
          <motion.div
            className="flex flex-col items-center gap-4"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: shouldReduceMotion ? 0.25 : 0.5 }}
          >
            <div className="relative size-28 sm:size-36">
              <div className="absolute inset-0 rounded-full bg-white/20 blur-2xl" />
              <AnimatedLogo className="relative z-10" mode="splash" />
            </div>
            <p className="font-display text-sm tracking-[0.28em] text-white/70 uppercase">
              Bunkialo
            </p>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
