"use client";

import { ArrowRight, ChartLineUp, Clock, Sparkle, Trophy, Users } from "@phosphor-icons/react";
import type { ActivityItem, LeaderboardEntry, OrgMember, Trait } from "@housepoints/contracts";
import { TRAIT_LABELS } from "@housepoints/contracts";

interface OverviewReportsProps {
  houses: LeaderboardEntry[];
  members: OrgMember[];
  activity: ActivityItem[];
  memberPoints: { memberId: string; points: number }[];
  selectedHouse?: LeaderboardEntry | null;
  onShowActivity: () => void;
}

interface Standout {
  name: string;
  points: number;
  houseName: string;
  houseColor: string;
}

interface TraitLeader {
  houseId: string;
  houseName: string;
  houseColor: string;
  trait: Trait | null;
  count: number;
}

function isThisMonth(isoString: string) {
  const date = new Date(isoString);
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function formatShortDate(isoString: string) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(isoString));
}

function scopeActivity(activity: ActivityItem[], selectedHouse?: LeaderboardEntry | null) {
  if (!selectedHouse) return activity;
  return activity.filter((item) => item.targetHouseName === selectedHouse.name);
}

function getStandout(activity: ActivityItem[]): Standout | null {
  const totals = new Map<string, Standout>();

  for (const item of activity.filter((entry) => isThisMonth(entry.createdAt))) {
    const current = totals.get(item.targetUserName) ?? {
      name: item.targetUserName,
      points: 0,
      houseName: item.targetHouseName,
      houseColor: item.targetHouseColor,
    };

    totals.set(item.targetUserName, {
      ...current,
      points: current.points + item.delta,
    });
  }

  return Array.from(totals.values()).sort((a, b) => b.points - a.points)[0] ?? null;
}

function getTraitLeaders(
  houses: LeaderboardEntry[],
  activity: ActivityItem[],
  selectedHouse?: LeaderboardEntry | null,
): TraitLeader[] {
  const visibleHouses = selectedHouse ? [selectedHouse] : houses;
  const monthlyActivity = activity.filter((entry) => isThisMonth(entry.createdAt) && entry.trait);

  return visibleHouses.map((house) => {
    const counts = new Map<Trait, number>();

    for (const item of monthlyActivity.filter((entry) => entry.targetHouseName === house.name)) {
      counts.set(item.trait!, (counts.get(item.trait!) ?? 0) + 1);
    }

    const [trait, count] = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0] ?? [null, 0];

    return {
      houseId: house.id,
      houseName: house.name,
      houseColor: house.color,
      trait,
      count,
    };
  });
}

function getVelocityDays(activity: ActivityItem[], houses: LeaderboardEntry[]) {
  const end = new Date();
  const days = Array.from({ length: 14 }, (_, index) => {
    const date = new Date(end);
    date.setDate(end.getDate() - (13 - index));
    return dateKey(date);
  });
  const pointsByHouse = new Map(houses.map((house) => [house.name, new Map<string, number>()]));

  for (const item of activity) {
    const key = dateKey(new Date(item.createdAt));
    if (!days.includes(key)) continue;
    const housePoints = pointsByHouse.get(item.targetHouseName);
    if (!housePoints) continue;
    housePoints.set(key, (housePoints.get(key) ?? 0) + item.delta);
  }

  const maxPoints = Math.max(
    1,
    ...Array.from(pointsByHouse.values()).flatMap((houseDays) => Array.from(houseDays.values())),
  );

  return houses.map((house) => ({
    house,
    days: days.map((day) => ({
      day,
      points: pointsByHouse.get(house.name)?.get(day) ?? 0,
      height: Math.max(10, ((pointsByHouse.get(house.name)?.get(day) ?? 0) / maxPoints) * 100),
    })),
  }));
}

function getHouseMemberRanking(
  selectedHouse: LeaderboardEntry,
  members: OrgMember[],
  memberPoints: { memberId: string; points: number }[],
) {
  const pointMap = new Map(memberPoints.map((entry) => [entry.memberId, entry.points]));
  return members
    .filter((member) => member.houseId === selectedHouse.id)
    .map((member) => ({
      member,
      points: pointMap.get(member.id) ?? 0,
    }))
    .sort((a, b) => b.points - a.points || a.member.displayName.localeCompare(b.member.displayName));
}

export function OverviewReports({
  houses,
  members,
  activity,
  memberPoints,
  selectedHouse,
  onShowActivity,
}: OverviewReportsProps) {
  const scopedActivity = scopeActivity(activity, selectedHouse);
  const standout = getStandout(scopedActivity);
  const traitLeaders = getTraitLeaders(houses, scopedActivity, selectedHouse);
  const recentActivity = scopedActivity.slice(0, 8);
  const velocity = getVelocityDays(scopedActivity, selectedHouse ? [selectedHouse] : houses);
  const rankedMembers = selectedHouse ? getHouseMemberRanking(selectedHouse, members, memberPoints) : [];
  const scopeLabel = selectedHouse ? selectedHouse.name : "All houses";

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
              <p className="text-2xl font-display font-semibold">{standout.name}</p>
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
              <p className="text-xs text-muted-foreground">points in recent monthly activity</p>
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
            {velocity.map(({ house, days }) => (
              <div key={house.id}>
                <div className="mb-2 flex items-center justify-between text-xs">
                  <span className="font-semibold">{house.name}</span>
                  <span className="text-muted-foreground">14 days</span>
                </div>
                <div className="flex h-14 items-end gap-1">
                  {days.map((day) => (
                    <span
                      key={day.day}
                      title={`${day.day}: ${day.points} points`}
                      className="flex-1 rounded-t-sm bg-muted"
                      style={{
                        height: `${day.height}%`,
                        backgroundColor: day.points > 0 ? house.color : undefined,
                        opacity: day.points > 0 ? 0.8 : 1,
                      }}
                    />
                  ))}
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
              rankedMembers.map(({ member, points }, index) => (
                <div key={member.id} className="flex items-center justify-between gap-4 p-4">
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
                    {points.toLocaleString()}
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
