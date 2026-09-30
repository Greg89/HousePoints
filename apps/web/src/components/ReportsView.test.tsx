import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  DashboardSummary,
  LeaderboardEntry,
  MemberScore,
  OrgMember,
  ReportPageResponse,
  SeasonContext,
} from "@housepoints/contracts";
import { ReportsView } from "./ReportsView";
import type { ReadReportPageResult } from "@/app/actions/reports";

const searchParamsState = { value: "" };
const routerPushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPushMock }),
  useSearchParams: () => new URLSearchParams(searchParamsState.value),
}));

const activeSeason = {
  id: "season-1",
  name: "Current Season",
  isActive: true,
  startsAt: "2026-01-01T00:00:00.000Z",
  endsAt: null,
};

const historicalSeason = {
  id: "season-0",
  name: "Fall 2025",
  isActive: false,
  startsAt: "2025-08-01T00:00:00.000Z",
  endsAt: "2025-12-31T00:00:00.000Z",
};

const seasonContext: SeasonContext = {
  activeSeason,
  seasons: [historicalSeason, activeSeason],
};

const leaderboard: LeaderboardEntry[] = [
  {
    id: "house-1",
    name: "Slytherin",
    color: "#22c55e",
    description: null,
    score: 120,
    transactions: 4,
    memberCount: 3,
    rank: 1,
  },
  {
    id: "house-2",
    name: "Gryffindor",
    color: "#ef4444",
    description: null,
    score: 90,
    transactions: 3,
    memberCount: 2,
    rank: 2,
  },
];

const members: OrgMember[] = [
  {
    id: "member-1",
    displayName: "Alice",
    role: "MEMBER",
    houseId: "house-1",
    houseName: "Slytherin",
    houseColor: "#22c55e",
  },
  {
    id: "member-2",
    displayName: "Bob",
    role: "MEMBER",
    houseId: "house-2",
    houseName: "Gryffindor",
    houseColor: "#ef4444",
  },
];

const memberPoints: MemberScore[] = [
  { memberId: "member-1", points: 80 },
  { memberId: "member-2", points: 40 },
];

const houseMemberRankings: DashboardSummary["houseMemberRankings"] = [
  {
    houseId: "house-1",
    members: [
      { memberId: "member-1", displayName: "Alice", role: "MEMBER", points: 80, rank: 1 },
      { memberId: null, displayName: "Former member", role: null, points: 10 },
    ],
  },
  { houseId: "house-2", members: [] },
];

function makeItem(id: string): ReportPageResponse["items"][number] {
  return {
    id,
    type: "AWARD",
    delta: 10,
    reason: `reason ${id}`,
    trait: "COLLABORATION",
    category: null,
    house: { id: "house-1", name: "Slytherin", color: "#22c55e" },
    member: { id: "member-1", displayName: "Alice" },
    giver: { id: "member-9", displayName: "Boss" },
    createdAt: "2026-02-01T00:00:00.000Z",
  };
}

function makeSuccess(items: ReportPageResponse["items"], nextCursor: string | null): ReadReportPageResult {
  return {
    ok: true,
    page: {
      scope: { seasonId: "season-1" },
      revision: "42",
      summary: {
        netPoints: 10,
        awardedPoints: 10,
        deductedPoints: 0,
        transactionCount: items.length,
        awardCount: items.length,
        deductionCount: 0,
        deductionsOutsideCategory: null,
      },
      items,
      nextCursor,
    },
  };
}

const baseProps = {
  organizationSlug: "acme",
  seasonContext,
  leaderboard,
  members,
  memberPoints,
  houseMemberRankings,
  seasonId: "season-1",
  houseId: null,
  memberId: null,
};

beforeEach(() => {
  searchParamsState.value = "";
  routerPushMock.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("ReportsView", () => {
  it("lists houses with drill-through links when no scope is selected", () => {
    const onLoadReport = vi.fn();
    render(
      <ReportsView
        {...baseProps}
        initialResult={makeSuccess([], null)}
        onLoadReport={onLoadReport}
      />,
    );

    expect(screen.getByRole("heading", { level: 1, name: "All houses" })).toBeInTheDocument();
    const slytherinLink = screen.getByRole("link", { name: /Slytherin/i });
    expect(slytherinLink).toHaveAttribute("href", "/o/acme/reports?house=house-1");
    expect(screen.getByText(/No transactions match this view yet/i)).toBeInTheDocument();
  });

  it("shows house recipients and links each to the member scope", () => {
    const onLoadReport = vi.fn();
    render(
      <ReportsView
        {...baseProps}
        houseId="house-1"
        initialResult={makeSuccess([makeItem("tx-1")], null)}
        onLoadReport={onLoadReport}
      />,
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "Slytherin" }),
    ).toBeInTheDocument();
    const recipientsCard = screen.getByRole("region", { name: /Slytherin recipients/i });
    const aliceLink = within(recipientsCard).getByRole("link", { name: /Alice/i });
    expect(aliceLink).toHaveAttribute("href", "/o/acme/reports?house=house-1&member=member-1");
    // Former recipients (no member id) render as static rows rather than links.
    expect(within(recipientsCard).getByText(/Former member/i)).toBeInTheDocument();
  });

  it("renders the member overview and ledger for a member scope", () => {
    const onLoadReport = vi.fn();
    render(
      <ReportsView
        {...baseProps}
        memberId="member-1"
        initialResult={makeSuccess([makeItem("tx-1")], null)}
        onLoadReport={onLoadReport}
      />,
    );

    expect(screen.getByRole("heading", { level: 1, name: "Alice" })).toBeInTheDocument();
    expect(screen.getByText("80")).toBeInTheDocument();
    expect(screen.getByText(/reason tx-1/i)).toBeInTheDocument();
  });

  it("shows a refresh banner when the initial result is REPORT_REFRESH_REQUIRED and retries via the action", async () => {
    const user = userEvent.setup();
    const onLoadReport = vi
      .fn<(request: Parameters<Parameters<typeof ReportsView>[0]["onLoadReport"]>[0]) => ReturnType<Parameters<typeof ReportsView>[0]["onLoadReport"]>>()
      .mockResolvedValue(makeSuccess([makeItem("tx-2")], null));

    render(
      <ReportsView
        {...baseProps}
        initialResult={{
          ok: false,
          code: "REPORT_REFRESH_REQUIRED",
          message: "Scores changed while loading. Refresh to see the current report.",
        }}
        onLoadReport={onLoadReport}
      />,
    );

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(/Scores changed while loading/i);
    await user.click(within(alert).getByRole("button", { name: /Refresh/i }));

    expect(onLoadReport).toHaveBeenCalledWith({
      seasonId: "season-1",
      houseId: undefined,
      memberId: undefined,
      limit: 25,
    });
    expect(await screen.findByText(/reason tx-2/i)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("hides the retry action for REPORT_ACCESS_REVOKED", () => {
    render(
      <ReportsView
        {...baseProps}
        initialResult={{
          ok: false,
          code: "REPORT_ACCESS_REVOKED",
          message: "You no longer have access to this report.",
        }}
        onLoadReport={vi.fn()}
      />,
    );

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(/no longer have access/i);
    expect(within(alert).queryByRole("button", { name: /Refresh/i })).not.toBeInTheDocument();
  });

  it("loads additional ledger pages using the returned cursor", async () => {
    const user = userEvent.setup();
    const onLoadReport = vi
      .fn<(request: Parameters<Parameters<typeof ReportsView>[0]["onLoadReport"]>[0]) => ReturnType<Parameters<typeof ReportsView>[0]["onLoadReport"]>>()
      .mockResolvedValue(makeSuccess([makeItem("tx-3")], null));

    render(
      <ReportsView
        {...baseProps}
        initialResult={makeSuccess([makeItem("tx-1")], "cursor-1")}
        onLoadReport={onLoadReport}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Load more/i }));

    expect(onLoadReport).toHaveBeenCalledWith({
      seasonId: "season-1",
      houseId: undefined,
      memberId: undefined,
      cursor: "cursor-1",
      limit: 25,
    });
    expect(await screen.findByText(/reason tx-3/i)).toBeInTheDocument();
  });

  it("navigates to the new season when the season selector changes", async () => {
    const user = userEvent.setup();
    render(
      <ReportsView
        {...baseProps}
        initialResult={makeSuccess([], null)}
        onLoadReport={vi.fn()}
      />,
    );

    await user.selectOptions(
      screen.getByRole("combobox", { name: /Reporting season/i }),
      "season-0",
    );

    expect(routerPushMock).toHaveBeenCalledWith("/o/acme/reports?season=season-0");
  });
});
