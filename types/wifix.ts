export type WifixConnectionState =
  | "idle"
  | "checking"
  | "online"
  | "captive"
  | "offline"
  | "error";

export interface WifixConnectivityResult {
  state: WifixConnectionState;
  portalUrl: string | null;
  portalBaseUrl: string | null;
  statusCode: number | null;
  message: string | null;
}

export interface WifixLoginResult {
  success: boolean;
  portalBaseUrl: string;
  statusCode: number | null;
  message: string;
}

export interface WifixLogoutResult {
  success: boolean;
  portalBaseUrl: string;
  statusCode: number | null;
  message: string;
}

export interface WifixSettings {
  autoReconnectEnabled: boolean;
  backgroundIntervalMinutes: number;
  portalBaseUrl: string | null;
}
