import { useState, useTransition, type FormEvent } from "react";
import { Calendar, PencilSimple } from "@phosphor-icons/react";
import { toast } from "sonner";
import type { Season, SeasonTransition, UserRole } from "@housepoints/contracts";
import type {
  RenameSeasonResult,
  StartSeasonResult,
} from "@/lib/action-results";

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
  const [startSeasonPending, startStartSeason] = useTransition();
  const [renameSeasonPending, startRenameSeason] = useTransition();
  const [seasonList, setSeasonList] = useState(seasons);
  const [currentSeason, setCurrentSeason] = useState(activeSeason);
  const [renameSeasonId, setRenameSeasonId] = useState(activeSeason.id);
  const canStartSeason = actorRole === "OWNER" || actorRole === "ADMIN";

  function handleStartSeason(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canStartSeason) return;

    const formData = new FormData(e.currentTarget);
    const name = String(formData.get("name") ?? "").trim();
    const form = e.currentTarget;

    const confirmed = window.confirm(
      `Start "${name}" now? This will close ${currentSeason.name} and reset current-season scoring.`,
    );

    if (!confirmed) return;

    startStartSeason(async () => {
      try {
        const result = await onStartSeason(formData);

        if (!result.ok) {
          toast.error("Failed to start season", {
            description: result.message,
          });
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
        form.reset();
      } catch (err) {
        toast.error("Failed to start season", {
          description: err instanceof Error ? err.message : "Something went wrong",
        });
      }
    });
  }

  function handleRenameSeason(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const form = e.currentTarget;

    startRenameSeason(async () => {
      try {
        const result = await onRenameSeason(formData);

        if (!result.ok) {
          toast.error("Failed to rename season", {
            description: result.message,
          });
          return;
        }

        const { season: renamedSeason } = result;
        setSeasonList((existing) =>
          existing.map((season) => (season.id === renamedSeason.id ? renamedSeason : season)),
        );
        if (currentSeason.id === renamedSeason.id) {
          setCurrentSeason(renamedSeason);
        }
        toast.success("Season renamed", { description: renamedSeason.name });
        form.reset();
        setRenameSeasonId(renamedSeason.id);
      } catch (err) {
        toast.error("Failed to rename season", {
          description: err instanceof Error ? err.message : "Something went wrong",
        });
      }
    });
  }

  return (
    <section className="space-y-6">
      <div>
        <h4 className="font-display text-lg font-semibold">Seasons</h4>
        <p className="text-sm text-muted-foreground">
          Rename reporting seasons or start the next competition window.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <form
          aria-label="Start season"
          onSubmit={handleStartSeason}
          className="grid gap-3 rounded-xl border p-5 bg-card"
        >
          <h5 className="text-sm font-semibold flex items-center gap-2">
            <Calendar size={16} />
            Start New Season
          </h5>
          <p className="text-xs text-muted-foreground">
            Current active season: <span className="font-semibold text-foreground">{currentSeason.name}</span>
          </p>
          <input
            name="name"
            className="rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="New season name"
            required
            minLength={2}
            maxLength={80}
            disabled={!canStartSeason}
          />
          {!canStartSeason ? (
            <p className="text-xs text-muted-foreground">
              Admins and owners can start a new season.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Starting a season immediately closes the current active season.
            </p>
          )}
          <button
            type="submit"
            disabled={startSeasonPending || !canStartSeason}
            className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {startSeasonPending ? "Starting..." : "Start season"}
          </button>
        </form>

        <form
          aria-label="Rename season"
          onSubmit={handleRenameSeason}
          className="grid gap-3 rounded-xl border p-5 bg-card"
        >
          <h5 className="text-sm font-semibold flex items-center gap-2">
            <PencilSimple size={16} />
            Rename Season
          </h5>
          <select
            name="seasonId"
            aria-label="Season to rename"
            className="rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none"
            required
            value={renameSeasonId}
            onChange={(event) => setRenameSeasonId(event.target.value)}
          >
            {seasonList.map((season) => (
              <option key={season.id} value={season.id}>
                {season.name}{season.isActive ? " (current)" : ""}
              </option>
            ))}
          </select>
          <input
            name="name"
            className="rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="Updated season name"
            required
            minLength={2}
            maxLength={80}
          />
          <p className="text-xs text-muted-foreground">
            Renaming changes display text only. Scores and dates stay the same.
          </p>
          <button
            type="submit"
            disabled={renameSeasonPending}
            className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {renameSeasonPending ? "Saving..." : "Rename season"}
          </button>
        </form>
      </div>
    </section>
  );
}
