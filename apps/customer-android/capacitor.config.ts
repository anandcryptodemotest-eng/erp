import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Remote-WebView shell around the Next.js customer portal (apps/customer).
 *
 * The app loads the live portal over HTTPS — Next.js is NOT bundled into the APK.
 * All catalog / cart / auth / tenant / OMS logic stays server-side in apps/customer.
 * See docs/CUSTOMER-ANDROID-APK.md (locked contract) and ./README.md.
 */

// Production default. Override per environment with CAPACITOR_SERVER_URL, e.g.
//   CAPACITOR_SERVER_URL=https://staging-customer.sankalpplatforms.com pnpm sync
const DEFAULT_SERVER_URL = "https://customer.sankalpplatforms.com";
const serverUrl = (process.env.CAPACITOR_SERVER_URL ?? DEFAULT_SERVER_URL).trim();

// Fail fast on an unsafe remote URL so a bad env can never produce a shippable build.
// (The release guard re-checks this against the built AAB — see scripts/release-check.mjs.)
if (!/^https:\/\//i.test(serverUrl)) {
  throw new Error(
    `CAPACITOR_SERVER_URL must be https:// (got "${serverUrl}"). HTTP and raw IPs are not allowed.`
  );
}

const config: CapacitorConfig = {
  appId: "com.sankalp.erp.customer",
  appName: "Sankalp",
  // Minimal placeholder only — the real UI is served remotely from server.url.
  webDir: "www",
  server: {
    url: serverUrl,
    // No cleartext: the WebView will refuse http:// resources.
    cleartext: false,
    androidScheme: "https",
  },
  android: {
    // Never trust user-added / debug CAs in release builds.
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: "#1e3d32",
      showSpinner: false,
    },
  },
};

export default config;
