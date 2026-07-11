import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { redirect } from "next/navigation";
import { readSessionSummary } from "@/app/actions/profile";
import SettingsPage from "./page";

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));

vi.mock("@/app/actions/profile", () => ({
  readSessionSummary: vi.fn(),
  updateDisplayName: vi.fn(),
  updateHouseThemePreference: vi.fn(),
}));

vi.mock("@/components/DisplayNameForm", () => ({
  DisplayNameForm: ({ currentName }: { currentName: string }) => (
    <div data-testid="display-name-form">{currentName}</div>
  ),
}));

vi.mock("@/components/HouseThemeToggleForm", () => ({
  HouseThemeToggleForm: () => <div data-testid="house-theme-toggle" />,
}));

const readSessionSummaryMock = vi.mocked(readSessionSummary);
const redirectMock = vi.mocked(redirect);

describe("SettingsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders account profile settings and the create organization entry point", async () => {
    readSessionSummaryMock.mockResolvedValue({
      isAuthenticated: true,
      userName: "User One",
      userEmail: "user@example.com",
      role: "ADMIN",
      organizationSlug: "acme",
      houseName: "Blue House",
      houseColor: "#2563eb",
      houseThemeEnabled: false,
      organizationContexts: [
        {
          organizationId: "org-1",
          organizationName: "Acme Corp",
          organizationSlug: "acme",
          role: "ADMIN",
          houseId: "house-1",
          houseName: "Blue House",
          houseColor: "#2563eb",
          isCurrent: true,
        },
        {
          organizationId: "org-2",
          organizationName: "Beta Org",
          organizationSlug: "beta",
          role: "OWNER",
          houseId: null,
          houseName: null,
          houseColor: null,
          isCurrent: false,
        },
      ],
    });

    render(await SettingsPage());

    expect(screen.getByRole("heading", { name: "Account" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Account settings sections" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /profile/i })).toHaveAttribute("href", "#profile");
    expect(screen.getByRole("link", { name: /organisations/i })).toHaveAttribute("href", "#organisations");
    expect(screen.getByRole("link", { name: /preferences/i })).toHaveAttribute("href", "#preferences");
    expect(screen.getByText("user@example.com")).toBeInTheDocument();
    expect(screen.getByTestId("display-name-form")).toHaveTextContent("User One");
    expect(screen.getByRole("heading", { name: "Organisations" })).toBeInTheDocument();
    expect(screen.getByText("Acme Corp")).toBeInTheDocument();
    expect(screen.getByText("Beta Org")).toBeInTheDocument();
    expect(screen.getByText("Current")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /beta org/i })).toHaveAttribute("href", "/o/beta/switch");
    expect(screen.getByRole("link", { name: "Create organisation" })).toHaveAttribute("href", "/orgs/new");
  });

  it("applies house theme surfaces when the user preference is enabled", async () => {
    readSessionSummaryMock.mockResolvedValue({
      isAuthenticated: true,
      userName: "User One",
      userEmail: "user@example.com",
      role: "ADMIN",
      organizationSlug: "acme",
      houseName: "Blue House",
      houseColor: "#2563eb",
      houseThemeEnabled: true,
      houseThemeMode: "CUSTOM",
      houseThemeSecondaryColor: "#22c55e",
      houseThemeSurfaceColor: "#f0fdf4",
      organizationContexts: [],
    });

    const { container } = render(await SettingsPage());

    expect(container.firstElementChild).toHaveStyle({
      "--primary": "#2563eb",
      "--secondary": "#22c55e",
      "--house-surface": "#f0fdf4",
    });
    expect(container.firstElementChild).toHaveClass("house-theme-shell");
    expect(screen.getByRole("banner")).toHaveClass("house-theme-header");
    expect(screen.getByRole("navigation", { name: "Account settings sections" })).toHaveClass("house-theme-card");
  });

  it("redirects unauthenticated users to login", async () => {
    readSessionSummaryMock.mockResolvedValue({
      isAuthenticated: false,
    });

    await expect(SettingsPage()).rejects.toThrow("NEXT_REDIRECT:/auth/login");

    expect(redirectMock).toHaveBeenCalledWith("/auth/login");
  });
});
