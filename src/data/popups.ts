import { AllpyqLaunchPopupContent } from "@/components/dashboard/popup/allpyq-launch-popup-content";
import { Colors } from "@/constants/theme";
import type { PopupNotice } from "@/types";

export const POPUP_NOTICES: PopupNotice[] = [
  {
    id: "allpyq-launch-2026-04",
    title: "AllPYQ Is Out",
    description:
      "AllPYQ is live: topic-wise PYQs, trend insights, instant AI solutions, and adaptive learning guides.",
    timestamp: "2026-04-14T12:00:00+05:30",
    iconColor: Colors.accent,
    isImportant: true,
    ctaLabel: "Explore AllPYQ",
    ctaAction: "open-url",
    ctaUrl: "https://allpyq.in",
    imageSourceDark: require("../assets/icons/allpyq_dark.png"),
    imageSourceLight: require("../assets/icons/allpyq_light.png"),
    customContent: AllpyqLaunchPopupContent,
  },
  // {
  //   id: "lms-feedback-autofill-2026-04",
  //   title: "LMS Feedback Autofill",
  //   description: "Feedback forms should never be made mandatory",
  //   timestamp: "2026-04-06T12:00:00+05:30",
  //   icon: "school",
  //   iconColor: Colors.status.warning,
  //   isImportant: true,
  //   ctaLabel: "Run Autofill",
  //   ctaAction: "run-lms-feedback-autofill",
  //   customContent: FeedbackAutofillPopupContent,
  // },
  // {
  //   id: "menu-update-2026-03",
  //   title: "Menu Updated",
  //   description:
  //     "The mess menu has been updated to the temporary menu of 2026.",
  //   timestamp: "2026-03-17T12:00:00+05:30",
  //   icon: "restaurant",
  //   iconColor: Colors.status.success,
  //   isImportant: true,
  // },
];
