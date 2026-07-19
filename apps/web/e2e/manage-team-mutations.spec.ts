import { expect, test, type Locator, type Page } from "@playwright/test";

import {
  missingRequiredEnv,
  readE2EAdminCredentials,
  readTargetMemberName,
  requiredManageEnv,
} from "./support/config";
import { openManage } from "./support/manage";

const missingEnv = missingRequiredEnv(requiredManageEnv);

test.skip(
  missingEnv.length > 0,
  `Missing Manage E2E environment variables: ${missingEnv.join(", ")}`,
);

test("admin can reassign a member and restore the original house", async ({ page }) => {
  const credentials = readE2EAdminCredentials()!;
  const targetMember = readTargetMemberName();
  let originalHouseId: string | null = null;
  let reassignmentAttempted = false;

  await openTargetMember(page, credentials, targetMember);
  const houseSelect = memberHouseSelect(page);
  originalHouseId = await houseSelect.inputValue();
  expect(originalHouseId, "The E2E target member must start with a house assignment.").not.toBe("");

  const alternativeHouseId = await findAlternativeHouseId(houseSelect, originalHouseId);
  expect(
    alternativeHouseId,
    "The staging E2E organization needs at least two active houses for reversible assignment coverage.",
  ).not.toBeNull();

  try {
    reassignmentAttempted = true;
    await saveHouseAssignment(page, alternativeHouseId!);
    await assertPersistedHouseAssignment(page, credentials, targetMember, alternativeHouseId!);
  } finally {
    if (reassignmentAttempted && originalHouseId) {
      await openTargetMember(page, credentials, targetMember);
      await saveHouseAssignment(page, originalHouseId);
      await assertPersistedHouseAssignment(page, credentials, targetMember, originalHouseId);
    }
  }
});

async function openTargetMember(
  page: Page,
  credentials: { email: string; password: string },
  targetMember: string,
) {
  await openManage(page, credentials);
  const navigation = page.getByRole("navigation", { name: "Manage sections" });
  await navigation.getByRole("tab", { name: "Members" }).click();
  await page.getByRole("searchbox", { name: "Search members" }).fill(targetMember);
  await page.getByRole("button", {
    name: new RegExp(`^Manage ${escapeRegExp(targetMember)}$`, "i"),
  }).click();
  await expect(page.getByRole("form", { name: "Assign user to house" })).toBeVisible();
}

function memberHouseSelect(page: Page) {
  return page.getByRole("form", { name: "Assign user to house" })
    .getByRole("combobox", { name: "House assignment" });
}

async function findAlternativeHouseId(houseSelect: Locator, originalHouseId: string) {
  const houseIds = await houseSelect.locator("option:not([disabled])").evaluateAll(
    (options) => options.map((option) => (option as HTMLOptionElement).value),
  );
  return houseIds.find((houseId) => houseId !== originalHouseId) ?? null;
}

async function saveHouseAssignment(page: Page, houseId: string) {
  const form = page.getByRole("form", { name: "Assign user to house" });
  await form.getByRole("combobox", { name: "House assignment" }).selectOption(houseId);
  await form.getByRole("button", { name: "Save house" }).click();
  await expect(page.getByText("House assigned", { exact: true }).last()).toBeVisible();
}

async function assertPersistedHouseAssignment(
  page: Page,
  credentials: { email: string; password: string },
  targetMember: string,
  expectedHouseId: string,
) {
  await openTargetMember(page, credentials, targetMember);
  await expect(memberHouseSelect(page)).toHaveValue(expectedHouseId);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
