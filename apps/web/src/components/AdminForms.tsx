"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Check,
  Calendar,
  Copy,
  House,
  LinkSimple,
  PencilSimple,
  Plus,
  Trash,
  UserSwitch,
  UsersThree,
} from "@phosphor-icons/react";
import type { DeletedPoint, Season, SeasonTransition, UserRole } from "@housepoints/contracts";
import type {
  CreateInviteResult,
  HouseAssignmentResult,
  HouseMutationResult,
  RenameSeasonResult,
  StartSeasonResult,
} from "@/lib/action-results";

interface AdminUser {
  id: string;
  displayName: string;
  houseId?: string | null;
}

interface AdminHouse {
  id: string;
  name: string;
  color?: string;
}

interface AdminFormsProps {
  users: AdminUser[];
  houses: AdminHouse[];
  seasons: Season[];
  activeSeason: Season;
  actorRole: UserRole;
  recentDeletedPoints: DeletedPoint[];
  onCreateHouse: (formData: FormData) => Promise<HouseMutationResult>;
  onAssignHouse: (formData: FormData) => Promise<HouseAssignmentResult>;
  onCreateInvite: () => Promise<CreateInviteResult>;
  onStartSeason: (formData: FormData) => Promise<StartSeasonResult<SeasonTransition>>;
  onRenameSeason: (formData: FormData) => Promise<RenameSeasonResult<Season>>;
}

const DEFAULT_HOUSE_COLOR = "#7c3aed";
const HEX_COLOR_PATTERN = /^#[\da-f]{6}$/i;

function getHouseColor(house?: AdminHouse) {
  return house?.color && HEX_COLOR_PATTERN.test(house.color) ? house.color : DEFAULT_HOUSE_COLOR;
}

function ColorField({
  id,
  label,
  value,
  defaultValue = DEFAULT_HOUSE_COLOR,
  onChange,
}: {
  id: string;
  label: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
}) {
  return (
    <label
      htmlFor={id}
      className="flex items-center justify-between gap-3 rounded-lg border bg-background px-3 py-2"
    >
      <span>
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-xs text-muted-foreground">Choose a house accent color</span>
      </span>
      <input
        id={id}
        name="color"
        type="color"
        value={value}
        defaultValue={value === undefined ? defaultValue : undefined}
        onChange={(event) => onChange?.(event.target.value)}
        className="h-9 w-12 flex-shrink-0 cursor-pointer rounded-md border bg-transparent p-1"
      />
    </label>
  );
}

export function AdminForms({
  users,
  houses,
  seasons,
  activeSeason,
  actorRole,
  recentDeletedPoints,
  onCreateHouse,
  onAssignHouse,
  onCreateInvite,
  onStartSeason,
  onRenameSeason,
}: AdminFormsProps) {
  const [createPending, startCreate] = useTransition();
  const [editPending, startEdit] = useTransition();
  const [assignPending, startAssign] = useTransition();
  const [invitePending, startInvite] = useTransition();
  const [startSeasonPending, startStartSeason] = useTransition();
  const [renameSeasonPending, startRenameSeason] = useTransition();
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [inviteExpiry, setInviteExpiry] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [editHouseName, setEditHouseName] = useState("");
  const [editHouseColor, setEditHouseColor] = useState(DEFAULT_HOUSE_COLOR);
  const [seasonList, setSeasonList] = useState(seasons);
  const [currentSeason, setCurrentSeason] = useState(activeSeason);
  const [renameSeasonId, setRenameSeasonId] = useState(activeSeason.id);
  const canStartSeason = actorRole === "OWNER" || actorRole === "ADMIN";
  const unassignedUsers = users.filter((user) => !user.houseId);
  const assignedUsers = users.filter((user) => user.houseId);
  const unassignedCount = unassignedUsers.length;
  const deletedPointsTotal = recentDeletedPoints.reduce((total, point) => total + point.delta, 0);
  const latestDeletedPoint = recentDeletedPoints[0] ?? null;
  const unassignedSummary =
    unassignedCount === 1 ? "1 needs assignment" : `${unassignedCount} need assignment`;

  function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = String(formData.get("name") ?? "").trim();
    const form = e.currentTarget;
    startCreate(async () => {
      try {
        const result = await onCreateHouse(formData);

        if (!result.ok) {
          toast.error("Failed to create house", {
            description: result.message,
          });
          return;
        }

        toast.success("House created", { description: name });
        form.reset();
      } catch (err) {
        toast.error("Failed to create house", {
          description: err instanceof Error ? err.message : "Something went wrong",
        });
      }
    });
  }

  function handleEdit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = String(formData.get("name") ?? "").trim();
    const form = e.currentTarget;
    startEdit(async () => {
      try {
        const result = await onCreateHouse(formData);

        if (!result.ok) {
          toast.error("Failed to update house", {
            description: result.message,
          });
          return;
        }

        toast.success("House updated", { description: name });
        setEditHouseName("");
        setEditHouseColor(DEFAULT_HOUSE_COLOR);
        form.reset();
      } catch (err) {
        toast.error("Failed to update house", {
          description: err instanceof Error ? err.message : "Something went wrong",
        });
      }
    });
  }

  function handleAssign(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const form = e.currentTarget;
    const userName = users.find((u) => u.id === formData.get("targetUserId"))?.displayName;
    const houseName = houses.find((h) => h.id === formData.get("targetHouseId"))?.name;
    startAssign(async () => {
      try {
        const result = await onAssignHouse(formData);

        if (!result.ok) {
          toast.error("Failed to assign house", {
            description: result.message,
          });
          return;
        }

        toast.success("House assigned", {
          description: `${userName} -> ${houseName}`,
        });
        form.reset();
      } catch (err) {
        toast.error("Failed to assign house", {
          description: err instanceof Error ? err.message : "Something went wrong",
        });
      }
    });
  }

  function handleInvite() {
    startInvite(async () => {
      try {
        const result = await onCreateInvite();

        if (!result.ok) {
          toast.error("Failed to generate invite", {
            description: result.message,
          });
          return;
        }

        setInviteToken(result.token);
        setInviteExpiry(result.expiresAt);
        setCopied(false);
      } catch (err) {
        toast.error("Failed to generate invite", {
          description: err instanceof Error ? err.message : "Something went wrong",
        });
      }
    });
  }

  async function handleCopy() {
    if (!inviteToken) return;
    await navigator.clipboard.writeText(inviteToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleStartSeason(e: React.FormEvent<HTMLFormElement>) {
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

  function handleRenameSeason(e: React.FormEvent<HTMLFormElement>) {
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
    <div className="space-y-6">
      <div className="rounded-2xl border bg-card p-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-medium text-primary">Organization tools</p>
            <h3 className="font-display text-2xl font-semibold mt-1">Manage your team</h3>
            <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
              Invite teammates, tune the houses, and keep every member assigned without leaving the dashboard.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:min-w-[28rem] lg:grid-cols-4">
            <div className="rounded-xl border bg-background/60 p-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <UsersThree size={14} />
                Members
              </div>
              <p className="font-number text-2xl font-bold mt-1">{users.length}</p>
            </div>
            <div className="rounded-xl border bg-background/60 p-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <House size={14} />
                Houses
              </div>
              <p className="font-number text-2xl font-bold mt-1">{houses.length}</p>
            </div>
            <div className="rounded-xl border bg-background/60 p-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <UserSwitch size={14} />
                Unassigned
              </div>
              <p className="font-number text-2xl font-bold mt-1">{unassignedCount}</p>
            </div>
            <div className="rounded-xl border bg-background/60 p-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Trash size={14} />
                Deleted
              </div>
              <p className="font-number text-2xl font-bold mt-1">{recentDeletedPoints.length}</p>
            </div>
          </div>
        </div>
      </div>

      <section className="rounded-2xl border bg-card p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-medium text-primary">Admin reporting</p>
            <h4 className="font-display text-xl font-semibold mt-1">Recently deleted point awards</h4>
            <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
              Deleted awards are removed from scoring, but stay visible here for review.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:min-w-72">
            <div className="rounded-xl border bg-background/60 p-3">
              <p className="text-xs text-muted-foreground">Awards deleted</p>
              <p className="font-number text-2xl font-bold mt-1">{recentDeletedPoints.length}</p>
            </div>
            <div className="rounded-xl border bg-background/60 p-3">
              <p className="text-xs text-muted-foreground">Points removed</p>
              <p className="font-number text-2xl font-bold mt-1">{deletedPointsTotal}</p>
            </div>
          </div>
        </div>
        {latestDeletedPoint ? (
          <p className="mt-4 rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            Latest deletion: {latestDeletedPoint.deletedByName ?? "Unknown admin"} removed{" "}
            {latestDeletedPoint.delta} points from {latestDeletedPoint.targetUserName} on{" "}
            {new Date(latestDeletedPoint.deletedAt).toLocaleString()}.
          </p>
        ) : null}
        <div className="mt-5 overflow-hidden rounded-xl border">
          {recentDeletedPoints.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              No point awards have been deleted recently.
            </p>
          ) : (
            <div className="divide-y">
              {recentDeletedPoints.map((point) => (
                <article key={point.id} className="grid gap-2 p-4 sm:grid-cols-[1fr_auto] sm:items-start">
                  <div>
                    <p className="text-sm font-semibold">
                      {point.deletedByName ?? "Unknown admin"} deleted {point.delta} points to{" "}
                      {point.targetUserName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Original award from {point.actorName} to {point.targetHouseName} on{" "}
                      {new Date(point.createdAt).toLocaleString()}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                      {point.deletionReason || point.reason}
                    </p>
                  </div>
                  <span className="rounded-full border bg-background px-2 py-1 text-xs font-medium text-muted-foreground">
                    {new Date(point.deletedAt).toLocaleDateString()}
                  </span>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)]">
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

          <div>
            <h4 className="font-display text-lg font-semibold">Houses</h4>
            <p className="text-sm text-muted-foreground">
              Create new houses or update the details shown on the scoreboard.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <form
              aria-label="Create house"
              onSubmit={handleCreate}
              className="grid gap-3 rounded-xl border p-5 bg-card"
            >
              <h5 className="text-sm font-semibold flex items-center gap-2">
                <Plus size={16} />
                Create House
              </h5>
              <input
                name="name"
                className="rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="House name"
                required
              />
              <ColorField id="create-house-color" label="House color" />
              <input
                name="description"
                className="rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Description (optional)"
              />
              <button
                type="submit"
                disabled={createPending}
                className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {createPending ? "Creating..." : "Create"}
              </button>
            </form>

            <form
              aria-label="Edit house"
              onSubmit={handleEdit}
              className="grid gap-3 rounded-xl border p-5 bg-card"
            >
              <h5 className="text-sm font-semibold flex items-center gap-2">
                <PencilSimple size={16} />
                Edit House
              </h5>
              <select
                name="name"
                aria-label="House to edit"
                className="rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none"
                required
                value={editHouseName}
                onChange={(event) => {
                  const selectedHouseName = event.target.value;
                  setEditHouseName(selectedHouseName);
                  setEditHouseColor(
                    getHouseColor(houses.find((house) => house.name === selectedHouseName)),
                  );
                }}
              >
                <option value="" disabled>Select house...</option>
                {houses.map((h) => (
                  <option key={h.id} value={h.name}>{h.name}</option>
                ))}
              </select>
              <ColorField
                id="edit-house-color"
                label="New color"
                value={editHouseColor}
                onChange={setEditHouseColor}
              />
              <input
                name="description"
                className="rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Description (optional)"
              />
              <button
                type="submit"
                disabled={editPending}
                className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {editPending ? "Saving..." : "Save changes"}
              </button>
            </form>
          </div>
        </section>

        <section className="space-y-6">
          <div>
            <h4 className="font-display text-lg font-semibold">Team Setup</h4>
            <p className="text-sm text-muted-foreground">
              Bring new members in and place them into the right house.
            </p>
          </div>

          <form
            aria-label="Assign user to house"
            onSubmit={handleAssign}
            className="grid gap-3 rounded-xl border p-5 bg-card"
          >
            <h5 className="flex items-center justify-between gap-3 text-sm font-semibold">
              <span className="flex items-center gap-2">
                <UserSwitch size={16} />
                Assign User to House
              </span>
              {unassignedCount > 0 ? (
                <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                  {unassignedSummary}
                </span>
              ) : null}
            </h5>
            <select
              name="targetUserId"
              aria-label="Member to assign"
              className="rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none"
              required
              defaultValue=""
            >
              <option value="" disabled>
                {unassignedCount > 0 ? `Select member... ${unassignedSummary}` : "Select member..."}
              </option>
              {unassignedUsers.length > 0 ? (
                <optgroup label={`Needs assignment (${unassignedUsers.length})`}>
                  {unassignedUsers.map((u) => (
                    <option key={u.id} value={u.id}>{u.displayName} - Needs assignment</option>
                  ))}
                </optgroup>
              ) : null}
              {assignedUsers.length > 0 ? (
                <optgroup label="Assigned members">
                  {assignedUsers.map((u) => (
                    <option key={u.id} value={u.id}>{u.displayName}</option>
                  ))}
                </optgroup>
              ) : null}
            </select>
            <p className="text-xs text-muted-foreground">
              {unassignedCount > 0
                ? `${unassignedCount} ${unassignedCount === 1 ? "member needs" : "members need"} a house. They appear first in this list.`
                : "All members currently have a house. Select anyone to move them."}
            </p>
            <select
              name="targetHouseId"
              aria-label="House assignment"
              className="rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none"
              required
              defaultValue=""
            >
              <option value="" disabled>Select house...</option>
              {houses.map((h) => (
                <option key={h.id} value={h.id}>{h.name}</option>
              ))}
            </select>
            <button
              type="submit"
              disabled={assignPending}
              className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {assignPending ? "Assigning..." : "Assign"}
            </button>
          </form>

          <div className="grid gap-3 rounded-xl border p-5 bg-card">
            <h5 className="text-sm font-semibold flex items-center gap-2">
              <LinkSimple size={16} />
              Invite Member
            </h5>
            <p className="text-xs text-muted-foreground">
              Generate a single-use token valid for 72 hours. Share it with the new member.
            </p>
            {inviteToken ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2">
                  <code className="text-xs font-mono flex-1 truncate">{inviteToken}</code>
                  <button
                    onClick={handleCopy}
                    className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                    title="Copy token"
                  >
                    {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Expires: {new Date(inviteExpiry!).toLocaleString()}
                </p>
                <button
                  onClick={() => { setInviteToken(null); setInviteExpiry(null); }}
                  className="text-xs text-muted-foreground hover:text-foreground underline"
                >
                  Generate another
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleInvite}
                disabled={invitePending}
                className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {invitePending ? "Generating..." : "Generate invite token"}
              </button>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
