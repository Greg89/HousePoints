import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  DashboardSummary,
  LeaderboardEntry,
  MemberScore,
  OrgMember,
  RecognitionCategory,
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

const categories: RecognitionCategory[] = [
  {
    id: "cat-1",
    name: "Teamwork",
    description: null,
    legacyTrait: "COLLABORATION",
    createdAt: "2026-01-01T00:00:00.000Z",
    archivedAt: null,
  },
  {
    id: "cat-2",
    name: "Teamwork",
    description: null,
    legacyTrait: "COLLABORATION",
    createdAt: "2025-01-01T00:00:00.000Z",
    archivedAt: "2025-12-31T00:00:00.000Z",
  },
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
  categories,
  seasonId: "season-1",
  houseId: null,
  memberId: null,
  categoryId: null,
  giverId: null,
  type: null,
  baselineSummary: null,
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
      categoryId: undefined,
      giverId: undefined,
      type: undefined,
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
      categoryId: undefined,
      giverId: undefined,
      type: undefined,
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

  it("renders category, giver, and type chips with removal links", () => {
    render(
      <ReportsView
        {...baseProps}
        categoryId="cat-2"
        giverId="member-2"
        type="AWARD"
        initialResult={makeSuccess([], null)}
        onLoadReport={vi.fn()}
      />,
    );

    const categoryChip = screen.getByRole("link", { name: /Remove category filter/i });
    expect(categoryChip).toHaveTextContent(/Teamwork/i);
    expect(categoryChip).toHaveTextContent(/archived/i);
    expect(categoryChip).toHaveAttribute("href", "/o/acme/reports?giver=member-2&type=AWARD");

    const giverChip = screen.getByRole("link", { name: /Remove giver filter/i });
    expect(giverChip).toHaveAttribute("href", "/o/acme/reports?category=cat-2&type=AWARD");

    const typeChip = screen.getByRole("link", { name: /Remove type filter/i });
    expect(typeChip).toHaveAttribute("href", "/o/acme/reports?category=cat-2&giver=member-2");
  });

  it("links award/deduction toolbar buttons to the corresponding filter URL", () => {
    render(
      <ReportsView
        {...baseProps}
        initialResult={makeSuccess([], null)}
        onLoadReport={vi.fn()}
      />,
    );

    const toolbar = screen.getByRole("group", { name: /Award\/deduction filter/i });
    const allLink = within(toolbar).getByRole("link", { name: "All" });
    const awardsLink = within(toolbar).getByRole("link", { name: "Awards only" });
    const deductionsLink = within(toolbar).getByRole("link", { name: "Deductions only" });

    expect(allLink).toHaveAttribute("href", "/o/acme/reports");
    expect(allLink).toHaveAttribute("aria-pressed", "true");
    expect(awardsLink).toHaveAttribute("href", "/o/acme/reports?type=AWARD");
    expect(deductionsLink).toHaveAttribute("href", "/o/acme/reports?type=DEDUCTION");
  });

  it("exposes category and giver drill-through links from a ledger row", () => {
    const categorizedItem: ReportPageResponse["items"][number] = {
      ...makeItem("tx-cat"),
      category: {
        id: "cat-1",
        name: "Teamwork",
        archivedAt: null,
      },
    };
    render(
      <ReportsView
        {...baseProps}
        initialResult={makeSuccess([categorizedItem], null)}
        onLoadReport={vi.fn()}
      />,
    );

    const categoryLink = screen.getByRole("link", { name: "Teamwork" });
    expect(categoryLink).toHaveAttribute("href", "/o/acme/reports?category=cat-1");

    const giverLink = screen.getByRole("link", { name: "Boss" });
    expect(giverLink).toHaveAttribute("href", "/o/acme/reports?giver=member-9");
  });

  it("renders filtered subtotal versus baseline full-season totals when a filter is active", () => {
    render(
      <ReportsView
        {...baseProps}
        type="AWARD"
        baselineSummary={{
          netPoints: 150,
          awardedPoints: 200,
          deductedPoints: 50,
          transactionCount: 20,
          awardCount: 15,
          deductionCount: 5,
          deductionsOutsideCategory: null,
        }}
        initialResult={makeSuccess([makeItem("tx-1")], null)}
        onLoadReport={vi.fn()}
      />,
    );

    const summary = screen.getByRole("region", { name: /Report summary/i });
    expect(within(summary).getByText(/Filtered net/i)).toBeInTheDocument();
    expect(within(summary).getByText(/of full-season net/i)).toBeInTheDocument();
    expect(within(summary).getByText(/full-season totals include every transaction/i)).toBeInTheDocument();
  });
});
