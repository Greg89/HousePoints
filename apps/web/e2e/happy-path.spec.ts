import { expect, test } from "@playwright/test";
import { missingRequiredEnv, readTargetMemberName, requiredStagingEnv } from "./support/config";
import { exactNamePattern, signInIfNeeded } from "./support/auth";
import { expectDashboardReady } from "./support/dashboard";
import { gotoE2EStart } from "./support/navigation";

const missingEnv = missingRequiredEnv(requiredStagingEnv);

test.skip(
  missingEnv.length > 0,
  `Missing E2E environment variables: ${missingEnv.join(", ")}`,
);

test("login, award points, and see activity plus leaderboard updates", async ({ page }) => {
  const targetMember = readTargetMemberName();
  const note = `Playwright E2E recognition ${Date.now()}`;

  await gotoE2EStart(page);
  await signInIfNeeded(page);

  await expectDashboardReady(page);

  await page.getByRole("button", { name: /award points/i }).first().click();
  const dialog = page.getByRole("dialog", { name: /award points/i });

  await dialog.getByText(/select a team member/i).click();
  await page.getByRole("option", { name: exactNamePattern(targetMember) }).click();

  await dialog.getByRole("button", { name: "+5", exact: true }).click();

  await dialog.getByText(/select a trait/i).click();
  await page.getByRole("option", { name: /collaboration/i }).click();

  await dialog.getByPlaceholder(/describe what they did well/i).fill(note);
  await dialog.getByRole("button", { name: /^award points$/i }).click();

  await expect(page.getByText(/points awarded/i)).toBeVisible();

  await page.getByRole("tab", { name: /activity/i }).click();
  await expect(page.getByText(note)).toBeVisible();

  await page.getByRole("tab", { name: /leaderboard/i }).click();
  await expect(page.getByText(exactNamePattern(targetMember))).toBeVisible();
});
