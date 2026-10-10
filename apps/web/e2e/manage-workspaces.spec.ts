import { expect, test } from "@playwright/test";
import {
  missingRequiredEnv,
  readE2EAdminCredentials,
  readE2EOwnerCredentials,
  readTargetMemberName,
  requiredManageEnv,
} from "./support/config";
import { exactNamePattern, signInIfNeeded } from "./support/auth";
import { expectDashboardReady } from "./support/dashboard";
import { expectManageWorkspaceContract, openManage } from "./support/manage";

const missingEnv = missingRequiredEnv(requiredManageEnv);

test.skip(
  missingEnv.length > 0,
  `Missing Manage E2E environment variables: ${missingEnv.join(", ")}`,
);

test("admin can use shared workspaces while owner-only destinations stay understandable", async ({ page }) => {
  await openManage(page, readE2EAdminCredentials()!);

  const navigation = page.getByRole("navigation", { name: "Manage sections" });
  const recognitionEnabled = await expectManageWorkspaceContract(navigation);
  await expect(page.getByRole("region", { name: "Manage overview" })).toBeVisible();

  if (recognitionEnabled) {
    const recognition = navigation.getByRole("tab", { name: "Recognition", exact: true });
    await expect(recognition).toHaveAttribute("aria-disabled", "false");
    await recognition.click();
    await expect(page.getByRole("region", { name: "Active categories" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Add category", exact: true })).toHaveCount(0);
    await navigation.getByRole("tab", { name: "Overview", exact: true }).click();
  }

  for (const name of ["Houses", "Seasons", "Organization"]) {
    const destination = navigation.getByRole("tab", { name: workspaceNamePattern(name) });
    await expect(destination).toHaveAttribute("aria-disabled", "true");
    await destination.focus();
    await expect(destination).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("region", { name: "Manage overview" })).toBeVisible();
  }

  await navigation.getByRole("tab", { name: "Members" }).click();
  await expect(page).toHaveURL(/[?&]manage=members(?:&|$)/);
  const search = page.getByRole("searchbox", { name: "Search members" });
  await search.fill(readTargetMemberName());
  const memberButton = page.getByRole("button", {
    name: new RegExp(`^Manage ${escapeRegExp(readTargetMemberName())}$`, "i"),
  });
  await expect(memberButton).toBeVisible();
  await memberButton.click();

  const memberDialog = page.getByRole("dialog");
  await expect(memberDialog.getByRole("heading", { name: exactNamePattern(readTargetMemberName()) })).toBeVisible();
  await expect(memberDialog.getByText("Owner only")).toHaveCount(2);
  await page.keyboard.press("Escape");
  await expect(memberDialog).toHaveCount(0);
  await expect(memberButton).toBeFocused();

  await navigation.getByRole("tab", { name: "Audit" }).click();
  await expect(page).toHaveURL(/[?&]manage=audit(?:&|$)/);
  await expect(page.getByRole("heading", { name: "History" })).toBeVisible();
  await page.getByRole("button", { name: "Point adjustments" }).click();
  await expect(page.getByRole("region", { name: "Point adjustment activity" })).toBeVisible();
  await expect(page.getByLabel("Reporting season")).toBeVisible();
  await page.getByRole("button", { name: "History" }).click();
  await expect(page.getByLabel("Filter history")).toBeVisible();
});

test("owner can traverse every workspace, preserve URLs, and open focused tools without mutating beta", async ({ page }) => {
  const ownerCredentials = readE2EOwnerCredentials()!;
  await openManage(page, ownerCredentials);

  const navigation = page.getByRole("navigation", { name: "Manage sections" });
  const recognitionEnabled = await expectManageWorkspaceContract(navigation);

  if (recognitionEnabled) {
    await navigation.getByRole("tab", { name: "Recognition", exact: true }).click();
    await expect(page).toHaveURL(/[?&]manage=recognition(?:&|$)/);
    await expect(page.getByRole("region", { name: "Active categories" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Add category", exact: true })).toBeVisible();
  }

  await navigation.getByRole("tab", { name: "Members" }).click();
  await expect(page.getByRole("heading", { name: "Members", level: 2 })).toBeVisible();
  await expect(page).toHaveURL(/[?&]manage=members(?:&|$)/);

  await navigation.getByRole("tab", { name: "Houses" }).click();
  await expect(page.getByRole("heading", { name: "Houses", level: 2 })).toBeVisible();
  await expect(page).toHaveURL(/[?&]manage=houses(?:&|$)/);
  const createHouse = page.getByRole("button", { name: "Create house" });
  await createHouse.click();
  await expect(page.getByRole("dialog", { name: "Create house" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(createHouse).toBeFocused();

  await navigation.getByRole("tab", { name: "Seasons" }).click();
  await expect(page.getByRole("region", { name: "Season history" })).toBeVisible();
  const startSeason = page.getByRole("button", { name: "Start next season" });
  await startSeason.click();
  await expect(page.getByRole("dialog", { name: "Start next season" })).toContainText(
    /immediately closes/i,
  );
  await page.keyboard.press("Escape");
  await expect(startSeason).toBeFocused();

  await navigation.getByRole("tab", { name: "Organization" }).click();
  await expect(page.getByRole("heading", { name: "Organization identity" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "URL and slug" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Ownership" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Danger zone" })).toBeVisible();

  await navigation.getByRole("tab", { name: "Audit" }).click();
  await expect(page).toHaveURL(/[?&]manage=audit(?:&|$)/);

  await page.goBack();
  await expect(page.getByRole("heading", { name: "Organization", level: 2 })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("heading", { name: "Seasons", level: 2 })).toBeVisible();

  await navigation.getByRole("tab", { name: "Audit" }).click();
  await page.reload({ waitUntil: "domcontentloaded" });
  await signInIfNeeded(page, ownerCredentials);
  await expectDashboardReady(page);
  await expect(page.getByRole("heading", { name: "Audit", level: 2 })).toBeVisible();
});

test("admin mobile picker keeps owner-only workspaces visible and disabled", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openManage(page, readE2EAdminCredentials()!);

  const picker = page.getByRole("combobox", { name: "Manage sections" });
  await expect(picker).toBeVisible();
  const recognitionEnabled = await expectManageWorkspaceContract(picker, "option");

  if (recognitionEnabled) {
    await expect(picker.getByRole("option", { name: "Recognition", exact: true })).toBeEnabled();
    await picker.selectOption("recognition");
    await expect(page.getByRole("region", { name: "Active categories" })).toBeVisible();
  }

  for (const label of ["Houses (Owner only)", "Seasons (Owner only)", "Organization (Owner only)"]) {
    await expect(picker.getByRole("option", { name: label })).toBeDisabled();
  }

  await picker.selectOption("members");
  await expect(page.getByRole("heading", { name: "Members", level: 2 })).toBeVisible();
  await expect(page.locator("body")).not.toHaveCSS("overflow-x", "scroll");
});

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function workspaceNamePattern(value: string) {
  return new RegExp(`^${escapeRegExp(value)}(?:\\s+Owner only)?$`, "i");
}
