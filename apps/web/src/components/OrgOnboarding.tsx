"use client";

import { useState, useTransition } from "react";
import { Buildings, LinkSimple } from "@phosphor-icons/react";
import { toast } from "sonner";
import { createOrg, joinOrg } from "@/app/actions/orgs";
import { cn } from "@/lib/cn";

interface OrgOnboardingProps {
  userName: string;
}

type View = "pick" | "create" | "join";

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function OrgOnboarding({ userName }: OrgOnboardingProps) {
  const [view, setView] = useState<View>("pick");
  const [isPending, startTransition] = useTransition();

  // Create org state
  const [orgName, setOrgName] = useState("");
  const [orgSlug, setOrgSlug] = useState("");
  const [firstHouseName, setFirstHouseName] = useState("");
  const [firstHouseColor, setFirstHouseColor] = useState("#7c3aed");
  const [slugEdited, setSlugEdited] = useState(false);

  // Join org state
  const [inviteToken, setInviteToken] = useState("");

  function handleOrgNameChange(value: string) {
    setOrgName(value);
    if (!slugEdited) {
      setOrgSlug(slugify(value));
    }
  }

  function handleSlugChange(value: string) {
    setSlugEdited(true);
    setOrgSlug(slugify(value));
  }

  function handleCreate() {
    if (!orgName.trim() || !orgSlug || !firstHouseName.trim()) return;
    startTransition(async () => {
      try {
        const result = await createOrg(orgName, orgSlug, firstHouseName, firstHouseColor);

        if (!result.ok) {
          toast.error("Could not create organisation", {
            description: result.message,
          });
          return;
        }

        toast.success("Organisation created!", { description: `Welcome to ${orgName}` });
      } catch (err) {
        toast.error("Could not create organisation", {
          description: err instanceof Error ? err.message : "Something went wrong",
        });
      }
    });
  }

  function handleJoin() {
    if (!inviteToken.trim()) return;
    startTransition(async () => {
      try {
        const result = await joinOrg(inviteToken.trim());

        if (!result.ok) {
          toast.error("Could not join organisation", {
            description: result.message,
          });
          return;
        }

        toast.success("You've joined the organisation!");
      } catch (err) {
        toast.error("Could not join organisation", {
          description: err instanceof Error ? err.message : "Something went wrong",
        });
      }
    });
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-8">
        {/* Logo / title */}
        <div className="text-center space-y-2">
          <h1 className="font-display text-4xl font-bold text-primary">House Points</h1>
          <p className="text-muted-foreground text-sm">
            Welcome, <strong>{userName}</strong>. Let&apos;s get you set up.
          </p>
        </div>

        {view === "pick" && (
          <div className="grid gap-4">
            <button
              onClick={() => setView("create")}
              className="flex items-start gap-4 p-5 rounded-xl border bg-card hover:border-primary/50 hover:bg-primary/5 transition-colors text-left"
            >
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Buildings size={22} className="text-primary" />
              </div>
              <div>
                <p className="font-semibold text-sm">Create a new organisation</p>
                <p className="text-muted-foreground text-xs mt-0.5">
                  Set up houses and invite your team. You&apos;ll become the owner.
                </p>
              </div>
            </button>

            <button
              onClick={() => setView("join")}
              className="flex items-start gap-4 p-5 rounded-xl border bg-card hover:border-primary/50 hover:bg-primary/5 transition-colors text-left"
            >
              <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
                <LinkSimple size={22} className="text-accent-foreground" />
              </div>
              <div>
                <p className="font-semibold text-sm">Join with an invite link</p>
                <p className="text-muted-foreground text-xs mt-0.5">
                  Someone shared a token with you. Paste it here to join their org.
                </p>
              </div>
            </button>

            <div className="text-center pt-2">
              <a href="/auth/logout" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                Sign out
              </a>
            </div>
          </div>
        )}

        {view === "create" && (
          <div className="rounded-xl border bg-card p-6 space-y-5">
            <div className="space-y-1">
              <h2 className="font-display text-lg font-semibold">Create organisation</h2>
              <p className="text-muted-foreground text-sm">You&apos;ll be the owner and can invite others after setup.</p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Organisation name</label>
              <input
                type="text"
                placeholder="Acme Corp"
                value={orgName}
                onChange={(e) => handleOrgNameChange(e.target.value)}
                className={cn(
                  "w-full rounded-lg border bg-background px-3 py-2.5 text-sm",
                  "focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
                )}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                URL slug
                <span className="ml-2 text-xs text-muted-foreground font-normal">
                  Lowercase letters, numbers and hyphens only
                </span>
              </label>
              <div className="flex items-center rounded-lg border bg-background overflow-hidden focus-within:ring-2 focus-within:ring-ring transition-colors">
                <span className="px-3 text-sm text-muted-foreground border-r bg-muted/50 py-2.5 select-none">
                  housepoints.app/
                </span>
                <input
                  type="text"
                  placeholder="acme-corp"
                  value={orgSlug}
                  onChange={(e) => handleSlugChange(e.target.value)}
                  className="flex-1 px-3 py-2.5 text-sm bg-transparent focus:outline-none"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Your first house</label>
              <p className="text-xs text-muted-foreground">
                You&apos;ll join this house as the organisation owner.
              </p>
              <div className="flex gap-3">
                <input
                  type="text"
                  placeholder="Phoenix"
                  value={firstHouseName}
                  onChange={(e) => setFirstHouseName(e.target.value)}
                  className={cn(
                    "min-w-0 flex-1 rounded-lg border bg-background px-3 py-2.5 text-sm",
                    "focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
                  )}
                />
                <input
                  type="color"
                  aria-label="First house color"
                  value={firstHouseColor}
                  onChange={(e) => setFirstHouseColor(e.target.value)}
                  className="h-11 w-14 cursor-pointer rounded-lg border bg-background p-1"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setView("pick")}
                className="flex-1 px-4 py-2 rounded-lg border text-sm hover:bg-muted transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleCreate}
                disabled={!orgName.trim() || !orgSlug || !firstHouseName.trim() || isPending}
                className={cn(
                  "flex-1 px-4 py-2 rounded-lg text-sm font-semibold transition-colors",
                  orgName.trim() && orgSlug && firstHouseName.trim() && !isPending
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "bg-muted text-muted-foreground cursor-not-allowed"
                )}
              >
                {isPending ? "Creating…" : "Create organisation"}
              </button>
            </div>
          </div>
        )}

        {view === "join" && (
          <div className="rounded-xl border bg-card p-6 space-y-5">
            <div className="space-y-1">
              <h2 className="font-display text-lg font-semibold">Join organisation</h2>
              <p className="text-muted-foreground text-sm">Paste the invite token an admin shared with you.</p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Invite token</label>
              <input
                type="text"
                placeholder="Paste your invite token here…"
                value={inviteToken}
                onChange={(e) => setInviteToken(e.target.value)}
                className={cn(
                  "w-full rounded-lg border bg-background px-3 py-2.5 text-sm font-mono",
                  "focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
                )}
              />
            </div>

            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setView("pick")}
                className="flex-1 px-4 py-2 rounded-lg border text-sm hover:bg-muted transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleJoin}
                disabled={!inviteToken.trim() || isPending}
                className={cn(
                  "flex-1 px-4 py-2 rounded-lg text-sm font-semibold transition-colors",
                  inviteToken.trim() && !isPending
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "bg-muted text-muted-foreground cursor-not-allowed"
                )}
              >
                {isPending ? "Joining…" : "Join organisation"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
