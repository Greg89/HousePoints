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
