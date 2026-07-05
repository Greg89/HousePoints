import { expect, test } from "@playwright/test";
import { missingRequiredEnv, readE2EStartPath, requiredDashboardSmokeEnv } from "./support/config";
import { signInIfNeeded } from "./support/auth";
import { expectDashboardReady } from "./support/dashboard";

const missingEnv = missingRequiredEnv(requiredDashboardSmokeEnv);

test.skip(
  missingEnv.length > 0,
  `Missing E2E environment variables: ${missingEnv.join(", ")}`,
);

test("login and navigate the core dashboard tabs", async ({ page }) => {
  await page.goto(readE2EStartPath());
  await signInIfNeeded(page);

  await expectDashboardReady(page);
  await expect(page.getByRole("button", { name: /award points/i }).first()).toBeVisible();

  const overviewTab = page.getByRole("tab", { name: /overview/i });
  await expect(overviewTab).toBeVisible();
  await expect(overviewTab).toHaveAttribute("aria-selected", "true");
  await expect(page.getByText(/organization report/i)).toBeVisible();

  await page.getByRole("tab", { name: /activity/i }).click();
  await expect(page.getByText(/recent activity/i)).toBeVisible();

  await page.getByRole("tab", { name: /leaderboard/i }).click();
  await expect(page.getByText(/top contributors/i)).toBeVisible();

  const manageTab = page.getByRole("tab", { name: /manage/i });
  if (await manageTab.isVisible().catch(() => false)) {
    await manageTab.click();
    await expect(page.getByRole("navigation", { name: /manage sections/i })).toBeVisible();
  }
});
