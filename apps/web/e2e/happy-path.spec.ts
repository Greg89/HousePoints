import { expect, test } from "@playwright/test";
import { exactNamePattern, missingRequiredEnv, signInIfNeeded } from "./support/auth";

const requiredEnv = [
  "E2E_BASE_URL",
  "E2E_USER_EMAIL",
  "E2E_USER_PASSWORD",
  "E2E_TARGET_MEMBER",
] as const;

const missingEnv = missingRequiredEnv(requiredEnv);

test.skip(
  missingEnv.length > 0,
  `Missing E2E environment variables: ${missingEnv.join(", ")}`,
);

test("login, award points, and see activity plus leaderboard updates", async ({ page }) => {
  const targetMember = process.env.E2E_TARGET_MEMBER!;
  const note = `Playwright E2E recognition ${Date.now()}`;

  await page.goto("/");
  await signInIfNeeded(page);

  await expect(page.getByText(/welcome back/i)).toBeVisible();

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
