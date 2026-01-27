/**
 * Dashboard/Timeline types
 */

export interface TimelineCourse {
  id: number;
  fullname: string;
  shortname: string;
  viewurl: string;
}

export interface TimelineEventAction {
  name: string;
  url: string;
  actionable: boolean;
}

export interface TimelineEvent {
  id: number;
  name: string;
  activityname: string;
  activitystr: string;
  modulename: string;
  instance: number;
  eventtype: string;
  timestart: number;
  timesort: number;
  overdue: boolean;
  course: TimelineCourse;
  action: TimelineEventAction;
  url: string;
  purpose: string;
}

export interface DashboardLog {
  id: string;
  timestamp: number;
  message: string;
  type: "info" | "error" | "success";
}

export interface DashboardState {
  events: TimelineEvent[];
  lastSyncTime: number | null;
  isLoading: boolean;
  error: string | null;
  logs: DashboardLog[];
}

export interface DashboardSettings {
  refreshIntervalMinutes: number;
  reminders: number[];
  notificationsEnabled: boolean;
  devDashboardSyncEnabled: boolean;
}
