import { redirect } from "next/navigation";
import Link from "next/link";
import { InviteJoinCard } from "@/components/InviteJoinCard";
import { WebAuthenticationError } from "@/lib/api-client";
import { previewInviteLink } from "@/app/actions/orgs";

type InviteJoinPageProps = {
  params: Promise<{
    slug: string;
    token: string;
  }>;
};

export const dynamic = "force-dynamic";

export default async function InviteJoinPage({ params }: InviteJoinPageProps) {
  const { slug, token } = await params;
  const currentPath = `/o/${encodeURIComponent(slug)}/join/${encodeURIComponent(token)}`;

  let preview: Awaited<ReturnType<typeof previewInviteLink>>;

  try {
    preview = await previewInviteLink(slug, token);
  } catch (error) {
    if (error instanceof WebAuthenticationError) {
      return (
        <InviteJoinMessage
          title="Sign in to use this invite"
          description="After signing in, return to this link to join the organisation."
          actionHref={`/auth/login?returnTo=${encodeURIComponent(currentPath)}`}
          actionLabel="Sign in"
        />
      );
    }

    throw error;
  }

  if (!preview.ok) {
    return (
      <InviteJoinMessage
        title="Invite link unavailable"
        description={preview.message}
        actionHref="/"
        actionLabel="Go home"
      />
    );
  }

  if (preview.organizationSlug !== slug) {
    redirect(`/o/${preview.organizationSlug}/join/${encodeURIComponent(token)}`);
  }

  if (preview.membershipStatus === "SAME_ORG") {
    return (
      <InviteJoinMessage
        title="You're already a member"
        description={`This invite is for ${preview.organizationName}, and your account already belongs to that organisation.`}
        actionHref={`/o/${encodeURIComponent(preview.organizationSlug)}`}
        actionLabel="Go to dashboard"
      />
    );
  }

  if (preview.membershipStatus === "OTHER_ORG") {
    return (
      <InviteJoinMessage
        title="This account is already in another organisation"
        description={`You are signed in with an account that belongs to ${preview.memberOrganizationName ?? "another organisation"}. Sign out and use a different account to join ${preview.organizationName}.`}
        actionHref="/auth/logout"
        actionLabel="Sign out"
      />
    );
  }

  return (
    <InviteJoinCard
      organizationName={preview.organizationName}
      organizationSlug={preview.organizationSlug}
      inviteToken={token}
    />
  );
}

function InviteJoinMessage({
  title,
  description,
  actionHref,
  actionLabel,
}: {
  title: string;
  description: string;
  actionHref: string;
  actionLabel: string;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-xl border bg-card p-6 text-center shadow-sm">
        <h1 className="font-display text-2xl font-semibold text-primary">{title}</h1>
        <p className="mt-3 text-sm text-muted-foreground">{description}</p>
        <Link
          href={actionHref}
          className="mt-6 inline-flex h-11 items-center justify-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          {actionLabel}
        </Link>
      </div>
    </div>
  );
}
