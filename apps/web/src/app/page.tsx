import { randomUUID } from "node:crypto";
import {
  assignUserHouse,
  createHouse,
  createInviteLink,
  deletePointTransaction,
  promoteUserRole,
  readAdminAuditPage,
  readAdminContext,
  readPointAdjustmentStats,
  updateOrgSlug,
  updateOrgSettings,
} from "./actions/admin";
import {
  readActivityPage,
  readDashboardSummary,
  readLeaderboard,
  readMembers,
} from "./actions/dashboard";
import {
  markAllNotificationsRead,
  markNotificationRead,
  readNotifications,
} from "./actions/notifications";
import { awardPoints, deductPoints } from "./actions/points";
import {
  readMemberScores,
  readSeasonComparison,
  readSeasonContext,
  readSeasonReports,
  renameSeason,
  startSeason,
} from "./actions/seasons";
import { readSessionSummary } from "./actions/profile";
import { DashboardShell } from "@/components/DashboardShell";
import { AdminForms } from "@/components/AdminForms";
import { AdminUnavailablePanel } from "@/components/AdminUnavailablePanel";
import { OrgOnboarding } from "@/components/OrgOnboarding";
import { logError, logInfo, logWarn, serializeErrorForLog } from "@/lib/logging";
import type { PagedNotifications, Season, SeasonComparison } from "@housepoints/contracts";

export const dynamic = "force-dynamic";

const ADMIN_CONTEXT_FAILED = Symbol("ADMIN_CONTEXT_FAILED");
const showSeasonOverviewCard = process.env.SHOW_SEASON_OVERVIEW_CARD === "true";
const pointAdjustmentsEnabled = process.env.POINT_ADJUSTMENTS_ENABLED === "true";

type AdminContextResult =
  | Awaited<ReturnType<typeof readAdminContext>>
  | typeof ADMIN_CONTEXT_FAILED;

export default async function Home() {
  try {
    return await renderHome();
  } catch (error) {
    logError("web.dashboard.render_failed", {
      ...serializeErrorForLog(error),
      route: "/",
    });

    throw error;
  }
}

async function renderHome() {
  const requestId = randomUUID();

  logInfo("web.dashboard.render_started", {
    requestId,
    route: "/",
  });

  const session = await readSessionSummary(requestId);

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

  // Fetch dashboard data in parallel. Admin tools are optional for rendering the core dashboard.
  const [leaderboard, members, activityPage, memberScores, dashboardSummary, seasonContext, notifications, adminContext] = await Promise.all([
    readLeaderboard(requestId),
    readMembers(requestId),
    readActivityPage(undefined, requestId),
    readMemberScores(undefined, requestId),
    readDashboardSummary(undefined, requestId),
    readSeasonContext(requestId),
    readNotificationsForDashboard(requestId),
    readAdminContextForDashboard(session.role, requestId),
  ]);
  const initialSeasonComparison = await readInitialSeasonComparison(seasonContext.seasons, requestId);

  logInfo("web.dashboard.render_completed", {
    requestId,
    route: "/",
    role: session.role,
    hasAdminContext: Boolean(adminContext),
  });

  const adminSection = adminContext === ADMIN_CONTEXT_FAILED ? (
    <AdminUnavailablePanel />
  ) : adminContext ? (
    <AdminForms
      users={adminContext.users}
      houses={adminContext.houses}
      organization={{
        id: adminContext.organizationId,
        name: adminContext.organizationName,
        slug: adminContext.organizationSlug,
      }}
      recentDeletedPoints={adminContext.recentDeletedPoints}
      recentAdminActions={adminContext.recentAdminActions}
      inviteStats={adminContext.inviteStats}
      pointAdjustmentStats={adminContext.pointAdjustmentStats}
      adminAuditNextCursor={adminContext.adminAuditNextCursor}
      seasons={seasonContext.seasons}
      activeSeason={seasonContext.activeSeason}
      actorRole={session.role ?? "MEMBER"}
      onCreateHouse={createHouse}
      onAssignHouse={assignUserHouse}
      onPromoteUser={promoteUserRole}
      onUpdateOrgSlug={updateOrgSlug}
      onUpdateOrgSettings={updateOrgSettings}
      onLoadAdminAudit={readAdminAuditPage}
      onLoadPointAdjustmentStats={readPointAdjustmentStats}
      onCreateInvite={createInviteLink}
      onStartSeason={startSeason}
      onRenameSeason={renameSeason}
    />
  ) : undefined;

  return (
    <DashboardShell
      session={{
        userName: session.userName ?? "Team Member",
        houseId: session.houseId ?? null,
        houseName: session.houseName ?? null,
        houseColor: session.houseColor ?? null,
        houseThemeEnabled: Boolean(session.houseThemeEnabled),
        role: session.role ?? "MEMBER",
      }}
      leaderboard={leaderboard}
      members={members}
      activity={activityPage.items}
      activityNextCursor={activityPage.nextCursor}
      onLoadMoreActivity={readActivityPage}
      memberPoints={memberScores}
      dashboardSummary={dashboardSummary}
      seasonContext={seasonContext}
      onSeasonChange={readSeasonReports}
      initialSeasonComparison={initialSeasonComparison}
      onCompareSeasons={readSeasonComparison}
      notifications={notifications}
      onRefreshNotifications={readNotifications}
      onMarkNotificationRead={markNotificationRead}
      onMarkAllNotificationsRead={markAllNotificationsRead}
      onAward={awardPoints}
      onDeduct={pointAdjustmentsEnabled ? deductPoints : undefined}
      onDeletePoint={deletePointTransaction}
      loginUrl="/auth/login"
      logoutUrl="/auth/logout"
      showSeasonOverviewCard={showSeasonOverviewCard}
      adminSection={adminSection}
    />
  );
}

async function readNotificationsForDashboard(requestId: string): Promise<PagedNotifications> {
  try {
    return await readNotifications(requestId);
  } catch (error) {
    logWarn("web.notifications.load_failed", {
      ...serializeErrorForLog(error),
      requestId,
      route: "/",
    });

    return {
      items: [],
      unreadCount: 0,
      nextCursor: null,
    };
  }
}

async function readInitialSeasonComparison(
  seasons: Season[],
  requestId: string,
): Promise<SeasonComparison | null> {
  if (seasons.length < 2) {
    return null;
  }

  const activeSeason = seasons.find((season) => season.isActive) ?? seasons[0];
  const historicalSeason = seasons
    .filter((season) => season.id !== activeSeason.id)
    .sort((left, right) => new Date(right.startsAt).getTime() - new Date(left.startsAt).getTime())[0];

  if (!historicalSeason) {
    return null;
  }

  try {
    return await readSeasonComparison(historicalSeason.id, activeSeason.id, requestId);
  } catch (error) {
    logWarn("web.seasons.initial_comparison_failed", {
      ...serializeErrorForLog(error),
      requestId,
      route: "/",
      fromSeasonId: historicalSeason.id,
      toSeasonId: activeSeason.id,
    });

    return null;
  }
}

async function readAdminContextForDashboard(
  role: string | null | undefined,
  requestId: string,
): Promise<AdminContextResult> {
  if (role !== "ADMIN" && role !== "OWNER") {
    return null;
  }

  try {
    return await readAdminContext(requestId);
  } catch (error) {
    logWarn("web.admin.context_failed", {
      ...serializeErrorForLog(error),
      requestId,
      route: "/",
    });

    return ADMIN_CONTEXT_FAILED;
  }
}
