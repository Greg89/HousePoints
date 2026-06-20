import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { AwardPointsDialog } from "./AwardPointsDialog";

vi.mock("framer-motion", () => ({
  motion: {
    button: ({
      children,
      whileHover,
      whileTap,
      ...props
    }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
      whileHover?: unknown;
      whileTap?: unknown;
    }) => {
      void whileHover;
      void whileTap;
      return <button {...props}>{children}</button>;
    },
  },
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@radix-ui/react-select", async () => {
  const { createContext, useContext } = await import("react");

  type SelectContextValue = {
    value: string;
    onValueChange: (value: string) => void;
  };
  type SelectRootProps = React.PropsWithChildren<{
    value?: string;
    onValueChange?: (value: string) => void;
  }>;
  type SelectItemProps = React.PropsWithChildren<{
    className?: string;
    value: string;
  }>;
  type SelectPassthroughProps = React.PropsWithChildren<{
    className?: string;
    placeholder?: string;
    position?: string;
    sideOffset?: number;
  }>;

  const SelectContext = createContext<SelectContextValue | null>(null);

  function Root({ value = "", onValueChange = () => undefined, children }: SelectRootProps) {
    return (
      <SelectContext.Provider value={{ value, onValueChange }}>
        {children}
      </SelectContext.Provider>
    );
  }

  function Trigger({ children, className }: SelectPassthroughProps) {
    return (
      <button
        type="button"
        role="combobox"
        aria-controls="award-points-select-options"
        aria-expanded="true"
        className={className}
      >
        {children}
      </button>
    );
  }

  function Value({ children, placeholder }: SelectPassthroughProps) {
    return <span>{children ?? placeholder}</span>;
  }

  function Item({ children, className, value }: SelectItemProps) {
    const context = useContext(SelectContext);
    if (!context) throw new Error("Select.Item must be rendered inside Select.Root");

    return (
      <button
        type="button"
        role="option"
        aria-selected={context.value === value}
        className={className}
        onClick={() => context.onValueChange(value)}
      >
        {children}
      </button>
    );
  }

  function Passthrough({ children }: SelectPassthroughProps) {
    return <>{children}</>;
  }

  return {
    Content: Passthrough,
    Icon: Passthrough,
    Item,
    ItemIndicator: Passthrough,
    ItemText: Passthrough,
    Portal: Passthrough,
    Root,
    Trigger,
    Value,
    Viewport: Passthrough,
  };
});

const members = [
  {
    id: "member-1",
    displayName: "Alice Assigned",
    role: "MEMBER" as const,
    houseId: "house-1",
    houseName: "Slytherin",
    houseColor: "#22c55e",
  },
];

const houses = [
  {
    id: "house-1",
    name: "Slytherin",
    color: "#22c55e",
    description: "Values ambition.",
    score: 150,
    transactions: 3,
    memberCount: 2,
  },
];

async function fillAwardForm(user: ReturnType<typeof userEvent.setup>) {
  const dialog = screen.getByRole("dialog", { name: "Award Points" });
  const selects = within(dialog).getAllByRole("combobox");

  await user.click(selects[0]);
  await user.click(await screen.findByRole("option", { name: /Alice Assigned/ }));

  await user.click(selects[1]);
  await user.click(await screen.findByRole("option", { name: "Team Support" }));

  await user.click(within(dialog).getByRole("button", { name: "+10" }));
  await user.type(
    within(dialog).getByPlaceholderText("Describe what they did well…"),
    "Great teamwork",
  );
}

function setupDialog(overrides: Partial<React.ComponentProps<typeof AwardPointsDialog>> = {}) {
  const props = {
    open: true,
    onOpenChange: vi.fn(),
    members,
    houses,
    onAward: vi.fn().mockResolvedValue({ ok: true }),
    ...overrides,
  };

  render(<AwardPointsDialog {...props} />);

  return {
    props,
    user: userEvent.setup(),
  };
}

describe("AwardPointsDialog", () => {
  it("shows a success toast and closes when the typed result succeeds", async () => {
    const { props, user } = setupDialog();

    await fillAwardForm(user);
    await user.click(screen.getByRole("button", { name: "Award Points" }));

    await waitFor(() => expect(props.onAward).toHaveBeenCalledWith(
      "member-1",
      10,
      "Great teamwork",
      "TEAM_SUPPORT",
    ));
    expect(toast.success).toHaveBeenCalledWith("Points awarded!", {
      description: "+10 pts to Alice Assigned",
    });
    expect(props.onOpenChange).toHaveBeenCalledWith(false);
  });

  it("shows a safe error toast without closing when the typed result fails", async () => {
    const { props, user } = setupDialog({
      onAward: vi.fn().mockResolvedValue({
        ok: false,
        code: "ACTIVE_SEASON_REQUIRED",
        message: "Points could not be awarded. Please try again.",
      }),
    });

    await fillAwardForm(user);
    await user.click(screen.getByRole("button", { name: "Award Points" }));

    await waitFor(() => expect(props.onAward).toHaveBeenCalledOnce());
    expect(toast.error).toHaveBeenCalledWith("Failed to award points", {
      description: "Points could not be awarded. Please try again.",
    });
    expect(props.onOpenChange).not.toHaveBeenCalledWith(false);
  });
});
