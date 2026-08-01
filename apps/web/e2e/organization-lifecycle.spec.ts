import { expect, test, type Page } from "@playwright/test";
import { signInIfNeeded } from "./support/auth";
import {
  missingRequiredEnv,
  readE2ELifecycleOrgSlug,
  readE2EOwnerCredentials,
  requiredManageEnv,
} from "./support/config";
import { expectDashboardReady } from "./support/dashboard";
import { gotoE2EStart } from "./support/navigation";

const lifecycleOrgSlug = readE2ELifecycleOrgSlug();
const missingEnv = missingRequiredEnv(requiredManageEnv);

test.skip(
  missingEnv.length > 0 || !lifecycleOrgSlug,
  `Missing lifecycle E2E configuration: ${[
    ...missingEnv,
    ...(lifecycleOrgSlug ? [] : ["E2E_LIFECYCLE_ORG_SLUG"]),
  ].join(", ")}`,
);

test("owner can switch to a dedicated organization, archive it, and restore it", async ({ page }) => {
  const ownerCredentials = readE2EOwnerCredentials()!;
  const slug = lifecycleOrgSlug!;
  let archived = false;

  await gotoE2EStart(page);
  await signInIfNeeded(page, ownerCredentials);
  await expectDashboardReady(page);

  await page.getByRole("button", { name: /current organization:/i }).click();
  const lifecycleLink = page.locator(
    `a[href="/o/${encodeURIComponent(slug)}/switch"]`,
  );
  await expect(lifecycleLink).toBeVisible();
  await lifecycleLink.click();
  await expect(page).toHaveURL(new RegExp(`/o/${escapeRegExp(slug)}(?:\\?|$)`));
  await expectDashboardReady(page);

  try {
    await openOrganizationWorkspace(page);
    const archiveForm = page.getByRole("form", { name: "Archive organization" });
    await archiveForm.getByLabel("Confirm archive").fill(slug);
    await archiveForm.getByRole("button", { name: "Archive organization" }).click();

    await expect(
      page.getByRole("heading", { name: "This organization is archived" }),
    ).toBeVisible();
    archived = true;
    await expect(page.getByRole("form", { name: /restore/i })).toBeVisible();

    await restoreArchivedOrganization(page, slug);
    archived = false;
    await expectDashboardReady(page);
    await expect(page).toHaveURL(new RegExp(`/o/${escapeRegExp(slug)}(?:\\?|$)`));
  } finally {
    if (archived) {
      await page.goto(`/o/${encodeURIComponent(slug)}`, {
        waitUntil: "domcontentloaded",
      });
      await restoreArchivedOrganization(page, slug);
    }
  }
});

async function openOrganizationWorkspace(page: Page) {
  await page.getByRole("tab", { name: "Manage" }).click();
  const navigation = page.getByRole("navigation", { name: "Manage sections" });
  await expect(navigation).toBeVisible();
  await navigation.getByRole("tab", { name: /^Organization$/i }).click();
  await expect(page.getByRole("heading", { name: "Danger zone" })).toBeVisible();
}

async function restoreArchivedOrganization(page: Page, slug: string) {
  const restoreForm = page.getByRole("form", { name: /restore/i });
  await restoreForm.getByLabel("Organization slug").fill(slug);
  await restoreForm.getByRole("button", { name: "Restore organization" }).click();
  await page.waitForURL(new RegExp(`/o/${escapeRegExp(slug)}(?:\\?|$)`));
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
