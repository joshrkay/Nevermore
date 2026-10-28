import { defineConfig, devices } from "@playwright/test";
import { ANON_KEY, APP_PORT, APP_URL, GATEWAY_URL } from "./e2e/stack/config.mjs";

const CI = Boolean(process.env.CI);

// Output (build, results, report) all goes under e2e/.output, which is gitignored.
const REPORT = { outputFolder: "e2e/.output/report", open: "never" } as const;

export default defineConfig({
  testDir: "e2e",
  testMatch: "**/*.spec.ts",
  outputDir: "e2e/.output/test-results",

  // One browser journey against one shared database and gateway: no parallelism, and no retries,
  // because a flaky run has to be fixed rather than hidden.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: CI,

  reporter: CI ? [["github"], ["html", REPORT]] : [["list"], ["html", REPORT]],

  use: {
    baseURL: APP_URL,
    viewport: { width: 1440, height: 900 }, // 768px and wider is the desktop layout, which has the chat transcript
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
        // CI installs the browser Playwright expects; a machine whose browser is a different build
        // points this at it. An empty value counts as unset.
        launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined },
      },
    },
  ],

  webServer: [
    {
      // The Supabase stand-in: a real Postgres with the real migrations behind a small HTTP gateway.
      command: "node e2e/stack/start.mjs",
      url: `${GATEWAY_URL}/__e2e/health`,
      reuseExistingServer: !CI, // a developer can keep it running; CI always starts fresh
      timeout: 60_000,
      stdout: "pipe",
    },
    {
      // A production build rather than `vite dev`: the dev server can re-optimise a dependency (jspdf,
      // on the lazy Manuscript route) mid-test and reload the page. The VITE_* values are set to
      // empty strings, not left out, so a developer's .env cannot leak into the build.
      command:
        "npx vite build --outDir e2e/.output/app --emptyOutDir && " +
        `npx vite preview --outDir e2e/.output/app --port ${APP_PORT} --strictPort --host localhost`,
      url: APP_URL,
      env: {
        VITE_SUPABASE_URL: GATEWAY_URL,
        VITE_SUPABASE_PUBLISHABLE_KEY: ANON_KEY,
        VITE_SUPABASE_PROJECT_ID: "e2e",
        VITE_TURNSTILE_SITE_KEY: "",
        VITE_ELEVENLABS_AGENT_ID: "",
      },
      reuseExistingServer: !CI,
      timeout: 180_000, // includes the build
    },
  ],
});
