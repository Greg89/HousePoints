import { expect, type Locator, type Page } from "@playwright/test";

export async function selectMemberFromCombobox(
  page: Page,
  root: Locator,
  label: RegExp,
  memberName: string,
) {
  await root.getByRole("combobox", { name: label }).click();

  const search = page.getByRole("searchbox", { name: new RegExp(`search ${label.source}`, "i") });
  await expect(search).toBeVisible();
  await search.fill(memberName);

  const option = page.getByRole("option", { name: memberOptionPattern(memberName) });
  await expect(option, await buildMissingMemberMessage(page, memberName)).toBeVisible();
  await option.click();
}

async function buildMissingMemberMessage(page: Page, memberName: string) {
  const options = await page.getByRole("option").allTextContents().catch(() => []);
  const visibleOptions = options.map((option) => option.replace(/\s+/g, " ").trim()).filter(Boolean);

  return [
    `Could not find member "${memberName}" in the open member picker.`,
    visibleOptions.length > 0
      ? `Visible member options: ${visibleOptions.slice(0, 15).join(" | ")}`
      : "No member options were visible.",
  ].join("\n");
}

function memberOptionPattern(memberName: string) {
  const escapedName = memberName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^${escapedName}(?:\\s|$)`, "i");
}
