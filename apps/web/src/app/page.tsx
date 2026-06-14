import {
  assignUserHouse,
  awardPoints,
  createHouse,
  readActivityFeed,
  readAdminContext,
  readLeaderboard,
  readMembers,
  readSessionSummary,
} from "./actions/points";
import { DashboardShell } from "@/components/DashboardShell";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await readSessionSummary();

  // Redirect to login if not authenticated
  if (!session.isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-6 max-w-sm px-4">
          <h1 className="font-display text-4xl font-bold text-primary">House Points</h1>
          <p className="text-muted-foreground">Sign in to see standings and award points to your team.</p>
          <a
            href="/auth/login"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            Sign in with Auth0
          </a>
        </div>
      </div>
    );
  }

  // Block unassigned users — nothing is visible until an admin assigns them to a house
  if (session.needsHouseAssignment) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center space-y-4 max-w-sm">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <span className="text-3xl">⏳</span>
          </div>
          <h1 className="font-display text-2xl font-semibold text-primary">Waiting for Assignment</h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            You&apos;re signed in as <strong>{session.userName}</strong>, but you haven&apos;t been assigned to a house yet.
            An admin will assign you shortly — check back soon.
          </p>
          <div className="flex items-center justify-center gap-4 pt-2">
            <a
              href="/settings"
              className="text-sm text-primary hover:underline"
            >
              Update your profile
            </a>
            <span className="text-border">·</span>
            <a
              href="/auth/logout"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Sign out
            </a>
          </div>
        </div>
      </div>
    );
  }

  // Fetch dashboard data in parallel
  const [leaderboard, members, activity, adminContext] = await Promise.all([
    readLeaderboard(),
    readMembers(),
    readActivityFeed(),
    session.role === "ADMIN" ? readAdminContext() : Promise.resolve(null),
  ]);

  // Compute per-member points from activity for the Leaderboard component
  const memberPointMap = new Map<string, number>();
  if (members && activity) {
    // activity is house-level; member points need separate enrichment
    // For now we derive from members' house scores proportionally via org members
    // (placeholder — a dedicated per-member endpoint can be added later)
  }
  const memberPoints = (members ?? []).map((m) => ({
    memberId: m.id,
    points: memberPointMap.get(m.id) ?? 0,
  }));

  const adminSection = adminContext ? (
    <div className="grid gap-6 sm:grid-cols-2">
      <form action={createHouse} className="grid gap-3 rounded-xl border p-5 bg-card">
        <h4 className="text-sm font-semibold">Create House</h4>
        <input
          name="name"
          className="rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder="House name"
          required
        />
        <input
          name="color"
          type="color"
          defaultValue="#7c3aed"
          className="h-9 rounded-lg border bg-background px-2"
          title="House color"
        />
        <input
          name="description"
          className="rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder="Description (optional)"
        />
        <button type="submit" className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold hover:bg-primary/90 transition-colors">
          Create
        </button>
      </form>

      <form action={assignUserHouse} className="grid gap-3 rounded-xl border p-5 bg-card">
        <h4 className="text-sm font-semibold">Assign User to House</h4>
        <select name="targetUserId" className="rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none" required defaultValue="">
          <option value="" disabled>Select member…</option>
          {adminContext.users.map((u) => (
            <option key={u.id} value={u.id}>{u.displayName}</option>
          ))}
        </select>
        <select name="targetHouseId" className="rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none" required defaultValue="">
          <option value="" disabled>Select house…</option>
          {adminContext.houses.map((h) => (
            <option key={h.id} value={h.id}>{h.name}</option>
          ))}
        </select>
        <button type="submit" className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold hover:bg-primary/90 transition-colors">
          Assign
        </button>
      </form>
    </div>
  ) : undefined;

  return (
    <DashboardShell
      session={{
        userName: session.userName ?? "Team Member",
        houseId: session.houseId ?? null,
        houseName: session.houseName ?? null,
        houseColor: session.houseColor ?? null,
        role: session.role ?? "MEMBER",
      }}
      leaderboard={leaderboard ?? []}
      members={members ?? []}
      activity={activity ?? []}
      memberPoints={memberPoints}
      onAward={awardPoints}
      loginUrl="/auth/login"
      logoutUrl="/auth/logout"
      adminSection={adminSection}
    />
  );
}
