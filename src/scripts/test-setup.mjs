// Test loader: resolves the "@/" alias and stubs native-only modules so
// `node --test` can import real src/*.ts files instead of copies of them.
//
// Usage: node --import ./src/scripts/test-setup.mjs --test src/**/*.test.mjs
//
// ponytail: sync resolve hook only, no transpiler. Node strips TS types natively.
// Ceiling: stubs are shared and inert. If a test needs native behaviour, mock it
// per-test with node:test mock.module() instead of widening this file.
import { registerHooks } from "node:module";
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve as resolvePath } from "node:path";

const SRC = resolvePath(dirname(fileURLToPath(import.meta.url)), "..");

// Native/Expo modules that cannot load outside a React Native runtime.
const STUBBED = [
  "@react-native-async-storage/async-storage",
  "expo-secure-store",
  "expo-haptics",
  "expo-notifications",
  "expo-background-task",
  "expo-task-manager",
  "react-native",
];

const STUB_URL = pathToFileURL(resolvePath(SRC, "scripts/test-stub.mjs")).href;

// TS/ESM import specifiers omit the extension; probe the same order tsc does.
const EXTS = [".ts", ".tsx", ".mjs", ".js", "/index.ts", "/index.tsx", "/index.ts"];

const probe = (base) => {
  for (const ext of EXTS) {
    const candidate = `${base}${ext}`;
    if (existsSync(candidate)) return candidate;
  }
  return null;
};

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) {
      const hit = probe(resolvePath(SRC, specifier.slice(2)));
      if (hit) return { url: pathToFileURL(hit).href, shortCircuit: true };
    }
    // Extensionless relative imports ("./storage") are valid TS but not valid ESM.
    if (specifier.startsWith(".") && context.parentURL?.startsWith("file:")) {
      const base = resolvePath(dirname(fileURLToPath(context.parentURL)), specifier);
      const hit = existsSync(base) ? null : probe(base);
      if (hit) return { url: pathToFileURL(hit).href, shortCircuit: true };
    }
    if (STUBBED.some((m) => specifier === m || specifier.startsWith(`${m}/`))) {
      return { url: STUB_URL, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});
