import { expect, test } from "@playwright/test";
import { missingRequiredEnv, readE2EAdminCredentials, requiredDashboardSmokeEnv } from "./support/config";
import { signInIfNeeded } from "./support/auth";
import { expectDashboardReady } from "./support/dashboard";
import { gotoE2EStart } from "./support/navigation";

const missingEnv = missingRequiredEnv(requiredDashboardSmokeEnv);

test.skip(
  missingEnv.length > 0,
  `Missing E2E environment variables: ${missingEnv.join(", ")}`,
);

test("admin audit history is reachable and filterable", async ({ page }) => {
  const adminCredentials = readE2EAdminCredentials();
  test.skip(!adminCredentials, "Missing optional E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD credentials.");

  await gotoE2EStart(page);
  await signInIfNeeded(page, adminCredentials ?? undefined);

  await expectDashboardReady(page);

  const manageTab = page.getByRole("tab", { name: /manage/i });
  await expect(manageTab).toBeVisible();
  await manageTab.click();

  await expect(page.getByRole("navigation", { name: /manage sections/i })).toBeVisible();

  await page.getByRole("tab", { name: /^audit$/i }).click();

  await expect(page.getByRole("heading", { name: "Audit", level: 2 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "History" })).toBeVisible();
  await expect(page.getByText(/full history of important organization changes/i)).toBeVisible();

  const filter = page.getByLabel(/filter history/i);
  await expect(filter).toBeVisible();
  await expect(filter).toContainText("All audit events");

  await filter.selectOption("USER_ROLE_CHANGED");
  await expect(page.getByText(/events (shown|total)/i).or(page.getByText(/no audit history matches this filter yet/i))).toBeVisible();
});
