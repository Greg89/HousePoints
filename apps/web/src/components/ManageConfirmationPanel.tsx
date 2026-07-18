import type { ReactNode } from "react";

interface ManageConfirmationPanelProps {
  title: ReactNode;
  description: ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel?: string;
  pendingLabel?: string;
  pending?: boolean;
  tone?: "warning" | "destructive";
}

export function ManageConfirmationPanel({
  title,
  description,
  onConfirm,
  onCancel,
  confirmLabel = "Confirm",
  pendingLabel = "Working...",
  pending = false,
  tone = "warning",
}: ManageConfirmationPanelProps) {
  const destructive = tone === "destructive";

  return (
    <section
      aria-label="Confirmation required"
      className={
        destructive
          ? "space-y-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3"
          : "space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3"
      }
    >
      <p className={destructive ? "text-sm font-semibold text-destructive" : "text-sm font-semibold text-amber-900"}>
        {title}
      </p>
      <p className={destructive ? "text-xs text-muted-foreground" : "text-xs text-amber-700"}>
        {description}
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onConfirm}
          disabled={pending}
          className={
            destructive
              ? "h-8 rounded-lg bg-destructive px-3 text-xs font-semibold text-destructive-foreground transition-colors hover:bg-destructive/90 disabled:opacity-50"
              : "h-8 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground disabled:opacity-50"
          }
        >
          {pending ? pendingLabel : confirmLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={pending}
          className="h-8 rounded-lg border px-3 text-xs font-semibold transition-colors hover:bg-muted disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </section>
  );
}
