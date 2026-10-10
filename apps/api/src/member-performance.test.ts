import { beforeEach, describe, expect, it, vi } from "vitest";
const tx = vi.hoisted(() => ({
  organizationMembership: { findFirst: vi.fn() },
  season: { findFirst: vi.fn() },
  user: { findUnique: vi.fn() },
  recognitionCategory: { findMany: vi.fn() },
  pointTransaction: { groupBy: vi.fn(), findMany: vi.fn(), findFirst: vi.fn() },
}));
vi.mock("@housepoints/db", () => ({ prisma: { $transaction: (callback: (client: typeof tx) => Promise<unknown>) => callback(tx) } }));
import { readMemberPerformance } from "./member-performance.js";

const params = {
  organizationId: "org-a", actorUserId: "viewer", membershipId: "membership-viewer", memberId: "member",
  season: { id: "season-a", name: "Season", startsAt: "2026-01-01T00:00:00.000Z", endsAt: null, isActive: true },
  now: new Date("2026-10-10T12:00:00.000Z"),
};
beforeEach(() => {
  vi.resetAllMocks();
  tx.organizationMembership.findFirst.mockResolvedValue({ id: "membership" });
  tx.season.findFirst.mockResolvedValue({ id: "season-a" });
  tx.user.findUnique.mockResolvedValue({ id: "member", displayName: "Alex" });
  tx.recognitionCategory.findMany.mockResolvedValue([{ id: "archived-category", name: "Community" }]);
  tx.pointTransaction.findMany.mockResolvedValue([{
    id: "tx", type: "AWARD", delta: 10, reason: "Helped", trait: null,
    category: { id: "archived-category", name: "Community", archivedAt: new Date("2026-09-01") },
    targetHouse: { id: "old-house", name: "Old house", color: "#123456" },
    targetUser: { id: "member", displayName: "Alex" }, actor: { id: "giver", displayName: "Giver" },
    createdAt: new Date("2026-10-10T10:00:00.000Z"),
  }]);
  tx.pointTransaction.groupBy.mockImplementation(async ({ by }: { by: string[] }) => {
    if (by[0] === "type") return [
      { type: "AWARD", _sum: { delta: 30 }, _count: { _all: 3 } },
      { type: "DEDUCTION", _sum: { delta: -5 }, _count: { _all: 1 } },
    ];
    if (by[0] === "categoryId") return [{ categoryId: "archived-category", trait: null, _sum: { delta: 30 }, _count: { _all: 3 } }];
    return [{ createdAt: new Date("2026-10-10T10:00:00.000Z"), _sum: { delta: -5 } }];
  });
});
describe("member performance read", () => {
  it("shares report totals, retains archived recognition and house history, and fills a UTC trend", async () => {
    const report = await readMemberPerformance(params);
    expect(report.summary).toMatchObject({ netPoints: 25, awardedPoints: 30, deductedPoints: 5, awardCount: 3, deductionCount: 1, transactionCount: 4 });
    expect(report.recognition).toEqual([{ key: "category:archived-category", label: "Community", points: 30, count: 3 }]);
    expect(report.days).toHaveLength(14);
    expect(report.days[0]).toEqual({ date: "2026-09-27", points: 0 });
    expect(report.days.at(-1)).toEqual({ date: "2026-10-10", points: -5 });
    expect(report.recentActivity[0].house.id).toBe("old-house");
    expect(report.recentActivity[0].category?.archivedAt).toBe("2026-09-01T00:00:00.000Z");
  });
  it("scopes every transaction read to the organization, season and recipient, excluding deletions", async () => {
    await readMemberPerformance(params);
    for (const [args] of [...tx.pointTransaction.groupBy.mock.calls, ...tx.pointTransaction.findMany.mock.calls]) {
      expect(args.where).toMatchObject({ organizationId: "org-a", seasonId: "season-a", targetUserId: "member", deletedAt: null });
      expect(args.where).not.toHaveProperty("targetHouseId");
    }
    expect(tx.pointTransaction.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 8, orderBy: [{ createdAt: "desc" }, { id: "desc" }] }));
  });
  it("rejects revoked access before reading member information", async () => {
    tx.organizationMembership.findFirst.mockResolvedValueOnce(null);
    await expect(readMemberPerformance(params)).rejects.toMatchObject({ code: "REPORT_ACCESS_REVOKED", statusCode: 403 });
    expect(tx.user.findUnique).not.toHaveBeenCalled();
  });
  it("rejects people from another organization without exposing their identity", async () => {
    tx.organizationMembership.findFirst.mockResolvedValueOnce({ id: "viewer" }).mockResolvedValueOnce(null);
    tx.pointTransaction.findFirst.mockResolvedValue(null);
    await expect(readMemberPerformance(params)).rejects.toMatchObject({ code: "REPORT_SCOPE_NOT_FOUND" });
    expect(tx.user.findUnique).not.toHaveBeenCalled();
  });
  it("keeps historical season trends inside the selected period", async () => {
    const result = await readMemberPerformance({ ...params, season: { ...params.season, endsAt: "2026-10-01T00:00:00.000Z", isActive: false } });
    expect(result.days.at(-1)?.date).toBe("2026-09-30");
  });
  it("returns honest zero/empty states for a member with no transactions", async () => {
    tx.pointTransaction.groupBy.mockResolvedValue([]);
    tx.pointTransaction.findMany.mockResolvedValue([]);
    const result = await readMemberPerformance(params);
    expect(result.summary.netPoints).toBe(0);
    expect(result.recognition).toEqual([]);
    expect(result.days.every(day => day.points === 0)).toBe(true);
    expect(result.recentActivity).toEqual([]);
  });
});
