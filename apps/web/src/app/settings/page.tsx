import { redirect } from "next/navigation";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { readSessionSummary, updateDisplayName } from "@/app/actions/points";
import { DisplayNameForm } from "@/components/DisplayNameForm";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Settings – HousePoints",
};

export default async function SettingsPage() {
  const session = await readSessionSummary();

  if (!session.isAuthenticated) {
    redirect("/auth/login");
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b bg-card/95 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center gap-4">
          <a
            href="/"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft size={16} />
            Back to dashboard
          </a>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-12">
        <div className="mb-8">
          <h1 className="font-display text-3xl font-semibold">Profile Settings</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Update your display name and account preferences.
          </p>
        </div>

        {/* Profile card */}
        <div className="rounded-xl border bg-card p-6 space-y-6">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
              Identity
            </h2>

            {/* Email — read-only */}
            <div className="space-y-2 mb-6">
              <label className="text-sm font-medium block">Email</label>
              <div className="w-full rounded-lg border bg-muted/30 px-3 py-2.5 text-sm text-muted-foreground">
                {session.userEmail ?? "—"}
              </div>
              <p className="text-xs text-muted-foreground">
                Managed by Auth0. To change your email, contact an admin.
              </p>
            </div>

            {/* Display name — editable */}
            <DisplayNameForm
              currentName={session.userName ?? ""}
              onSave={updateDisplayName}
            />
          </div>

          {/* House & org info */}
          {(session.houseName || session.organizationSlug) && (
            <>
              <div className="border-t" />
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
                  Organization
                </h2>
                <dl className="space-y-3 text-sm">
                  {session.organizationSlug && (
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Organization</dt>
                      <dd className="font-medium">{session.organizationSlug}</dd>
                    </div>
                  )}
                  <div className="flex justify-between items-center">
                    <dt className="text-muted-foreground">House</dt>
                    <dd className="flex items-center gap-2 font-medium">
                      {session.houseColor && (
                        <span
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: session.houseColor }}
                        />
                      )}
                      {session.houseName ?? (
                        <span className="text-muted-foreground italic">Not assigned</span>
                      )}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Role</dt>
                    <dd className="font-medium capitalize">{session.role?.toLowerCase() ?? "—"}</dd>
                  </div>
                </dl>
              </div>
            </>
          )}
        </div>

        {/* Sign out */}
        <div className="mt-6 text-center">
          <a
            href="/auth/logout"
            className="text-sm text-muted-foreground hover:text-destructive transition-colors"
          >
            Sign out
          </a>
        </div>
      </main>
    </div>
  );
}
