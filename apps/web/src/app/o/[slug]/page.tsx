import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { readOrgRouteContext } from "@/app/actions/orgs";
import { renderDashboardPage } from "@/app/dashboard-page";
import { WebAuthenticationError } from "@/lib/api-client";
import { logError, serializeErrorForLog } from "@/lib/logging";

type OrganizationDashboardPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export const dynamic = "force-dynamic";

export default async function OrganizationDashboardPage({
  params,
}: OrganizationDashboardPageProps) {
  const { slug } = await params;
  const route = `/o/${encodeURIComponent(slug)}`;

  return renderOrganizationDashboardPage(slug, route);
}

async function renderOrganizationDashboardPage(slug: string, route: string) {
  const requestId = randomUUID();
  let routeContext: Awaited<ReturnType<typeof readOrgRouteContext>>;

  try {
    routeContext = await readOrgRouteContext(slug, requestId);
  } catch (error) {
    if (error instanceof WebAuthenticationError) {
      return (
        <SlugRouteMessage
          title="Sign in to open this organization"
          description="After signing in, you can open your organization dashboard if your account belongs there."
          actionHref={`/auth/login?returnTo=${encodeURIComponent(route)}`}
          actionLabel="Sign in"
        />
      );
    }

    throw error;
  }

  if (routeContext.status === "NOT_FOUND") {
    notFound();
  }

  if (routeContext.status === "ALIAS_REDIRECT") {
    redirect(`/o/${encodeURIComponent(routeContext.organizationSlug)}`);
  }

  if (routeContext.status === "DIFFERENT_ORG") {
    return (
      <SlugRouteMessage
        title="This dashboard belongs to another organization"
        description={`You are signed in with an account that belongs to ${routeContext.actorOrganizationName}.`}
        actionHref={`/o/${encodeURIComponent(routeContext.actorOrganizationSlug)}`}
        actionLabel="Open your dashboard"
        secondaryHref="/auth/logout"
        secondaryLabel="Sign out"
      />
    );
  }

  try {
    return await renderDashboardPage(route);
  } catch (error) {
    logError("web.dashboard.render_failed", {
      ...serializeErrorForLog(error),
      route,
      organizationSlug: slug,
    });

    throw error;
  }
}

function SlugRouteMessage({
  title,
  description,
  actionHref,
  actionLabel,
  secondaryHref,
  secondaryLabel,
}: {
  title: string;
  description: string;
  actionHref: string;
  actionLabel: string;
  secondaryHref?: string;
  secondaryLabel?: string;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-xl border bg-card p-6 text-center shadow-sm">
        <h1 className="font-display text-2xl font-semibold text-primary">{title}</h1>
        <p className="mt-3 text-sm text-muted-foreground">{description}</p>
        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href={actionHref}
            className="inline-flex h-11 items-center justify-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {actionLabel}
          </Link>
          {secondaryHref && secondaryLabel ? (
            <Link
              href={secondaryHref}
              className="inline-flex h-11 items-center justify-center rounded-lg border bg-card px-5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
            >
              {secondaryLabel}
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
