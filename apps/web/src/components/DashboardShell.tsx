"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import {
  CaretDown,
  CalendarBlank,
  Check,
  Trophy,
  Clock,
  ChartBar,
  Star,
  MinusCircle,
  SignOut,
  User,
  Wrench,
} from "@phosphor-icons/react";
import { motion } from "framer-motion";
import { HouseCard } from "./HouseCard";
import { Leaderboard } from "./Leaderboard";
import { ActivityFeed } from "./ActivityFeed";
import { OverviewReports } from "./OverviewReports";
import { SeasonComparisonReport } from "./SeasonComparisonReport";
import { AwardPointsDialog } from "./AwardPointsDialog";
import { DeductPointsDialog } from "./DeductPointsDialog";
import type { AwardPointsResult, DeductPointsResult, DeletePointResult } from "@/lib/action-results";
import { resolveHouseThemeStyle } from "@/lib/house-theme";
import type {
  DashboardSummary,
  LeaderboardEntry,
  OrgMember,
  ActivityItem,
  MemberScore,
  PagedActivityFeed,
  SeasonComparison,
  SeasonContext,
  Trait,
} from "@housepoints/contracts";
import { cn } from "@/lib/cn";

interface DashboardShellProps {
  session: {
    userName: string;
    houseId: string | null;
    houseName: string | null;
    houseColor: string | null;
    houseThemeEnabled: boolean;
    role: "MEMBER" | "ADMIN" | "OWNER";
  };
  leaderboard: LeaderboardEntry[];
  members: OrgMember[];
  activity: ActivityItem[];
  activityNextCursor: string | null;
  onLoadMoreActivity: (cursor: string) => Promise<PagedActivityFeed>;
  /** Computed per-member point totals from activity */
  memberPoints: MemberScore[];
  dashboardSummary: DashboardSummary;
  seasonContext: SeasonContext;
  onSeasonChange: (seasonId?: string) => Promise<{
    dashboardSummary: DashboardSummary;
    leaderboard: LeaderboardEntry[];
    memberPoints: MemberScore[];
  }>;
  initialSeasonComparison?: SeasonComparison | null;
  onCompareSeasons?: (fromSeasonId: string, toSeasonId: string) => Promise<SeasonComparison>;
  onAward: (targetUserId: string, delta: number, reason: string, trait: Trait) => Promise<AwardPointsResult>;
  onDeduct?: (targetUserId: string, reason: string) => Promise<DeductPointsResult>;
  onDeletePoint?: (transactionId: string) => Promise<DeletePointResult>;
  loginUrl: string;
  logoutUrl: string;
  showSeasonOverviewCard?: boolean;
  adminSection?: React.ReactNode;
}

const TABS = [
  { id: "overview", label: "Overview", icon: ChartBar },
  { id: "activity", label: "Activity", icon: Clock },
  { id: "leaderboard", label: "Leaderboard", icon: Trophy },
] as const;

type TabId = (typeof TABS)[number]["id"] | "manage";

const dateFormatter = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

function formatDate(value: string) {
  return dateFormatter.format(new Date(value));
}

function getSeasonTiming(season: SeasonContext["activeSeason"], now = new Date()) {
  if (!season.endsAt) {
    return {
      label: "No end date set",
      detail: `Started ${formatDate(season.startsAt)}. Admins can start a new season from Manage when this one is ready to close.`,
    };
  }

  const endsAt = new Date(season.endsAt);
  const millisecondsRemaining = endsAt.getTime() - now.getTime();
  const daysRemaining = Math.ceil(millisecondsRemaining / 86_400_000);

  if (daysRemaining < 0) {
    return {
      label: "Season ended",
      detail: `Ended ${formatDate(season.endsAt)}. Start a new season from Manage to reset current scoring.`,
    };
  }

  if (daysRemaining === 0) {
    return {
      label: "Ends today",
      detail: `Started ${formatDate(season.startsAt)} and closes today.`,
    };
  }

  return {
    label: `${daysRemaining} day${daysRemaining === 1 ? "" : "s"} remaining`,
    detail: `Started ${formatDate(season.startsAt)} and ends ${formatDate(season.endsAt)}.`,
  };
}

export function DashboardShell({
  session,
  leaderboard,
  members,
  activity,
  activityNextCursor,
  onLoadMoreActivity,
  memberPoints,
  dashboardSummary,
  seasonContext,
  onSeasonChange,
  initialSeasonComparison = null,
  onCompareSeasons,
  onAward,
  onDeduct,
  onDeletePoint,
  logoutUrl,
  showSeasonOverviewCard = false,
  adminSection,
}: DashboardShellProps) {
  const [awardOpen, setAwardOpen] = useState(false);
  const [deductOpen, setDeductOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [selectedHouseId, setSelectedHouseId] = useState<string | null>(null);
  const [selectedSeasonId, setSelectedSeasonId] = useState(dashboardSummary.selectedSeason.id);
  const [scopedLeaderboard, setScopedLeaderboard] = useState(leaderboard);
  const [scopedDashboardSummary, setScopedDashboardSummary] = useState(dashboardSummary);
  const [scopedMemberPoints, setScopedMemberPoints] = useState(memberPoints);
  const [seasonError, setSeasonError] = useState<string | null>(null);
  const [seasonMenuOpen, setSeasonMenuOpen] = useState(false);
  const [isSeasonPending, startSeasonTransition] = useTransition();
  const seasonMenuRef = useRef<HTMLDivElement>(null);
  const visibleTabs = adminSection
    ? [...TABS, { id: "manage" as const, label: "Manage", icon: Wrench }]
    : TABS;
  const selectedSeason = useMemo(
    () => seasonContext.seasons.find((season) => season.id === selectedSeasonId) ?? seasonContext.activeSeason,
    [seasonContext.activeSeason, seasonContext.seasons, selectedSeasonId],
  );
  const isHistoricalSeason = !selectedSeason.isActive;
  const hasMultipleSeasons = seasonContext.seasons.length > 1;
  const selectedSeasonLabel = `${selectedSeason.name}${selectedSeason.isActive ? " (current)" : ""}`;
  const displayedDashboardSummary =
    selectedSeasonId === dashboardSummary.selectedSeason.id ? dashboardSummary : scopedDashboardSummary;
  const displayedLeaderboard =
    selectedSeasonId === dashboardSummary.selectedSeason.id ? leaderboard : scopedLeaderboard;
  const displayedMemberPoints =
    selectedSeasonId === dashboardSummary.selectedSeason.id ? memberPoints : scopedMemberPoints;
  const selectedHouse = displayedLeaderboard.find((house) => house.id === selectedHouseId) ?? null;
  const activityFeedKey = `${activityNextCursor ?? "end"}:${activity.map((item) => item.id).join(",")}`;
  const activeSeasonTiming = getSeasonTiming(seasonContext.activeSeason);
  const canDeduct = Boolean(onDeduct) && (session.role === "ADMIN" || session.role === "OWNER");
  const houseThemeStyle = resolveHouseThemeStyle({
    enabled: session.houseThemeEnabled,
    houseColor: session.houseColor,
  });

  useEffect(() => {
    if (!seasonMenuOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (!seasonMenuRef.current?.contains(event.target as Node)) {
        setSeasonMenuOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setSeasonMenuOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [seasonMenuOpen]);

  function handleSeasonChange(nextSeasonId: string) {
    setSeasonMenuOpen(false);
    setSelectedSeasonId(nextSeasonId);
    setSeasonError(null);

    startSeasonTransition(async () => {
      try {
        const nextReports = await onSeasonChange(nextSeasonId);
        setScopedDashboardSummary(nextReports.dashboardSummary);
        setScopedLeaderboard(nextReports.leaderboard);
        setScopedMemberPoints(nextReports.memberPoints);
        setSelectedHouseId(null);
      } catch (error) {
        setSeasonError(error instanceof Error ? error.message : "Season reports could not be loaded.");
        setSelectedSeasonId(scopedDashboardSummary.selectedSeason.id);
      }
    });
  }

  function handleTabChange(nextTab: string) {
    const nextActiveTab = nextTab as TabId;

    if (nextActiveTab !== "overview") {
      setSelectedHouseId(null);
    }

    setActiveTab(nextActiveTab);
  }

  return (
    <div className="min-h-screen bg-background" style={houseThemeStyle}>
      {/* Header */}
      <header className="sticky top-0 z-30 border-b bg-card/95 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <h1 className="font-display text-xl font-bold tracking-wide text-primary">
            House Points
          </h1>
          <div className="flex items-center gap-3">
            {/* Current house badge */}
            {session.houseName && (
              <span
                className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full"
                style={{
                  backgroundColor: `${session.houseColor ?? "var(--primary)"}20`,
                  color: session.houseColor ?? "var(--primary)",
                  border: `1px solid ${session.houseColor ?? "var(--primary)"}40`,
                }}
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: session.houseColor ?? "var(--primary)" }}
                />
                {session.houseName}
              </span>
            )}
            {/* Award points button - hidden on mobile (FAB used instead) */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setAwardOpen(true)}
              className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <Star weight="fill" size={16} />
              Award Points
            </motion.button>
            {canDeduct ? (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setDeductOpen(true)}
                className="hidden items-center gap-2 rounded-lg border border-destructive/30 px-4 py-2 text-sm font-semibold text-destructive transition-colors hover:bg-destructive/10 sm:flex"
              >
                <MinusCircle weight="fill" size={16} />
                Deduct Points
              </motion.button>
            ) : null}
            {/* User / logout */}
            <div className="flex items-center gap-1">
              <a
                href="/settings"
                className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center hover:bg-primary/30 transition-colors"
                aria-label="Profile settings"
              >
                <User size={16} className="text-primary" />
              </a>
              <a
                href={logoutUrl}
                className="w-8 h-8 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                aria-label="Sign out"
              >
                <SignOut size={18} />
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Welcome */}
        <div className="mb-8">
          <p className="text-muted-foreground text-sm">Welcome back,</p>
          <h2 className="font-display text-3xl font-semibold">{session.userName}</h2>
        </div>

        <Tabs.Root
          value={activeTab}
          onValueChange={handleTabChange}
        >
          {/* Tab bar */}
          <Tabs.List className="flex gap-1 border-b mb-8">
            {visibleTabs.map(({ id, label, icon: Icon }) => (
              <Tabs.Trigger
                key={id}
                value={id}
                className={cn(
                  "flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors",
                  "focus:outline-none",
                  activeTab === id
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                )}
              >
                <Icon size={16} />
                <span className="hidden sm:inline">{label}</span>
              </Tabs.Trigger>
            ))}
          </Tabs.List>

          {/* Overview tab */}
          <Tabs.Content value="overview" className="focus:outline-none">
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="font-display text-xl font-semibold">House standings</h3>
                <p className="text-sm text-muted-foreground">
                  Select a house to focus the report widgets below.
                </p>
              </div>
              <div className="flex flex-col items-start gap-2 sm:items-end">
                {hasMultipleSeasons ? (
                  <div ref={seasonMenuRef} className="relative">
                    <button
                      type="button"
                      aria-label={`Reporting season: ${selectedSeasonLabel}`}
                      aria-haspopup="listbox"
                      aria-expanded={seasonMenuOpen}
                      onClick={() => setSeasonMenuOpen((open) => !open)}
                      disabled={isSeasonPending}
                      className="inline-flex items-center gap-2 rounded-full border bg-card/70 px-3 py-1.5 text-sm font-medium text-foreground shadow-sm transition-colors hover:border-primary/40 hover:bg-card focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:cursor-wait disabled:opacity-70"
                    >
                      <CalendarBlank size={15} className="text-primary" aria-hidden="true" />
                      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Viewing
                      </span>
                      <span className="max-w-52 truncate font-semibold">{selectedSeasonLabel}</span>
                      <CaretDown
                        size={14}
                        className={cn(
                          "text-muted-foreground transition-transform",
                          seasonMenuOpen ? "rotate-180" : "",
                        )}
                        aria-hidden="true"
                      />
                    </button>
                    {seasonMenuOpen ? (
                      <div
                        role="listbox"
                        aria-label="Reporting season"
                        className="absolute right-0 z-20 mt-2 min-w-full overflow-hidden rounded-2xl border bg-card p-1.5 text-sm shadow-xl shadow-primary/10"
                      >
                        {seasonContext.seasons.map((season) => {
                          const optionLabel = `${season.name}${season.isActive ? " (current)" : ""}`;
                          const isSelected = season.id === selectedSeasonId;

                          return (
                            <button
                              key={season.id}
                              type="button"
                              role="option"
                              aria-selected={isSelected}
                              onClick={() => handleSeasonChange(season.id)}
                              className={cn(
                                "flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left font-semibold transition-colors",
                                isSelected
                                  ? "bg-primary/10 text-primary"
                                  : "text-foreground hover:bg-muted/70",
                              )}
                            >
                              <span className="whitespace-nowrap">{optionLabel}</span>
                              {isSelected ? <Check size={14} aria-hidden="true" /> : null}
                            </button>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div
                    className="inline-flex items-center gap-2 rounded-full border bg-card/70 px-3 py-1.5 text-sm font-medium text-foreground shadow-sm"
                    aria-label={`Reporting season: ${selectedSeasonLabel}`}
                  >
                    <CalendarBlank size={15} className="text-primary" aria-hidden="true" />
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Viewing
                    </span>
                    <span className="font-semibold">{selectedSeasonLabel}</span>
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  {isHistoricalSeason ? (
                    <span className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                      Historical view
                    </span>
                  ) : null}
                  {isSeasonPending ? (
                    <span className="text-xs text-muted-foreground">Loading season reports...</span>
                  ) : null}
                  {selectedHouse && (
                    <button
                      type="button"
                      onClick={() => setSelectedHouseId(null)}
                      className="rounded-full border px-3 py-1 text-xs font-semibold text-muted-foreground hover:text-foreground"
                    >
                      Back to all houses
                    </button>
                  )}
                </div>
              </div>
            </div>
            {seasonError ? (
              <p className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {seasonError}
              </p>
            ) : null}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {displayedLeaderboard.map((house, index) => (
                <HouseCard
                  key={house.id}
                  house={house}
                  rank={index + 1}
                  selected={house.id === selectedHouseId}
                  onSelect={() => setSelectedHouseId((current) => current === house.id ? null : house.id)}
                />
              ))}
            </div>
            {showSeasonOverviewCard ? (
              <section
                className="mt-6 rounded-2xl border bg-card/80 p-5 shadow-sm"
                aria-label="Current season status"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Current season
                    </p>
                    <h4 className="mt-1 font-display text-xl font-semibold">{seasonContext.activeSeason.name}</h4>
                    <p className="mt-2 text-sm text-muted-foreground">{activeSeasonTiming.detail}</p>
                  </div>
                  <div className="inline-flex items-center gap-3 rounded-xl border bg-background px-4 py-3 text-sm font-semibold text-foreground">
                    <CalendarBlank size={20} className="text-primary" aria-hidden="true" />
                    <span>{activeSeasonTiming.label}</span>
                  </div>
                </div>
                {isHistoricalSeason ? (
                  <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
                    You are viewing historical reports and house standings for {selectedSeason.name}.
                  </p>
                ) : null}
              </section>
            ) : null}
            <div className="mt-8">
              <OverviewReports
                dashboardSummary={displayedDashboardSummary}
                selectedHouse={selectedHouse}
                onShowActivity={() => setActiveTab("activity")}
              />
            </div>
            {onCompareSeasons ? (
              <div className="mt-8">
                <SeasonComparisonReport
                  seasons={seasonContext.seasons}
                  initialComparison={initialSeasonComparison}
                  onCompare={onCompareSeasons}
                />
              </div>
            ) : null}
          </Tabs.Content>

          {/* Activity tab */}
          <Tabs.Content value="activity" className="focus:outline-none">
            <ActivityFeed
              key={activityFeedKey}
              items={activity}
              nextCursor={activityNextCursor}
              onLoadMore={onLoadMoreActivity}
              canDelete={session.role === "ADMIN" || session.role === "OWNER"}
              onDelete={onDeletePoint}
            />
          </Tabs.Content>

          {/* Leaderboard tab */}
          <Tabs.Content value="leaderboard" className="focus:outline-none">
            <Leaderboard
              members={members}
              memberPoints={displayedMemberPoints}
              seasonName={displayedDashboardSummary.selectedSeason.name}
              isHistoricalSeason={!displayedDashboardSummary.selectedSeason.isActive}
            />
          </Tabs.Content>

          {adminSection && (
            <Tabs.Content value="manage" className="focus:outline-none">
              {adminSection}
            </Tabs.Content>
          )}
        </Tabs.Root>
      </main>

      {/* Mobile FABs - Award Points and admin deductions */}
      <div className="fixed bottom-6 right-6 z-40 flex flex-col gap-3 sm:hidden">
        {canDeduct ? (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setDeductOpen(true)}
            className="flex h-14 w-14 items-center justify-center rounded-full border border-destructive/30 bg-card text-destructive shadow-lg"
            aria-label="Deduct Points"
          >
            <MinusCircle weight="fill" size={24} />
          </motion.button>
        ) : null}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setAwardOpen(true)}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg"
          aria-label="Award Points"
        >
          <Star weight="fill" size={24} />
        </motion.button>
      </div>

      {/* Award dialog */}
      <AwardPointsDialog
        open={awardOpen}
        onOpenChange={setAwardOpen}
        houses={leaderboard}
        members={members}
        onAward={onAward}
      />
      {onDeduct ? (
        <DeductPointsDialog
          open={deductOpen}
          onOpenChange={setDeductOpen}
          members={members}
          actorHouseId={session.houseId}
          onDeduct={onDeduct}
        />
      ) : null}
    </div>
  );
}
