"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ChartBar,
  Flag,
  Lifebuoy,
  MagnifyingGlass,
  Trash,
} from "@phosphor-icons/react";

type PlatformSectionId =
  | "overview"
  | "users"
  | "account-deletions"
  | "support-cases"
  | "moderation";

interface PlatformSection {
  id: PlatformSectionId;
  label: string;
  href: string;
  icon: typeof ChartBar;
  matches: (pathname: string) => boolean;
}

const PLATFORM_SECTIONS: PlatformSection[] = [
  {
    id: "overview",
    label: "Overview",
    href: "/platform",
    icon: ChartBar,
    matches: (pathname) => pathname === "/platform" || pathname.startsWith("/platform/organizations"),
  },
  {
    id: "users",
    label: "Users",
    href: "/platform/users",
    icon: MagnifyingGlass,
    matches: (pathname) => pathname.startsWith("/platform/users"),
  },
  {
    id: "account-deletions",
    label: "Account deletions",
    href: "/platform/account-deletions",
    icon: Trash,
    matches: (pathname) => pathname.startsWith("/platform/account-deletions"),
  },
  {
    id: "support-cases",
    label: "Support cases",
    href: "/platform/support-cases",
    icon: Lifebuoy,
    matches: (pathname) => pathname.startsWith("/platform/support-cases"),
  },
  {
    id: "moderation",
    label: "Moderation",
    href: "/platform/moderation",
    icon: Flag,
    matches: (pathname) => pathname.startsWith("/platform/moderation"),
  },
];

export function PlatformNav() {
  const pathname = usePathname() ?? "/platform";
  const router = useRouter();
  const activeSection =
    PLATFORM_SECTIONS.find((section) => section.matches(pathname))?.id ?? "overview";

  return (
    <>
      <aside className="hidden lg:block">
        <nav aria-label="Platform sections">
          <ul className="space-y-1">
            {PLATFORM_SECTIONS.map((section) => {
              const isActive = section.id === activeSection;
              const Icon = section.icon;
              return (
                <li key={section.id}>
                  <Link
                    href={section.href}
                    aria-current={isActive ? "page" : undefined}
                    className={`block w-full rounded-xl px-3 py-2.5 text-left transition-colors ${
                      isActive
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-foreground hover:bg-muted/60"
                    }`}
                  >
                    <span className="flex items-center gap-2.5 text-sm font-semibold">
                      <Icon size={15} aria-hidden="true" />
                      <span className="flex-1">{section.label}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>

      <div className="lg:hidden">
        <label className="sr-only" htmlFor="platform-section-picker">
          Platform sections
        </label>
        <select
          id="platform-section-picker"
          aria-label="Platform sections"
          value={activeSection}
          onChange={(event) => {
            const next = PLATFORM_SECTIONS.find((section) => section.id === event.target.value);
            if (next) router.push(next.href);
          }}
          className="w-full rounded-xl border bg-card px-3 py-2 text-sm font-medium focus:outline-none"
        >
          {PLATFORM_SECTIONS.map((section) => (
            <option key={section.id} value={section.id}>
              {section.label}
            </option>
          ))}
        </select>
      </div>
    </>
  );
}
