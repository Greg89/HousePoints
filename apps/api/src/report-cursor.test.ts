import { describe, expect, it } from "vitest";
import { decodeReportCursor, encodeReportCursor, parseReportCursorSecret } from "./report-cursor.js";

const secret = "report-cursor-test-secret-with-32-plus-characters";
const scope = { seasonId: "season-1", houseId: "house-1", memberId: null };

describe("report cursors", () => {
  it("round trips the exact organization, scope, revision, and stable position", () => {
    const cursor = encodeReportCursor({
      organizationId: "org-1", scope, revision: "9007199254740993",
      createdAt: "2026-09-27T12:00:00.000Z", id: "point-1",
    }, secret);
    expect(decodeReportCursor(cursor, "org-1", scope, secret)).toMatchObject({
      revision: "9007199254740993", id: "point-1",
    });
    expect(() => decodeReportCursor(cursor, "org-2", scope, secret)).toThrow();
    expect(() => decodeReportCursor(cursor, "org-1", { ...scope, memberId: undefined }, secret)).toThrow();
    expect(() => decodeReportCursor(cursor, "org-1", { ...scope, houseId: "house-2" }, secret)).toThrow();
  });

  it("rejects tampering and weak configured secrets", () => {
    const cursor = encodeReportCursor({
      organizationId: "org-1", scope, revision: "1",
      createdAt: "2026-09-27T12:00:00.000Z", id: "point-1",
    }, secret);
    expect(() => decodeReportCursor(`${cursor}x`, "org-1", scope, secret)).toThrow();
    expect(() => decodeReportCursor("not-a-cursor", "org-1", scope, secret)).toThrow();
    expect(() => parseReportCursorSecret("short")).toThrow();
  });
});
