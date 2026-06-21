import { expect, test, type Page } from "@playwright/test";

const requiredEnv = [
  "E2E_BASE_URL",
  "E2E_USER_EMAIL",
  "E2E_USER_PASSWORD",
  "E2E_TARGET_MEMBER",
] as const;

const missingEnv = requiredEnv.filter((name) => !process.env[name]);

test.skip(
  missingEnv.length > 0,
  `Missing E2E environment variables: ${missingEnv.join(", ")}`,
);

async function fillFirstVisible(page: Page, selectors: string, value: string) {
  const field = page.locator(selectors).first();
  await expect(field).toBeVisible();
  await field.fill(value);
}

async function completeAuth0Login(page: Page) {
  await fillFirstVisible(
    page,
    'input[name="username"], input[name="email"], input[type="email"]',
    process.env.E2E_USER_EMAIL!,
  );
  await fillFirstVisible(
    page,
    'input[name="password"], input[type="password"]',
    process.env.E2E_USER_PASSWORD!,
  );
  await page.getByRole("button", { name: /continue|log in|sign in/i }).click();
}

test("login, award points, and see activity plus leaderboard updates", async ({ page }) => {
  const targetMember = process.env.E2E_TARGET_MEMBER!;
  const note = `Playwright E2E recognition ${Date.now()}`;

  await page.goto("/");

  const signInLink = page.getByRole("link", { name: /sign in/i });
  if (await signInLink.isVisible().catch(() => false)) {
    await signInLink.click();
    await completeAuth0Login(page);
  }

  await expect(page.getByText(/welcome back/i)).toBeVisible();

  await page.getByRole("button", { name: /award points/i }).first().click();
  const dialog = page.getByRole("dialog", { name: /award points/i });

  await dialog.getByText(/select a team member/i).click();
  await page.getByRole("option", { name: new RegExp(targetMember, "i") }).click();

  await dialog.getByRole("button", { name: "+5" }).click();

  await dialog.getByText(/select a trait/i).click();
  await page.getByRole("option", { name: /collaboration/i }).click();

  await dialog.getByPlaceholder(/describe what they did well/i).fill(note);
  await dialog.getByRole("button", { name: /^award points$/i }).click();

  await expect(page.getByText(/points awarded/i)).toBeVisible();

  await page.getByRole("tab", { name: /activity/i }).click();
  await expect(page.getByText(note)).toBeVisible();

  await page.getByRole("tab", { name: /leaderboard/i }).click();
  await expect(page.getByText(new RegExp(targetMember, "i"))).toBeVisible();
});
