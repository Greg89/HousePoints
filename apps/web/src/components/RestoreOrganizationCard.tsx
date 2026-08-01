"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { RestoreOrganizationResult } from "@/lib/action-results";

type RestoreOrganizationCardProps = {
  organizationName: string;
  organizationSlug: string;
  onRestoreOrganization: (formData: FormData) => Promise<RestoreOrganizationResult>;
};

export function RestoreOrganizationCard({
  organizationName,
  organizationSlug,
  onRestoreOrganization,
}: RestoreOrganizationCardProps) {
  const router = useRouter();
  const [confirmation, setConfirmation] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    if (confirmation.trim() !== organizationSlug) {
      toast.error("Restore confirmation does not match", {
        description: `Type ${organizationSlug} to restore this organization.`,
      });
      return;
    }

    startTransition(async () => {
      try {
        const result = await onRestoreOrganization(formData);

        if (!result.ok) {
          toast.error("Failed to restore organization", {
            description: result.message,
          });
          return;
        }

        toast.success("Organization restored", {
          description: "Opening the restored dashboard.",
        });
        router.replace(result.redirectTo);
      } catch (error) {
        toast.error("Failed to restore organization", {
          description: error instanceof Error ? error.message : "Something went wrong",
        });
      }
    });
  }

  return (
    <form
      aria-label={`Restore ${organizationName}`}
      onSubmit={handleSubmit}
      className="mt-6 grid gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4 text-left"
    >
      <div>
        <h2 className="font-display text-base font-semibold">Restore organization</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Restoring re-enables the dashboard and normal organization activity. Type{" "}
          <strong className="font-semibold text-foreground">{organizationSlug}</strong> to confirm.
        </p>
      </div>
      <input type="hidden" name="slug" value={organizationSlug} />
      <label className="grid gap-1.5 text-xs font-semibold text-muted-foreground">
        Organization slug
        <input
          name="confirmation"
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          autoComplete="off"
          required
          className="h-10 rounded-lg border bg-background px-3 text-sm font-normal text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </label>
      <button
        type="submit"
        disabled={isPending || confirmation.trim() !== organizationSlug}
        className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? "Restoring..." : "Restore organization"}
      </button>
    </form>
  );
}
