import { OrgOnboarding } from "@/components/OrgOnboarding";
import { readSessionSummary } from "@/app/actions/profile";

export const dynamic = "force-dynamic";

export default async function NewOrganizationPage() {
  const session = await readSessionSummary();

  if (!session.isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-6 max-w-sm px-4">
          <h1 className="font-display text-4xl font-bold text-primary">House Points</h1>
          <p className="text-muted-foreground">Sign in to create a new organisation.</p>
          <a
            href="/auth/login?returnTo=/orgs/new"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            Sign in with Auth0
          </a>
        </div>
      </div>
    );
  }

  const dashboardHref = session.organizationSlug
    ? `/o/${encodeURIComponent(session.organizationSlug)}`
    : "/";

  return (
    <OrgOnboarding
      userName={session.userName ?? "there"}
      initialView="create"
      allowJoin={false}
      backHref={dashboardHref}
      introText="Create another organisation and switch into it when setup is complete."
    />
  );
}
