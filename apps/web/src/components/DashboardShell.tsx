"use client";

import { useMemo, useState, useTransition } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import {
  CaretDown,
  CalendarBlank,
  Trophy,
  Clock,
  ChartBar,
  Star,
  SignOut,
  User,
  Wrench,
} from "@phosphor-icons/react";
import { motion } from "framer-motion";
import { HouseCard } from "./HouseCard";
import { Leaderboard } from "./Leaderboard";
import { ActivityFeed } from "./ActivityFeed";
import { OverviewReports } from "./OverviewReports";
import { AwardPointsDialog } from "./AwardPointsDialog";
import type { AwardPointsResult } from "@/lib/action-results";
import type {
  DashboardSummary,
  LeaderboardEntry,
  OrgMember,
  ActivityItem,
  MemberScore,
  PagedActivityFeed,
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
    memberPoints: MemberScore[];
  }>;
  onAward: (targetUserId: string, delta: number, reason: string, trait: Trait) => Promise<AwardPointsResult>;
  loginUrl: string;
  logoutUrl: string;
  adminSection?: React.ReactNode;
}

const TABS = [
  { id: "overview", label: "Overview", icon: ChartBar },
  { id: "activity", label: "Activity", icon: Clock },
  { id: "leaderboard", label: "Leaderboard", icon: Trophy },
] as const;

type TabId = (typeof TABS)[number]["id"] | "manage";

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
  onAward,
  logoutUrl,
  adminSection,
}: DashboardShellProps) {
  const [awardOpen, setAwardOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [selectedHouseId, setSelectedHouseId] = useState<string | null>(null);
  const [selectedSeasonId, setSelectedSeasonId] = useState(dashboardSummary.selectedSeason.id);
  const [scopedDashboardSummary, setScopedDashboardSummary] = useState(dashboardSummary);
  const [scopedMemberPoints, setScopedMemberPoints] = useState(memberPoints);
  const [seasonError, setSeasonError] = useState<string | null>(null);
  const [isSeasonPending, startSeasonTransition] = useTransition();
  const visibleTabs = adminSection
    ? [...TABS, { id: "manage" as const, label: "Manage", icon: Wrench }]
    : TABS;
  const selectedHouse = leaderboard.find((house) => house.id === selectedHouseId) ?? null;
  const selectedSeason = useMemo(
    () => seasonContext.seasons.find((season) => season.id === selectedSeasonId) ?? seasonContext.activeSeason,
    [seasonContext.activeSeason, seasonContext.seasons, selectedSeasonId],
  );
  const isHistoricalSeason = !selectedSeason.isActive;
  const hasMultipleSeasons = seasonContext.seasons.length > 1;
  const selectedSeasonLabel = `${selectedSeason.name}${selectedSeason.isActive ? " (current)" : ""}`;
  const displayedDashboardSummary =
    selectedSeasonId === dashboardSummary.selectedSeason.id ? dashboardSummary : scopedDashboardSummary;
  const displayedMemberPoints =
    selectedSeasonId === dashboardSummary.selectedSeason.id ? memberPoints : scopedMemberPoints;
  const activityFeedKey = `${activityNextCursor ?? "end"}:${activity.map((item) => item.id).join(",")}`;

  function handleSeasonChange(nextSeasonId: string) {
    setSelectedSeasonId(nextSeasonId);
    setSeasonError(null);

    startSeasonTransition(async () => {
      try {
        const nextReports = await onSeasonChange(nextSeasonId);
        setScopedDashboardSummary(nextReports.dashboardSummary);
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
    <div className="min-h-screen bg-background">
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
            {/* Award points button — hidden on mobile (FAB used instead) */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setAwardOpen(true)}
              className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <Star weight="fill" size={16} />
              Award Points
            </motion.button>
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
                  <label className="inline-flex items-center gap-2 rounded-full border bg-card/70 px-3 py-1.5 text-sm font-medium text-foreground shadow-sm transition-colors focus-within:ring-2 focus-within:ring-primary/30">
                    <span className="sr-only">Reporting season</span>
                    <CalendarBlank size={15} className="text-primary" aria-hidden="true" />
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Viewing
                    </span>
                    <select
                      value={selectedSeasonId}
                      onChange={(event) => handleSeasonChange(event.target.value)}
                      disabled={isSeasonPending}
                      className="max-w-52 appearance-none bg-transparent pr-5 text-sm font-semibold text-foreground focus:outline-none disabled:cursor-wait disabled:opacity-70"
                    >
                      {seasonContext.seasons.map((season) => (
                        <option key={season.id} value={season.id}>
                          {season.name}{season.isActive ? " (current)" : ""}
                        </option>
                      ))}
                    </select>
                    <CaretDown size={14} className="-ml-5 text-muted-foreground" aria-hidden="true" />
                  </label>
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
              {leaderboard.map((house, index) => (
                <HouseCard
                  key={house.id}
                  house={house}
                  rank={index + 1}
                  selected={house.id === selectedHouseId}
                  onSelect={() => setSelectedHouseId((current) => current === house.id ? null : house.id)}
                />
              ))}
            </div>
            <div className="mt-8">
              <OverviewReports
                dashboardSummary={displayedDashboardSummary}
                selectedHouse={selectedHouse}
                onShowActivity={() => setActiveTab("activity")}
              />
            </div>
          </Tabs.Content>

          {/* Activity tab */}
          <Tabs.Content value="activity" className="focus:outline-none">
            <ActivityFeed
              key={activityFeedKey}
              items={activity}
              nextCursor={activityNextCursor}
              onLoadMore={onLoadMoreActivity}
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

      {/* Mobile FAB — Award Points (visible only below sm) */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setAwardOpen(true)}
        className="sm:hidden fixed bottom-6 right-6 z-40 flex items-center justify-center w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg"
        aria-label="Award Points"
      >
        <Star weight="fill" size={24} />
      </motion.button>

      {/* Award dialog */}
      <AwardPointsDialog
        open={awardOpen}
        onOpenChange={setAwardOpen}
        houses={leaderboard}
        members={members}
        onAward={onAward}
      />
    </div>
  );
}
