import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { RecognitionCategory } from "@housepoints/contracts";
import { RecognitionManagement } from "./RecognitionManagement";

const category = (id: string, name: string, archivedAt: string | null = null): RecognitionCategory => ({
  id, name, archivedAt, description: null, legacyTrait: null, createdAt: "2026-09-20T12:00:00.000Z",
});

function setup(overrides: Partial<React.ComponentProps<typeof RecognitionManagement>> = {}) {
  const props = {
    initialCategories: [category("first", "Community Impact"), category("second", "Team Spirit")],
    isOwner: true,
    onList: vi.fn().mockResolvedValue([category("first", "Community Impact"), category("second", "Team Spirit")]),
    onCreate: vi.fn().mockResolvedValue({ ok: true }),
    onArchive: vi.fn().mockResolvedValue({ ok: true }),
    ...overrides,
  };
  render(<RecognitionManagement {...props} />);
  return { props, user: userEvent.setup() };
}

describe("RecognitionManagement", () => {
  it("shows admin read access without mutation controls", () => {
    setup({ isOwner: false });
    expect(screen.getByText(/Only organization owners/)).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Active categories" })).toHaveTextContent("Community Impact");
    expect(screen.queryByRole("button", { name: "Archive" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add category" })).not.toBeInTheDocument();
  });

  it("keeps archived names in history and permits a new identity with that name", async () => {
    const archived = category("old", "Community Impact", "2026-09-21T12:00:00.000Z");
    const replacement = category("new", "Community Impact");
    const { user, props } = setup({
      initialCategories: [archived, category("second", "Team Spirit")],
      onList: vi.fn().mockResolvedValue([archived, category("second", "Team Spirit"), replacement]),
    });
    expect(within(screen.getByRole("region", { name: "Archived categories" })).getByText(/Community Impact/)).toBeInTheDocument();
    await user.type(screen.getByRole("textbox", { name: "Name" }), "Community Impact");
    await user.click(screen.getByRole("button", { name: "Add category" }));
    await waitFor(() => expect(props.onCreate).toHaveBeenCalledWith(expect.objectContaining({ name: "Community Impact", idempotencyKey: expect.any(String) })));
    await waitFor(() => expect(within(screen.getByRole("region", { name: "Active categories" })).getByText("Community Impact")).toBeInTheDocument());
    expect(within(screen.getByRole("region", { name: "Archived categories" })).getByText(/Community Impact/)).toBeInTheDocument();
  });

  it("requires confirmation and preserves the final active category", async () => {
    const { user, props } = setup({ onList: vi.fn().mockResolvedValue([category("first", "Community Impact", "2026-09-22T12:00:00.000Z"), category("second", "Team Spirit")]) });
    await user.click(screen.getAllByRole("button", { name: "Archive" })[0]);
    await user.click(screen.getByRole("button", { name: "Confirm archive" }));
    await waitFor(() => expect(props.onArchive).toHaveBeenCalledWith("first"));
    await waitFor(() => expect(screen.getByText(/Add another category before archiving/)).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Archive" })).toBeDisabled();
  });

  it("shows API errors without clearing the form", async () => {
    const { user } = setup({ onCreate: vi.fn().mockResolvedValue({ ok: false, code: "RECOGNITION_CATEGORY_NAME_IN_USE", message: "An active category uses that name." }) });
    await user.type(screen.getByRole("textbox", { name: "Name" }), "Team Spirit");
    await user.click(screen.getByRole("button", { name: "Add category" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("An active category uses that name.");
    expect(screen.getByRole("textbox", { name: "Name" })).toHaveValue("Team Spirit");
  });
});
