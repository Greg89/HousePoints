import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { URL } from "node:url";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(
  new URL("../../../../.github/workflows/mobile-e2e-staging.yml", import.meta.url),
  "utf8",
);
const script = workflow.match(/ {10}script: \|\r?\n((?: {12}.*\r?\n)+)/)?.[1];
if (!script) {
  throw new Error("Mobile E2E emulator script was not found.");
}
const commands = script
  .trim()
  .split(/\r\n|\n|\r/)
  .map((line) => line.trim())
  .filter((line) => line.length > 0 && !line.startsWith("#"));
const shell = process.platform === "win32"
  ? join(process.env.ProgramFiles ?? "C:\\Program Files", "Git", "usr", "bin", "sh.exe")
  : "sh";

describe("mobile E2E workflow shell commands", () => {
  it.each(["legacy", "categories"])("runs only the %s award flow", (mode) => {
    const output: string[] = [];
    for (const command of commands) {
      const result = spawnSync(shell, ["-c", `
        adb() { :; }
        maestro() { printf '%s\\n' "$@"; }
        ${command}
      `], {
        encoding: "utf8",
        env: {
          ...process.env,
          MOBILE_E2E_RECOGNITION_MODE: mode,
          MOBILE_E2E_USER_EMAIL: "smoke@example.com",
          MOBILE_E2E_USER_PASSWORD: "test password with spaces",
          MOBILE_E2E_TARGET_MEMBER: "Test Member",
          MOBILE_E2E_CATEGORY_NAME: "Custom Category",
        },
      });
      expect(result.error).toBeUndefined();
      expect(result.stderr).toBe("");
      expect(result.status).toBe(0);
      if (result.stdout.length > 0) {
        output.push(...result.stdout.trimEnd().split(/\r?\n/));
      }
    }
    expect(output).toEqual([
      "--version",
      "test",
      "-e", "MOBILE_E2E_USER_EMAIL=smoke@example.com",
      "-e", "MOBILE_E2E_USER_PASSWORD=test password with spaces",
      "-e", "MOBILE_E2E_TARGET_MEMBER=Test Member",
      ...(mode === "categories" ? ["-e", "MOBILE_E2E_CATEGORY_NAME=Custom Category"] : []),
      mode === "categories"
        ? "apps/mobile/e2e/category-award.yaml"
        : "apps/mobile/e2e/sign-in-dashboard-award.yaml",
    ]);
  });

  it.each(["legacy", "categories"])("propagates Maestro failures in %s mode", (mode) => {
    const command = commands.find((line) => line.startsWith("if "));
    expect(command).toBeDefined();
    const result = spawnSync(shell, ["-c", `maestro() { return 7; }; ${command}`], {
      encoding: "utf8",
      env: { ...process.env, MOBILE_E2E_RECOGNITION_MODE: mode },
    });
    expect(result.error).toBeUndefined();
    expect(result.stderr).toBe("");
    expect(result.status).toBe(7);
  });
});

describe("legacy mobile E2E award input guards", () => {
  const flow = readFileSync(
    new URL("../../e2e/sign-in-dashboard-award.yaml", import.meta.url),
    "utf8",
  ).replace(/\r\n/g, "\n");

  it("reopens the numeric keyboard without rewriting the amount", () => {
    const reopen = flow.split("# Reopen the numeric keyboard")[1]?.split("- hideKeyboard")[0];
    expect(reopen).toBeDefined();
    expect(reopen).toContain('- tapOn:\n    id: "mobile.award.points"');
    expect(reopen).not.toMatch(/- (?:eraseText|inputText)/);
    expect(reopen).toContain('- assertVisible:\n    id: "mobile.award.points"\n    text: "7"');
    expect(reopen).toContain('- assertVisible: "Award 7 points"');
  });

  it("enters the final reason once before exercising the numeric keyboard", () => {
    expect(flow.match(/- inputText: "Maestro staging award"/g)).toHaveLength(1);
    expect(flow).toContain([
      "- tapOn:",
      '    id: "mobile.award.reason"',
      '- inputText: "Maestro staging award"',
      "- assertVisible:",
      '    id: "mobile.award.reason"',
      '    text: "Maestro staging award"',
    ].join("\n"));
    expect(flow.indexOf('- inputText: "Maestro staging award"')).toBeLessThan(
      flow.indexOf('- tapOn:\n    id: "mobile.award.points"'),
    );
  });

  it("preserves the reason through dismissal and refocusing without selection or re-entry", () => {
    const refocus = flow.split("- takeScreenshot: award-points-keyboard-reopened")[1]
      ?.split('- tapOn:\n    id: "mobile.award.submit"')[0];
    expect(refocus).toBeDefined();
    expect(refocus).not.toMatch(/- (?:inputText|eraseText|longPressOn)/);
    expect(refocus).not.toContain("Select all");
    expect(refocus).toContain('- tapOn:\n    id: "mobile.award.reason"');
    expect(refocus?.match(
      /- assertVisible:\n {4}id: "mobile.award.reason"\n {4}text: "Maestro staging award"/g,
    )).toHaveLength(2);
  });

  it("checks the exact reason and amount before submission", () => {
    const beforeSubmit = flow.split("- takeScreenshot: award-points-keyboard-dismissed")[1]
      ?.split('- tapOn:\n    id: "mobile.award.submit"')[0];
    expect(beforeSubmit).toBeDefined();
    expect(beforeSubmit).toContain(
      '- assertVisible:\n    id: "mobile.award.reason"\n    text: "Maestro staging award"',
    );
    expect(beforeSubmit).toContain(
      '- assertVisible:\n    id: "mobile.award.points"\n    text: "7"',
    );
    expect(beforeSubmit).toContain('- assertVisible: "Award 7 points"');
  });
});
