import { expect, type Page } from "@playwright/test";

import { getE2EDiagnostics } from "./navigation";

export async function expectDashboardReady(page: Page) {
  await page.waitForURL(/\/o\/[^/?#]+/, { timeout: 30_000 }).catch(() => undefined);

  await Promise.any([
    page.getByText(/welcome back/i).waitFor({ state: "visible", timeout: 30_000 }),
    page.getByText(/waiting for assignment/i).waitFor({ state: "visible", timeout: 30_000 }),
    page.getByText(/create organisation/i).waitFor({ state: "visible", timeout: 30_000 }),
    page.getByText(/something went wrong/i).waitFor({ state: "visible", timeout: 30_000 }),
  ]).catch(async () => {
    throw new Error(await buildDashboardTimeoutMessage(page));
  });

  if (await page.getByText(/waiting for assignment/i).isVisible().catch(() => false)) {
    throw new Error(
      "E2E user reached the waiting-for-assignment state. Assign this user to a house in the E2E organization.",
    );
  }

  if (await page.getByText(/create organisation/i).isVisible().catch(() => false)) {
    throw new Error(
      "E2E user reached organization onboarding. Add this user to the E2E organization or set E2E_ORG_SLUG to an organization they belong to.",
    );
  }

  if (await page.getByText(/something went wrong/i).isVisible().catch(() => false)) {
    throw new Error("E2E user reached the app error boundary. Check web/API logs for the staging request.");
  }

  await expect(page.getByText(/welcome back/i)).toBeVisible();
}

async function buildDashboardTimeoutMessage(page: Page) {
  const title = await page.title().catch(() => "unknown");
  const bodyText = await page.locator("body").innerText({ timeout: 1_000 }).catch(() => "");
  const preview = bodyText.replace(/\s+/g, " ").trim().slice(0, 500) || "empty body";

  return [
    ...buildDashboardTimeoutLines(page, title, preview),
  ].join("\n");
}

function buildDashboardTimeoutLines(page: Page, title: string, preview: string) {
  const lines = [
    "E2E user did not reach a recognized dashboard state within 30 seconds.",
    `Current URL: ${page.url()}`,
    `Page title: ${title}`,
    `Body preview: ${preview}`,
  ];

  const diagnostics = getE2EDiagnostics(page);
  if (diagnostics.length > 0) {
    lines.push("Navigation diagnostics:");
    lines.push(...diagnostics.slice(-15));
  }

  return lines;
}
