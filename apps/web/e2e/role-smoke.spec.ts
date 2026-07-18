import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  missingRequiredEnv,
  readE2EAdminCredentials,
  readE2EOwnerCredentials,
  requiredDashboardSmokeEnv,
} from "./support/config";
import { signInIfNeeded } from "./support/auth";
import { expectDashboardReady } from "./support/dashboard";
import { gotoE2EStart } from "./support/navigation";

const missingEnv = missingRequiredEnv(requiredDashboardSmokeEnv);

test.skip(
  missingEnv.length > 0,
  `Missing E2E environment variables: ${missingEnv.join(", ")}`,
);

test("member role can use the dashboard without admin controls", async ({ page }) => {
  await gotoE2EStart(page);
  await signInIfNeeded(page);

  await expectDashboardReady(page);

  await expect(page.getByRole("button", { name: /award points/i }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: /deduct points/i })).toHaveCount(0);
  await expect(page.getByRole("tab", { name: /manage/i })).toHaveCount(0);
});

test("admin role can reach admin sections but not owner-only tabs", async ({ page }) => {
  const adminCredentials = readE2EAdminCredentials();
  test.skip(!adminCredentials, "Missing optional E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD credentials.");

  await gotoE2EStart(page);
  await signInIfNeeded(page, adminCredentials ?? undefined);

  await expectDashboardReady(page);

  await page.getByRole("tab", { name: /manage/i }).click();
  const manageSections = page.getByRole("navigation", { name: /manage sections/i });
  await expect(manageSections).toBeVisible();

  await expect(manageSections.getByRole("tab", { name: /^overview$/i })).toBeEnabled();
  await expect(manageSections.getByRole("tab", { name: /^members$/i })).toBeEnabled();
  await expect(manageSections.getByRole("tab", { name: /^audit$/i })).toBeEnabled();

  for (const ownerOnlyTab of [/^houses\b/i, /^seasons\b/i, /^organization\b/i]) {
    await expectOwnerOnlyTabBlockedForAdmin(page, manageSections, ownerOnlyTab);
  }

  await expect(manageSections.getByRole("tab")).toHaveCount(6);
  await expect(manageSections.getByRole("tab", { name: /^roles$/i })).toHaveCount(0);
  await expect(manageSections.getByRole("tab", { name: /^settings$/i })).toHaveCount(0);
});

test("owner role can reach owner-only manage tabs", async ({ page }) => {
  const ownerCredentials = readE2EOwnerCredentials();
  test.skip(!ownerCredentials, "Missing optional E2E_OWNER_EMAIL/E2E_OWNER_PASSWORD credentials.");

  await gotoE2EStart(page);
  await signInIfNeeded(page, ownerCredentials ?? undefined);

  await expectDashboardReady(page);

  await page.getByRole("tab", { name: /manage/i }).click();
  const manageSections = page.getByRole("navigation", { name: /manage sections/i });
  await expect(manageSections).toBeVisible();

  for (const ownerOnlyTab of [/^houses$/i, /^seasons$/i, /^organization$/i]) {
    const tab = manageSections.getByRole("tab", { name: ownerOnlyTab });
    await expect(tab).toBeVisible();
    await expect(tab).toHaveAttribute("aria-disabled", "false");
  }

  await expect(manageSections.getByRole("tab")).toHaveCount(6);
});

async function expectOwnerOnlyTabBlockedForAdmin(page: Page, manageSections: Locator, name: RegExp) {
  const tab = manageSections.getByRole("tab", { name });
  await expect(tab).toBeVisible();
  await expect(tab).toHaveAttribute("aria-disabled", "true");
  await tab.focus();
  await expect(tab).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(tab).toHaveAttribute("aria-selected", "false");
}
