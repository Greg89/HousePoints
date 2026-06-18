import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HouseCard } from "./HouseCard";

vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
      <div {...props}>{children}</div>
    ),
  },
}));

const house = {
  id: "house-1",
  name: "Slytherin",
  color: "#22c55e",
  description: "Values ambition.",
  score: 150,
  transactions: 3,
  memberCount: 2,
};

describe("HouseCard", () => {
  it("uses a neutral selected ring while keeping the house color accent", () => {
    render(<HouseCard house={house} rank={1} selected />);

    const card = screen.getByRole("button", { name: /slytherin/i });
    expect(card).toHaveAttribute("aria-pressed", "true");
    expect(card).toHaveClass("ring-foreground");
    expect(card).toHaveStyle({ borderTop: `4px solid ${house.color}` });
  });
});
