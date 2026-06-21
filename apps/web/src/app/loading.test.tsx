import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Loading from "./loading";

describe("Loading", () => {
  it("renders an accessible dashboard loading state", () => {
    render(<Loading />);

    expect(screen.getByRole("status", { name: "Loading dashboard" })).toBeInTheDocument();
  });
});
