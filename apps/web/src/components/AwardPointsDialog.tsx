"use client";

import { useState, useTransition } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import * as Select from "@radix-ui/react-select";
import { Star, CaretDown, Check, Info, X } from "@phosphor-icons/react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import type { OrgMember, LeaderboardEntry, Trait } from "@housepoints/contracts";
import { TRAITS, TRAIT_LABELS } from "@housepoints/contracts";
import { cn } from "@/lib/cn";
import type { AwardPointsResult } from "@/lib/action-results";
import { MemberCombobox } from "./MemberCombobox";

interface AwardPointsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** All org members – shown as targets */
  members: OrgMember[];
  /** Houses available for display context only */
  houses: LeaderboardEntry[];
  /** Server action to submit the award */
  onAward: (targetUserId: string, delta: number, reason: string, trait: Trait) => Promise<AwardPointsResult>;
}

const QUICK_AMOUNTS = [5, 10, 25, 50];

export function AwardPointsDialog({
  open,
  onOpenChange,
  members,
  onAward,
}: AwardPointsDialogProps) {
  const [targetUserId, setTargetUserId] = useState("");
  const [delta, setDelta] = useState("");
  const [reason, setReason] = useState("");
  const [trait, setTrait] = useState<Trait | "">("");
  const [isPending, startTransition] = useTransition();

  const selectedMember = members.find((m) => m.id === targetUserId);

  function reset() {
    setTargetUserId("");
    setDelta("");
    setReason("");
    setTrait("");
  }

  function handleClose(value: boolean) {
    if (!value) reset();
    onOpenChange(value);
  }

  const deltaNum = Number(delta);
  const hasValidDelta =
    delta !== "" &&
    Number.isInteger(deltaNum) &&
    deltaNum >= 1 &&
    deltaNum <= 100;
  const hasValidReason = reason.trim().length >= 3 && reason.length <= 240;
  const canSubmit =
    !!targetUserId &&
    hasValidDelta &&
    hasValidReason &&
    !!trait;

  const pointsError =
    delta === ""
      ? null
      : !Number.isFinite(deltaNum) || !Number.isInteger(deltaNum)
        ? "Enter a whole number of points."
        : deltaNum < 1
          ? "Points must be at least 1."
          : deltaNum > 100
            ? "Points cannot exceed 100."
            : null;
  const noteError =
    reason.length > 0 && reason.trim().length < 3
      ? "Add at least 3 characters."
      : reason.length > 240
        ? "Keep the note to 240 characters or fewer."
        : null;

  const remainingRequirements = [
    !targetUserId ? "select a recipient" : null,
    !hasValidDelta ? "enter 1–100 whole points" : null,
    !trait ? "select a trait" : null,
    !hasValidReason ? "add a note (3–240 characters)" : null,
  ].filter((requirement): requirement is string => requirement !== null);

  function handleSubmit() {
    if (!canSubmit) return;
    startTransition(async () => {
      try {
        const result = await onAward(targetUserId, deltaNum, reason, trait as Trait);

        if (!result.ok) {
          toast.error("Failed to award points", {
            description: result.message,
          });
          return;
        }

        toast.success("Points awarded!", {
          description: `+${deltaNum} pts to ${selectedMember?.displayName}`,
        });
        reset();
        onOpenChange(false);
      } catch (err) {
        toast.error("Failed to award points", {
          description: err instanceof Error ? err.message : "Something went wrong",
        });
      }
    });
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-40" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg z-50 rounded-2xl border bg-card p-6 shadow-2xl"
        >
          <div className="flex items-start justify-between mb-6">
            <div>
              <Dialog.Title className="font-display text-2xl font-semibold flex items-center gap-2">
                <Star weight="fill" className="text-yellow-500" size={24} />
                Award Points
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-muted-foreground">
                Recognize a house for their great work
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button className="rounded-lg p-1 hover:bg-muted transition-colors" aria-label="Close">
                <X size={20} />
              </button>
            </Dialog.Close>
          </div>

          <div className="space-y-5">
            {/* Member selector */}
            <MemberCombobox
              label="Recipient"
              members={members.filter((m) => m.houseId)}
              value={targetUserId}
              onValueChange={setTargetUserId}
              placeholder="Select a team member..."
              emptyMessage="No assigned members found."
            />

            {/* Points input */}
            <div className="space-y-2">
              <label htmlFor="award-points-delta" className="text-sm font-medium">
                Points (1–100) <span className="text-destructive" aria-hidden="true">*</span>
              </label>
              <div className="flex gap-2 flex-wrap mb-2">
                {QUICK_AMOUNTS.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setDelta(String(n))}
                    className={cn(
                      "px-3 py-1 rounded-full text-sm font-number font-semibold border transition-colors",
                      delta === String(n)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border hover:border-primary/50 hover:bg-muted/50"
                    )}
                  >
                    +{n}
                  </button>
                ))}
              </div>
              <input
                id="award-points-delta"
                type="number"
                min={1}
                max={100}
                step={1}
                placeholder="Custom…"
                value={delta}
                onChange={(e) => setDelta(e.target.value)}
                aria-invalid={!!pointsError}
                aria-describedby={pointsError ? "award-points-delta-error" : undefined}
                className={cn(
                  "w-full rounded-lg border bg-background px-3 py-2.5 text-sm font-number",
                  "focus:outline-none focus:ring-2 focus:ring-ring transition-colors",
                  pointsError && "border-destructive focus:ring-destructive"
                )}
              />
              {pointsError ? (
                <p id="award-points-delta-error" className="text-sm text-destructive" role="alert">
                  {pointsError}
                </p>
              ) : null}
            </div>

            {/* Reason */}
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Trait <span className="text-destructive" aria-hidden="true">*</span>
              </label>
              <Select.Root value={trait} onValueChange={(v) => setTrait(v as Trait)}>
                <Select.Trigger
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg border bg-background px-3 py-2.5 text-sm",
                    "hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
                  )}
                >
                  <Select.Value placeholder="Select a trait…">
                    {trait ? TRAIT_LABELS[trait as Trait] : null}
                  </Select.Value>
                  <Select.Icon>
                    <CaretDown size={16} className="text-muted-foreground" />
                  </Select.Icon>
                </Select.Trigger>
                <Select.Portal>
                  <Select.Content
                    className="z-[60] min-w-[240px] max-h-72 overflow-y-auto rounded-lg border bg-popover shadow-lg"
                    position="popper"
                    sideOffset={4}
                  >
                    <Select.Viewport className="p-1">
                      {TRAITS.map((t) => (
                        <Select.Item
                          key={t}
                          value={t}
                          className={cn(
                            "flex items-center gap-2 rounded-md px-3 py-2 text-sm cursor-pointer",
                            "hover:bg-accent/10 focus:bg-accent/10 outline-none select-none"
                          )}
                        >
                          <Select.ItemText>{TRAIT_LABELS[t]}</Select.ItemText>
                          <Select.ItemIndicator className="ml-auto">
                            <Check size={14} />
                          </Select.ItemIndicator>
                        </Select.Item>
                      ))}
                    </Select.Viewport>
                  </Select.Content>
                </Select.Portal>
              </Select.Root>
            </div>

            {/* Note */}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <label htmlFor="award-points-note" className="text-sm font-medium">
                  Note <span className="text-destructive" aria-hidden="true">*</span>
                </label>
                <span className="text-xs text-muted-foreground">{reason.length}/240</span>
              </div>
              <textarea
                id="award-points-note"
                rows={3}
                placeholder="Describe what they did well…"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={240}
                aria-invalid={!!noteError}
                aria-describedby={noteError ? "award-points-note-error" : undefined}
                className={cn(
                  "w-full rounded-lg border bg-background px-3 py-2.5 text-sm resize-none",
                  "focus:outline-none focus:ring-2 focus:ring-ring transition-colors",
                  noteError && "border-destructive focus:ring-destructive"
                )}
              />
              {noteError ? (
                <p id="award-points-note-error" className="text-sm text-destructive" role="alert">
                  {noteError}
                </p>
              ) : null}
            </div>
          </div>

          {!canSubmit && !isPending ? (
            <div
              className="mt-6 flex items-start gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-muted-foreground"
              role="status"
            >
              <Info size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
              <p>
                <span className="font-medium text-foreground">To enable Award Points:</span>{" "}
                {remainingRequirements.join(", ")}.
              </p>
            </div>
          ) : null}

          <div className="flex justify-end gap-3 mt-4">
            <Dialog.Close asChild>
              <button className="px-4 py-2 rounded-lg border text-sm hover:bg-muted transition-colors">
                Cancel
              </button>
            </Dialog.Close>
            <motion.button
              whileHover={{ scale: canSubmit ? 1.02 : 1 }}
              whileTap={{ scale: canSubmit ? 0.98 : 1 }}
              onClick={handleSubmit}
              disabled={!canSubmit || isPending}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors",
                canSubmit && !isPending
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "bg-muted text-muted-foreground cursor-not-allowed"
              )}
            >
              <Star weight="fill" size={16} />
              {isPending ? "Awarding…" : "Award Points"}
            </motion.button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
