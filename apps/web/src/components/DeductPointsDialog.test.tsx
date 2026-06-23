import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { DeductPointsDialog } from "./DeductPointsDialog";

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
    disabled?: boolean;
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
        aria-controls="deduct-points-select-options"
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
    displayName: "Alice Samehouse",
    role: "MEMBER" as const,
    houseId: "house-1",
    houseName: "Slytherin",
    houseColor: "#22c55e",
  },
  {
    id: "member-2",
    displayName: "Cara Otherhouse",
    role: "MEMBER" as const,
    houseId: "house-2",
    houseName: "Ravenclaw",
    houseColor: "#1d4ed8",
  },
];

async function fillDeductForm(user: ReturnType<typeof userEvent.setup>) {
  const dialog = screen.getByRole("dialog", { name: "Deduct Points" });

  await user.click(within(dialog).getByRole("combobox"));
  await user.click(await screen.findByRole("option", { name: /Cara Otherhouse/ }));
  await user.type(
    within(dialog).getByPlaceholderText("Explain why points are being deducted..."),
    "Missed the agreed cleanup rotation",
  );
}

function setupDialog(overrides: Partial<React.ComponentProps<typeof DeductPointsDialog>> = {}) {
  const props = {
    open: true,
    onOpenChange: vi.fn(),
    members,
    actorHouseId: "house-1",
    onDeduct: vi.fn().mockResolvedValue({ ok: true }),
    ...overrides,
  };

  render(<DeductPointsDialog {...props} />);

  return {
    props,
    user: userEvent.setup(),
  };
}

describe("DeductPointsDialog", () => {
  it("only lists members from another house", () => {
    setupDialog();

    expect(screen.queryByRole("option", { name: /Alice Samehouse/ })).not.toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Cara Otherhouse/ })).toBeInTheDocument();
  });

  it("shows a success toast and closes when the typed result succeeds", async () => {
    const { props, user } = setupDialog();

    await fillDeductForm(user);
    await user.click(screen.getByRole("button", { name: "Deduct 10 Points" }));

    await waitFor(() => expect(props.onDeduct).toHaveBeenCalledWith(
      "member-2",
      "Missed the agreed cleanup rotation",
    ));
    expect(toast.success).toHaveBeenCalledWith("Points deducted", {
      description: "-10 pts from Cara Otherhouse",
    });
    expect(props.onOpenChange).toHaveBeenCalledWith(false);
  }, 10_000);

  it("shows a safe error toast without closing when the typed result fails", async () => {
    const { props, user } = setupDialog({
      onDeduct: vi.fn().mockResolvedValue({
        ok: false,
        code: "DEDUCTION_COOLDOWN_ACTIVE",
        message: "Your house has already deducted points in the last 24 hours.",
      }),
    });

    await fillDeductForm(user);
    await user.click(screen.getByRole("button", { name: "Deduct 10 Points" }));

    await waitFor(() => expect(props.onDeduct).toHaveBeenCalledOnce());
    expect(toast.error).toHaveBeenCalledWith("Failed to deduct points", {
      description: "Your house has already deducted points in the last 24 hours.",
    });
    expect(props.onOpenChange).not.toHaveBeenCalledWith(false);
  }, 10_000);
});
