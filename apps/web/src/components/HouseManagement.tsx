import { useState, useTransition, type FormEvent } from "react";
import { PencilSimple, Plus, X } from "@phosphor-icons/react";
import { toast } from "sonner";
import type { HouseMutationResult } from "@/lib/action-results";
import { assessHouseThemeColor, resolveHouseThemeStyle } from "@/lib/house-theme";
import type { AdminHouse } from "./AdminManageTypes";

interface HouseManagementProps {
  houses: AdminHouse[];
  onCreateHouse: (formData: FormData) => Promise<HouseMutationResult>;
}

const DEFAULT_HOUSE_COLOR = "#7c3aed";
const DEFAULT_SECONDARY_COLOR = "#a78bfa";
const DEFAULT_SURFACE_COLOR = "#f5f3ff";
const HEX_COLOR_PATTERN = /^#[\da-f]{6}$/i;
type HouseThemeMode = "GENERATED" | "CUSTOM";

function getHouseColor(house?: AdminHouse) {
  return house?.color && HEX_COLOR_PATTERN.test(house.color) ? house.color : DEFAULT_HOUSE_COLOR;
}

function getHouseThemeMode(house?: AdminHouse): HouseThemeMode {
  return house?.themeMode === "CUSTOM" ? "CUSTOM" : "GENERATED";
}

function getOptionalHouseColor(value: string | null | undefined, fallback: string) {
  return value && HEX_COLOR_PATTERN.test(value) ? value : fallback;
}

function ThemeQualityPreview({
  color,
  themeMode = "GENERATED",
  secondaryColor,
  surfaceColor,
}: {
  color: string;
  themeMode?: HouseThemeMode;
  secondaryColor?: string | null;
  surfaceColor?: string | null;
}) {
  const assessment = assessHouseThemeColor(color);
  const themeStyle = resolveHouseThemeStyle({
    enabled: true,
    houseColor: color,
    themeMode,
    themeSecondaryColor: secondaryColor,
    themeSurfaceColor: surfaceColor,
  });
  const contrastLabel = assessment.contrastRatio
    ? `${assessment.contrastRatio.toFixed(1)}:1 contrast`
    : "Contrast unavailable";
  const badgeClassName =
    assessment.status === "ready"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : assessment.status === "subtle"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : "border-destructive/30 bg-destructive/10 text-destructive";

  return (
    <div
      className="rounded-xl border bg-background p-3"
      style={themeStyle}
      aria-live="polite"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${badgeClassName}`}>
          {assessment.status === "ready" ? "Theme ready" : assessment.status === "subtle" ? "Theme subtle" : "Invalid color"}
        </span>
        <span className="text-xs text-muted-foreground">
          {themeMode === "CUSTOM" ? "Custom palette" : "Generated palette"} · {contrastLabel}
        </span>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <span
          aria-hidden="true"
          className="h-10 w-10 rounded-full border shadow-sm"
          style={{ backgroundColor: assessment.normalizedColor ?? DEFAULT_HOUSE_COLOR }}
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">House theme preview</p>
          <p className="text-xs text-muted-foreground">{assessment.message}</p>
        </div>
      </div>
      <div
        role="group"
        aria-label="Generated house theme preview"
        className="mt-3 overflow-hidden rounded-xl border bg-card shadow-sm"
      >
        <div className="house-theme-header flex items-center justify-between border-b bg-card/90 px-3 py-2">
          <span className="font-display text-sm font-semibold text-primary">House Points</span>
          <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-bold text-primary">
            House badge
          </span>
        </div>
        <div className="house-theme-shell space-y-3 p-3">
          <div className="house-theme-card rounded-lg border p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Selected surface
            </p>
            <p className="mt-1 text-sm font-semibold">Dashboard card preview</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
              Badge
            </span>
            <span className="rounded-lg border border-primary/30 px-3 py-1 text-xs font-semibold text-primary">
              Outline
            </span>
            <button
              type="button"
              className="rounded-lg bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground"
            >
              Button
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ColorField({
  id,
  label,
  value,
  defaultValue = DEFAULT_HOUSE_COLOR,
  name = "color",
  description = "Choose a house accent color",
  onChange,
  disabled = false,
}: {
  id: string;
  label: string;
  value?: string;
  defaultValue?: string;
  name?: string;
  description?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <label
      htmlFor={id}
      className="flex items-center justify-between gap-3 rounded-lg border bg-background px-3 py-2"
    >
      <span>
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-xs text-muted-foreground">{description}</span>
      </span>
      <input
        id={id}
        name={name}
        aria-label={label}
        type="color"
        value={value}
        defaultValue={value === undefined ? defaultValue : undefined}
        onChange={(event) => onChange?.(event.target.value)}
        disabled={disabled}
        className="h-9 w-12 flex-shrink-0 cursor-pointer rounded-md border bg-transparent p-1"
      />
    </label>
  );
}

function ThemePaletteControls({
  idBase,
  mode,
  onModeChange,
  secondaryColor,
  onSecondaryColorChange,
  surfaceColor,
  onSurfaceColorChange,
}: {
  idBase: string;
  mode: HouseThemeMode;
  onModeChange: (mode: HouseThemeMode) => void;
  secondaryColor: string;
  onSecondaryColorChange: (value: string) => void;
  surfaceColor: string;
  onSurfaceColorChange: (value: string) => void;
}) {
  const customMode = mode === "CUSTOM";

  return (
    <fieldset className="space-y-3 rounded-xl border bg-background/60 p-3">
      <legend className="px-1 text-sm font-semibold">Advanced theme</legend>
      <p className="text-xs text-muted-foreground">
        Generate a safe palette from the house color, or override the supporting colors for a stronger house identity.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="flex cursor-pointer items-start gap-2 rounded-lg border bg-card px-3 py-2 text-sm">
          <input
            type="radio"
            name="themeMode"
            aria-label="Generate palette"
            value="GENERATED"
            checked={mode === "GENERATED"}
            onChange={() => onModeChange("GENERATED")}
            className="mt-1"
          />
          <span>
            <span className="block font-medium">Generate palette</span>
            <span className="block text-xs text-muted-foreground">Recommended default.</span>
          </span>
        </label>
        <label className="flex cursor-pointer items-start gap-2 rounded-lg border bg-card px-3 py-2 text-sm">
          <input
            type="radio"
            name="themeMode"
            aria-label="Custom palette"
            value="CUSTOM"
            checked={customMode}
            onChange={() => onModeChange("CUSTOM")}
            className="mt-1"
          />
          <span>
            <span className="block font-medium">Custom palette</span>
            <span className="block text-xs text-muted-foreground">Tune secondary and surface colors.</span>
          </span>
        </label>
      </div>
      {customMode ? (
        <div className="grid gap-3">
          <ColorField
            id={`${idBase}-secondary-color`}
            name="themeSecondaryColor"
            label="Secondary color"
            description="Used for gradients and supporting accents"
            value={secondaryColor}
            onChange={onSecondaryColorChange}
          />
          <ColorField
            id={`${idBase}-surface-color`}
            name="themeSurfaceColor"
            label="Surface tint"
            description="Used for subtle page and card washes"
            value={surfaceColor}
            onChange={onSurfaceColorChange}
          />
        </div>
      ) : null}
    </fieldset>
  );
}

export function HouseManagement({ houses, onCreateHouse }: HouseManagementProps) {
  const [editorMode, setEditorMode] = useState<"create" | "edit" | null>(null);
  const [createPending, startCreate] = useTransition();
  const [editPending, startEdit] = useTransition();
  const [createHouseColor, setCreateHouseColor] = useState(DEFAULT_HOUSE_COLOR);
  const [createThemeMode, setCreateThemeMode] = useState<HouseThemeMode>("GENERATED");
  const [createSecondaryColor, setCreateSecondaryColor] = useState(DEFAULT_SECONDARY_COLOR);
  const [createSurfaceColor, setCreateSurfaceColor] = useState(DEFAULT_SURFACE_COLOR);
  const [editHouseName, setEditHouseName] = useState("");
  const [editHouseColor, setEditHouseColor] = useState(DEFAULT_HOUSE_COLOR);
  const [editHouseDescription, setEditHouseDescription] = useState("");
  const [editThemeMode, setEditThemeMode] = useState<HouseThemeMode>("GENERATED");
  const [editSecondaryColor, setEditSecondaryColor] = useState(DEFAULT_SECONDARY_COLOR);
  const [editSurfaceColor, setEditSurfaceColor] = useState(DEFAULT_SURFACE_COLOR);

  function handleCreate(e: FormEvent<HTMLFormElement>) {
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
        setCreateHouseColor(DEFAULT_HOUSE_COLOR);
        setCreateThemeMode("GENERATED");
        setCreateSecondaryColor(DEFAULT_SECONDARY_COLOR);
        setCreateSurfaceColor(DEFAULT_SURFACE_COLOR);
        form.reset();
        setEditorMode(null);
      } catch (err) {
        toast.error("Failed to create house", {
          description: err instanceof Error ? err.message : "Something went wrong",
        });
      }
    });
  }

  function handleEdit(e: FormEvent<HTMLFormElement>) {
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
        setEditHouseDescription("");
        setEditThemeMode("GENERATED");
        setEditSecondaryColor(DEFAULT_SECONDARY_COLOR);
        setEditSurfaceColor(DEFAULT_SURFACE_COLOR);
        form.reset();
        setEditorMode(null);
      } catch (err) {
        toast.error("Failed to update house", {
          description: err instanceof Error ? err.message : "Something went wrong",
        });
      }
    });
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="font-display text-xl font-semibold">Houses</h4>
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
              {houses.length}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Review each house, then create or update its identity and theme.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEditorMode("create")}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground"
        >
          <Plus size={16} />
          Create house
        </button>
      </div>

      {houses.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {houses.map((house) => (
            <button
              key={house.id}
              type="button"
              aria-label={`Edit ${house.name}`}
              onClick={() => {
                setEditHouseName(house.name);
                setEditHouseColor(getHouseColor(house));
                setEditHouseDescription(house.description ?? "");
                setEditThemeMode(getHouseThemeMode(house));
                setEditSecondaryColor(getOptionalHouseColor(house.themeSecondaryColor, DEFAULT_SECONDARY_COLOR));
                setEditSurfaceColor(getOptionalHouseColor(house.themeSurfaceColor, DEFAULT_SURFACE_COLOR));
                setEditorMode("edit");
              }}
              className="flex items-start gap-3 rounded-xl border bg-card p-4 text-left transition-colors hover:border-primary/40 hover:bg-muted/30"
            >
              <span
                className="mt-0.5 h-10 w-10 shrink-0 rounded-full border shadow-sm"
                style={{ backgroundColor: getHouseColor(house) }}
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-display text-lg font-semibold">{house.name}</span>
                <span className="mt-1 block text-sm text-muted-foreground">
                  {house.description || "No description yet"}
                </span>
                <span className="mt-2 block text-xs font-medium text-muted-foreground">
                  {getHouseThemeMode(house) === "CUSTOM" ? "Custom palette" : "Generated palette"}
                </span>
              </span>
              <PencilSimple size={16} className="shrink-0 text-muted-foreground" />
            </button>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed bg-card px-6 py-10 text-center">
          <p className="text-sm font-semibold">No houses yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Create the first house before assigning members.
          </p>
          <button
            type="button"
            onClick={() => setEditorMode("create")}
            className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            Create the first house
          </button>
        </div>
      )}

      {editorMode ? (
      <div className="max-w-2xl rounded-2xl border bg-card p-5 shadow-sm">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h5 className="font-display text-lg font-semibold">
              {editorMode === "create" ? "Create house" : `Edit ${editHouseName}`}
            </h5>
            <p className="mt-1 text-xs text-muted-foreground">
              {editorMode === "create"
                ? "Set the identity used throughout the organization."
                : "Update this house without affecting its members or score history."}
            </p>
          </div>
          <button type="button" onClick={() => setEditorMode(null)} aria-label="Close house editor" className="rounded-lg p-2 hover:bg-muted">
            <X size={17} />
          </button>
        </div>
        <div>
        {editorMode === "create" ? (
        <form
          aria-label="Create house"
          onSubmit={handleCreate}
          className="grid gap-3"
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
          <ColorField
            id="create-house-color"
            label="House color"
            value={createHouseColor}
            onChange={setCreateHouseColor}
          />
          <ThemePaletteControls
            idBase="create-house"
            mode={createThemeMode}
            onModeChange={setCreateThemeMode}
            secondaryColor={createSecondaryColor}
            onSecondaryColorChange={setCreateSecondaryColor}
            surfaceColor={createSurfaceColor}
            onSurfaceColorChange={setCreateSurfaceColor}
          />
          <ThemeQualityPreview
            color={createHouseColor}
            themeMode={createThemeMode}
            secondaryColor={createThemeMode === "CUSTOM" ? createSecondaryColor : null}
            surfaceColor={createThemeMode === "CUSTOM" ? createSurfaceColor : null}
          />
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
        ) : (
        <form
          aria-label="Edit house"
          onSubmit={handleEdit}
          className="grid gap-3"
        >
          <h5 className="text-sm font-semibold flex items-center gap-2">
            <PencilSimple size={16} />
            Edit House
          </h5>
          <input type="hidden" name="name" value={editHouseName} />
          <ColorField
            id="edit-house-color"
            label="New color"
            value={editHouseColor}
            onChange={setEditHouseColor}
          />
          <ThemePaletteControls
            idBase="edit-house"
            mode={editThemeMode}
            onModeChange={setEditThemeMode}
            secondaryColor={editSecondaryColor}
            onSecondaryColorChange={setEditSecondaryColor}
            surfaceColor={editSurfaceColor}
            onSurfaceColorChange={setEditSurfaceColor}
          />
          <ThemeQualityPreview
            color={editHouseColor}
            themeMode={editThemeMode}
            secondaryColor={editThemeMode === "CUSTOM" ? editSecondaryColor : null}
            surfaceColor={editThemeMode === "CUSTOM" ? editSurfaceColor : null}
          />
          <input
            name="description"
            value={editHouseDescription}
            onChange={(event) => setEditHouseDescription(event.target.value)}
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
        )}
        </div>
      </div>
      ) : null}
    </section>
  );
}
