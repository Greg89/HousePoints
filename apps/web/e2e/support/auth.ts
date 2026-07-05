import { expect, type Page } from "@playwright/test";
import { readE2EUserCredentials } from "./config";
import { getE2EDiagnostics } from "./navigation";

type E2ECredentials = {
  email: string;
  password: string;
};

export function exactNamePattern(value: string) {
  return new RegExp(`^${value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i");
}

export async function signInIfNeeded(page: Page, credentials: E2ECredentials = readE2EUserCredentials()) {
  assertNotChromeErrorPage(page, "before sign-in check");

  const signInLink = page.getByRole("link", { name: /sign in/i });
  if (await signInLink.isVisible().catch(() => false)) {
    await signInLink.click();
    await completeAuth0Login(page, credentials);
  }

  assertNotChromeErrorPage(page, "after sign-in check");
}

async function completeAuth0Login(page: Page, credentials: E2ECredentials) {
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
  await page.waitForLoadState("domcontentloaded").catch(() => undefined);
  assertNotChromeErrorPage(page, "after Auth0 submit");
}

async function fillFirstVisible(page: Page, selectors: string, value: string) {
  const field = page.locator(selectors).first();
  await expect(field).toBeVisible();
  await field.fill(value);
}

function assertNotChromeErrorPage(page: Page, checkpoint: string) {
  if (!page.url().startsWith("chrome-error://")) {
    return;
  }

  const diagnostics = getE2EDiagnostics(page);
  const lines = [
    `Browser reached Chrome's internal error page ${checkpoint}.`,
    `Current URL: ${page.url()}`,
  ];

  if (diagnostics.length > 0) {
    lines.push("Navigation diagnostics:");
    lines.push(...diagnostics.slice(-15));
  }

  throw new Error(lines.join("\n"));
}
