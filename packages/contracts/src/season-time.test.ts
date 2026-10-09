import { describe, expect, it } from "vitest";
import {
  formatInstantForTimezone,
  isValidIanaTimeZone,
  resolveLocalDateTime,
} from "./season-time.js";

describe("season time zones", () => {
  it("resolves ordinary local times to one UTC instant", () => {
    expect(resolveLocalDateTime("2026-02-01T12:00", "America/New_York")).toEqual({
      kind: "unique",
      instants: ["2026-02-01T17:00:00.000Z"],
    });
  });

  it("rejects nonexistent local times during the spring clock change", () => {
    expect(resolveLocalDateTime("2026-03-08T02:30", "America/New_York")).toEqual({
      kind: "nonexistent",
      instants: [],
    });
  });

  it("returns both instants for ambiguous fall-back times", () => {
    expect(resolveLocalDateTime("2026-11-01T01:30", "America/New_York")).toEqual({
      kind: "ambiguous",
      instants: ["2026-11-01T05:30:00.000Z", "2026-11-01T06:30:00.000Z"],
    });
  });

  it("rejects invalid date input and invalid time zones explicitly", () => {
    expect(resolveLocalDateTime("2026-02-30T12:00", "UTC")).toEqual({
      kind: "invalid-date",
      instants: [],
    });
    expect(resolveLocalDateTime("2026-02-01T12:00", "Not/AZone")).toEqual({
      kind: "invalid-timezone",
      instants: [],
    });
    expect(isValidIanaTimeZone("America/New_York")).toBe(true);
    expect(isValidIanaTimeZone("Not/AZone")).toBe(false);
  });

  it("formats persisted instants back into the selected local time", () => {
    expect(formatInstantForTimezone("2026-02-01T17:00:00.000Z", "America/New_York"))
      .toBe("2026-02-01T12:00");
  });
});
