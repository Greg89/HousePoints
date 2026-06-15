import {
  assignUserHouse,
  awardPoints,
  createHouse,
  createInviteLink,
  readActivityFeed,
  readAdminContext,
  readLeaderboard,
  readMemberScores,
  readMembers,
  readSessionSummary,
} from "./actions/points";
import { DashboardShell } from "@/components/DashboardShell";
import { AdminForms } from "@/components/AdminForms";
import { OrgOnboarding } from "@/components/OrgOnboarding";

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

  // No org yet — show onboarding (create or join)
  if (session.needsOrg) {
    return <OrgOnboarding userName={session.userName ?? "there"} />;
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
  const [leaderboard, members, activity, memberScores, adminContext] = await Promise.all([
    readLeaderboard(),
    readMembers(),
    readActivityFeed(),
    readMemberScores(),
    (session.role === "ADMIN" || session.role === "OWNER") ? readAdminContext() : Promise.resolve(null),
  ]);

  const adminSection = adminContext ? (
    <AdminForms
      users={adminContext.users}
      houses={adminContext.houses}
      onCreateHouse={createHouse}
      onAssignHouse={assignUserHouse}
      onCreateInvite={createInviteLink}
    />
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
      leaderboard={leaderboard}
      members={members}
      activity={activity}
      memberPoints={memberScores}
      onAward={awardPoints}
      loginUrl="/auth/login"
      logoutUrl="/auth/logout"
      adminSection={adminSection}
    />
  );
}
