import type { ReactNode } from "react";

interface ManageWorkspaceProps {
  id: string;
  title: string;
  description: string;
  count?: number;
  action?: ReactNode;
  children: ReactNode;
  ariaLabel?: string;
  className?: string;
}

export function ManageWorkspace({
  id,
  title,
  description,
  count,
  action,
  children,
  ariaLabel,
  className = "space-y-6",
}: ManageWorkspaceProps) {
  const headingId = `manage-workspace-${id}-heading`;

  return (
    <section
      className={className}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabel ? undefined : headingId}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 id={headingId} className="font-display text-2xl font-semibold">
              {title}
            </h2>
            {count !== undefined ? (
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                {count}
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
