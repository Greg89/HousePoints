import { useState, useTransition, type FormEvent } from "react";
import { PencilSimple, Plus } from "@phosphor-icons/react";
import { toast } from "sonner";
import type { HouseMutationResult } from "@/lib/action-results";
import type { AdminHouse } from "./AdminManageTypes";

interface HouseManagementProps {
  houses: AdminHouse[];
  onCreateHouse: (formData: FormData) => Promise<HouseMutationResult>;
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

export function HouseManagement({ houses, onCreateHouse }: HouseManagementProps) {
  const [createPending, startCreate] = useTransition();
  const [editPending, startEdit] = useTransition();
  const [editHouseName, setEditHouseName] = useState("");
  const [editHouseColor, setEditHouseColor] = useState(DEFAULT_HOUSE_COLOR);

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
        form.reset();
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
        form.reset();
      } catch (err) {
        toast.error("Failed to update house", {
          description: err instanceof Error ? err.message : "Something went wrong",
        });
      }
    });
  }

  return (
    <section className="space-y-6">
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
            {houses.map((house) => (
              <option key={house.id} value={house.name}>{house.name}</option>
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
  );
}
