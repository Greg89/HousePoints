"use client";

import { useMemo, useState, useTransition } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { MinusCircle, X } from "@phosphor-icons/react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import type { OrgMember } from "@housepoints/contracts";
import { cn } from "@/lib/cn";
import type { DeductPointsResult } from "@/lib/action-results";
import { MemberCombobox } from "./MemberCombobox";

interface DeductPointsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  members: OrgMember[];
  actorHouseId: string | null;
  onDeduct: (targetUserId: string, reason: string) => Promise<DeductPointsResult>;
}

const DEDUCTION_AMOUNT = 10;

export function DeductPointsDialog({
  open,
  onOpenChange,
  members,
  actorHouseId,
  onDeduct,
}: DeductPointsDialogProps) {
  const [targetUserId, setTargetUserId] = useState("");
  const [reason, setReason] = useState("");
  const [isConfirming, setIsConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();
  const eligibleMembers = useMemo(
    () => members.filter((member) => member.houseId && member.houseId !== actorHouseId),
    [actorHouseId, members],
  );
  const selectedMember = eligibleMembers.find((member) => member.id === targetUserId);
  const canSubmit = Boolean(targetUserId) && reason.trim().length >= 3 && !isPending;

  function reset() {
    setTargetUserId("");
    setReason("");
    setIsConfirming(false);
  }

  function handleClose(value: boolean) {
    if (!value) reset();
    onOpenChange(value);
  }

  function handleSubmit() {
    if (!canSubmit) return;

    if (!isConfirming) {
      setIsConfirming(true);
      return;
    }

    startTransition(async () => {
      try {
        const result = await onDeduct(targetUserId, reason.trim());

        if (!result.ok) {
          toast.error("Failed to deduct points", {
            description: result.message,
          });
          return;
        }

        toast.success("Points deducted", {
          description: `-${DEDUCTION_AMOUNT} pts from ${selectedMember?.displayName}`,
        });
        reset();
        onOpenChange(false);
      } catch (error) {
        toast.error("Failed to deduct points", {
          description: error instanceof Error ? error.message : "Something went wrong",
        });
      }
    });
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl border bg-card p-6 shadow-2xl">
          <div className="mb-6 flex items-start justify-between">
            <div>
              <Dialog.Title className="font-display flex items-center gap-2 text-2xl font-semibold">
                <MinusCircle weight="fill" className="text-destructive" size={24} />
                Deduct Points
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-muted-foreground">
                Deduct {DEDUCTION_AMOUNT} points from another house with a visible reason.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button className="rounded-lg p-1 transition-colors hover:bg-muted" aria-label="Close">
                <X size={20} />
              </button>
            </Dialog.Close>
          </div>

          <div className="space-y-5">
            <div className="rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-foreground">
              Each house can deduct once every 24 hours, and the same member can only receive one deduction in that window.
            </div>

            <MemberCombobox
              label="Member from another house"
              members={eligibleMembers}
              value={targetUserId}
              onValueChange={(value) => {
                setTargetUserId(value);
                setIsConfirming(false);
              }}
              placeholder={eligibleMembers.length === 0 ? "No eligible members" : "Select a member..."}
              emptyMessage="No eligible members found."
              disabled={eligibleMembers.length === 0}
            />

            <div className="space-y-2">
              <label className="text-sm font-medium">Reason</label>
              <textarea
                rows={4}
                placeholder="Explain why points are being deducted..."
                value={reason}
                onChange={(event) => {
                  setReason(event.target.value);
                  setIsConfirming(false);
                }}
                className={cn(
                  "w-full resize-none rounded-lg border bg-background px-3 py-2.5 text-sm",
                  "transition-colors focus:outline-none focus:ring-2 focus:ring-ring",
                )}
              />
              <p className="text-xs text-muted-foreground">
                This reason is shown in Activity and retained in the audit trail.
              </p>
            </div>

            {isConfirming && selectedMember ? (
              <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm">
                <p className="font-semibold text-destructive">Confirm deduction</p>
                <p className="mt-1 text-foreground">
                  This will deduct {DEDUCTION_AMOUNT} points from {selectedMember.displayName}
                  {selectedMember.houseName ? ` (${selectedMember.houseName})` : ""}.
                </p>
                <p className="mt-1 text-muted-foreground">
                  The deduction will be visible in Activity and Audit.
                </p>
              </div>
            ) : null}
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <Dialog.Close asChild>
              <button className="rounded-lg border px-4 py-2 text-sm transition-colors hover:bg-muted">
                Cancel
              </button>
            </Dialog.Close>
            {isConfirming ? (
              <button
                type="button"
                onClick={() => setIsConfirming(false)}
                className="rounded-lg border px-4 py-2 text-sm transition-colors hover:bg-muted"
              >
                Back
              </button>
            ) : null}
            <motion.button
              whileHover={{ scale: canSubmit ? 1.02 : 1 }}
              whileTap={{ scale: canSubmit ? 0.98 : 1 }}
              onClick={handleSubmit}
              disabled={!canSubmit}
              className={cn(
                "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors",
                canSubmit
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : "cursor-not-allowed bg-muted text-muted-foreground",
              )}
            >
              <MinusCircle weight="fill" size={16} />
              {isPending
                ? "Deducting..."
                : isConfirming
                  ? "Confirm Deduction"
                  : `Deduct ${DEDUCTION_AMOUNT} Points`}
            </motion.button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
