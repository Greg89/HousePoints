import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import AboutPage, { metadata as aboutMetadata } from "./about/page";
import PrivacyPage, { metadata as privacyMetadata } from "./privacy/page";
import SupportPage, { metadata as supportMetadata } from "./support/page";

describe("public store information pages", () => {
  it("publishes a public HousePoints product homepage", () => {
    render(<AboutPage />);

    expect(screen.getByRole("heading", { name: "HousePoints" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "What HousePoints does" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "HousePoints Privacy Policy" })).toHaveAttribute(
      "href",
      "/privacy",
    );
    expect(screen.getByRole("link", { name: "HousePoints Support" })).toHaveAttribute(
      "href",
      "/support",
    );
    expect(aboutMetadata.title).toBe("HousePoints | Recognition and House Scoring");
  });

  it("publishes privacy information without requiring authentication", () => {
    render(<PrivacyPage />);

    expect(screen.getByRole("heading", { name: "Privacy Policy" })).toBeInTheDocument();
    expect(screen.getByText(/information we process/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "dodson.gregory@gmail.com" })).toHaveAttribute(
      "href",
      "mailto:dodson.gregory@gmail.com",
    );
    expect(privacyMetadata.title).toBe("Privacy Policy | HousePoints");
  });

  it("publishes support guidance and contact information", () => {
    render(<SupportPage />);

    expect(screen.getByRole("heading", { name: "Support" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Signing in" })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "dodson.gregory@gmail.com" })[0]).toHaveAttribute(
      "href",
      "mailto:dodson.gregory@gmail.com",
    );
    expect(supportMetadata.title).toBe("Support | HousePoints");
  });
});
