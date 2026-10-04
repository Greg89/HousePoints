import type { ReactNode } from "react";
import { PlatformNav } from "@/components/PlatformNav";

export default function PlatformLayout({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-background px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            HousePoints platform
          </p>
          <h1 className="mt-2 font-display text-3xl font-bold">Operator console</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Operate capacity, inspect organizations, and handle support and safety without changing organization context.
          </p>
        </div>
        <div className="lg:grid lg:grid-cols-[220px_1fr] lg:gap-6">
          <PlatformNav />
          <div className="min-w-0 space-y-6">{children}</div>
        </div>
      </div>
    </main>
  );
}
