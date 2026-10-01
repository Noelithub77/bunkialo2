/** @jsxImportSource react */
import {
  Column,
  Row,
  Text,
  TextButton,
  Spacer,
} from "@expo/ui/jetpack-compose";
import {
  background,
  cornerRadius,
  fillMaxSize,
  fillMaxWidth,
  paddingAll,
  semantics,
  size,
  weight,
} from "@expo/ui/jetpack-compose/modifiers";
import { createWidget, type WidgetEnvironment } from "expo-widgets";
import type { ScheduleWidgetProps } from "@/types";
import { buildMessWidgetProps } from "./data";

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
  if (!selected)
    return (
      <Column
        modifiers={[
          fillMaxSize(),
          background(surface),
          cornerRadius(24),
          paddingAll(16),
        ]}
        verticalArrangement="center"
      >
        <Text color={muted} style={{ fontSize: 16 }}>
          No classes
        </Text>
      </Column>
    );
  return (
    <Column
      modifiers={[
        fillMaxSize(),
        background(surface),
        cornerRadius(24),
        paddingAll(12),
      ]}
      verticalArrangement={{ spacedBy: 3 }}
    >
      <Row modifiers={[fillMaxWidth()]} verticalAlignment="center">
        <Text color={muted} style={{ fontSize: 11, fontWeight: "600" }}>
          {status}
        </Text>
        <Spacer modifiers={[weight(1)]} />
        <Text color={muted} style={{ fontSize: 10 }}>
          {page === 0 && localDay > 0
            ? localDay === 1
              ? "Tomorrow"
              : days[selected.card.day]
            : ""}
        </Text>
      </Row>
      <Text
        color={ink}
        style={{ fontSize: 18, fontWeight: "700" }}
        maxLines={1}
        overflow="ellipsis"
      >
        {selected.card.name}
      </Text>
      <Text color={muted} style={{ fontSize: 12 }}>
        {selected.card.time}
      </Text>
      <Column modifiers={[weight(1)]} verticalArrangement={{ spacedBy: 2 }}>
        {selected.card.items.slice(0, 3).map((item, index) => (
          <Text
            key={`${selected.card.id}-${index}`}
            color={ink}
            style={{ fontSize: 11 }}
            maxLines={1}
            overflow="ellipsis"
          >{`• ${item}`}</Text>
        ))}
        {selected.card.items.length > 3 && (
          <Text
            color={muted}
            style={{ fontSize: 11 }}
          >{`+${selected.card.items.length - 3}`}</Text>
        )}
      </Column>
      {windows.length > 1 && (
        <Row
          modifiers={[fillMaxWidth()]}
          horizontalArrangement="spaceBetween"
          verticalAlignment="center"
        >
          <TextButton
            onClick={() => move(-1)}
            colors={{ contentColor: muted }}
            contentPadding={{ start: 0, end: 0, top: 0, bottom: 0 }}
            modifiers={[
              size(32, 28),
              semantics({ contentDescription: "Previous meal" }),
            ]}
          >
            <Text color={muted} style={{ fontSize: 20 }}>
              ‹
            </Text>
          </TextButton>
          <Text color={muted} style={{ fontSize: 11 }}>
            {windows.map((_, index) => (index === page ? "●" : "·")).join("  ")}
          </Text>
          <TextButton
            onClick={() => move(1)}
            colors={{ contentColor: muted }}
            contentPadding={{ start: 0, end: 0, top: 0, bottom: 0 }}
            modifiers={[
              size(32, 28),
              semantics({ contentDescription: "Next meal" }),
            ]}
          >
            <Text color={muted} style={{ fontSize: 20 }}>
              ›
            </Text>
          </TextButton>
        </Row>
      )}
    </Column>
  );
};

export default createWidget<ScheduleWidgetProps>(
  "BunkialoMess",
  WidgetLayout,
  buildMessWidgetProps(),
);
