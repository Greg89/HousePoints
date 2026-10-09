"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition, type FormEvent } from "react";
import { Calendar, PencilSimple, Plus } from "@phosphor-icons/react";
import { toast } from "sonner";
import {
  formatInstantForTimezone,
  isValidIanaTimeZone,
  resolveLocalDateTime,
  type Season,
  type SeasonPlan,
  type SeasonPlanContext,
  type SeasonTransition,
  type UserRole,
} from "@housepoints/contracts";
import type {
  MutationResult,
  RenameSeasonResult,
  SaveSeasonPlanResult,
  StartSeasonResult,
} from "@/lib/action-results";
import { ManageWorkspace } from "./ManageWorkspace";
import { ManageDetailSheet } from "./ManageDetailSheet";
import { ManageConfirmationPanel } from "./ManageConfirmationPanel";
import { ManageResourceList } from "./ManageResourceList";

interface SeasonManagementProps {
  seasons: Season[];
  activeSeason: Season;
  actorRole: UserRole;
  onStartSeason: (formData: FormData) => Promise<StartSeasonResult<SeasonTransition>>;
  onRenameSeason: (formData: FormData) => Promise<RenameSeasonResult<Season>>;
  onReadPlanContext: () => Promise<SeasonPlanContext>;
  onSavePlan: (formData: FormData) => Promise<SaveSeasonPlanResult<SeasonPlan>>;
  onDiscardPlan: (formData: FormData) => Promise<MutationResult>;
  onUpdatePlannedEnd: (formData: FormData) => Promise<RenameSeasonResult<Season>>;
}

type EditorMode = "start" | "rename" | "plan" | "plannedEnd" | null;

function defaultTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

function resolveFormDateTime(
  formData: FormData,
  fieldName: string,
  timezone: string,
): { ok: true; instant: string | null } | { ok: false; message: string } {
  const localDateTime = String(formData.get(`${fieldName}Local`) ?? "");
  if (!localDateTime) return { ok: true, instant: null };

  const resolution = resolveLocalDateTime(localDateTime, timezone);
  if (resolution.kind === "invalid-timezone") {
    return { ok: false, message: "Enter a valid IANA time zone, such as America/New_York." };
  }
  if (resolution.kind === "invalid-date") {
    return { ok: false, message: "Enter a valid local date and time." };
  }
  if (resolution.kind === "nonexistent") {
    return {
      ok: false,
      message: "That local time does not exist because the clocks move forward. Choose another time.",
    };
  }
  if (resolution.kind === "unique") {
    return { ok: true, instant: resolution.instants[0] ?? null };
  }

  const occurrence = formData.get(`${fieldName}Occurrence`);
  if (occurrence !== "earlier" && occurrence !== "later") {
    return {
      ok: false,
      message: "This local time occurs twice. Choose the earlier or later occurrence.",
    };
  }
  return {
    ok: true,
    instant: resolution.instants[occurrence === "earlier" ? 0 : 1] ?? null,
  };
}

function formatSeasonDate(iso: string, timezone: string) {
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone,
    timeZoneName: "short",
  }).format(new Date(iso));
}

function SeasonDateTimeField({
  name,
  label,
  timezone,
  initialValue,
}: {
  name: string;
  label: string;
  timezone: string;
  initialValue: string;
}) {
  const [localValue, setLocalValue] = useState(initialValue);
  const [occurrence, setOccurrence] = useState("");
  const resolution = useMemo(
    () => localValue ? resolveLocalDateTime(localValue, timezone) : null,
    [localValue, timezone],
  );

  return (
    <div className="grid gap-1.5 text-xs font-semibold text-muted-foreground">
      <label htmlFor={`${name}-local`}>{label}</label>
      <input
        id={`${name}-local`}
        name={`${name}Local`}
        type="datetime-local"
        value={localValue}
        onChange={(event) => {
          setLocalValue(event.currentTarget.value);
          setOccurrence("");
        }}
        className="rounded-lg border bg-background px-3 py-2 text-sm font-normal text-foreground"
      />
      {resolution?.kind === "nonexistent" ? (
        <span className="font-normal text-destructive">
          This local time does not exist because clocks move forward.
        </span>
      ) : null}
      {resolution?.kind === "ambiguous" ? (
        <label className="grid gap-1.5 font-normal">
          This local time occurs twice. Choose which occurrence to use.
          <select
            name={`${name}Occurrence`}
            value={occurrence}
            onChange={(event) => setOccurrence(event.currentTarget.value)}
            className="rounded-lg border bg-background px-3 py-2 text-sm text-foreground"
            required
          >
            <option value="">Choose occurrence</option>
            <option value="earlier">Earlier occurrence</option>
            <option value="later">Later occurrence</option>
          </select>
        </label>
      ) : null}
    </div>
  );
}

export function SeasonManagement({
  seasons,
  activeSeason,
  actorRole,
  onStartSeason,
  onRenameSeason,
  onReadPlanContext,
  onSavePlan,
  onDiscardPlan,
  onUpdatePlannedEnd,
}: SeasonManagementProps) {
  const [editorMode, setEditorMode] = useState<EditorMode>(null);
  const [startSeasonPending, startStartSeason] = useTransition();
  const [renameSeasonPending, startRenameSeason] = useTransition();
  const [savePlanPending, startSavePlan] = useTransition();
  const [discardPlanPending, startDiscardPlan] = useTransition();
  const [plannedEndPending, startPlannedEnd] = useTransition();
  const [seasonList, setSeasonList] = useState(seasons);
  const [currentSeason, setCurrentSeason] = useState(activeSeason);
  const [renameSeasonId, setRenameSeasonId] = useState(activeSeason.id);
  const [pendingStartName, setPendingStartName] = useState<string | null>(null);
  const [planContext, setPlanContext] = useState<SeasonPlanContext | null>(null);
  const [planContextError, setPlanContextError] = useState<string | null>(null);
  const [planContextLoading, setPlanContextLoading] = useState(true);
  const [pendingPlanDiscard, setPendingPlanDiscard] = useState(false);
  const [planTimezone, setPlanTimezone] = useState(defaultTimezone);
  const [plannedEndTimezone, setPlannedEndTimezone] = useState(
    activeSeason.timezone ?? defaultTimezone(),
  );
  const [now, setNow] = useState<number | null>(null);
  const startFormRef = useRef<HTMLFormElement>(null);
  const canManageSeasons = actorRole === "OWNER";
  const renameSeason = seasonList.find((season) => season.id === renameSeasonId) ?? currentSeason;

  const refreshPlanContext = useCallback(async () => {
    setPlanContextLoading(true);
    setPlanContextError(null);
    try {
      const context = await onReadPlanContext();
      setPlanContext(context);
      setCurrentSeason(context.activeSeason);
      setSeasonList((existing) => existing.map((season) =>
        season.id === context.activeSeason.id ? context.activeSeason : season,
      ));
    } catch (error) {
      setPlanContextError(
        error instanceof Error ? error.message : "Season planning details could not be loaded.",
      );
    } finally {
      setPlanContextLoading(false);
    }
  }, [onReadPlanContext]);

  useEffect(() => {
    let isCurrent = true;
    void onReadPlanContext()
      .then((context) => {
        if (!isCurrent) return;
        setPlanContext(context);
        setCurrentSeason(context.activeSeason);
        setSeasonList((existing) => existing.map((season) =>
          season.id === context.activeSeason.id ? context.activeSeason : season,
        ));
      })
      .catch((error: unknown) => {
        if (!isCurrent) return;
        setPlanContextError(
          error instanceof Error ? error.message : "Season planning details could not be loaded.",
        );
      })
      .finally(() => {
        if (isCurrent) setPlanContextLoading(false);
      });
    return () => {
      isCurrent = false;
    };
  }, [onReadPlanContext]);

  useEffect(() => {
    const updateNow = () => setNow(Date.now());
    const timeout = window.setTimeout(updateNow, 0);
    const interval = window.setInterval(updateNow, 60_000);
    return () => {
      window.clearTimeout(timeout);
      window.clearInterval(interval);
    };
  }, []);

  function openPlanEditor() {
    const timezone = planContext?.plan?.timezone ?? defaultTimezone();
    setPlanTimezone(timezone);
    setEditorMode("plan");
  }

  function openPlannedEndEditor() {
    setPlannedEndTimezone(currentSeason.timezone ?? defaultTimezone());
    setEditorMode("plannedEnd");
  }

  function handleSavePlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManageSeasons) return;
    const formData = new FormData(event.currentTarget);
    const timezone = String(formData.get("timezone") ?? "").trim();
    if (!isValidIanaTimeZone(timezone)) {
      toast.error("Invalid time zone", {
        description: "Enter a valid IANA time zone, such as America/New_York.",
      });
      return;
    }

    const plannedStartsAt = resolveFormDateTime(formData, "plannedStartsAt", timezone);
    const plannedEndsAt = resolveFormDateTime(formData, "plannedEndsAt", timezone);
    if (!plannedStartsAt.ok) {
      toast.error("Check the planned dates", {
        description: plannedStartsAt.message,
      });
      return;
    }
    if (!plannedEndsAt.ok) {
      toast.error("Check the planned dates", {
        description: plannedEndsAt.message,
      });
      return;
    }
    if (
      plannedStartsAt.instant &&
      plannedEndsAt.instant &&
      new Date(plannedEndsAt.instant) <= new Date(plannedStartsAt.instant)
    ) {
      toast.error("Invalid date range", {
        description: "The planned end must be later than the planned start.",
      });
      return;
    }

    formData.set("expectedVersion", String(planContext?.plan?.version ?? 0));
    formData.set("timezone", timezone);
    formData.set("plannedStartsAt", plannedStartsAt.instant ?? "");
    formData.set("plannedEndsAt", plannedEndsAt.instant ?? "");
    startSavePlan(async () => {
      try {
        const result = await onSavePlan(formData);
        if (!result.ok) {
          toast.error("Season plan not saved", { description: result.message });
          if (result.code === "SEASON_PLAN_VERSION_CONFLICT") {
            await refreshPlanContext();
            setEditorMode(null);
          }
          return;
        }
        toast.success("Next-season plan saved", { description: result.plan.name });
        setEditorMode(null);
        await refreshPlanContext();
      } catch (error) {
        toast.error("Season plan not saved", {
          description: error instanceof Error ? error.message : "Something went wrong.",
        });
      }
    });
  }

  function handleDiscardPlan() {
    const plan = planContext?.plan;
    if (!canManageSeasons || !plan) return;
    const formData = new FormData();
    formData.set("expectedVersion", String(plan.version));
    startDiscardPlan(async () => {
      try {
        const result = await onDiscardPlan(formData);
        if (!result.ok) {
          toast.error("Season plan not discarded", { description: result.message });
          if (result.code === "SEASON_PLAN_VERSION_CONFLICT") await refreshPlanContext();
          setPendingPlanDiscard(false);
          return;
        }
        toast.success("Next-season plan discarded");
        setPendingPlanDiscard(false);
        await refreshPlanContext();
      } catch (error) {
        toast.error("Season plan not discarded", {
          description: error instanceof Error ? error.message : "Something went wrong.",
        });
      }
    });
  }

  function handleUpdatePlannedEnd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManageSeasons) return;
    const formData = new FormData(event.currentTarget);
    const timezone = String(formData.get("timezone") ?? "").trim();
    if (!isValidIanaTimeZone(timezone)) {
      toast.error("Invalid time zone", {
        description: "Enter a valid IANA time zone, such as America/New_York.",
      });
      return;
    }
    const plannedEnd = resolveFormDateTime(formData, "plannedEndsAt", timezone);
    if (!plannedEnd.ok) {
      toast.error("Check the planned end", { description: plannedEnd.message });
      return;
    }
    formData.set("seasonId", currentSeason.id);
    formData.set("timezone", timezone);
    formData.set("plannedEndsAt", plannedEnd.instant ?? "");
    startPlannedEnd(async () => {
      try {
        const result = await onUpdatePlannedEnd(formData);
        if (!result.ok) {
          toast.error("Planned end not saved", { description: result.message });
          if (result.code === "ACTIVE_SEASON_CHANGED") await refreshPlanContext();
          return;
        }
        setCurrentSeason(result.season);
        setSeasonList((existing) => existing.map((season) =>
          season.id === result.season.id ? result.season : season,
        ));
        toast.success("Planned season end saved");
        setEditorMode(null);
      } catch (error) {
        toast.error("Planned end not saved", {
          description: error instanceof Error ? error.message : "Something went wrong.",
        });
      }
    });
  }

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
      action={(
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={openPlanEditor}
            disabled={!canManageSeasons || planContextLoading}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border bg-card px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
          >
            <PencilSimple size={16} />
            {planContext?.plan ? "Edit next-season plan" : "Prepare next season"}
          </button>
          <button
            type="button"
            onClick={() => setEditorMode("start")}
            disabled={!canManageSeasons}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus size={16} />
            Start immediately
          </button>
        </div>
      )}
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
            {currentSeason.plannedEndsAt && currentSeason.timezone ? (
              <p className="mt-1 text-sm text-muted-foreground">
                Planned end: {formatSeasonDate(currentSeason.plannedEndsAt, currentSeason.timezone)}
                {now !== null && new Date(currentSeason.plannedEndsAt).getTime() < now
                  ? " · Past planned end; awaiting next kickoff"
                  : ""}
                {" · Awards continue until kickoff"}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={openPlannedEndEditor}
              disabled={!canManageSeasons}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border bg-card px-3 text-xs font-semibold disabled:opacity-50"
            >
              <Calendar size={14} />
              {currentSeason.plannedEndsAt ? "Change planned end" : "Set planned end"}
            </button>
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
        </div>
      </section>

      <section aria-labelledby="next-season-plan-heading" className="rounded-xl border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h5 id="next-season-plan-heading" className="text-sm font-semibold">Next-season plan</h5>
            {planContextLoading ? (
              <p className="mt-2 text-sm text-muted-foreground">Loading plan and readiness…</p>
            ) : planContextError ? (
              <div className="mt-2">
                <p role="alert" className="text-sm text-destructive">{planContextError}</p>
                <button type="button" onClick={() => void refreshPlanContext()} className="mt-2 text-sm font-semibold text-primary">
                  Retry
                </button>
              </div>
            ) : planContext?.plan ? (
              <>
                <p className="mt-2 text-sm font-semibold">{planContext.plan.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {planContext.plan.plannedStartsAt
                    ? `Intended start: ${formatSeasonDate(planContext.plan.plannedStartsAt, planContext.plan.timezone)}`
                    : "No intended start date"}
                  {planContext.plan.plannedEndsAt
                    ? ` · Intended end: ${formatSeasonDate(planContext.plan.plannedEndsAt, planContext.plan.timezone)}`
                    : ""}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Dates are expectations only. This plan does not start a season or stop awards.
                </p>
              </>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">
                No draft yet. Preparing a plan will not change the active season.
              </p>
            )}
          </div>
          {planContext?.plan && canManageSeasons ? (
            <button
              type="button"
              onClick={() => setPendingPlanDiscard(true)}
              disabled={discardPlanPending}
              className="rounded-lg border px-3 py-2 text-xs font-semibold text-destructive disabled:opacity-50"
            >
              Discard plan
            </button>
          ) : null}
        </div>
        {planContext ? (
          <ul className="mt-4 grid gap-2 border-t pt-4 text-xs text-muted-foreground sm:grid-cols-2">
            <li>
              {planContext.activeCategoryCount > 0
                ? `${planContext.activeCategoryCount} active recognition categor${planContext.activeCategoryCount === 1 ? "y" : "ies"}`
                : "No active recognition categories — add one before kickoff"}
            </li>
            <li>{planContext.houseCount} {planContext.houseCount === 1 ? "house" : "houses"} ready</li>
            <li>
              {planContext.unassignedMemberCount === 0
                ? "All active members are assigned to a house"
                : `${planContext.unassignedMemberCount} active member${planContext.unassignedMemberCount === 1 ? "" : "s"} need a house`}
            </li>
            <li>Current season to close: {planContext.activeSeason.name}</li>
          </ul>
        ) : null}
        {pendingPlanDiscard && planContext?.plan ? (
          <div className="mt-4">
            <ManageConfirmationPanel
              title={<>Discard the plan for &ldquo;{planContext.plan.name}&rdquo;?</>}
              description={<>This removes only the draft. The current season and all scores remain unchanged.</>}
              onConfirm={handleDiscardPlan}
              onCancel={() => setPendingPlanDiscard(false)}
              confirmLabel="Discard plan"
              pendingLabel="Discarding..."
              pending={discardPlanPending}
            />
          </div>
        ) : null}
      </section>

      <section aria-labelledby="season-history-heading">
        <h5 id="season-history-heading" className="text-sm font-semibold">Season history</h5>
        <ManageResourceList className="mt-3">
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
        </ManageResourceList>
      </section>

      <ManageDetailSheet
        open={Boolean(editorMode)}
        onOpenChange={(open) => {
          if (!open) {
            setPendingStartName(null);
            setEditorMode(null);
          }
        }}
        title={
          editorMode === "start"
            ? "Start next season"
            : editorMode === "rename"
              ? `Rename ${renameSeason.name}`
              : editorMode === "plan"
                ? "Prepare next season"
                : "Planned end for current season"
        }
        description={
          editorMode === "start"
            ? `Starting a new season immediately closes ${currentSeason.name}.`
            : editorMode === "rename"
              ? "Renaming changes display text only; scores and dates stay the same."
              : editorMode === "plan"
                ? "Save a draft without changing the active season. Dates are informational and use the selected time zone."
                : "A planned end is informational. Awards continue until an owner starts the next season."
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
          ) : editorMode === "rename" ? (
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
          ) : editorMode === "plan" ? (
            <form
              key={`plan-${planContext?.plan?.version ?? "new"}`}
              aria-label="Prepare next season"
              onSubmit={handleSavePlan}
              className="grid gap-4"
            >
              <label className="grid gap-1.5 text-xs font-semibold text-muted-foreground">
                Season name
                <input
                  name="name"
                  defaultValue={planContext?.plan?.name ?? ""}
                  className="rounded-lg border bg-background px-3 py-2 text-sm font-normal text-foreground"
                  placeholder="New season name"
                  required
                  minLength={2}
                  maxLength={80}
                  disabled={savePlanPending}
                />
              </label>
              <label className="grid gap-1.5 text-xs font-semibold text-muted-foreground">
                Optional kickoff message
                <textarea
                  name="kickoffMessage"
                  defaultValue={planContext?.plan?.kickoffMessage ?? ""}
                  className="min-h-20 rounded-lg border bg-background px-3 py-2 text-sm font-normal text-foreground"
                  maxLength={500}
                  disabled={savePlanPending}
                />
                <span className="font-normal">Up to 500 characters. This is saved for later; it is not sent now.</span>
              </label>
              <label className="grid gap-1.5 text-xs font-semibold text-muted-foreground">
                IANA time zone
                <input
                  name="timezone"
                  value={planTimezone}
                  onChange={(event) => setPlanTimezone(event.currentTarget.value)}
                  className="rounded-lg border bg-background px-3 py-2 text-sm font-normal text-foreground"
                  placeholder="America/New_York"
                  required
                  disabled={savePlanPending}
                />
                <span className="font-normal">For example, America/New_York or Europe/London.</span>
              </label>
              <SeasonDateTimeField
                key={`plan-start-${planContext?.plan?.version ?? "new"}`}
                name="plannedStartsAt"
                label="Intended start (optional)"
                timezone={planTimezone}
                initialValue={planContext?.plan?.plannedStartsAt
                  ? formatInstantForTimezone(planContext.plan.plannedStartsAt, planTimezone)
                  : ""}
              />
              <SeasonDateTimeField
                key={`plan-end-${planContext?.plan?.version ?? "new"}`}
                name="plannedEndsAt"
                label="Intended end (optional)"
                timezone={planTimezone}
                initialValue={planContext?.plan?.plannedEndsAt
                  ? formatInstantForTimezone(planContext.plan.plannedEndsAt, planTimezone)
                  : ""}
              />
              <p className="text-xs text-muted-foreground">
                Preparing or editing this draft does not close the current season, reset points, or schedule a future transition.
              </p>
              <button
                type="submit"
                disabled={savePlanPending}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                {savePlanPending ? "Saving..." : "Save plan"}
              </button>
            </form>
          ) : editorMode === "plannedEnd" ? (
            <form
              key={`planned-end-${currentSeason.id}-${currentSeason.plannedEndsAt ?? "none"}`}
              aria-label="Set planned season end"
              onSubmit={handleUpdatePlannedEnd}
              className="grid gap-4"
            >
              <label className="grid gap-1.5 text-xs font-semibold text-muted-foreground">
                IANA time zone
                <input
                  name="timezone"
                  value={plannedEndTimezone}
                  onChange={(event) => setPlannedEndTimezone(event.currentTarget.value)}
                  className="rounded-lg border bg-background px-3 py-2 text-sm font-normal text-foreground"
                  required
                  disabled={plannedEndPending}
                />
              </label>
              <SeasonDateTimeField
                name="plannedEndsAt"
                label="Planned end (optional)"
                timezone={plannedEndTimezone}
                initialValue={currentSeason.plannedEndsAt && currentSeason.timezone
                  ? formatInstantForTimezone(currentSeason.plannedEndsAt, currentSeason.timezone)
                  : ""}
              />
              <p className="text-xs text-muted-foreground">
                Leave the date empty and save to clear it. Passing this date will not stop awards or close the season.
              </p>
              <button
                type="submit"
                disabled={plannedEndPending}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                {plannedEndPending ? "Saving..." : "Save planned end"}
              </button>
            </form>
          ) : null}
      </ManageDetailSheet>
    </ManageWorkspace>
  );
}
