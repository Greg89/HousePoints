import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Buildings, Crown, LinkSimple, Warning } from "@phosphor-icons/react";
import { toast } from "sonner";
import type { OrgSettings } from "@housepoints/contracts";
import type { ArchiveOrganizationResult, OrgSettingsMutationResult, RoleChangeResult } from "@/lib/action-results";
import type { AdminUser } from "./AdminManageTypes";
import { ManageWorkspace } from "./ManageWorkspace";

interface OrgSettingsManagementProps {
  users: AdminUser[];
  organization: OrgSettings;
  onTransferOwnership: (formData: FormData) => Promise<RoleChangeResult>;
  onUpdateOrgSlug: (formData: FormData) => Promise<OrgSettingsMutationResult>;
  onUpdateOrgSettings: (formData: FormData) => Promise<OrgSettingsMutationResult>;
  onArchiveOrganization: (formData: FormData) => Promise<ArchiveOrganizationResult>;
}

export function OrgSettingsManagement({
  users,
  organization,
  onTransferOwnership,
  onUpdateOrgSlug,
  onUpdateOrgSettings,
  onArchiveOrganization,
}: OrgSettingsManagementProps) {
  const router = useRouter();
  const [isNamePending, startNameTransition] = useTransition();
  const [isSlugPending, startSlugTransition] = useTransition();
  const [isOwnerPending, startOwnerTransition] = useTransition();
  const [isArchivePending, startArchiveTransition] = useTransition();
  const [pendingTransferId, setPendingTransferId] = useState<string | null>(null);
  const [archiveConfirmation, setArchiveConfirmation] = useState("");
  const ownerCandidates = users.filter((user) => user.role !== "OWNER");
  const canArchive = archiveConfirmation.trim() === organization.slug;
  const pendingTransferName = pendingTransferId
    ? (users.find((u) => u.id === pendingTransferId)?.displayName ?? null)
    : null;

  function handleNameSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const nextName = String(formData.get("name") ?? "").trim();

    startNameTransition(async () => {
      try {
        const result = await onUpdateOrgSettings(formData);

        if (!result.ok) {
          toast.error("Failed to update organization", {
            description: result.message,
          });
          return;
        }

        toast.success("Organization updated", {
          description: nextName,
        });
      } catch (err) {
        toast.error("Failed to update organization", {
          description: err instanceof Error ? err.message : "Something went wrong",
        });
      }
    });
  }

  function handleSlugSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const nextSlug = String(formData.get("slug") ?? "").trim();
    const confirmation = String(formData.get("confirmation") ?? "").trim();

    if (confirmation !== organization.slug) {
      toast.error("Slug confirmation does not match", {
        description: `Type ${organization.slug} to confirm this change.`,
      });
      return;
    }

    startSlugTransition(async () => {
      try {
        const result = await onUpdateOrgSlug(formData);

        if (!result.ok) {
          toast.error("Failed to update organization slug", {
            description: result.message,
          });
          return;
        }

        toast.success("Organization slug updated", {
          description: nextSlug,
        });
        form.reset();
      } catch (err) {
        toast.error("Failed to update organization slug", {
          description: err instanceof Error ? err.message : "Something went wrong",
        });
      }
    });
  }

  function handleOwnerSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const targetUserId = String(formData.get("targetUserId") ?? "").trim();
    const confirmation = String(formData.get("confirmation") ?? "").trim();
    const targetUser = users.find((user) => user.id === targetUserId);

    if (!targetUser) {
      toast.error("Choose a new owner", {
        description: "Select a member before transferring ownership.",
      });
      return;
    }

    if (confirmation !== "TRANSFER") {
      toast.error("Ownership confirmation does not match", {
        description: "Type TRANSFER to confirm this change.",
      });
      return;
    }

    setPendingTransferId(targetUserId);
  }

  function confirmOwnerTransfer() {
    if (!pendingTransferId) return;
    const userId = pendingTransferId;
    const targetUser = users.find((u) => u.id === userId);
    setPendingTransferId(null);
    const formData = new FormData();
    formData.set("targetUserId", userId);
    formData.set("confirmation", "TRANSFER");
    startOwnerTransition(async () => {
      try {
        const result = await onTransferOwnership(formData);

        if (!result.ok) {
          toast.error("Failed to transfer ownership", {
            description: result.message,
          });
          return;
        }

        toast.success("Ownership transferred", {
          description: `${targetUser?.displayName} is now the organization owner.`,
        });
      } catch (err) {
        toast.error("Failed to transfer ownership", {
          description: err instanceof Error ? err.message : "Something went wrong",
        });
      }
    });
  }

  function handleArchiveSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const confirmation = String(formData.get("confirmation") ?? "").trim();

    if (confirmation !== organization.slug) {
      toast.error("Archive confirmation does not match", {
        description: `Type ${organization.slug} to archive this organization.`,
      });
      return;
    }

    startArchiveTransition(async () => {
      try {
        const result = await onArchiveOrganization(formData);

        if (!result.ok) {
          toast.error("Failed to archive organization", {
            description: result.message,
          });
          return;
        }

        toast.success("Organization archived", {
          description: "Opening the archived organization page.",
        });
        form.reset();
        setArchiveConfirmation("");
        router.replace(result.redirectTo);
      } catch (err) {
        toast.error("Failed to archive organization", {
          description: err instanceof Error ? err.message : "Something went wrong",
        });
      }
    });
  }

  return (
    <ManageWorkspace
      id="organization"
      title="Organization"
      description="Manage your organization identity, URL, ownership, and lifecycle."
      className="space-y-8"
    >
      <form
        aria-label="Organization settings"
        onSubmit={handleNameSubmit}
        className="grid max-w-xl gap-4 border-b pb-8"
      >
        <div>
          <h3 className="flex items-center gap-2 font-display text-lg font-semibold">
            <Buildings size={16} />
            Organization identity
          </h3>
          <p className="mt-2 text-xs text-muted-foreground">
            Rename the organization without changing its URL slug or membership.
          </p>
        </div>

        <label className="grid gap-1.5 text-xs font-semibold text-muted-foreground">
          Organization name
          <input
            name="name"
            defaultValue={organization.name}
            minLength={2}
            maxLength={80}
            required
            className="h-10 rounded-lg border bg-background px-3 text-sm font-normal text-foreground focus:outline-none"
          />
        </label>

        <div className="grid gap-1.5 text-xs font-semibold text-muted-foreground">
          Organization slug
          <div className="h-10 rounded-lg border bg-muted/40 px-3 py-2 text-sm font-normal text-muted-foreground">
            {organization.slug}
          </div>
          <p className="text-xs font-normal text-muted-foreground">
            Use the slug form in the Danger Zone below for link-related changes.
          </p>
        </div>

        <button
          type="submit"
          disabled={isNamePending}
          className="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {isNamePending ? "Saving..." : "Save organization"}
        </button>
      </form>

      <div className="max-w-xl divide-y">
        <div>
          <h3 className="flex items-center gap-2 font-display text-lg font-semibold">
            <LinkSimple size={16} />
            URL and slug
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Control the URL-safe identifier used by organization and invite links.
          </p>
        </div>

        <form
          aria-label="Organization slug"
          onSubmit={handleSlugSubmit}
          className="grid gap-4 py-6"
        >
          <div>
            <p className="mt-2 text-xs text-muted-foreground">
              Change the URL-safe identifier that will appear in future organization links and invite URLs.
            </p>
          </div>

          <div className="grid gap-1.5 text-xs font-semibold text-muted-foreground">
            Current slug
            <div className="h-10 rounded-lg border bg-muted/40 px-3 py-2 text-sm font-normal text-muted-foreground">
              {organization.slug}
            </div>
            <p className="text-xs font-normal text-muted-foreground">
              Previous slugs stay reserved so old links cannot be claimed by another organization.
            </p>
          </div>

          <label htmlFor="organization-new-slug" className="grid gap-1.5 text-xs font-semibold text-muted-foreground">
            New slug
            <input
              id="organization-new-slug"
              name="slug"
              placeholder="acme-corp"
              minLength={2}
              maxLength={60}
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              required
              className="h-10 rounded-lg border bg-background px-3 text-sm font-normal text-foreground focus:outline-none"
            />
          </label>

          <div className="grid gap-1.5">
            <label htmlFor="organization-slug-confirmation" className="text-xs font-semibold text-muted-foreground">
              Confirm current slug
            </label>
            <input
              id="organization-slug-confirmation"
              name="confirmation"
              placeholder={organization.slug}
              required
              className="h-10 rounded-lg border bg-background px-3 text-sm font-normal text-foreground focus:outline-none"
            />
            <span className="text-xs font-normal text-muted-foreground">
              Type <span className="font-mono">{organization.slug}</span> to confirm.
            </span>
          </div>

          <button
            type="submit"
            disabled={isSlugPending}
            className="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {isSlugPending ? "Saving slug..." : "Change organization slug"}
          </button>
        </form>

        <form
          aria-label="Transfer ownership"
          onSubmit={handleOwnerSubmit}
          className="grid gap-4 py-6"
        >
          <div>
            <h3 className="flex items-center gap-2 font-display text-lg font-semibold">
              <Crown size={16} />
              Ownership
            </h3>
            <p className="mt-2 text-xs text-muted-foreground">
              Move organization ownership to another member. Your account will become an admin after the transfer.
            </p>
          </div>

          <label htmlFor="organization-new-owner" className="grid gap-1.5 text-xs font-semibold text-muted-foreground">
            New owner
            <select
              id="organization-new-owner"
              name="targetUserId"
              required
              defaultValue=""
              disabled={ownerCandidates.length === 0}
              className="h-10 rounded-lg border bg-background px-3 text-sm font-normal text-foreground focus:outline-none disabled:opacity-60"
            >
              <option value="" disabled>
                {ownerCandidates.length > 0 ? "Select member..." : "No members eligible"}
              </option>
              {ownerCandidates.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.displayName} ({user.role.toLowerCase()})
                </option>
              ))}
            </select>
          </label>

          <div className="grid gap-1.5">
            <label htmlFor="organization-owner-confirmation" className="text-xs font-semibold text-muted-foreground">
              Confirm transfer
            </label>
            <input
              id="organization-owner-confirmation"
              name="confirmation"
              placeholder="TRANSFER"
              required
              className="h-10 rounded-lg border bg-background px-3 text-sm font-normal text-foreground focus:outline-none"
            />
            <span className="text-xs font-normal text-muted-foreground">
              Type <span className="font-mono">TRANSFER</span> to confirm.
            </span>
          </div>

          {pendingTransferName ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 space-y-2">
              <p className="text-sm font-semibold text-destructive">
                Transfer ownership to {pendingTransferName}?
              </p>
              <p className="text-xs text-muted-foreground">
                You will become an admin after this change.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={confirmOwnerTransfer}
                  disabled={isOwnerPending}
                  className="h-8 rounded-lg bg-destructive px-3 text-xs font-semibold text-destructive-foreground transition-colors hover:bg-destructive/90 disabled:opacity-50"
                >
                  Confirm
                </button>
                <button
                  type="button"
                  onClick={() => setPendingTransferId(null)}
                  className="h-8 rounded-lg border px-3 text-xs font-semibold transition-colors hover:bg-muted"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              type="submit"
              disabled={isOwnerPending || ownerCandidates.length === 0}
              className="h-10 rounded-lg border border-destructive/30 px-4 text-sm font-semibold text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
            >
              {isOwnerPending ? "Transferring..." : "Transfer ownership"}
            </button>
          )}
        </form>

        <form
          aria-label="Archive organization"
          onSubmit={handleArchiveSubmit}
          className="mt-2 grid gap-4 rounded-xl border border-destructive/30 bg-destructive/5 p-5"
        >
          <div>
            <h3 className="flex items-center gap-2 font-display text-lg font-semibold text-destructive">
              <Warning size={16} />
              Danger zone
            </h3>
            <p className="mt-2 text-xs text-muted-foreground">
              Archive this organization for every member. Historical records stay preserved, but the
              organization will no longer appear as an active workspace.
            </p>
          </div>

          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-muted-foreground">
            This is a soft delete. Data is retained for audit and future recovery work, but users
            cannot continue using the archived organization.
          </div>

          <div className="grid gap-1.5">
            <label htmlFor="organization-archive-confirmation" className="text-xs font-semibold text-muted-foreground">
              Confirm archive
            </label>
            <input
              id="organization-archive-confirmation"
              name="confirmation"
              value={archiveConfirmation}
              onChange={(event) => setArchiveConfirmation(event.target.value)}
              placeholder={organization.slug}
              required
              className="h-10 rounded-lg border bg-background px-3 text-sm font-normal text-foreground focus:outline-none"
            />
            <span className="text-xs font-normal text-muted-foreground">
              Type <span className="font-mono">{organization.slug}</span> to confirm.
            </span>
          </div>

          <button
            type="submit"
            disabled={isArchivePending || !canArchive}
            className="h-10 rounded-lg bg-destructive px-4 text-sm font-semibold text-destructive-foreground transition-colors hover:bg-destructive/90 disabled:opacity-50"
          >
            {isArchivePending ? "Archiving..." : "Archive organization"}
          </button>
        </form>
      </div>
    </ManageWorkspace>
  );
}
