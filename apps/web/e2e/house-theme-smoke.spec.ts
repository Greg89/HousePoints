import { expect, test, type Page } from "@playwright/test";
import { missingRequiredEnv, requiredDashboardSmokeEnv } from "./support/config";
import { signInIfNeeded } from "./support/auth";
import { expectDashboardReady } from "./support/dashboard";
import { gotoE2EStart } from "./support/navigation";

const missingEnv = missingRequiredEnv(requiredDashboardSmokeEnv);

test.skip(
  missingEnv.length > 0,
  `Missing E2E environment variables: ${missingEnv.join(", ")}`,
);

test("enabled house theme applies to settings and dashboard shells", async ({ page }) => {
  await gotoE2EStart(page);
  await signInIfNeeded(page);
  await expectDashboardReady(page);

  await page.goto("/settings", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Account" })).toBeVisible();

  const themeSwitch = page.getByRole("switch").first();
  await expect(themeSwitch).toBeVisible();
  await expect(themeSwitch).toBeEnabled();

  if ((await themeSwitch.getAttribute("aria-checked")) !== "true") {
    await themeSwitch.click();
    await expect(page.getByText(/house theme preference saved/i)).toBeVisible();
  }

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Account" })).toBeVisible();
  await expectHouseThemeShell(page);
  await expect(page.getByRole("banner")).toHaveClass(/house-theme-header/);
  await expect(page.getByRole("navigation", { name: /account settings sections/i })).toHaveClass(/house-theme-card/);

  await gotoE2EStart(page);
  await expectDashboardReady(page);
  await expectHouseThemeShell(page);
  await expect(page.getByRole("banner")).toHaveClass(/house-theme-header/);
});

async function expectHouseThemeShell(page: Page) {
  const shell = page.locator(".house-theme-shell").first();
  await expect(shell).toBeVisible();

  const primary = await shell.evaluate((element) =>
    window.getComputedStyle(element).getPropertyValue("--primary").trim(),
  );

  expect(primary).toMatch(/^#[0-9a-f]{6}$/i);
}
