export interface WidgetCard {
  id: string;
  day: number;
  startMinute: number;
  endMinute: number;
  name: string;
  time: string;
  color: string;
  lightBackground: string;
  darkBackground: string;
  items: string[];
}

export interface ScheduleWidgetProps {
  cards: WidgetCard[];
  page: number;
  anchor: number;
  utcOffsetMinutes: number;
}
