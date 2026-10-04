import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { readDashboardSummary, readMembers, readSeasonLeaderboard } from "@/app/actions/dashboard";
import { readOrgRouteContext } from "@/app/actions/orgs";
import { readSessionSummary } from "@/app/actions/profile";
import { readRecognitionCategoriesForReports } from "@/app/actions/recognition";
import {
  readMemberScores,
  readSeasonContext,
} from "@/app/actions/seasons";
import { readReportPage } from "@/app/actions/reports";
import { ReportsView, type ReportTypeFilter } from "@/components/ReportsView";
import { WebAuthenticationError } from "@/lib/api-client";
import { reportsDrillThroughWebEnabled } from "@/lib/reports-gate";
import { logInfo } from "@/lib/logging";

type OrganizationReportsPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    season?: string | string[];
    house?: string | string[];
    member?: string | string[];
    category?: string | string[];
    giver?: string | string[];
    type?: string | string[];
  }>;
};

export const dynamic = "force-dynamic";

function readParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function parseTypeParam(value: string | null): ReportTypeFilter | null {
  if (value === "AWARD" || value === "DEDUCTION") return value;
  return null;
}

export default async function OrganizationReportsPage({
  params,
  searchParams,
}: OrganizationReportsPageProps) {
  if (!reportsDrillThroughWebEnabled) {
    notFound();
  }

  const { slug } = await params;
  const query = await searchParams;
  const route = `/o/${encodeURIComponent(slug)}/reports`;
  const requestId = randomUUID();

  logInfo("web.reports.render_started", { requestId, route });

  const session = await readSessionSummary(requestId);
  if (!session.isAuthenticated) {
    redirect(`/auth/login?returnTo=${encodeURIComponent(route)}`);
  }

  let routeContext: Awaited<ReturnType<typeof readOrgRouteContext>>;
  try {
    routeContext = await readOrgRouteContext(slug, requestId);
  } catch (error) {
    if (error instanceof WebAuthenticationError) {
      redirect(`/auth/login?returnTo=${encodeURIComponent(route)}`);
    }
    throw error;
  }

  if (routeContext.status !== "MATCH") {
    // Any non-match status is handled by the dashboard route (alias, archived,
    // suspended, different-org, no-actor-org, not-found). Send the user back
    // there so they see the correct chrome and take the correct action.
    redirect(`/o/${encodeURIComponent(slug)}`);
  }

  if (!session.appUserId) {
    redirect(`/o/${encodeURIComponent(slug)}`);
  }

  const [seasonContext, leaderboardBaseline, members, categories] = await Promise.all([
    readSeasonContext(requestId),
    readSeasonLeaderboard(undefined, requestId),
    readMembers(requestId),
    readRecognitionCategoriesForReports(requestId),
  ]);

  const seasonParam = readParam(query.season);
  const selectedSeason =
    seasonContext.seasons.find((season) => season.id === seasonParam) ??
    seasonContext.activeSeason;

  // Refetch leaderboard/summary/scores for the selected season if it differs
  // from the active season baseline.
  const [leaderboard, dashboardSummary, memberScores] = await Promise.all([
    selectedSeason.id === seasonContext.activeSeason.id
      ? Promise.resolve(leaderboardBaseline)
      : readSeasonLeaderboard(selectedSeason.id, requestId),
    readDashboardSummary(selectedSeason.id, requestId),
    readMemberScores(selectedSeason.id, requestId),
  ]);

  const houseParam = readParam(query.house);
  const memberParam = readParam(query.member);
  const categoryParam = readParam(query.category);
  const giverParam = readParam(query.giver);
  const typeParam = parseTypeParam(readParam(query.type));

  const houseId = houseParam && leaderboard.some((house: { id: string }) => house.id === houseParam)
    ? houseParam
    : null;
  const memberId = memberParam && members.some((member: { id: string }) => member.id === memberParam)
    ? memberParam
    : null;
  const categoryId = categoryParam && categories.some((category) => category.id === categoryParam)
    ? categoryParam
    : null;
  const giverId = giverParam && members.some((member: { id: string }) => member.id === giverParam)
    ? giverParam
    : null;
  const type = typeParam;

  const hasFilterOverlay = Boolean(categoryId || giverId || type);

  const [initialResult, baselineResult] = await Promise.all([
    readReportPage({
      seasonId: selectedSeason.id,
      houseId: houseId ?? undefined,
      memberId: memberId ?? undefined,
      categoryId: categoryId ?? undefined,
      giverId: giverId ?? undefined,
      type: type ?? undefined,
      limit: 25,
    }),
    hasFilterOverlay
      ? readReportPage({
          seasonId: selectedSeason.id,
          houseId: houseId ?? undefined,
          memberId: memberId ?? undefined,
          limit: 1,
        })
      : Promise.resolve(null),
  ]);
  const baselineSummary = baselineResult && baselineResult.ok ? baselineResult.page.summary : null;

  logInfo("web.reports.render_completed", {
    requestId,
    route,
    seasonId: selectedSeason.id,
    houseId: houseId ?? undefined,
    memberId: memberId ?? undefined,
    categoryId: categoryId ?? undefined,
    giverId: giverId ?? undefined,
    type: type ?? undefined,
    ok: initialResult.ok,
  });

  return (
    <div className="min-h-screen bg-background">
      <ReportsView
        organizationSlug={routeContext.organizationSlug}
        seasonContext={seasonContext}
        leaderboard={leaderboard}
        members={members}
        memberPoints={memberScores}
        houseMemberRankings={dashboardSummary.houseMemberRankings}
        categories={categories}
        seasonId={selectedSeason.id}
        houseId={houseId}
        memberId={memberId}
        categoryId={categoryId}
        giverId={giverId}
        type={type}
        baselineSummary={baselineSummary}
        initialResult={initialResult}
        onLoadReport={readReportPage}
      />
      <ReportsFooterLink slug={routeContext.organizationSlug} />
    </div>
  );
}

function ReportsFooterLink({ slug }: { slug: string }) {
  return (
    <div className="mx-auto max-w-6xl px-4 pb-10 text-center text-xs text-muted-foreground">
      <Link href={`/o/${encodeURIComponent(slug)}`} className="hover:text-foreground">
        Return to dashboard
      </Link>
    </div>
  );
}
