import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { notFound, redirect } from "next/navigation";
import { readOrgRouteContext } from "@/app/actions/orgs";
import { renderDashboardPage } from "@/app/dashboard-page";
import { WebAuthenticationError } from "@/lib/api-client";
import OrganizationDashboardPage from "./page";

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));

vi.mock("@/app/actions/orgs", () => ({
  readOrgRouteContext: vi.fn(),
}));

vi.mock("@/app/dashboard-page", () => ({
  renderDashboardPage: vi.fn(),
}));

const readOrgRouteContextMock = vi.mocked(readOrgRouteContext);
const renderDashboardPageMock = vi.mocked(renderDashboardPage);
const notFoundMock = vi.mocked(notFound);
const redirectMock = vi.mocked(redirect);

function renderPage(slug: string) {
  return OrganizationDashboardPage({
    params: Promise.resolve({ slug }),
  });
}

describe("OrganizationDashboardPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    readOrgRouteContextMock.mockResolvedValue({
      status: "MATCH",
      requestedSlug: "acme",
      organizationSlug: "acme",
    });
    renderDashboardPageMock.mockResolvedValue(
      <main>
        <h1>Dashboard</h1>
      </main>,
    );
  });

  it("renders the shared dashboard for a matching organization slug", async () => {
    render(await renderPage("acme"));

    expect(screen.getByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
    expect(readOrgRouteContextMock).toHaveBeenCalledWith("acme", expect.any(String));
    expect(renderDashboardPageMock).toHaveBeenCalledWith("/o/acme");
  });

  it("renders the shared dashboard for signed-in users without an organization", async () => {
    readOrgRouteContextMock.mockResolvedValue({
      status: "NO_ACTOR_ORG",
      requestedSlug: "acme",
      organizationSlug: "acme",
    });

    render(await renderPage("acme"));

    expect(screen.getByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
    expect(renderDashboardPageMock).toHaveBeenCalledWith("/o/acme");
  });

  it("redirects old slug aliases to the canonical organization slug", async () => {
    readOrgRouteContextMock.mockResolvedValue({
      status: "ALIAS_REDIRECT",
      requestedSlug: "old-acme",
      organizationSlug: "acme",
    });

    await expect(renderPage("old-acme")).rejects.toThrow("NEXT_REDIRECT:/o/acme");

    expect(redirectMock).toHaveBeenCalledWith("/o/acme");
    expect(renderDashboardPageMock).not.toHaveBeenCalled();
  });

  it("shows the safe not-found state for unknown slugs", async () => {
    readOrgRouteContextMock.mockResolvedValue({
      status: "NOT_FOUND",
      requestedSlug: "not-real",
    });

    await expect(renderPage("not-real")).rejects.toThrow("NEXT_NOT_FOUND");

    expect(notFoundMock).toHaveBeenCalled();
    expect(renderDashboardPageMock).not.toHaveBeenCalled();
  });

  it("blocks users who request another organization's dashboard", async () => {
    readOrgRouteContextMock.mockResolvedValue({
      status: "DIFFERENT_ORG",
      requestedSlug: "acme",
      organizationSlug: "acme",
      actorOrganizationSlug: "other-org",
      actorOrganizationName: "Other Org",
    });

    render(await renderPage("acme"));

    expect(
      screen.getByRole("heading", { name: "This dashboard belongs to another organization" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/belongs to Other Org/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open your dashboard" })).toHaveAttribute("href", "/o/other-org");
    expect(screen.getByRole("link", { name: "Sign out" })).toHaveAttribute("href", "/auth/logout");
    expect(renderDashboardPageMock).not.toHaveBeenCalled();
  });

  it("prompts signed-out users to log in with a return path", async () => {
    readOrgRouteContextMock.mockRejectedValue(
      new WebAuthenticationError("SESSION_MISSING", "You must be logged in"),
    );

    render(await renderPage("acme"));

    expect(screen.getByRole("heading", { name: "Sign in to open this organization" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/auth/login?returnTo=%2Fo%2Facme",
    );
    expect(renderDashboardPageMock).not.toHaveBeenCalled();
  });
});
