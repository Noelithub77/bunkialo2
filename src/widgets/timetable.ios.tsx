/** @jsxImportSource react */
import { Button, HStack, VStack, Text, Spacer } from "@expo/ui/swift-ui";
import {
  background,
  buttonStyle,
  font,
  foregroundStyle,
  frame,
  lineLimit,
  padding,
  widgetURL,
  accessibilityLabel,
} from "@expo/ui/swift-ui/modifiers";
import { createWidget, type WidgetEnvironment } from "expo-widgets";
import type { ScheduleWidgetProps } from "@/types";

export const WidgetLayout = (
  props: ScheduleWidgetProps,
  environment: WidgetEnvironment,
) => {
  "widget";
  const now = environment.date?.getTime() ?? Date.now();
  const local = new Date(now + props.utcOffsetMinutes * 60000);
  const midnight =
    Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) -
    props.utcOffsetMinutes * 60000;
  const windows = props.cards
    .map((card) => {
      let start =
        midnight +
        ((card.day - local.getUTCDay() + 7) % 7) * 86400000 +
        card.startMinute * 60000;
      let end = start + (card.endMinute - card.startMinute) * 60000;
      if (end <= now) {
        start += 604800000;
        end += 604800000;
      }
      return { card, start, end };
    })
    .sort((a, b) => a.start - b.start)
    .slice(0, 5);
  const page =
    props.anchor === windows[0]?.start
      ? Math.max(0, Math.min(props.page, windows.length - 1))
      : 0;
  const selected = windows[page];
  const dark = environment.colorScheme === "dark";
  const ink = dark ? "#F5F5F5" : "#24202B";
  const muted = dark ? "#C1BCC9" : "#615A6C";
  const surface = selected
    ? dark
      ? selected.card.darkBackground
      : selected.card.lightBackground
    : dark
      ? "#262131"
      : "#F1EBFC";
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const localDay = selected
    ? Math.floor((selected.start - midnight) / 86400000)
    : 0;
  const status =
    selected && selected.start <= now
      ? "Now"
      : page === 0
        ? "Next"
        : localDay === 0
          ? "Today"
          : localDay === 1
            ? "Tomorrow"
            : days[selected?.card.day ?? 0];
  const move = (delta: number) => ({
    ...props,
    page: (page + delta + windows.length) % windows.length,
    anchor: windows[0]?.start ?? 0,
  });
  const container = [
    frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: "topLeading" }),
    padding({ all: 14 }),
    background(surface),
    widgetURL("bunkialo://timetable"),
  ];
  if (!selected)
    return (
      <VStack alignment="leading" modifiers={container}>
        <Text modifiers={[font({ size: 16 }), foregroundStyle(muted)]}>
          No classes
        </Text>
      </VStack>
    );
  return (
    <VStack alignment="leading" spacing={5} modifiers={container}>
      <HStack modifiers={[frame({ maxWidth: Infinity })]}>
        <Text
          modifiers={[
            font({ size: 11, weight: "semibold" }),
            foregroundStyle(muted),
          ]}
        >
          {status}
        </Text>
        <Spacer minLength={0} />
        <Text modifiers={[font({ size: 10 }), foregroundStyle(muted)]}>
          {page === 0 && localDay > 0
            ? localDay === 1
              ? "Tomorrow"
              : days[selected.card.day]
            : ""}
        </Text>
      </HStack>
      <Text
        modifiers={[
          font({ size: 21, weight: "bold" }),
          foregroundStyle(ink),
          lineLimit(2),
        ]}
      >
        {selected.card.name}
      </Text>
      <Text modifiers={[font({ size: 12 }), foregroundStyle(muted)]}>
        {selected.card.time}
      </Text>
      <Spacer minLength={0} />
      {windows.length > 1 && (
        <HStack modifiers={[frame({ maxWidth: Infinity })]}>
          <Button
            target="previous"
            onPress={() => move(-1)}
            modifiers={[
              buttonStyle("plain"),
              frame({ width: 28, height: 26 }),
              accessibilityLabel("Previous class"),
            ]}
          >
            <Text modifiers={[font({ size: 20 }), foregroundStyle(muted)]}>
              ‹
            </Text>
          </Button>
          <Spacer minLength={0} />
          <Text modifiers={[font({ size: 11 }), foregroundStyle(muted)]}>
            {windows.map((_, index) => (index === page ? "●" : "·")).join("  ")}
          </Text>
          <Spacer minLength={0} />
          <Button
            target="next"
            onPress={() => move(1)}
            modifiers={[
              buttonStyle("plain"),
              frame({ width: 28, height: 26 }),
              accessibilityLabel("Next class"),
            ]}
          >
            <Text modifiers={[font({ size: 20 }), foregroundStyle(muted)]}>
              ›
            </Text>
          </Button>
        </HStack>
      )}
    </VStack>
  );
};

export default createWidget<ScheduleWidgetProps>(
  "BunkialoTimetable",
  WidgetLayout,
  { cards: [], page: 0, anchor: 0, utcOffsetMinutes: 330 },
);
