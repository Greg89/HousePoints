"use client";

import { useState, useTransition } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import * as Select from "@radix-ui/react-select";
import { Star, CaretDown, Check, X } from "@phosphor-icons/react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import type { OrgMember, LeaderboardEntry } from "@housepoints/contracts";
import { cn } from "@/lib/cn";

interface AwardPointsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** All org members – shown as targets */
  members: OrgMember[];
  /** Houses available for display context only */
  houses: LeaderboardEntry[];
  /** Server action to submit the award */
  onAward: (targetUserId: string, delta: number, reason: string) => Promise<void>;
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
  const [isPending, startTransition] = useTransition();

  const selectedMember = members.find((m) => m.id === targetUserId);

  function reset() {
    setTargetUserId("");
    setDelta("");
    setReason("");
  }

  function handleClose(value: boolean) {
    if (!value) reset();
    onOpenChange(value);
  }

  function handleSubmit() {
    const deltaNum = parseInt(delta, 10);
    if (!targetUserId || !deltaNum || !reason.trim()) return;
    startTransition(async () => {
      try {
        await onAward(targetUserId, deltaNum, reason);
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

  const deltaNum = parseInt(delta, 10);
  const canSubmit =
    !!targetUserId &&
    !isNaN(deltaNum) &&
    deltaNum >= 1 &&
    deltaNum <= 100 &&
    reason.trim().length >= 3;

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
            <div className="space-y-2">
              <label className="text-sm font-medium">Recipient</label>
              <Select.Root value={targetUserId} onValueChange={setTargetUserId}>
                <Select.Trigger
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg border bg-background px-3 py-2.5 text-sm",
                    "hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
                  )}
                >
                  <Select.Value placeholder="Select a team member…">
                    {selectedMember && (
                      <span className="flex items-center gap-2">
                        {selectedMember.houseColor && (
                          <span
                            className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: selectedMember.houseColor }}
                          />
                        )}
                        {selectedMember.displayName}
                        {selectedMember.houseName && (
                          <span className="text-muted-foreground text-xs">· {selectedMember.houseName}</span>
                        )}
                      </span>
                    )}
                  </Select.Value>
                  <Select.Icon>
                    <CaretDown size={16} className="text-muted-foreground" />
                  </Select.Icon>
                </Select.Trigger>
                <Select.Portal>
                  <Select.Content
                    className="z-[60] min-w-[200px] overflow-hidden rounded-lg border bg-popover shadow-lg"
                    position="popper"
                    sideOffset={4}
                  >
                    <Select.Viewport className="p-1">
                      {members.filter((m) => m.houseId).map((member) => (
                        <Select.Item
                          key={member.id}
                          value={member.id}
                          className={cn(
                            "flex items-center gap-2 rounded-md px-3 py-2 text-sm cursor-pointer",
                            "hover:bg-accent/10 focus:bg-accent/10 outline-none select-none"
                          )}
                        >
                          {member.houseColor && (
                            <span
                              className="w-3 h-3 rounded-full flex-shrink-0"
                              style={{ backgroundColor: member.houseColor }}
                            />
                          )}
                          <Select.ItemText>{member.displayName}</Select.ItemText>
                          {member.houseName && (
                            <span className="text-muted-foreground text-xs ml-auto pl-4">{member.houseName}</span>
                          )}
                          <Select.ItemIndicator>
                            <Check size={14} />
                          </Select.ItemIndicator>
                        </Select.Item>
                      ))}
                    </Select.Viewport>
                  </Select.Content>
                </Select.Portal>
              </Select.Root>
            </div>

            {/* Points input */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Points (1–100)</label>
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
                type="number"
                min={1}
                max={100}
                placeholder="Custom…"
                value={delta}
                onChange={(e) => setDelta(e.target.value)}
                className={cn(
                  "w-full rounded-lg border bg-background px-3 py-2.5 text-sm font-number",
                  "focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
                )}
              />
            </div>

            {/* Reason */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Reason</label>
              <textarea
                rows={3}
                placeholder="Describe what they did well…"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className={cn(
                  "w-full rounded-lg border bg-background px-3 py-2.5 text-sm resize-none",
                  "focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
                )}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6">
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
