"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import { Calendar, PencilSimple, Plus } from "@phosphor-icons/react";
import { toast } from "sonner";
import type { Season, SeasonTransition, UserRole } from "@housepoints/contracts";
import type { RenameSeasonResult, StartSeasonResult } from "@/lib/action-results";
import { ManageWorkspace } from "./ManageWorkspace";
import { ManageDetailSheet } from "./ManageDetailSheet";
import { ManageConfirmationPanel } from "./ManageConfirmationPanel";

interface SeasonManagementProps {
  seasons: Season[];
  activeSeason: Season;
  actorRole: UserRole;
  onStartSeason: (formData: FormData) => Promise<StartSeasonResult<SeasonTransition>>;
  onRenameSeason: (formData: FormData) => Promise<RenameSeasonResult<Season>>;
}

export function SeasonManagement({
  seasons,
  activeSeason,
  actorRole,
  onStartSeason,
  onRenameSeason,
}: SeasonManagementProps) {
  const [editorMode, setEditorMode] = useState<"start" | "rename" | null>(null);
  const [startSeasonPending, startStartSeason] = useTransition();
  const [renameSeasonPending, startRenameSeason] = useTransition();
  const [seasonList, setSeasonList] = useState(seasons);
  const [currentSeason, setCurrentSeason] = useState(activeSeason);
  const [renameSeasonId, setRenameSeasonId] = useState(activeSeason.id);
  const [pendingStartName, setPendingStartName] = useState<string | null>(null);
  const startFormRef = useRef<HTMLFormElement>(null);
  const canManageSeasons = actorRole === "OWNER";
  const renameSeason = seasonList.find((season) => season.id === renameSeasonId) ?? currentSeason;

  function handleStartSeason(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManageSeasons) return;
    const name = String(new FormData(event.currentTarget).get("name") ?? "").trim();
    if (name) setPendingStartName(name);
  }

  function confirmStartSeason() {
    if (!pendingStartName) return;
    const name = pendingStartName;
    setPendingStartName(null);
    const formData = new FormData();
    formData.set("name", name);

    startStartSeason(async () => {
      try {
        const result = await onStartSeason(formData);
        if (!result.ok) {
          toast.error("Failed to start season", { description: result.message });
          return;
        }
        const { transition } = result;
        setCurrentSeason(transition.activeSeason);
        setRenameSeasonId(transition.activeSeason.id);
        setSeasonList((existing) => [
          transition.activeSeason,
          transition.previousSeason,
          ...existing.filter(
            (season) =>
              season.id !== transition.activeSeason.id &&
              season.id !== transition.previousSeason.id,
          ),
        ]);
        toast.success("Season started", { description: transition.activeSeason.name });
        startFormRef.current?.reset();
        setEditorMode(null);
      } catch (error) {
        toast.error("Failed to start season", {
          description: error instanceof Error ? error.message : "Something went wrong",
        });
      }
    });
  }

  function handleRenameSeason(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManageSeasons) return;
    const formData = new FormData(event.currentTarget);

    startRenameSeason(async () => {
      try {
        const result = await onRenameSeason(formData);
        if (!result.ok) {
          toast.error("Failed to rename season", { description: result.message });
          return;
        }
        const renamedSeason = result.season;
        setSeasonList((existing) =>
          existing.map((season) => season.id === renamedSeason.id ? renamedSeason : season),
        );
        if (currentSeason.id === renamedSeason.id) setCurrentSeason(renamedSeason);
        toast.success("Season renamed", { description: renamedSeason.name });
        setRenameSeasonId(renamedSeason.id);
        setEditorMode(null);
      } catch (error) {
        toast.error("Failed to rename season", {
          description: error instanceof Error ? error.message : "Something went wrong",
        });
      }
    });
  }

  return (
    <ManageWorkspace
      id="seasons"
      title="Seasons"
      description="Review the current competition window and historical seasons."
      action={
        <button
          type="button"
          onClick={() => setEditorMode("start")}
          disabled={!canManageSeasons}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus size={16} />
          Start next season
        </button>
      }
    >

      <section aria-label="Current season" className="rounded-xl border border-primary/20 bg-primary/5 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wide text-primary">Current season</span>
            <h5 className="mt-1 font-display text-xl font-semibold">{currentSeason.name}</h5>
            <p className="mt-1 text-sm text-muted-foreground">
              Started {new Date(currentSeason.startsAt).toLocaleDateString()}
              {currentSeason.endsAt
                ? ` · Ends ${new Date(currentSeason.endsAt).toLocaleDateString()}`
                : " · No end date"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setRenameSeasonId(currentSeason.id);
              setEditorMode("rename");
            }}
            disabled={!canManageSeasons}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border bg-card px-3 text-xs font-semibold disabled:opacity-50"
          >
            <PencilSimple size={14} />
            Rename current season
          </button>
        </div>
      </section>

      <section aria-labelledby="season-history-heading">
        <h5 id="season-history-heading" className="text-sm font-semibold">Season history</h5>
        <div className="mt-3 divide-y overflow-hidden rounded-xl border bg-card">
          {seasonList.map((season) => (
            <div key={season.id} className="flex items-center gap-3 px-4 py-3">
              <Calendar size={17} className="shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-semibold">{season.name}</p>
                  <span className="rounded-full border px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
                    {season.isActive ? "Active" : "Completed"}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {new Date(season.startsAt).toLocaleDateString()}
                  {season.endsAt
                    ? ` – ${new Date(season.endsAt).toLocaleDateString()}`
                    : " – Present"}
                </p>
              </div>
              <button
                type="button"
                aria-label={`Rename ${season.name}`}
                onClick={() => {
                  setRenameSeasonId(season.id);
                  setEditorMode("rename");
                }}
                disabled={!canManageSeasons}
                className="rounded-lg p-2 text-muted-foreground hover:bg-muted disabled:opacity-50"
              >
                <PencilSimple size={15} />
              </button>
            </div>
          ))}
        </div>
      </section>

      <ManageDetailSheet
        open={Boolean(editorMode)}
        onOpenChange={(open) => {
          if (!open) {
            setPendingStartName(null);
            setEditorMode(null);
          }
        }}
        title={editorMode === "start" ? "Start next season" : `Rename ${renameSeason.name}`}
        description={
          editorMode === "start"
            ? `Starting a new season immediately closes ${currentSeason.name}.`
            : "Renaming changes display text only; scores and dates stay the same."
        }
        closeLabel="Close season editor"
      >
          {editorMode === "start" ? (
            <form ref={startFormRef} aria-label="Start season" onSubmit={handleStartSeason} className="grid gap-3">
              <input
                name="name"
                className="rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="New season name"
                required
                minLength={2}
                maxLength={80}
                disabled={startSeasonPending}
              />
              <p className="text-xs text-muted-foreground">
                Starting a season closes {currentSeason.name} and resets current-season scoring.
              </p>
              {pendingStartName ? (
                <ManageConfirmationPanel
                  title={<>Start &ldquo;{pendingStartName}&rdquo; now?</>}
                  description={<>This will close {currentSeason.name} and reset current-season scoring.</>}
                  onConfirm={confirmStartSeason}
                  onCancel={() => setPendingStartName(null)}
                  confirmLabel="Start season"
                  pendingLabel="Starting..."
                  pending={startSeasonPending}
                />
              ) : (
                <button type="submit" disabled={startSeasonPending} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
                  {startSeasonPending ? "Starting..." : "Continue"}
                </button>
              )}
            </form>
          ) : (
            <form aria-label="Rename season" onSubmit={handleRenameSeason} className="grid gap-3">
              <input type="hidden" name="seasonId" value={renameSeasonId} />
              <label className="grid gap-1.5 text-xs font-semibold text-muted-foreground">
                Season name
                <input
                  name="name"
                  defaultValue={renameSeason.name}
                  className="rounded-lg border bg-background px-3 py-2 text-sm font-normal text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  required
                  minLength={2}
                  maxLength={80}
                />
              </label>
              <button type="submit" disabled={renameSeasonPending} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
                {renameSeasonPending ? "Saving..." : "Save name"}
              </button>
            </form>
          )}
      </ManageDetailSheet>
    </ManageWorkspace>
  );
}
