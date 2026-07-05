import { defineConfig, devices } from "@playwright/test";

function readBaseURL() {
  const rawBaseURL = process.env.E2E_BASE_URL?.trim();
  if (!rawBaseURL) {
    return "http://localhost:3000";
  }

  const baseURL = new URL(rawBaseURL);
  if (baseURL.protocol !== "http:" && baseURL.protocol !== "https:") {
    throw new Error("E2E_BASE_URL must use the http or https protocol.");
  }

  return baseURL.href.replace(/\/$/, "");
}

export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  expect: {
    timeout: 15_000,
  },
  fullyParallel: false,
  workers: process.env.CI ? 1 : undefined,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: readBaseURL(),
    screenshot: "only-on-failure",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
