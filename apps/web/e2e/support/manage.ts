import { expect, type Locator, type Page } from "@playwright/test";

import { signInIfNeeded } from "./auth";
import { expectDashboardReady } from "./dashboard";
import { gotoE2EStart } from "./navigation";

export async function expectManageWorkspaceContract(
  control: Locator,
  role: "tab" | "option" = "tab",
) {
  await expect(control).toBeVisible();
  await expect(control.getByRole(role, { name: "Overview", exact: true })).toHaveCount(1);
  const recognitionEnabled = await control.getByRole(role, { name: "Recognition", exact: true }).count() > 0;
  const names = ["Overview", "Members", "Houses", "Seasons"];
  if (recognitionEnabled) names.push("Recognition");
  names.push("Organization", "Audit");

  await expect(control.getByRole(role)).toHaveCount(names.length);
  for (const name of names) {
    const label = new RegExp(`^${name}(?:\\s+\\(?Owner only\\)?)?$`, "i");
    const destination = control.getByRole(role, { name: label });
    if (role === "tab") {
      await expect(destination).toBeVisible();
    } else {
      await expect(destination).toHaveCount(1);
    }
  }
  return recognitionEnabled;
}

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
