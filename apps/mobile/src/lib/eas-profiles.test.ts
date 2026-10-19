import { readFileSync } from "node:fs";
import { URL } from "node:url";
import { describe, expect, it } from "vitest";

const config = JSON.parse(readFileSync(new URL("../../eas.json", import.meta.url), "utf8"));

describe("TestFlight staging configuration", () => {
  it("uses store signing while keeping staging services and OTA updates together", () => {
    expect(config.build.testflight).toMatchObject({
      distribution: "store",
      environment: config.build.preview.environment,
      channel: config.build.preview.channel,
      autoIncrement: true,
    });
    expect(config.build.testflight.environment).not.toBe(config.build.production.environment);
    expect(config.build.testflight.channel).not.toBe(config.build.production.channel);
  });

  it("targets the registered Apple app without enabling Android submission", () => {
    expect(config.submit.testflight.ios.ascAppId).toBe("6823836742");
    expect(config.submit.testflight.android).toBeUndefined();
  });
});

describe("production TestFlight configuration", () => {
  it("builds the production release candidate with production services and OTA updates", () => {
    expect(config.build.production).toMatchObject({
      distribution: "store",
      environment: "production",
      channel: "production",
      autoIncrement: true,
    });
    expect(config.build.production.developmentClient).not.toBe(true);
  });

  it("uploads to the same Apple app as staging while preserving the Play production track", () => {
    expect(config.submit.production.ios.ascAppId).toBe(config.submit.testflight.ios.ascAppId);
    expect(config.submit.production.android.track).toBe("production");
  });
});
