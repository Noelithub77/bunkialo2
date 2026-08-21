import { spawn } from "node:child_process";
import { createServer } from "node:net";

const isWindows = process.platform === "win32";
const bunCommand = isWindows ? "bun.exe" : "bun";
const forwardedArgs = process.argv.slice(2).filter((arg) => arg !== "--open");
const shouldOpenBrowser = process.argv.slice(2).includes("--open");

const getPortArgIndex = (args) => args.findIndex(
  (arg) => arg === "--port" || arg === "-p" || arg.startsWith("--port="),
);

const getPort = (args) => {
  const portIndex = getPortArgIndex(args);
  const inlineValue = portIndex >= 0
    ? args[portIndex].match(/^--port=(\d+)$/)?.[1]
    : undefined;
  const value = inlineValue ?? (portIndex >= 0 ? args[portIndex + 1] : undefined);
  const parsed = value ? Number(value) : 8081;
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 8081;
};

const isPortAvailable = (port) => new Promise((resolve) => {
  const server = createServer();
  server.once("error", () => resolve(false));
  server.listen(port, "127.0.0.1", () => {
    server.close(() => resolve(true));
  });
});

const findAvailablePort = async (startingPort) => {
  let port = startingPort;
  while (!(await isPortAvailable(port))) port += 1;
  return port;
};

const children = [];
let shuttingDown = false;

const stopChild = (child) => {
  if (!child.pid) return;
  if (isWindows) {
    spawn("taskkill", ["/pid", String(child.pid), "/t", "/f"], {
      stdio: "ignore",
    });
    return;
  }
  child.kill("SIGTERM");
};

const shutdown = (exitCode = 0) => {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) stopChild(child);
  setTimeout(() => process.exit(exitCode), 100);
};

const start = (command, args) => {
  const child = spawn(command, args, {
    env: process.env,
    stdio: "inherit",
    windowsHide: true,
  });
  children.push(child);
  child.on("error", (error) => {
    console.error(`Could not start ${command}: ${error.message}`);
    shutdown(1);
  });
  return child;
};

const openBrowser = (url) => {
  if (isWindows) {
    const browser = spawn("cmd.exe", ["/c", "start", "", url], {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    });
    browser.unref();
    return;
  }

  const command = process.platform === "darwin" ? "open" : "xdg-open";
  const browser = spawn(command, [url], {
    detached: true,
    stdio: "ignore",
  });
  browser.unref();
};

const openBrowserWhenReady = async (url) => {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (shuttingDown) return;
    try {
      await fetch(url);
      openBrowser(url);
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }

  if (!shuttingDown) openBrowser(url);
};

process.on("SIGINT", () => shutdown());
process.on("SIGTERM", () => shutdown());

const relayPort = getPort(forwardedArgs);
const relayPortAvailable = await isPortAvailable(relayPort);
if (!relayPortAvailable) {
  console.error(`Relay port ${relayPort} is already in use. Stop that process or choose another port.`);
  process.exit(1);
}

const expoPort = await findAvailablePort(relayPort + 1);
const expoArgs = [...forwardedArgs];
const portIndex = getPortArgIndex(expoArgs);
if (portIndex >= 0 && expoArgs[portIndex].includes("=")) {
  expoArgs[portIndex] = `--port=${expoPort}`;
} else if (portIndex >= 0) {
  expoArgs[portIndex + 1] = String(expoPort);
} else {
  expoArgs.push("--port", String(expoPort));
}

console.log("Building the web bundle for the local relay...");
const build = start(bunCommand, ["run", "web:build"]);
build.once("exit", (code) => {
  if (shuttingDown) return;
  if (code !== 0) {
    console.error("Web bundle build failed; relay was not started.");
    shutdown(code ?? 1);
    return;
  }

  console.log(`Starting Expo hot reload on http://localhost:${expoPort}`);
  const expo = start(bunCommand, ["x", "expo", "start", "--web", ...expoArgs]);
  expo.once("exit", (expoCode) => {
    if (!shuttingDown && expoCode !== 0) shutdown(expoCode ?? 1);
  });

  console.log(`Starting Wrangler relay on http://localhost:${relayPort}`);
  const worker = start(bunCommand, [
    "x",
    "wrangler@latest",
    "dev",
    "--port",
    String(relayPort),
    "--local-upstream",
    `localhost:${expoPort}`,
  ]);
  worker.once("exit", (workerCode) => {
    if (!shuttingDown) shutdown(workerCode ?? 1);
  });

  if (shouldOpenBrowser) {
    void openBrowserWhenReady(`http://localhost:${relayPort}`);
  }
});
