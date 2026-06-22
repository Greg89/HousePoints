"use client";

import { useState, useTransition } from "react";
import { Check, Palette, Warning } from "@phosphor-icons/react";
import type { ProfileUpdateResult } from "@/lib/action-results";
import { cn } from "@/lib/cn";

interface HouseThemeToggleFormProps {
  enabled: boolean;
  houseName: string | null;
  houseColor: string | null;
  onSave: (enabled: boolean) => Promise<ProfileUpdateResult>;
}

export function HouseThemeToggleForm({
  enabled,
  houseName,
  houseColor,
  onSave,
}: HouseThemeToggleFormProps) {
  const [value, setValue] = useState(enabled);
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const canUseHouseTheme = Boolean(houseName && houseColor);

  function handleToggle() {
    if (!canUseHouseTheme || isPending) {
      return;
    }

    const nextValue = !value;
    setValue(nextValue);
    setStatus("idle");

    startTransition(async () => {
      try {
        const result = await onSave(nextValue);

        if (!result.ok) {
          setValue(!nextValue);
          setStatus("error");
          setErrorMsg(result.message);
          return;
        }

        setStatus("success");
      } catch (err) {
        setValue(!nextValue);
        setStatus("error");
        setErrorMsg(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  return (
    <section className="space-y-4 rounded-xl border bg-background/60 p-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-lg bg-primary/10 p-2 text-primary">
          <Palette size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold">House theme</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Use your assigned house color for buttons, tabs, focus rings, and app accents.
          </p>
          {houseName && houseColor ? (
            <p className="mt-3 inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: houseColor }}
              />
              {houseName}
            </p>
          ) : (
            <p className="mt-3 rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              A house assignment is required before you can enable a house theme.
            </p>
          )}
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={value}
          disabled={!canUseHouseTheme || isPending}
          onClick={handleToggle}
          className={cn(
            "relative inline-flex h-7 w-12 flex-shrink-0 items-center rounded-full border transition-colors focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
            value ? "border-primary bg-primary" : "border-border bg-muted",
          )}
        >
          <span
            className={cn(
              "inline-block h-5 w-5 rounded-full bg-background shadow-sm transition-transform",
              value ? "translate-x-5" : "translate-x-1",
            )}
          />
        </button>
      </div>

      {status === "error" ? (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <Warning size={16} weight="fill" />
          {errorMsg}
        </div>
      ) : null}

      {status === "success" ? (
        <div className="flex items-center gap-2 rounded-lg border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-800">
          <Check size={16} weight="bold" />
          House theme preference saved.
        </div>
      ) : null}
    </section>
  );
}
