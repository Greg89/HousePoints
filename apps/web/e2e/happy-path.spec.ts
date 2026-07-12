import { expect, test, type Page } from "@playwright/test";
import { missingRequiredEnv, readTargetMemberName, requiredStagingEnv } from "./support/config";
import { exactNamePattern, signInIfNeeded } from "./support/auth";
import { expectDashboardReady } from "./support/dashboard";
import { gotoE2EStart } from "./support/navigation";
import { selectMemberFromCombobox } from "./support/member-picker";

const missingEnv = missingRequiredEnv(requiredStagingEnv);

test.skip(
  missingEnv.length > 0,
  `Missing E2E environment variables: ${missingEnv.join(", ")}`,
);

test("login, award points, react, and see activity plus leaderboard updates", async ({ page }) => {
  const targetMember = readTargetMemberName();
  const note = `Playwright E2E recognition ${Date.now()}`;

  await gotoE2EStart(page);
  await signInIfNeeded(page);

  await expectDashboardReady(page);

  await page.getByRole("button", { name: /award points/i }).first().click();
  const dialog = page.getByRole("dialog", { name: /award points/i });

  await selectMemberFromCombobox(page, dialog, /recipient/i, targetMember);

  await dialog.getByRole("button", { name: "+5", exact: true }).click();

  await dialog.getByText(/select a trait/i).click();
  await page.getByRole("option", { name: /collaboration/i }).click();

  await dialog.getByPlaceholder(/describe what they did well/i).fill(note);
  await dialog.getByRole("button", { name: /^award points$/i }).click();

  await expect(page.getByText(/points awarded/i)).toBeVisible();

  await page.getByRole("tab", { name: /activity/i }).click();
  await expect(page.getByText(note)).toBeVisible();

  const activityCard = getActivityCard(page, note);
  await activityCard.getByRole("button", { name: /open reactions for/i }).click();
  await activityCard.getByRole("menuitem", { name: /react with love it/i }).click();
  await expect(activityCard.getByRole("menuitem", { name: /remove love it reaction/i })).toHaveAttribute("aria-pressed", "true");

  await activityCard.getByRole("button", { name: /activity actions/i }).click();
  await page.getByRole("menuitem", { name: /view reactions/i }).click();
  const reactionsDialog = page.getByRole("dialog", { name: /reactions/i });
  await expect(reactionsDialog).toBeVisible();
  await expect(reactionsDialog.getByRole("img", { name: "Love it" })).toBeVisible();
  await expect(reactionsDialog.getByText(note)).toBeVisible();
  await reactionsDialog.getByRole("button", { name: /close reaction details/i }).click();

  await page.getByRole("tab", { name: /leaderboard/i }).click();
  await expect(page.getByText(exactNamePattern(targetMember))).toBeVisible();
});

function getActivityCard(page: Page, note: string) {
  return page.getByText(note, { exact: true }).locator(
    "xpath=ancestor::*[@data-testid='activity-card' or (contains(concat(' ', normalize-space(@class), ' '), ' rounded-xl ') and .//button[contains(@aria-label, 'Open reactions for')])][1]",
  );
}
