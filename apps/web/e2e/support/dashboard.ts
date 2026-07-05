import { expect, type Page } from "@playwright/test";

export async function expectDashboardReady(page: Page) {
  await Promise.race([
    page.getByText(/welcome back/i).waitFor({ state: "visible", timeout: 15_000 }),
    page.getByText(/waiting for assignment/i).waitFor({ state: "visible", timeout: 15_000 }),
    page.getByText(/create organisation/i).waitFor({ state: "visible", timeout: 15_000 }),
    page.getByText(/something went wrong/i).waitFor({ state: "visible", timeout: 15_000 }),
  ]);

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
