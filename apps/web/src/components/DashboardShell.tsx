"use client";

import { useState } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import { Trophy, Clock, ChartBar, Star, SignOut, User } from "@phosphor-icons/react";
import { motion, AnimatePresence } from "framer-motion";
import { HouseCard } from "./HouseCard";
import { Leaderboard } from "./Leaderboard";
import { ActivityFeed } from "./ActivityFeed";
import { AwardPointsDialog } from "./AwardPointsDialog";
import type {
  LeaderboardEntry,
  OrgMember,
  ActivityItem,
} from "@housepoints/contracts";
import { cn } from "@/lib/cn";

interface DashboardShellProps {
  session: {
    userName: string;
    houseId: string | null;
    houseName: string | null;
    houseColor: string | null;
    role: "MEMBER" | "ADMIN";
    needsHouseAssignment: boolean;
  };
  leaderboard: LeaderboardEntry[];
  members: OrgMember[];
  activity: ActivityItem[];
  /** Computed per-member point totals from activity */
  memberPoints: { memberId: string; points: number }[];
  onAward: (targetHouseId: string, delta: number, reason: string) => Promise<void>;
  loginUrl: string;
  logoutUrl: string;
  adminSection?: React.ReactNode;
}

const TABS = [
  { id: "overview", label: "Overview", icon: ChartBar },
  { id: "activity", label: "Activity", icon: Clock },
  { id: "leaderboard", label: "Leaderboard", icon: Trophy },
] as const;

export function DashboardShell({
  session,
  leaderboard,
  members,
  activity,
  memberPoints,
  onAward,
  logoutUrl,
  adminSection,
}: DashboardShellProps) {
  const [awardOpen, setAwardOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "activity" | "leaderboard">("overview");

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b bg-card/95 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
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
            {/* Award points button */}
            {!session.needsHouseAssignment && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setAwardOpen(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <Star weight="fill" size={16} />
                <span className="hidden sm:inline">Award Points</span>
              </motion.button>
            )}
            {/* User / logout */}
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                <User size={16} className="text-primary" />
              </div>
              <a
                href={logoutUrl}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Sign out"
              >
                <SignOut size={18} />
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* Needs house assignment banner */}
      {session.needsHouseAssignment && (
        <div className="border-b border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800 text-center">
          You haven&apos;t been assigned to a house yet. Ask an admin to assign you.
        </div>
      )}

      {/* Main content */}
      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* Welcome */}
        <div className="mb-8">
          <p className="text-muted-foreground text-sm">Welcome back,</p>
          <h2 className="font-display text-3xl font-semibold">{session.userName}</h2>
        </div>

        <Tabs.Root
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as typeof activeTab)}
        >
          {/* Tab bar */}
          <Tabs.List className="flex gap-1 border-b mb-8">
            {TABS.map(({ id, label, icon: Icon }) => (
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
                {label}
              </Tabs.Trigger>
            ))}
          </Tabs.List>

          {/* Overview tab */}
          <Tabs.Content value="overview" className="focus:outline-none">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {leaderboard.map((house, index) => (
                <HouseCard key={house.id} house={house} rank={index + 1} />
              ))}
            </div>
            {adminSection && (
              <div className="mt-10 border-t pt-8">
                <h3 className="font-display text-xl font-semibold mb-6 text-muted-foreground">
                  Admin Controls
                </h3>
                {adminSection}
              </div>
            )}
          </Tabs.Content>

          {/* Activity tab */}
          <Tabs.Content value="activity" className="focus:outline-none">
            <ActivityFeed items={activity} />
          </Tabs.Content>

          {/* Leaderboard tab */}
          <Tabs.Content value="leaderboard" className="focus:outline-none">
            <Leaderboard members={members} memberPoints={memberPoints} />
          </Tabs.Content>
        </Tabs.Root>
      </main>

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
