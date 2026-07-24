import type { ReactNode } from "react";

interface ManageEmptyStateProps {
  title: string;
  description: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
  compact?: boolean;
}

export function ManageEmptyState({
  title,
  description,
  icon,
  action,
  className = "",
  compact = false,
}: ManageEmptyStateProps) {
  return (
    <section
      aria-label={title}
      className={`rounded-xl border border-dashed bg-card text-center ${
        compact ? "px-4 py-6" : "px-6 py-10"
      } ${className}`}
    >
      {icon ? (
        <div className="mx-auto flex w-fit text-muted-foreground" aria-hidden="true">
          {icon}
        </div>
      ) : null}
      <h3 className={`${icon ? "mt-3" : ""} text-sm font-semibold`}>{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </section>
  );
}
