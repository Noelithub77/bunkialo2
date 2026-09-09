import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const PORTAL_HOST = "auth.iiitkottayam.ac.in";
const PORTAL_PORT = "1442";
const LOGIN_URL = `https://${PORTAL_HOST}:${PORTAL_PORT}/login?0330598d1f22608a`;
const LOGOUT_URL = `https://${PORTAL_HOST}:${PORTAL_PORT}/logout?0307020009020400`;
const BASE_URL = `https://${PORTAL_HOST}:${PORTAL_PORT}/`;
const CONNECTIVITY_URL = "http://connectivitycheck.gstatic.com/generate_204";
const SECRET_SERVICE = "bunkialo-omarchy";
const SECRET_ACCOUNT = "desktop";

interface CommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

interface Credentials {
  username: string;
  password: string;
}

const runCommand = (
  command: string[],
  input?: string,
): Promise<CommandResult> =>
  new Promise((resolve, reject) => {
    const [executable, ...args] = command;
    if (!executable) {
      reject(new Error("Cannot run an empty command"));
      return;
    }

    const child = spawn(executable, args, {
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.once("error", reject);
    child.once("close", (exitCode) => {
      resolve({ exitCode: exitCode ?? 1, stdout, stderr });
    });
    if (input) child.stdin.write(input);
    child.stdin.end();
  });

const requireObject = (value: unknown): Record<string, unknown> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("credentials JSON must be an object");
  }
  return Object.fromEntries(Object.entries(value));
};

const readCredentials = async (): Promise<Credentials> => {
  const envValue = process.env.WIFIX_CREDENTIALS_JSON;
  const secret = envValue
    ? { exitCode: 0, stdout: envValue, stderr: "" }
    : await runCommand([
        "secret-tool",
        "lookup",
        "service",
        SECRET_SERVICE,
        "account",
        SECRET_ACCOUNT,
      ]);
  if (secret.exitCode !== 0 || secret.stdout.trim() === "") {
    throw new Error(
      `credentials lookup failed: exit=${secret.exitCode} ${formatError(secret.stderr)}`,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(secret.stdout);
  } catch {
    throw new Error("credentials lookup returned invalid JSON");
  }
  const object = requireObject(parsed);
  const keys = Object.keys(object);
  const username = keys[0];
  const password = username ? object[username] : undefined;
  if (keys.length !== 2 || !username || typeof password !== "string" || !password) {
    throw new Error("credentials JSON must contain two username/password entries");
  }
  return { username, password };
};

const formatError = (value: string): string => {
  const message = value.trim().replace(/\s+/g, " ");
  if (!message) return "no stderr";
  return message.length > 320 ? `${message.slice(0, 320)}...` : message;
};

const parseDhcpDnsServers = (raw: string): string[] => {
  const servers: string[] = [];
  for (const value of raw.replaceAll("|", "\n").split(/\r?\n/)) {
    const server = value.trim();
    if (!/^\d{1,3}(?:\.\d{1,3}){3}$/.test(server)) continue;
    if (!servers.includes(server)) servers.push(server);
  }
  return servers;
};

const logStep = (step: string, result: CommandResult): void => {
  const marker = result.stderr.match(
    /http=(\d{3}) remote=([^\s]+) effective=([^\s]+)/,
  );
  const http = marker?.[1] ?? (step.includes("connectivity") ? result.stdout.trim() : "000");
  const remote = marker?.[2] ?? "none";
  const effective = marker?.[3] ?? "none";
  console.log(
    `[WiFix atomic] step=${step} exit=${result.exitCode} http=${http} remote=${remote} effective=${effective} stdoutBytes=${Buffer.byteLength(result.stdout)} stderr=${formatError(result.stderr)}`,
  );
};

const curlConfig = (entries: Record<string, string>): string =>
  Object.entries(entries)
    .map(([key, value]) => {
      const escaped = value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
      return `${key} = "${escaped}"`;
    })
    .join("\n") + "\n";

const runCurl = async (
  step: string,
  interfaceName: string,
  portalAddress: string,
  cookiePath: string,
  config: Record<string, string>,
): Promise<CommandResult> => {
  const result = await runCommand(
    [
      "curl",
      "-4",
      "-k",
      "-sS",
      "--max-time",
      "20",
      "--interface",
      interfaceName,
      "--resolve",
      `${PORTAL_HOST}:${PORTAL_PORT}:${portalAddress}`,
      "-c",
      cookiePath,
      "-b",
      cookiePath,
      "-w",
      "%{stderr}http=%{http_code} remote=%{remote_ip} effective=%{url_effective}\\n",
      "-K",
      "-",
    ],
    curlConfig(config),
  );
  logStep(step, result);
  return result;
};

const requireHttpSuccess = (step: string, result: CommandResult): void => {
  const match = result.stderr.match(/http=(\d{3})/);
  const status = match ? Number(match[1]) : 0;
  if (result.exitCode !== 0 || status < 200 || status >= 400) {
    throw new Error(
      `${step} failed: exit=${result.exitCode} http=${status} ${formatError(result.stderr)}`,
    );
  }
};

const extractField = (html: string, name: string): string | null => {
  const pattern = new RegExp(
    `name=["']${name}["'][^>]*value=["']([^"']*)`,
    "i",
  );
  const reversePattern = new RegExp(
    `value=["']([^"']*)["'][^>]*name=["']${name}["']`,
    "i",
  );
  return pattern.exec(html)?.[1] ?? reversePattern.exec(html)?.[1] ?? null;
};

const main = async (): Promise<void> => {
  const nmcli = await runCommand([
    "nmcli",
    "-t",
    "-f",
    "DEVICE,TYPE,STATE,CONNECTION",
    "device",
  ]);
  logStep("inspect-network", nmcli);
  const networkRow = nmcli.stdout
    .split(/\r?\n/)
    .map((row) => row.split(":"))
    .find(
      (fields) =>
        fields.length >= 4 &&
        fields[1] === "wifi" &&
        fields[2] === "connected" &&
        ["IIITKottayam", "IIITKottayam_5G"].includes(fields.slice(3).join(":")),
    );
  if (!networkRow) {
    throw new Error("active campus SSID not found; refusing to change any network state");
  }
  const interfaceName = networkRow[0];
  const ssid = networkRow.slice(3).join(":");
  const tailscaleBefore = nmcli.stdout
    .split(/\r?\n/)
    .find((row) => row.startsWith("tailscale0:"));
  console.log(`[WiFix atomic] network=campus ssid=${ssid} interface=${interfaceName}`);
  console.log(`[WiFix atomic] tailscaleBefore=${tailscaleBefore ?? "missing"}`);

  const dnsServersResult = await runCommand([
    "nmcli",
    "-g",
    "IP4.DNS",
    "dev",
    "show",
    interfaceName,
  ]);
  logStep("read-dhcp-dns", dnsServersResult);
  const dnsServers = parseDhcpDnsServers(dnsServersResult.stdout);
  console.log(`[WiFix atomic] dhcpDnsServers=${dnsServers.join(",") || "none"}`);
  let portalAddress: string | undefined;
  let dnsServerUsed: string | undefined;
  for (const dnsServer of dnsServers) {
    const dns = await runCommand([
      "dig",
      "+short",
      "+time=2",
      "+tries=1",
      `@${dnsServer}`,
      PORTAL_HOST,
    ]);
    logStep(`resolve-portal-dhcp-${dnsServer}`, dns);
    const address = dns.stdout.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/)?.[0];
    if (dns.exitCode === 0 && address) {
      portalAddress = address;
      dnsServerUsed = dnsServer;
      break;
    }
  }
  if (!portalAddress || !dnsServerUsed) {
    throw new Error("portal DNS lookup failed through all DHCP DNS servers");
  }
  console.log(
    `[WiFix atomic] portalAddress=${portalAddress} source=dhcp-dns server=${dnsServerUsed}`,
  );

  const credentials = await readCredentials();
  console.log("[WiFix atomic] credentials=loaded usernamePresent=true passwordPresent=true");
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "bunkialo-wifix-"));
  const cookiePath = path.join(tempDir, "cookies");

  try {
    const logout = await runCurl("logout", interfaceName, portalAddress, cookiePath, {
      url: LOGOUT_URL,
    });
    requireHttpSuccess("logout", logout);

    const loginPage = await runCurl(
      "fetch-login-html",
      interfaceName,
      portalAddress,
      cookiePath,
      { url: LOGIN_URL },
    );
    requireHttpSuccess("fetch-login-html", loginPage);
    if (loginPage.stdout.trim() === "") throw new Error("login HTML was empty");
    const redirect = extractField(loginPage.stdout, "4Tredir");
    const magic = extractField(loginPage.stdout, "magic");
    console.log(
      `[WiFix atomic] login-form htmlBytes=${Buffer.byteLength(loginPage.stdout)} redirect=${redirect ? "found" : "missing"} magic=${magic ? "found" : "missing"}`,
    );
    if (!magic) throw new Error("login HTML did not contain magic");

    const form = new URLSearchParams({
      ...(redirect ? { "4Tredir": redirect } : {}),
      magic,
      username: credentials.username,
      password: credentials.password,
    });
    const login = await runCurl("submit-login-form", interfaceName, portalAddress, cookiePath, {
      url: BASE_URL,
      request: "POST",
      header: "Content-Type: application/x-www-form-urlencoded",
      data: form.toString(),
    });
    requireHttpSuccess("submit-login-form", login);

    const connectivity = await runCommand([
      "curl",
      "-4",
      "-sS",
      "--max-time",
      "12",
      "--interface",
      interfaceName,
      "-o",
      "/dev/null",
      "-w",
      "%{http_code}",
      CONNECTIVITY_URL,
    ]);
    logStep("verify-login-connectivity", connectivity);
    if (connectivity.exitCode !== 0 || connectivity.stdout.trim() !== "204") {
      throw new Error(
        `verify-login-connectivity failed: expected HTTP 204, got ${connectivity.stdout.trim() || "000"} ${formatError(connectivity.stderr)}`,
      );
    }
    const networkAfter = await runCommand([
      "nmcli",
      "-t",
      "-f",
      "DEVICE,TYPE,STATE,CONNECTION",
      "device",
    ]);
    logStep("verify-network-unchanged", networkAfter);
    const tailscaleAfter = networkAfter.stdout
      .split(/\r?\n/)
      .find((row) => row.startsWith("tailscale0:"));
    console.log(`[WiFix atomic] tailscaleAfter=${tailscaleAfter ?? "missing"}`);
    if (tailscaleAfter !== tailscaleBefore) {
      throw new Error("Tailscale interface state changed during WiFix test");
    }
    console.log("[WiFix atomic] RESULT=PASS logout->HTML/magic->POST->HTTP204");
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
};

main().catch((error: unknown) => {
  console.error(
    `[WiFix atomic] RESULT=FAIL ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
});
