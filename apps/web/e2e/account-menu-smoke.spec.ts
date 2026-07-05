import { expect, test } from "@playwright/test";
import { missingRequiredEnv, requiredDashboardSmokeEnv } from "./support/config";
import { signInIfNeeded } from "./support/auth";
import { expectDashboardReady } from "./support/dashboard";
import { gotoE2EStart } from "./support/navigation";

const missingEnv = missingRequiredEnv(requiredDashboardSmokeEnv);

test.skip(
  missingEnv.length > 0,
  `Missing E2E environment variables: ${missingEnv.join(", ")}`,
);

test("account menu exposes org scope, notifications, and account actions", async ({ page }) => {
  await gotoE2EStart(page);
  await signInIfNeeded(page);

  await expectDashboardReady(page);

  await page.getByRole("button", { name: /account menu/i }).click();
  const accountMenu = page.getByRole("dialog", { name: /account and notifications/i });

  await expect(accountMenu).toBeVisible();
  await expect(accountMenu.getByText(/signed in/i)).toBeVisible();
  await expect(accountMenu.getByRole("heading", { name: /notifications/i })).toBeVisible();
  await expect(accountMenu.getByRole("button", { name: /mark all read/i })).toBeVisible();
  await expect(accountMenu.getByRole("link", { name: /^account$/i })).toBeVisible();
  await expect(accountMenu.getByRole("link", { name: /sign out/i })).toBeVisible();

  const organizationSwitcher = accountMenu.getByRole("region", { name: /switch organization/i });
  if (await organizationSwitcher.isVisible().catch(() => false)) {
    await expect(organizationSwitcher.getByText(/notifications and dashboard data follow/i)).toBeVisible();
    await expect(organizationSwitcher.getByText(/current/i).first()).toBeVisible();
  }

  const whatsNewLink = accountMenu.getByRole("link", { name: /what'?s new/i });
  if (await whatsNewLink.isVisible().catch(() => false)) {
    await expect(whatsNewLink).toHaveAttribute("target", "_blank");
  }
});
