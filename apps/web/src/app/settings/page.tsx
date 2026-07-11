import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowLeft,
  Buildings,
  IdentificationCard,
  Palette,
  Shield,
} from "@phosphor-icons/react/dist/ssr";
import type { AppUserOrganizationContext } from "@housepoints/contracts";
import { readSessionSummary, updateDisplayName, updateHouseThemePreference } from "@/app/actions/profile";
import { DisplayNameForm } from "@/components/DisplayNameForm";
import { HouseThemeToggleForm } from "@/components/HouseThemeToggleForm";
import { cn } from "@/lib/cn";
import { resolveHouseThemeStyle } from "@/lib/house-theme";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Account - HousePoints",
};

export default async function SettingsPage() {
  const session = await readSessionSummary();

  if (!session.isAuthenticated) {
    redirect("/auth/login");
  }

  const houseThemeStyle = resolveHouseThemeStyle({
    enabled: Boolean(session.houseThemeEnabled),
    houseColor: session.houseColor,
    themeMode: session.houseThemeMode,
    themeSecondaryColor: session.houseThemeSecondaryColor,
    themeSurfaceColor: session.houseThemeSurfaceColor,
  });
  const organizationContexts = session.organizationContexts ?? [];

  return (
    <div
      className={cn("min-h-screen bg-background", houseThemeStyle ? "house-theme-shell" : "")}
      style={houseThemeStyle}
    >
      <header className={cn("sticky top-0 z-30 border-b bg-card/95 backdrop-blur-sm", houseThemeStyle ? "house-theme-header" : "")}>
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft size={16} />
            Back to dashboard
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-12">
        <div className="mb-8">
          <h1 className="font-display text-3xl font-semibold">Account</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Manage your profile, personal preferences, and the organisations your account can access.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[16rem_1fr]">
          <nav
            aria-label="Account settings sections"
            className={cn("h-fit rounded-xl border bg-card p-3 lg:sticky lg:top-24", houseThemeStyle ? "house-theme-card" : "")}
          >
            <a
              href="#profile"
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/10"
            >
              <IdentificationCard size={18} aria-hidden="true" />
              Profile
            </a>
            <a
              href="#organisations"
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
            >
              <Buildings size={18} aria-hidden="true" />
              Organisations
            </a>
            <a
              href="#preferences"
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
            >
              <Palette size={18} aria-hidden="true" />
              Preferences
            </a>
          </nav>

          <div className="space-y-6">
            <section
              id="profile"
              className={cn("scroll-mt-24 rounded-xl border bg-card p-6", houseThemeStyle ? "house-theme-card" : "")}
            >
              <div className="mb-6 flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <IdentificationCard size={20} aria-hidden="true" />
                </div>
                <div>
                  <h2 className="font-display text-xl font-semibold">Profile</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Your identity and display details across HousePoints.
                  </p>
                </div>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="block text-sm font-medium">Email</label>
                  <div className="w-full rounded-lg border bg-muted/30 px-3 py-2.5 text-sm text-muted-foreground">
                    {session.userEmail ?? "-"}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Managed by Auth0. To change your email, contact an admin.
                  </p>
                </div>

                <DisplayNameForm
                  currentName={session.userName ?? ""}
                  onSave={updateDisplayName}
                />
              </div>
            </section>

            <section
              id="organisations"
              className={cn("scroll-mt-24 rounded-xl border bg-card p-6", houseThemeStyle ? "house-theme-card" : "")}
            >
              <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Buildings size={20} aria-hidden="true" />
                  </div>
                  <div>
                    <h2 className="font-display text-xl font-semibold">Organisations</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Switch between team spaces or create another organisation.
                    </p>
                  </div>
                </div>
                <Link
                  href="/orgs/new"
                  className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  Create organisation
                </Link>
              </div>

              {organizationContexts.length > 0 ? (
                <div className="grid gap-3">
                  {organizationContexts.map((organization) => (
                    <OrganizationAccountCard
                      key={organization.organizationId}
                      organization={organization}
                    />
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed p-5 text-center">
                  <p className="text-sm font-semibold">No organisations yet.</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Create your first organisation to start using HousePoints.
                  </p>
                </div>
              )}
            </section>

            <section
              id="preferences"
              className={cn("scroll-mt-24 rounded-xl border bg-card p-6", houseThemeStyle ? "house-theme-card" : "")}
            >
              <div className="mb-6 flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Palette size={20} aria-hidden="true" />
                </div>
                <div>
                  <h2 className="font-display text-xl font-semibold">Preferences</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Personal settings that follow you across organisations.
                  </p>
                </div>
              </div>

              <HouseThemeToggleForm
                enabled={Boolean(session.houseThemeEnabled)}
                houseName={session.houseName ?? null}
                houseColor={session.houseColor ?? null}
                onSave={updateHouseThemePreference}
              />
            </section>
          </div>
        </div>

        <div className="mt-6 text-center">
          <a
            href="/auth/logout"
            className="text-sm text-muted-foreground transition-colors hover:text-destructive"
          >
            Sign out
          </a>
        </div>
      </main>
    </div>
  );
}

function OrganizationAccountCard({
  organization,
}: {
  organization: AppUserOrganizationContext;
}) {
  const content = (
    <>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="truncate text-base font-semibold">{organization.organizationName}</h3>
          {organization.isCurrent ? (
            <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-bold text-primary">
              Current
            </span>
          ) : null}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {formatRole(organization.role)}
          {organization.houseName ? `, ${organization.houseName}` : ", no house assigned"}
        </p>
        <p className="mt-1 truncate text-xs text-muted-foreground">
          /o/{organization.organizationSlug}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2 text-sm font-semibold">
        {organization.isCurrent ? (
          <span className="inline-flex items-center gap-1 rounded-xl border px-3 py-2 text-muted-foreground">
            <Shield size={16} aria-hidden="true" />
            Active
          </span>
        ) : (
          <span className="rounded-xl border px-3 py-2 text-primary transition-colors group-hover:bg-primary/10">
            Switch
          </span>
        )}
      </div>
    </>
  );

  const className =
    "group flex items-center justify-between gap-4 rounded-xl border bg-background/60 px-4 py-3 text-left transition-colors hover:bg-muted/60";

  if (organization.isCurrent) {
    return (
      <div className={className} aria-current="page">
        {content}
      </div>
    );
  }

  return (
    <a className={className} href={`/o/${encodeURIComponent(organization.organizationSlug)}/switch`}>
      {content}
    </a>
  );
}

function formatRole(role: AppUserOrganizationContext["role"]) {
  if (role === "OWNER") {
    return "Owner";
  }

  if (role === "ADMIN") {
    return "Admin";
  }

  return "Member";
}
