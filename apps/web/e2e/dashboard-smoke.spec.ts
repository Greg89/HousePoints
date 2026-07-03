import { expect, test } from "@playwright/test";
import { missingRequiredEnv, signInIfNeeded } from "./support/auth";

const requiredEnv = [
  "E2E_BASE_URL",
  "E2E_USER_EMAIL",
  "E2E_USER_PASSWORD",
] as const;

const missingEnv = missingRequiredEnv(requiredEnv);

test.skip(
  missingEnv.length > 0,
  `Missing E2E environment variables: ${missingEnv.join(", ")}`,
);

test("login and navigate the core dashboard tabs", async ({ page }) => {
  await page.goto("/");
  await signInIfNeeded(page);

  await expect(page.getByText(/welcome back/i)).toBeVisible();
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
