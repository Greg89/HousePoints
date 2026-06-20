import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import GlobalError from "./error";

describe("GlobalError", () => {
  it("offers retry and logout recovery actions", () => {
    render(
      <GlobalError
        error={new Error("Session failed")}
        reset={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /sign out and start over/i })).toHaveAttribute(
      "href",
      "/auth/logout",
    );
    expect(screen.getByRole("link", { name: /go home/i })).toHaveAttribute("href", "/");
  });
});
