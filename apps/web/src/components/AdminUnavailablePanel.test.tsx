import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AdminUnavailablePanel } from "./AdminUnavailablePanel";

describe("AdminUnavailablePanel", () => {
  it("explains that only admin tools failed and offers a dashboard reload", () => {
    render(<AdminUnavailablePanel />);

    expect(screen.getByText("Manage tools unavailable")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Admin tools could not be loaded" })).toBeInTheDocument();
    expect(screen.getByText(/The dashboard is still available/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /reload dashboard/i })).toHaveAttribute("href", "/");
  });
});
