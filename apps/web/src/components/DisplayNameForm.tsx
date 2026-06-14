"use client";

import { useState, useTransition } from "react";
import { motion } from "framer-motion";
import { Check, Warning } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";

interface DisplayNameFormProps {
  currentName: string;
  onSave: (name: string) => Promise<void>;
}

export function DisplayNameForm({ currentName, onSave }: DisplayNameFormProps) {
  const [value, setValue] = useState(currentName);
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const isDirty = value.trim() !== currentName;
  const isValid = value.trim().length >= 1 && value.trim().length <= 120;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isDirty || !isValid) return;
    setStatus("idle");
    startTransition(async () => {
      try {
        await onSave(value.trim());
        setStatus("success");
      } catch (err) {
        setStatus("error");
        setErrorMsg(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="displayName" className="text-sm font-medium block">
          Display Name
        </label>
        <input
          id="displayName"
          type="text"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setStatus("idle");
          }}
          maxLength={120}
          placeholder="Your name"
          className={cn(
            "w-full rounded-lg border bg-background px-3 py-2.5 text-sm",
            "focus:outline-none focus:ring-2 focus:ring-ring transition-colors",
            status === "error" && "border-destructive focus:ring-destructive"
          )}
        />
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            This is how your name appears to your team.
          </p>
          <p className="text-xs text-muted-foreground">
            {value.length}/120
          </p>
        </div>
      </div>

      {status === "error" && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <Warning size={16} weight="fill" />
          {errorMsg}
        </div>
      )}

      {status === "success" && (
        <div className="flex items-center gap-2 rounded-lg border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-800">
          <Check size={16} weight="bold" />
          Display name updated successfully.
        </div>
      )}

      <motion.button
        type="submit"
        whileHover={{ scale: isDirty && isValid ? 1.01 : 1 }}
        whileTap={{ scale: isDirty && isValid ? 0.99 : 1 }}
        disabled={!isDirty || !isValid || isPending}
        className={cn(
          "px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors",
          isDirty && isValid && !isPending
            ? "bg-primary text-primary-foreground hover:bg-primary/90"
            : "bg-muted text-muted-foreground cursor-not-allowed"
        )}
      >
        {isPending ? "Saving…" : "Save Changes"}
      </motion.button>
    </form>
  );
}
