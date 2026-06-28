import { useTransition, type FormEvent } from "react";
import { Buildings } from "@phosphor-icons/react";
import { toast } from "sonner";
import type { OrgSettings } from "@housepoints/contracts";
import type { OrgSettingsMutationResult } from "@/lib/action-results";

interface OrgSettingsManagementProps {
  organization: OrgSettings;
  onUpdateOrgSettings: (formData: FormData) => Promise<OrgSettingsMutationResult>;
}

export function OrgSettingsManagement({
  organization,
  onUpdateOrgSettings,
}: OrgSettingsManagementProps) {
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const nextName = String(formData.get("name") ?? "").trim();

    startTransition(async () => {
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

  return (
    <section className="space-y-6">
      <div>
        <h4 className="font-display text-lg font-semibold">Organization Settings</h4>
        <p className="text-sm text-muted-foreground">
          Update the organization details shown throughout House Points.
        </p>
      </div>

      <form
        aria-label="Organization settings"
        onSubmit={handleSubmit}
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
            Slug changes are intentionally deferred because they affect links and future invite policies.
          </p>
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {isPending ? "Saving..." : "Save organization"}
        </button>
      </form>
    </section>
  );
}
