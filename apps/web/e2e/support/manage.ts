import { expect, type Page } from "@playwright/test";

import { signInIfNeeded } from "./auth";
import { expectDashboardReady } from "./dashboard";
import { gotoE2EStart } from "./navigation";

export async function openManage(
  page: Page,
  credentials: { email: string; password: string },
) {
  await gotoE2EStart(page);
  await signInIfNeeded(page, credentials);
  await expectDashboardReady(page);

  const manageTab = page.getByRole("tab", { name: "Manage" });
  if (await manageTab.isVisible().catch(() => false)) {
    await manageTab.click();
  } else {
    const manageUrl = new URL(page.url());
    manageUrl.searchParams.set("tab", "manage");
    await page.goto(manageUrl.toString(), { waitUntil: "domcontentloaded" });
    await expectDashboardReady(page);
  }

  await expect(page.getByRole("navigation", { name: "Manage sections" }).or(
    page.getByRole("combobox", { name: "Manage sections" }),
  )).toBeVisible();
}
