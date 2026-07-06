"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CaretDown, Buildings } from "@phosphor-icons/react";
import type { AppUserOrganizationContext } from "@housepoints/contracts";
import { cn } from "@/lib/cn";

type OrganizationSwitcherProps = {
  organizationContexts: AppUserOrganizationContext[];
};

export function OrganizationSwitcher({ organizationContexts }: OrganizationSwitcherProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentOrganization = useMemo(
    () => organizationContexts.find((context) => context.isCurrent) ?? organizationContexts[0] ?? null,
    [organizationContexts],
  );
  const orderedContexts = useMemo(() => {
    const current = organizationContexts.find((context) => context.isCurrent);
    const others = organizationContexts.filter((context) => !context.isCurrent);
    return current ? [current, ...others] : organizationContexts;
  }, [organizationContexts]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  if (!currentOrganization) {
    return null;
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-label={`Current organization: ${currentOrganization.organizationName}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex max-w-[11.5rem] items-center gap-1.5 rounded-full border bg-card px-2.5 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/30 sm:max-w-[16rem] sm:gap-2 sm:px-3 sm:text-sm"
      >
        <Buildings size={14} className="text-primary" aria-hidden="true" />
        <span className="truncate">{currentOrganization.organizationName}</span>
        <CaretDown size={12} aria-hidden="true" />
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Switch organization"
          className="absolute right-0 z-40 mt-3 w-[min(calc(100vw-2rem),22rem)] rounded-2xl border bg-card p-3 shadow-xl shadow-primary/10"
        >
          <div className="mb-2 px-1">
            <h2 className="text-sm font-bold">Switch organization</h2>
            <p className="text-xs text-muted-foreground">
              Dashboard data and admin tools follow the active organization.
            </p>
          </div>
          <div className="space-y-2">
            {orderedContexts.slice(0, 5).map((context) => (
              <OrganizationSwitchLink key={context.organizationId} context={context} />
            ))}
            {orderedContexts.length > 5 ? (
              <a
                href="/settings#organisations"
                className="flex w-full items-center justify-center rounded-xl border border-dashed bg-card px-3 py-2 text-sm font-semibold text-primary transition-colors hover:bg-muted/70"
              >
                View all organisations ({orderedContexts.length - 5} more)
              </a>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function OrganizationSwitchLink({ context }: { context: AppUserOrganizationContext }) {
  const content = (
    <>
      <span className="min-w-0">
        <span className="block truncate font-semibold">{context.organizationName}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {formatRole(context.role)}
          {context.houseName ? `, ${context.houseName}` : ""}
        </span>
      </span>
      {context.isCurrent ? (
        <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-bold text-primary">
          Current
        </span>
      ) : null}
    </>
  );

  const className = cn(
    "flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left text-sm transition-colors",
    context.isCurrent
      ? "bg-primary/5 text-foreground"
      : "bg-card text-foreground hover:bg-muted/70",
  );

  if (context.isCurrent) {
    return (
      <span className={className} aria-current="page">
        {content}
      </span>
    );
  }

  return (
    <a className={className} href={`/o/${encodeURIComponent(context.organizationSlug)}/switch`}>
      {content}
    </a>
  );
}

function formatRole(role: AppUserOrganizationContext["role"]) {
  if (role === "OWNER") {
    return "Owner";
  }

  if (role === "ADMIN") {
    return "Admin";
  }

  return "Member";
}
