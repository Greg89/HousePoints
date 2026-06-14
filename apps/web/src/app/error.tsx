"use client";

import { ArrowCounterClockwise } from "@phosphor-icons/react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="text-center space-y-4 max-w-sm">
        <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
          <span className="text-3xl">⚠️</span>
        </div>
        <h1 className="font-display text-2xl font-semibold text-destructive">
          Something went wrong
        </h1>
        <p className="text-muted-foreground text-sm leading-relaxed">
          {error.message ?? "An unexpected error occurred. Please try again."}
        </p>
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
        >
          <ArrowCounterClockwise size={16} />
          Try again
        </button>
        <div>
          <a href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}
