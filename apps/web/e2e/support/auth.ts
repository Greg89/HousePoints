import { expect, type Page } from "@playwright/test";
import { readE2EUserCredentials } from "./config";

export function exactNamePattern(value: string) {
  return new RegExp(`^${value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i");
}

export async function signInIfNeeded(page: Page) {
  const signInLink = page.getByRole("link", { name: /sign in/i });
  if (await signInLink.isVisible().catch(() => false)) {
    await signInLink.click();
    await completeAuth0Login(page);
  }
}

async function completeAuth0Login(page: Page) {
  const credentials = readE2EUserCredentials();

  await fillFirstVisible(
    page,
    'input[name="username"], input[name="email"], input[type="email"]',
    credentials.email,
  );
  await fillFirstVisible(
    page,
    'input[name="password"], input[type="password"]',
    credentials.password,
  );
  await page.getByRole("button", { name: /^(continue|log in|sign in)$/i }).click();
}

async function fillFirstVisible(page: Page, selectors: string, value: string) {
  const field = page.locator(selectors).first();
  await expect(field).toBeVisible();
  await field.fill(value);
}
