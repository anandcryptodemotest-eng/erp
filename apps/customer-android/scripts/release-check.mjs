#!/usr/bin/env node
/**
 * Release guard for the customer Android shell.
 *
 * Enforces the locked contract (docs/CUSTOMER-ANDROID-APK.md) before a production
 * AAB is built. HARD-FAILS (exit 1) on any of:
 *   - a non-HTTPS server URL (http:// anywhere)
 *   - a raw-IP host
 *   - a staging host leaking into a release build
 *   - debug cleartext / user-CA trust left enabled in the release network config
 *   - wrong application id
 *   - missing / non-positive versionCode
 *
 * Usage:
 *   node scripts/release-check.mjs                 # checks config + android project
 *   CAPACITOR_SERVER_URL=https://host ... (honored, same as the build)
 */

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const EXPECTED_APP_ID = "com.sankalp.erp.customer";
const APPROVED_HOSTS = new Set(["customer.sankalpplatforms.com"]);
const STAGING_HOSTS = new Set([
  "staging-customer.sankalpplatforms.com",
  "localhost",
  "127.0.0.1",
]);

const errors = [];
const notes = [];

function fail(msg) {
  errors.push(msg);
}

// ── 1. Resolve the server URL exactly as the build will ──────────────────────
const DEFAULT_SERVER_URL = "https://customer.sankalpplatforms.com";
const serverUrl = (process.env.CAPACITOR_SERVER_URL ?? DEFAULT_SERVER_URL).trim();

if (/^http:\/\//i.test(serverUrl)) {
  fail(`Server URL uses insecure http:// — ${serverUrl}`);
}
if (!/^https:\/\//i.test(serverUrl)) {
  fail(`Server URL must be https:// — ${serverUrl}`);
}

let host = "";
try {
  host = new URL(serverUrl).hostname;
} catch {
  fail(`Server URL is not a valid URL — ${serverUrl}`);
}

// Raw IPv4 / IPv6 hosts are never allowed in a release.
if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(":")) {
  fail(`Server URL points at a raw IP — ${host}`);
}
if (STAGING_HOSTS.has(host)) {
  fail(`Staging / local host must not ship in a release build — ${host}`);
}
if (host && !APPROVED_HOSTS.has(host)) {
  fail(`Host "${host}" is not in the approved production allowlist (${[...APPROVED_HOSTS].join(", ")})`);
}

// ── 2. Scan the capacitor config source for stray insecure URLs ──────────────
const configPath = join(ROOT, "capacitor.config.ts");
if (existsSync(configPath)) {
  const cfg = readFileSync(configPath, "utf8");
  // Match an http:// URL used as a string literal (quoted), not regexes/comments
  // that merely mention the scheme.
  if (/["'`]http:\/\//i.test(cfg)) fail("capacitor.config.ts contains an http:// URL literal");
  if (!cfg.includes(EXPECTED_APP_ID)) {
    fail(`capacitor.config.ts appId is not ${EXPECTED_APP_ID}`);
  }
} else {
  fail("capacitor.config.ts not found");
}

// ── 3. Inspect the generated Android project (present after `cap add android`) ─
const androidDir = join(ROOT, "android");
if (!existsSync(androidDir)) {
  notes.push("android/ not generated yet — run `pnpm add:android` on a machine with the Android SDK. Skipping native checks.");
} else {
  // 3a. applicationId + versionCode from app/build.gradle
  const gradlePath = join(androidDir, "app", "build.gradle");
  if (existsSync(gradlePath)) {
    const gradle = readFileSync(gradlePath, "utf8");
    const appId = gradle.match(/applicationId\s+["']([^"']+)["']/)?.[1];
    if (appId !== EXPECTED_APP_ID) {
      fail(`android applicationId is "${appId}", expected "${EXPECTED_APP_ID}"`);
    }
    const versionCode = Number(gradle.match(/versionCode\s+(\d+)/)?.[1] ?? "0");
    if (!Number.isInteger(versionCode) || versionCode < 1) {
      fail(`android versionCode must be a positive integer (got ${versionCode})`);
    } else {
      notes.push(`versionCode = ${versionCode}`);
    }
  } else {
    fail("android/app/build.gradle not found");
  }

  // 3b. No cleartext / debuggable network config in the release manifest
  const manifestPath = join(androidDir, "app", "src", "main", "AndroidManifest.xml");
  if (existsSync(manifestPath)) {
    const manifest = readFileSync(manifestPath, "utf8");
    if (/android:usesCleartextTraffic\s*=\s*"true"/i.test(manifest)) {
      fail("AndroidManifest.xml enables cleartext traffic");
    }
  }

  // 3c. network_security_config must not trust user CAs or allow cleartext
  const nscPath = join(
    androidDir, "app", "src", "main", "res", "xml", "network_security_config.xml"
  );
  if (existsSync(nscPath)) {
    const nsc = readFileSync(nscPath, "utf8");
    if (/cleartextTrafficPermitted\s*=\s*"true"/i.test(nsc)) {
      fail("network_security_config.xml permits cleartext traffic");
    }
    if (/<certificates[^>]*src\s*=\s*"user"/i.test(nsc)) {
      fail("network_security_config.xml trusts user-installed CAs (debug trust left enabled)");
    }
  }
}

// ── Report ───────────────────────────────────────────────────────────────────
for (const n of notes) console.log(`  · ${n}`);

if (errors.length) {
  console.error("\n✗ Release check FAILED:");
  for (const e of errors) console.error(`  - ${e}`);
  console.error(`\n${errors.length} blocking issue(s). Not safe to build a release AAB.\n`);
  process.exit(1);
}

console.log(`\n✓ Release check passed — server ${serverUrl}, appId ${EXPECTED_APP_ID}.\n`);
