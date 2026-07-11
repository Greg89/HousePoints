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

test("account menu exposes account actions and release notes access", async ({ page }) => {
  await gotoE2EStart(page);
  await signInIfNeeded(page);

  await expectDashboardReady(page);

  await page.getByRole("button", { name: /account menu/i }).click();
  const accountMenu = page.getByRole("dialog", { name: /^account$/i });

  await expect(accountMenu).toBeVisible();
  await expect(accountMenu.getByText(/signed in/i)).toBeVisible();
  await expect(accountMenu.getByRole("link", { name: /account settings/i })).toBeVisible();
  await expect(accountMenu.getByRole("link", { name: /sign out/i })).toBeVisible();

  const whatsNewLink = accountMenu.getByRole("link", { name: /what'?s new/i });
  if (await whatsNewLink.isVisible().catch(() => false)) {
    await expect(whatsNewLink).toHaveAttribute("target", "_blank");
  }
});
