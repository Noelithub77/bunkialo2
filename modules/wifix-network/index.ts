import { requireOptionalNativeModule } from "expo-modules-core";

export interface WifixNetworkRequest {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
}

export interface WifixNetworkResponse {
  status: number;
  url: string;
  headers: Record<string, string[]>;
  setCookies: string[];
  body: string;
  interfaceName: string | null;
  dnsServers: string[];
  dhcpServer: string | null;
  resolvedAddresses: string[];
}

export interface WifixDnsResponse {
  interfaceName: string | null;
  dnsServers: string[];
  dhcpServer: string | null;
  resolvedAddresses: string[];
}

export interface WifixNetworkState {
  available: boolean;
  validated: boolean;
  captivePortal: boolean;
  interfaceName: string | null;
  dnsServers: string[];
  dhcpServer: string | null;
}

export interface WifixNetworkModule {
  requestOnWifi(request: WifixNetworkRequest): Promise<WifixNetworkResponse>;
  resolveOnWifi(host: string): Promise<WifixDnsResponse>;
  getWifiNetworkState(): Promise<WifixNetworkState>;
}

const WifixNetwork = requireOptionalNativeModule<WifixNetworkModule>(
  "WifixNetwork",
);

export default WifixNetwork;
