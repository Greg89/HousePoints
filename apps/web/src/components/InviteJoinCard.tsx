"use client";

import { useTransition } from "react";
import Link from "next/link";
import { CheckCircle, LinkSimple, WarningCircle } from "@phosphor-icons/react";
import { toast } from "sonner";
import { joinOrg } from "@/app/actions/orgs";

interface InviteJoinCardProps {
  organizationName: string;
  organizationSlug: string;
  inviteToken: string;
  onJoined?: () => void;
}

export function InviteJoinCard({
  organizationName,
  organizationSlug,
  inviteToken,
  onJoined,
}: InviteJoinCardProps) {
  const [isPending, startTransition] = useTransition();
  const dashboardHref = `/o/${encodeURIComponent(organizationSlug)}`;

  function handleJoin() {
    startTransition(async () => {
      try {
        const result = await joinOrg(inviteToken, organizationSlug);

        if (!result.ok) {
          toast.error("Could not join organisation", {
            description: result.message,
          });
          return;
        }

        toast.success("You've joined the organisation!", {
          description: `Welcome to ${organizationName}.`,
        });
        if (onJoined) {
          onJoined();
        } else {
          window.location.assign(dashboardHref);
        }
      } catch (err) {
        toast.error("Could not join organisation", {
          description: err instanceof Error ? err.message : "Something went wrong",
        });
      }
    });
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-xl border bg-card p-6 text-center shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          <LinkSimple size={28} />
        </div>
        <div className="mt-5 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Invite link
          </p>
          <h1 className="font-display text-2xl font-semibold text-primary">
            Join {organizationName}
          </h1>
          <p className="text-sm text-muted-foreground">
            You are signed in and ready to join this organisation. The invite can only be used once.
          </p>
        </div>
        <button
          type="button"
          onClick={handleJoin}
          disabled={isPending}
          className="mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          <CheckCircle size={18} />
          {isPending ? "Joining..." : "Join organisation"}
        </button>
        <Link
          href={dashboardHref}
          className="mt-4 inline-flex items-center justify-center gap-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <WarningCircle size={14} />
          Not now
        </Link>
      </div>
    </div>
  );
}
