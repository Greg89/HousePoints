"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowsClockwise, Warning } from "@phosphor-icons/react";
import {
  TRAIT_LABELS,
  type DashboardSummary,
  type LeaderboardEntry,
  type MemberScore,
  type OrgMember,
  type RecognitionCategory,
  type ReportItem,
  type ReportPageRequest,
  type ReportPageResponse,
  type ReportSummary,
  type SeasonContext,
} from "@housepoints/contracts";
import type { ReadReportPageResult, ReportPageErrorCode } from "@/app/actions/reports";
import { cn } from "@/lib/cn";

export type ReportTypeFilter = "AWARD" | "DEDUCTION";

export interface ReportsViewProps {
  organizationSlug: string;
  seasonContext: SeasonContext;
  leaderboard: LeaderboardEntry[];
  members: OrgMember[];
  memberPoints: MemberScore[];
  houseMemberRankings: DashboardSummary["houseMemberRankings"];
  categories: RecognitionCategory[];
  seasonId: string;
  houseId: string | null;
  memberId: string | null;
  categoryId: string | null;
  giverId: string | null;
  type: ReportTypeFilter | null;
  baselineSummary: ReportSummary | null;
  initialResult: ReadReportPageResult;
  onLoadReport: (request: ReportPageRequest) => Promise<ReadReportPageResult>;
}

type LoadState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; code: ReportPageErrorCode; message: string };

type BuildHrefParams = {
  seasonId?: string;
  houseId?: string | null;
  memberId?: string | null;
  categoryId?: string | null;
  giverId?: string | null;
  type?: ReportTypeFilter | null;
};

const PAGE_SIZE = 25;

export function ReportsView(props: ReportsViewProps) {
  const scopeKey = JSON.stringify([
    props.organizationSlug,
    props.seasonId,
    props.houseId,
    props.memberId,
    props.categoryId,
    props.giverId,
    props.type,
  ]);

  return <ScopedReportsView key={scopeKey} {...props} />;
}

function ScopedReportsView({
  organizationSlug,
  seasonContext,
  leaderboard,
  members,
  memberPoints,
  houseMemberRankings,
  categories,
  seasonId,
  houseId,
  memberId,
  categoryId,
  giverId,
  type,
  baselineSummary,
  initialResult,
  onLoadReport,
}: ReportsViewProps) {
  const [isPending, startTransition] = useTransition();

  const [items, setItems] = useState<ReportItem[]>(() =>
    initialResult.ok ? initialResult.page.items : [],
  );
  const [summary, setSummary] = useState<ReportPageResponse["summary"] | null>(() =>
    initialResult.ok ? initialResult.page.summary : null,
  );
  const [nextCursor, setNextCursor] = useState<string | null>(() =>
    initialResult.ok ? initialResult.page.nextCursor : null,
  );
  const [revision, setRevision] = useState<string | null>(() =>
    initialResult.ok ? initialResult.page.revision : null,
  );
  const [loadState, setLoadState] = useState<LoadState>(() =>
    initialResult.ok
      ? { status: "idle" }
      : { status: "error", code: initialResult.code, message: initialResult.message },
  );

  const selectedSeason = useMemo(
    () =>
      seasonContext.seasons.find((season) => season.id === seasonId) ??
      seasonContext.activeSeason,
    [seasonContext, seasonId],
  );

  const selectedHouse = useMemo(() => {
    if (!houseId) return null;
    return leaderboard.find((house) => house.id === houseId) ?? null;
  }, [houseId, leaderboard]);

  const selectedMember = useMemo(() => {
    if (!memberId) return null;
    return members.find((member) => member.id === memberId) ?? null;
  }, [memberId, members]);

  const selectedCategory = useMemo(() => {
    if (!categoryId) return null;
    return categories.find((category) => category.id === categoryId) ?? null;
  }, [categoryId, categories]);

  const selectedGiver = useMemo(() => {
    if (!giverId) return null;
    return members.find((member) => member.id === giverId) ?? null;
  }, [giverId, members]);

  const houseRecipients = useMemo(() => {
    if (!houseId) return [];
    const ranking = houseMemberRankings.find((entry) => entry.houseId === houseId);
    return ranking?.members ?? [];
  }, [houseId, houseMemberRankings]);

  const memberTotal = useMemo(() => {
    if (!memberId) return null;
    return memberPoints.find((entry) => entry.memberId === memberId)?.points ?? 0;
  }, [memberId, memberPoints]);

  const buildHref = useCallback(
    (params: BuildHrefParams) => {
      const next = new URLSearchParams();
      const nextSeasonId = params.seasonId ?? seasonId;
      if (nextSeasonId && nextSeasonId !== seasonContext.activeSeason.id) {
        next.set("season", nextSeasonId);
      }
      const nextHouseId =
        params.houseId === undefined ? houseId : params.houseId;
      if (nextHouseId) next.set("house", nextHouseId);
      const nextMemberId =
        params.memberId === undefined ? memberId : params.memberId;
      if (nextMemberId) next.set("member", nextMemberId);
      const nextCategoryId =
        params.categoryId === undefined ? categoryId : params.categoryId;
      if (nextCategoryId) next.set("category", nextCategoryId);
      const nextGiverId =
        params.giverId === undefined ? giverId : params.giverId;
      if (nextGiverId) next.set("giver", nextGiverId);
      const nextType =
        params.type === undefined ? type : params.type;
      if (nextType) next.set("type", nextType);
      const query = next.toString();
      const base = `/o/${encodeURIComponent(organizationSlug)}/reports`;
      return query ? `${base}?${query}` : base;
    },
    [categoryId, giverId, houseId, memberId, organizationSlug, seasonContext.activeSeason.id, seasonId, type],
  );

  const applyPage = useCallback(
    (page: ReportPageResponse, mode: "replace" | "append") => {
      setSummary(page.summary);
      setRevision(page.revision);
      setNextCursor(page.nextCursor);
      setItems((prev) => (mode === "append" ? [...prev, ...page.items] : page.items));
    },
    [],
  );

  const handleFailure = useCallback((code: ReportPageErrorCode, message: string) => {
    setLoadState({ status: "error", code, message });
  }, []);

  const refresh = useCallback(() => {
    setLoadState({ status: "loading" });
    startTransition(async () => {
      const result = await onLoadReport({
        seasonId,
        houseId: houseId ?? undefined,
        memberId: memberId ?? undefined,
        categoryId: categoryId ?? undefined,
        giverId: giverId ?? undefined,
        type: type ?? undefined,
        limit: PAGE_SIZE,
      });
      if (result.ok) {
        applyPage(result.page, "replace");
        setLoadState({ status: "idle" });
      } else {
        handleFailure(result.code, result.message);
      }
    });
  }, [applyPage, categoryId, giverId, handleFailure, houseId, memberId, onLoadReport, seasonId, type]);

  const loadMore = useCallback(() => {
    if (!nextCursor) return;
    setLoadState({ status: "loading" });
    startTransition(async () => {
      const result = await onLoadReport({
        seasonId,
        houseId: houseId ?? undefined,
        memberId: memberId ?? undefined,
        categoryId: categoryId ?? undefined,
        giverId: giverId ?? undefined,
        type: type ?? undefined,
        cursor: nextCursor,
        limit: PAGE_SIZE,
      });
      if (result.ok) {
        applyPage(result.page, "append");
        setLoadState({ status: "idle" });
      } else {
        handleFailure(result.code, result.message);
      }
    });
  }, [applyPage, categoryId, giverId, handleFailure, houseId, memberId, nextCursor, onLoadReport, seasonId, type]);

  const dashboardHref = `/o/${encodeURIComponent(organizationSlug)}`;

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <nav aria-label="Report breadcrumbs" className="flex flex-wrap items-center gap-2 text-sm">
        <Link
          href={dashboardHref}
          className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={14} aria-hidden="true" />
          Back to dashboard
        </Link>
      </nav>

      <header className="flex flex-col gap-4 rounded-2xl border bg-card p-5 shadow-sm sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Report
          </p>
          <h1 className="mt-1 font-display text-2xl font-semibold text-foreground">
            {selectedHouse && selectedMember
              ? `${selectedMember.displayName} in ${selectedHouse.name}`
              : selectedMember
                ? selectedMember.displayName
                : selectedHouse
                  ? selectedHouse.name
                  : "All houses"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {selectedSeason.name}
            {!selectedSeason.isActive ? " · historical view" : ""}
          </p>
        </div>
        <SeasonSelector
          seasonContext={seasonContext}
          selectedSeasonId={selectedSeason.id}
          buildHref={buildHref}
        />
      </header>

      {(selectedHouse || selectedMember || selectedCategory || selectedGiver || type) ? (
        <ScopeChips
          selectedHouse={selectedHouse}
          selectedMember={selectedMember}
          selectedCategory={selectedCategory}
          selectedGiver={selectedGiver}
          type={type}
          buildHref={buildHref}
        />
      ) : null}

      <TypeFilterToolbar type={type} buildHref={buildHref} />

      {loadState.status === "error" ? (
        <ErrorPanel state={loadState} onRefresh={refresh} pending={isPending} />
      ) : null}

      {selectedHouse && !selectedMember ? (
        <HouseRecipientsCard
          house={selectedHouse}
          recipients={houseRecipients}
          buildHref={buildHref}
        />
      ) : null}

      {selectedMember && !selectedHouse ? (
        <MemberOverviewCard member={selectedMember} totalPoints={memberTotal ?? 0} />
      ) : null}

      {!selectedHouse && !selectedMember ? (
        <HouseListCard leaderboard={leaderboard} buildHref={buildHref} />
      ) : null}

      {summary ? (
        <SummaryCard summary={summary} baselineSummary={baselineSummary} />
      ) : null}

      <LedgerList
        items={items}
        houseId={houseId}
        memberId={memberId}
        categoryId={categoryId}
        giverId={giverId}
        buildHref={buildHref}
        canLoadMore={Boolean(nextCursor) && loadState.status !== "error"}
        pending={isPending && loadState.status === "loading"}
        onLoadMore={loadMore}
      />

      {revision ? (
        <p className="text-center text-xs text-muted-foreground">
          Report revision {revision}
        </p>
      ) : null}
    </main>
  );
}

function SeasonSelector({
  seasonContext,
  selectedSeasonId,
  buildHref,
}: {
  seasonContext: SeasonContext;
  selectedSeasonId: string;
  buildHref: (params: BuildHrefParams) => string;
}) {
  const router = useRouter();
  if (seasonContext.seasons.length <= 1) return null;
  return (
    <label className="flex flex-col items-start gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:items-end">
      Reporting season
      <select
        aria-label="Reporting season"
        className="w-full min-w-56 rounded-full border bg-background px-3 py-1.5 text-sm font-medium text-foreground"
        value={selectedSeasonId}
        onChange={(event) => {
          const nextSeasonId = event.currentTarget.value;
          if (nextSeasonId === selectedSeasonId) return;
          router.push(buildHref({
            seasonId: nextSeasonId,
            houseId: null,
            memberId: null,
            categoryId: null,
            giverId: null,
            type: null,
          }));
        }}
      >
        {seasonContext.seasons.map((season) => (
          <option key={season.id} value={season.id}>
            {season.name}
            {season.isActive ? " (current)" : ""}
          </option>
        ))}
      </select>
    </label>
  );
}

function TypeFilterToolbar({
  type,
  buildHref,
}: {
  type: ReportTypeFilter | null;
  buildHref: (params: BuildHrefParams) => string;
}) {
  const options: Array<{ value: ReportTypeFilter | null; label: string }> = [
    { value: null, label: "All" },
    { value: "AWARD", label: "Awards only" },
    { value: "DEDUCTION", label: "Deductions only" },
  ];
  return (
    <div
      role="group"
      aria-label="Award/deduction filter"
      className="flex flex-wrap items-center gap-2 text-sm"
    >
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Show
      </span>
      <div className="inline-flex rounded-full border bg-card p-1">
        {options.map((option) => {
          const isActive = (option.value ?? null) === (type ?? null);
          return (
            <Link
              key={option.label}
              href={buildHref({ type: option.value })}
              aria-pressed={isActive}
              className={cn(
                "rounded-full px-3 py-1 text-sm font-semibold",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {option.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function ScopeChips({
  selectedHouse,
  selectedMember,
  selectedCategory,
  selectedGiver,
  type,
  buildHref,
}: {
  selectedHouse: LeaderboardEntry | null;
  selectedMember: OrgMember | null;
  selectedCategory: RecognitionCategory | null;
  selectedGiver: OrgMember | null;
  type: ReportTypeFilter | null;
  buildHref: (params: BuildHrefParams) => string;
}) {
  return (
    <div className="flex flex-wrap gap-2 text-sm">
      {selectedHouse ? (
        <Link
          href={buildHref({ houseId: null })}
          className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 font-semibold text-foreground hover:border-primary/40"
        >
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: selectedHouse.color }}
            aria-hidden="true"
          />
          House · {selectedHouse.name}
          <span aria-hidden="true">×</span>
          <span className="sr-only">Remove house filter</span>
        </Link>
      ) : null}
      {selectedMember ? (
        <Link
          href={buildHref({ memberId: null })}
          className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 font-semibold text-foreground hover:border-primary/40"
        >
          Member · {selectedMember.displayName}
          <span aria-hidden="true">×</span>
          <span className="sr-only">Remove member filter</span>
        </Link>
      ) : null}
      {selectedCategory ? (
        <Link
          href={buildHref({ categoryId: null })}
          className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 font-semibold text-foreground hover:border-primary/40"
        >
          Category · {selectedCategory.name}
          {selectedCategory.archivedAt ? (
            <span className="rounded-full border border-muted-foreground/40 px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
              archived
            </span>
          ) : null}
          <span aria-hidden="true">×</span>
          <span className="sr-only">Remove category filter</span>
        </Link>
      ) : null}
      {selectedGiver ? (
        <Link
          href={buildHref({ giverId: null })}
          className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 font-semibold text-foreground hover:border-primary/40"
        >
          Giver · {selectedGiver.displayName}
          <span aria-hidden="true">×</span>
          <span className="sr-only">Remove giver filter</span>
        </Link>
      ) : null}
      {type ? (
        <Link
          href={buildHref({ type: null })}
          className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 font-semibold text-foreground hover:border-primary/40"
        >
          {type === "AWARD" ? "Awards only" : "Deductions only"}
          <span aria-hidden="true">×</span>
          <span className="sr-only">Remove type filter</span>
        </Link>
      ) : null}
    </div>
  );
}

function ErrorPanel({
  state,
  onRefresh,
  pending,
}: {
  state: Extract<LoadState, { status: "error" }>;
  onRefresh: () => void;
  pending: boolean;
}) {
  const showRetry = state.code !== "REPORT_ACCESS_REVOKED";
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between",
        state.code === "REPORT_REFRESH_REQUIRED"
          ? "border-amber-300 bg-amber-50 text-amber-900"
          : "border-destructive/40 bg-destructive/10 text-destructive",
      )}
    >
      <p className="flex items-start gap-2 text-sm font-semibold">
        <Warning size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
        {state.message}
      </p>
      {showRetry ? (
        <button
          type="button"
          onClick={onRefresh}
          disabled={pending}
          className="inline-flex items-center justify-center gap-2 self-start rounded-full border border-current px-3 py-1.5 text-sm font-semibold hover:bg-current/10 disabled:cursor-wait disabled:opacity-70"
        >
          <ArrowsClockwise size={14} aria-hidden="true" />
          {pending ? "Refreshing…" : "Refresh"}
        </button>
      ) : null}
    </div>
  );
}

function HouseListCard({
  leaderboard,
  buildHref,
}: {
  leaderboard: LeaderboardEntry[];
  buildHref: (params: BuildHrefParams) => string;
}) {
  return (
    <section className="rounded-xl border bg-card" aria-label="Houses">
      <div className="border-b p-5">
        <h2 className="font-display text-lg font-semibold">Houses</h2>
        <p className="text-sm text-muted-foreground">
          Open a house to see who received points this season.
        </p>
      </div>
      {leaderboard.length === 0 ? (
        <p className="p-6 text-sm text-muted-foreground">No houses yet.</p>
      ) : (
        <ul className="divide-y">
          {leaderboard.map((house) => (
            <li key={house.id}>
              <Link
                href={buildHref({ houseId: house.id, memberId: null })}
                className="flex items-center justify-between gap-3 p-4 hover:bg-muted/40"
              >
                <span className="flex items-center gap-3">
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: house.color }}
                    aria-hidden="true"
                  />
                  <span className="font-semibold">{house.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {house.memberCount} {house.memberCount === 1 ? "member" : "members"}
                  </span>
                </span>
                <span
                  className="font-number text-lg font-bold"
                  style={{ color: house.color }}
                >
                  {house.score.toLocaleString()}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function HouseRecipientsCard({
  house,
  recipients,
  buildHref,
}: {
  house: LeaderboardEntry;
  recipients: DashboardSummary["houseMemberRankings"][number]["members"];
  buildHref: (params: BuildHrefParams) => string;
}) {
  return (
    <section className="rounded-xl border bg-card" aria-label={`${house.name} recipients`}>
      <div className="border-b p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">Recipients</h2>
          <span
            className="font-number text-lg font-bold"
            style={{ color: house.color }}
          >
            {house.score.toLocaleString()} pts
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          Members who received points for {house.name} this season.
        </p>
      </div>
      {recipients.length === 0 ? (
        <p className="p-6 text-sm text-muted-foreground">No recipients yet for this house.</p>
      ) : (
        <ul className="divide-y">
          {recipients.map((recipient, index) => (
            <li key={recipient.memberId ?? `unattributed-${index}`}>
              {recipient.memberId ? (
                <Link
                  href={buildHref({ memberId: recipient.memberId })}
                  className="flex items-center justify-between gap-3 p-4 hover:bg-muted/40"
                >
                  <RecipientRow recipient={recipient} index={index} />
                </Link>
              ) : (
                <div className="flex items-center justify-between gap-3 p-4">
                  <RecipientRow recipient={recipient} index={index} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function RecipientRow({
  recipient,
  index,
}: {
  recipient: DashboardSummary["houseMemberRankings"][number]["members"][number];
  index: number;
}) {
  return (
    <>
      <span className="flex items-center gap-3">
        <span className="w-6 text-center text-sm font-semibold text-muted-foreground">
          {recipient.rank ?? index + 1}
        </span>
        <span>
          <span className="block font-semibold">{recipient.displayName}</span>
          <span className="block text-xs text-muted-foreground">
            {recipient.role ?? (recipient.memberId ? "Former member" : "Identity unavailable")}
          </span>
        </span>
      </span>
      <span className="font-number text-sm font-bold">
        {recipient.points.toLocaleString()}
      </span>
    </>
  );
}

function MemberOverviewCard({
  member,
  totalPoints,
}: {
  member: OrgMember;
  totalPoints: number;
}) {
  return (
    <section className="rounded-xl border bg-card" aria-label={`${member.displayName} overview`}>
      <div className="flex items-center justify-between gap-4 p-5">
        <div>
          <h2 className="font-display text-lg font-semibold">{member.displayName}</h2>
          <p className="text-sm text-muted-foreground">
            Points received across every house this season.
          </p>
        </div>
        <span className="font-number text-2xl font-bold">
          {totalPoints.toLocaleString()}
        </span>
      </div>
    </section>
  );
}

function SummaryCard({
  summary,
  baselineSummary,
}: {
  summary: ReportPageResponse["summary"];
  baselineSummary: ReportSummary | null;
}) {
  const filtered = Boolean(baselineSummary);
  return (
    <section
      aria-label="Report summary"
      className="grid gap-3 rounded-xl border bg-card p-5 sm:grid-cols-2 lg:grid-cols-4"
    >
      <SummaryStat
        label={filtered ? "Filtered net" : "Net points"}
        value={summary.netPoints}
        baseline={baselineSummary?.netPoints}
        baselineLabel="of full-season net"
      />
      <SummaryStat
        label={filtered ? "Filtered awarded" : "Awarded"}
        value={summary.awardedPoints}
        sub={`${summary.awardCount} awards`}
        baseline={baselineSummary?.awardedPoints}
        baselineLabel="of full-season awarded"
      />
      <SummaryStat
        label={filtered ? "Filtered deducted" : "Deducted"}
        value={-summary.deductedPoints}
        sub={`${summary.deductionCount} deductions`}
        baseline={baselineSummary ? -baselineSummary.deductedPoints : undefined}
        baselineLabel="of full-season deducted"
      />
      <SummaryStat
        label={filtered ? "Filtered transactions" : "Transactions"}
        value={summary.transactionCount}
        baseline={baselineSummary?.transactionCount}
        baselineLabel="of full-season transactions"
      />
      {summary.deductionsOutsideCategory ? (
        <p className="sm:col-span-2 lg:col-span-4 rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">
          {summary.deductionsOutsideCategory.count} deductions ({summary.deductionsOutsideCategory.points.toLocaleString()} points)
          fall outside this category and are not part of its subtotal.
        </p>
      ) : null}
      {filtered ? (
        <p className="sm:col-span-2 lg:col-span-4 text-xs text-muted-foreground">
          Subtotals reflect the active filters. Full-season totals include every transaction in the current season/house/member scope.
        </p>
      ) : null}
    </section>
  );
}

function SummaryStat({
  label,
  value,
  sub,
  baseline,
  baselineLabel,
}: {
  label: string;
  value: number;
  sub?: string;
  baseline?: number;
  baselineLabel?: string;
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 font-number text-2xl font-bold">
        {value.toLocaleString()}
      </p>
      {sub ? <p className="text-xs text-muted-foreground">{sub}</p> : null}
      {baseline !== undefined && baselineLabel ? (
        <p className="text-xs text-muted-foreground">
          {value.toLocaleString()} of {baseline.toLocaleString()} {baselineLabel}
        </p>
      ) : null}
    </div>
  );
}

function LedgerList({
  items,
  houseId,
  memberId,
  categoryId,
  giverId,
  buildHref,
  canLoadMore,
  pending,
  onLoadMore,
}: {
  items: ReportItem[];
  houseId: string | null;
  memberId: string | null;
  categoryId: string | null;
  giverId: string | null;
  buildHref: (params: BuildHrefParams) => string;
  canLoadMore: boolean;
  pending: boolean;
  onLoadMore: () => void;
}) {
  return (
    <section aria-label="Point transactions" className="rounded-xl border bg-card">
      <div className="border-b p-5">
        <h2 className="font-display text-lg font-semibold">Contributing transactions</h2>
        <p className="text-sm text-muted-foreground">
          Newest first. Points are attributed to the house at the time of the award.
        </p>
      </div>
      {items.length === 0 ? (
        <p className="p-6 text-sm text-muted-foreground">
          No transactions match this view yet.
        </p>
      ) : (
        <ul className="divide-y">
          {items.map((item) => (
            <li key={item.id} className="p-4">
              <LedgerRow
                item={item}
                showHouseLink={!houseId}
                showMemberLink={!memberId}
                showCategoryLink={!categoryId}
                showGiverLink={!giverId}
                buildHref={buildHref}
              />
            </li>
          ))}
        </ul>
      )}
      {canLoadMore ? (
        <div className="border-t p-4 text-center">
          <button
            type="button"
            onClick={onLoadMore}
            disabled={pending}
            className="inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-semibold hover:border-primary/40 disabled:cursor-wait disabled:opacity-70"
          >
            {pending ? "Loading…" : "Load more"}
          </button>
        </div>
      ) : null}
    </section>
  );
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}

function LedgerRow({
  item,
  showHouseLink,
  showMemberLink,
  showCategoryLink,
  showGiverLink,
  buildHref,
}: {
  item: ReportItem;
  showHouseLink: boolean;
  showMemberLink: boolean;
  showCategoryLink: boolean;
  showGiverLink: boolean;
  buildHref: (params: BuildHrefParams) => string;
}) {
  const label = item.category?.name ?? (item.trait ? TRAIT_LABELS[item.trait] : null);
  const memberLabel = item.member.displayName;
  const isDeduction = item.type === "DEDUCTION";
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{formatDate(item.createdAt)}</p>
        <p className="mt-1 truncate text-sm">
          {showGiverLink ? (
            <Link
              href={buildHref({ giverId: item.giver.id })}
              className="font-semibold text-primary hover:underline"
            >
              {item.giver.displayName}
            </Link>
          ) : (
            <span className="font-semibold">{item.giver.displayName}</span>
          )}
          <span className="text-muted-foreground"> to </span>
          {showMemberLink && item.member.id ? (
            <Link
              href={buildHref({ memberId: item.member.id })}
              className="font-semibold text-primary hover:underline"
            >
              {memberLabel}
            </Link>
          ) : (
            <span className="font-semibold">{memberLabel}</span>
          )}
          {" for "}
          {showHouseLink ? (
            <Link
              href={buildHref({ houseId: item.house.id })}
              className="font-semibold text-primary hover:underline"
            >
              {item.house.name}
            </Link>
          ) : (
            <span className="font-semibold">{item.house.name}</span>
          )}
        </p>
        {item.reason ? (
          <p className="mt-1 text-sm text-muted-foreground">{item.reason}</p>
        ) : null}
        <div className="mt-1 flex flex-wrap gap-1.5 text-xs">
          {label && item.category ? (
            showCategoryLink ? (
              <Link
                href={buildHref({ categoryId: item.category.id })}
                className="rounded-full bg-primary/10 px-2 py-0.5 text-primary hover:bg-primary/20"
              >
                {label}
              </Link>
            ) : (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary">{label}</span>
            )
          ) : label ? (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary">{label}</span>
          ) : null}
          {item.category?.archivedAt ? (
            <span className="rounded-full border border-muted-foreground/40 px-2 py-0.5 text-muted-foreground">
              Archived category
            </span>
          ) : null}
          {isDeduction ? (
            <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-destructive">
              Deduction
            </span>
          ) : null}
        </div>
      </div>
      <span
        className="rounded-full px-3 py-1 font-number text-sm font-bold"
        style={{
          backgroundColor: `${item.house.color}20`,
          color: item.house.color,
        }}
      >
        {item.delta > 0 ? "+" : ""}
        {item.delta}
      </span>
    </div>
  );
}
