"use client";

import { ArrowRight, ChartLineUp, Clock, Sparkle, Trophy, Users } from "@phosphor-icons/react";
import type { DashboardSummary, LeaderboardEntry } from "@housepoints/contracts";
import { TRAIT_LABELS } from "@housepoints/contracts";

interface OverviewReportsProps {
  dashboardSummary: DashboardSummary;
  selectedHouse?: LeaderboardEntry | null;
  onShowActivity: () => void;
}

function formatShortDate(isoString: string) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(isoString));
}

export function OverviewReports({
  dashboardSummary,
  selectedHouse,
  onShowActivity,
}: OverviewReportsProps) {
  const scopeLabel = selectedHouse ? selectedHouse.name : "All houses";
  const standout = selectedHouse
    ? dashboardSummary.monthlyStandoutsByHouse.find((entry) => entry.houseId === selectedHouse.id)?.standout ?? null
    : dashboardSummary.monthlyStandout;
  const traitLeaders = selectedHouse
    ? dashboardSummary.traitLeaders.filter((entry) => entry.houseId === selectedHouse.id)
    : dashboardSummary.traitLeaders;
  const recentActivity = (
    selectedHouse
      ? dashboardSummary.recentActivity.filter((item) => item.targetHouseName === selectedHouse.name)
      : dashboardSummary.recentActivity
  ).slice(0, 8);
  const velocity = selectedHouse
    ? dashboardSummary.pointsVelocity.filter((entry) => entry.houseId === selectedHouse.id)
    : dashboardSummary.pointsVelocity;
  const maxVelocityPoints = Math.max(
    1,
    ...velocity.flatMap((entry) => entry.days.map((day) => day.points)),
  );
  const rankedMembers = selectedHouse
    ? dashboardSummary.houseMemberRankings.find((entry) => entry.houseId === selectedHouse.id)?.members ?? []
    : [];

  return (
    <section className="space-y-4" aria-label={`${scopeLabel} reporting widgets`}>
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-primary">{scopeLabel}</p>
          <h3 className="font-display text-2xl font-semibold">
            {selectedHouse ? "House report" : "Organization report"}
          </h3>
        </div>
        <p className="text-sm text-muted-foreground">
          {selectedHouse
            ? "Focused reporting for the selected house."
            : "A quick read on recognition across the organization."}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        <article className="rounded-xl border bg-card p-5 lg:col-span-1">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Sparkle size={18} className="text-primary" />
            This month&apos;s standout
          </div>
          {standout ? (
            <div className="mt-5">
              <p className="font-display text-2xl font-semibold">{standout.memberName}</p>
              <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: standout.houseColor }}
                />
                {standout.houseName}
              </div>
              <p className="mt-4 font-number text-3xl font-bold" style={{ color: standout.houseColor }}>
                {standout.points.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">points this month</p>
            </div>
          ) : (
            <p className="mt-5 text-sm text-muted-foreground">No points found for this month yet.</p>
          )}
        </article>

        <article className="rounded-xl border bg-card p-5 lg:col-span-2">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Trophy size={18} className="text-primary" />
            Trait leader per house
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {traitLeaders.map((leader) => (
              <div key={leader.houseId} className="rounded-lg border bg-background/60 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold">{leader.houseName}</span>
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: leader.houseColor }}
                  />
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {leader.trait ? TRAIT_LABELS[leader.trait] : "No trait data yet"}
                </p>
                {leader.trait ? (
                  <div className="mt-3 h-2 rounded-full bg-muted">
                    <div
                      className="h-2 rounded-full"
                      style={{
                        width: `${Math.min(100, leader.count * 25)}%`,
                        backgroundColor: leader.houseColor,
                      }}
                    />
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-xl border bg-card p-5 lg:col-span-1">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <ChartLineUp size={18} className="text-primary" />
            Points velocity
          </div>
          <div className="mt-4 space-y-4">
            {velocity.map((entry) => (
              <div key={entry.houseId}>
                <div className="mb-2 flex items-center justify-between text-xs">
                  <span className="font-semibold">{entry.houseName}</span>
                  <span className="text-muted-foreground">14 days</span>
                </div>
                <div className="flex h-14 items-end gap-1">
                  {entry.days.map((day) => {
                    const height = Math.max(10, (day.points / maxVelocityPoints) * 100);

                    return (
                      <span
                        key={day.date}
                        title={`${day.date}: ${day.points} points`}
                        className="flex-1 rounded-t-sm bg-muted"
                        style={{
                          height: `${height}%`,
                          backgroundColor: day.points > 0 ? entry.houseColor : undefined,
                          opacity: day.points > 0 ? 0.8 : 1,
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </article>
      </div>

      <article className="rounded-xl border bg-card">
        <div className="flex items-center justify-between gap-3 border-b p-5">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Clock size={18} className="text-primary" />
            Recent activity strip
          </div>
          <button
            type="button"
            onClick={onShowActivity}
            className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
          >
            Open activity
            <ArrowRight size={13} />
          </button>
        </div>
        {recentActivity.length > 0 ? (
          <div className="flex gap-3 overflow-x-auto p-4">
            {recentActivity.map((item) => (
              <div key={item.id} className="min-w-64 rounded-lg border bg-background/60 p-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: item.targetHouseColor }}
                  />
                  {formatShortDate(item.createdAt)}
                </div>
                <p className="mt-2 text-sm">
                  <span className="font-semibold">{item.actorName}</span>
                  <span className="text-muted-foreground"> to </span>
                  <span className="font-semibold">{item.targetUserName}</span>
                </p>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <span
                    className="rounded-full px-2 py-0.5 font-number text-xs font-bold"
                    style={{ backgroundColor: `${item.targetHouseColor}20`, color: item.targetHouseColor }}
                  >
                    +{item.delta}
                  </span>
                  {item.trait ? (
                    <span className="truncate rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                      {TRAIT_LABELS[item.trait]}
                    </span>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="p-6 text-sm text-muted-foreground">No activity yet for this view.</p>
        )}
      </article>

      {selectedHouse ? (
        <article className="rounded-xl border bg-card">
          <div className="flex items-center gap-2 border-b p-5 text-sm font-semibold">
            <Users size={18} className="text-primary" />
            {selectedHouse.name} members by points received
          </div>
          <div className="divide-y">
            {rankedMembers.length > 0 ? (
              rankedMembers.map((member, index) => (
                <div key={member.memberId} className="flex items-center justify-between gap-4 p-4">
                  <div className="flex items-center gap-3">
                    <span className="w-7 text-center text-sm font-semibold text-muted-foreground">
                      {index + 1}
                    </span>
                    <div>
                      <p className="text-sm font-semibold">{member.displayName}</p>
                      <p className="text-xs text-muted-foreground">{member.role}</p>
                    </div>
                  </div>
                  <span
                    className="rounded-full px-3 py-1 font-number text-sm font-bold"
                    style={{
                      backgroundColor: `${selectedHouse.color}20`,
                      color: selectedHouse.color,
                    }}
                  >
                    {member.points.toLocaleString()}
                  </span>
                </div>
              ))
            ) : (
              <p className="p-6 text-sm text-muted-foreground">No members are assigned to this house yet.</p>
            )}
          </div>
        </article>
      ) : null}
    </section>
  );
}
