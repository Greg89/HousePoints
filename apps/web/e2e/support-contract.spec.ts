import { expect, test } from "@playwright/test";
import { selectAwardRecognition } from "./support/award";
import { expectManageWorkspaceContract } from "./support/manage";

for (const recognitionEnabled of [false, true]) {
  for (const role of ["tab", "option"] as const) {
    test(`Manage ${role} contract with recognition ${recognitionEnabled ? "enabled" : "disabled"}`, async ({ page }) => {
      const names = ["Overview", "Members", "Houses", "Seasons"];
      if (recognitionEnabled) names.push("Recognition");
      names.push("Organization", "Audit");
      const ownerOnly = new Set(["Houses", "Seasons", "Organization"]);
      const destinations = names.map((name) => {
        const restricted = ownerOnly.has(name);
        return role === "tab"
          ? `<button role="tab" aria-disabled="${restricted}">${name}${restricted ? " Owner only" : ""}</button>`
          : `<option${restricted ? " disabled" : ""}>${name}${restricted ? " (Owner only)" : ""}</option>`;
      }).join("");
      await page.setContent(role === "tab"
        ? `<nav aria-label="Manage sections">${destinations}</nav>`
        : `<select aria-label="Manage sections">${destinations}</select>`);

      const control = page.getByRole(role === "tab" ? "navigation" : "combobox", { name: "Manage sections" });
      expect(await expectManageWorkspaceContract(control, role)).toBe(recognitionEnabled);
    });
  }
}

for (const scenario of [
  { mode: "trait", configuredName: undefined, expectedName: "Collaboration" },
  { mode: "category", configuredName: undefined, expectedName: "Collaboration" },
  { mode: "category", configuredName: "  Teamwork  ", expectedName: "Teamwork" },
]) {
  test(`award selector supports ${scenario.mode} with ${scenario.configuredName ? "configured" : "default"} recognition`, async ({ page }) => {
    const originalName = process.env.E2E_RECOGNITION_CATEGORY_NAME;
    try {
      if (scenario.configuredName === undefined) {
        delete process.env.E2E_RECOGNITION_CATEGORY_NAME;
      } else {
        process.env.E2E_RECOGNITION_CATEGORY_NAME = scenario.configuredName;
      }
      await page.setContent(`
        <div role="dialog" aria-label="Award points">
          <button role="combobox" onclick="document.getElementById('choices').hidden = false">Select a ${scenario.mode}...</button>
        </div>
        <div id="choices" role="listbox" hidden>
          <button role="option" onclick="this.setAttribute('aria-selected', 'true')">Other</button>
          <button role="option" onclick="this.setAttribute('aria-selected', 'true')">${scenario.expectedName}</button>
        </div>
      `);

      await selectAwardRecognition(page, page.getByRole("dialog", { name: "Award points" }));
      await expect(page.getByRole("option", { name: scenario.expectedName, exact: true })).toHaveAttribute("aria-selected", "true");
      await expect(page.getByRole("option", { name: "Other", exact: true })).not.toHaveAttribute("aria-selected", "true");
    } finally {
      if (originalName === undefined) {
        delete process.env.E2E_RECOGNITION_CATEGORY_NAME;
      } else {
        process.env.E2E_RECOGNITION_CATEGORY_NAME = originalName;
      }
    }
  });
}
