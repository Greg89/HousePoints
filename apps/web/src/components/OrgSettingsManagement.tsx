import { useTransition, type FormEvent } from "react";
import { Buildings } from "@phosphor-icons/react";
import { toast } from "sonner";
import type { OrgSettings } from "@housepoints/contracts";
import type { OrgSettingsMutationResult } from "@/lib/action-results";

interface OrgSettingsManagementProps {
  organization: OrgSettings;
  onUpdateOrgSlug: (formData: FormData) => Promise<OrgSettingsMutationResult>;
  onUpdateOrgSettings: (formData: FormData) => Promise<OrgSettingsMutationResult>;
}

export function OrgSettingsManagement({
  organization,
  onUpdateOrgSlug,
  onUpdateOrgSettings,
}: OrgSettingsManagementProps) {
  const [isNamePending, startNameTransition] = useTransition();
  const [isSlugPending, startSlugTransition] = useTransition();

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

  return (
    <section className="space-y-6">
      <div>
        <h4 className="font-display text-lg font-semibold">Organization Settings</h4>
        <p className="text-sm text-muted-foreground">
          Update the organization details shown throughout House Points and future invite links.
        </p>
      </div>

      <form
        aria-label="Organization settings"
        onSubmit={handleNameSubmit}
        className="grid max-w-xl gap-4 rounded-xl border bg-card p-5"
      >
        <div>
          <h5 className="flex items-center gap-2 text-sm font-semibold">
            <Buildings size={16} />
            Organization Details
          </h5>
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
            Use the separate slug form below for link-related changes.
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

      <form
        aria-label="Organization slug"
        onSubmit={handleSlugSubmit}
        className="grid max-w-xl gap-4 rounded-xl border bg-card p-5"
      >
        <div>
          <h5 className="flex items-center gap-2 text-sm font-semibold">
            <Buildings size={16} />
            Organization Slug
          </h5>
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
    </section>
  );
}
