import type { ReactNode } from "react";

interface ManageResourceListProps {
  children: ReactNode;
  label?: string;
  header?: ReactNode;
  className?: string;
}

export function ManageResourceList({
  children,
  label,
  header,
  className = "",
}: ManageResourceListProps) {
  return (
    <section
      aria-label={label}
      className={`overflow-hidden rounded-xl border bg-card ${className}`}
    >
      {header ? <div className="border-b bg-muted/30">{header}</div> : null}
      <div className="divide-y">{children}</div>
    </section>
  );
}
