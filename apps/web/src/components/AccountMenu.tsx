"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowSquareOut,
  Gear,
  Megaphone,
  SignOut,
  User,
} from "@phosphor-icons/react";
import type { AppUserOrganizationContext } from "@housepoints/contracts";

type AccountMenuProps = {
  session: {
    userName: string;
    role: "MEMBER" | "ADMIN" | "OWNER";
    organizationContexts: AppUserOrganizationContext[];
  };
  releaseNotesUrl?: string | null;
  logoutUrl: string;
};

export function AccountMenu({
  session,
  releaseNotesUrl,
  logoutUrl,
}: AccountMenuProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const currentOrganization = session.organizationContexts.find((context) => context.isCurrent) ?? null;

  useEffect(() => {
    if (!open) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      const firstFocusable = panelRef.current?.querySelector<HTMLElement>(
        "a[href], button:not([disabled]), [tabindex]:not([tabindex='-1'])",
      );
      firstFocusable?.focus();
    });

    return () => cancelAnimationFrame(frame);
  }, [open]);

  function closeMenu() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        closeMenu();
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeMenu();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={menuRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-label="Account menu"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="account-menu-dialog"
        onClick={() => setOpen((current) => !current)}
        className="relative flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-primary transition-colors hover:bg-primary/25 focus:outline-none focus:ring-2 focus:ring-primary/30"
      >
        <User size={17} aria-hidden="true" />
      </button>

      {open ? (
        <div
          id="account-menu-dialog"
          ref={panelRef}
          role="dialog"
          aria-label="Account"
          tabIndex={-1}
          className="absolute right-0 z-40 mt-3 flex w-[min(calc(100vw-2rem),20rem)] flex-col overflow-hidden rounded-2xl border bg-card shadow-xl shadow-primary/10"
        >
          <div className="shrink-0 border-b p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Signed in
            </p>
            <p
              data-testid="account-menu-user-name"
              className="mt-1 font-display text-lg font-semibold leading-tight"
            >
              {session.userName}
            </p>
            <p className="mt-1 text-xs font-medium text-muted-foreground">{formatRole(session.role)}</p>
            {currentOrganization ? (
              <p className="mt-2 text-xs font-semibold text-primary">
                {currentOrganization.organizationName}
              </p>
            ) : null}
          </div>

          <div className="shrink-0 space-y-2 border-t bg-muted/20 p-3">
            <a
              href="/settings"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border bg-card px-3 py-2 text-sm font-semibold transition-colors hover:bg-muted/70"
            >
              <Gear size={16} aria-hidden="true" />
              Account settings
            </a>
            {isExternalHttpsHref(releaseNotesUrl ?? null) ? (
              <a
                href={releaseNotesUrl ?? undefined}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-2 rounded-xl border bg-card px-3 py-2 text-sm font-semibold transition-colors hover:bg-muted/70"
              >
                <Megaphone size={16} aria-hidden="true" />
                What&apos;s New
                <ArrowSquareOut size={13} aria-hidden="true" />
              </a>
            ) : null}
            <a
              href={logoutUrl}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border bg-card px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
            >
              <SignOut size={16} aria-hidden="true" />
              Sign out
            </a>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function isExternalHttpsHref(href: string | null) {
  if (!href) {
    return false;
  }

  try {
    return new URL(href).protocol === "https:";
  } catch {
    return false;
  }
}

function formatRole(role: AccountMenuProps["session"]["role"]) {
  if (role === "OWNER") {
    return "Owner";
  }

  if (role === "ADMIN") {
    return "Admin";
  }

  return "Member";
}
