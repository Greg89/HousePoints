import type { ReactNode } from "react";

interface ManageToolbarProps {
  label: string;
  children: ReactNode;
  secondary?: ReactNode;
  status?: ReactNode;
  error?: string | null;
  className?: string;
}

export function ManageToolbar({
  label,
  children,
  secondary,
  status,
  error,
  className = "",
}: ManageToolbarProps) {
  return (
    <section
      aria-label={label}
      className={`rounded-xl border bg-card p-3 ${className}`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-wrap gap-1">{children}</div>
        {secondary ? <div className="shrink-0">{secondary}</div> : null}
      </div>
      {status || error ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t pt-3 text-xs text-muted-foreground">
          <span>{status}</span>
          {error ? <span className="font-medium text-destructive">{error}</span> : null}
        </div>
      ) : null}
    </section>
  );
}
