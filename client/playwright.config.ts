import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:5174",
    trace: "on-first-retry",
    ...devices["Desktop Chrome"],
    launchOptions:
      process.platform === "win32"
        ? {
            executablePath:
              process.env.CHROME_PATH ??
              "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
          }
        : {},
  },
  webServer: {
    command: "pnpm dev --host 127.0.0.1 --port 5174 --strictPort",
    url: "http://127.0.0.1:5174",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
