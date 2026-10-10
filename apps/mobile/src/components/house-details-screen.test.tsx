import { Children, isValidElement, type ReactNode, type ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  status: "ready", hydrated: true, slug: "org-a" as string | null, houseId: "a" as string | string[],
  houses: [{ id: "a", name: "Alpha" }] as { id: string; name: string }[],
  pending: false, error: null as Error | null,
}));
vi.mock("react", async (importOriginal) => ({
  ...await importOriginal<typeof import("react")>(),
  useState: () => [false, vi.fn()],
}));
vi.mock("expo-router", () => ({
  Redirect: "Redirect", Stack: { Screen: "StackScreen" }, useLocalSearchParams: () => ({ houseId: mocks.houseId }),
}));
vi.mock("react-native", () => ({
  ActivityIndicator: "ActivityIndicator", Pressable: "Pressable", RefreshControl: "RefreshControl",
  ScrollView: "ScrollView", Text: "Text", View: "View", StyleSheet: { create: (styles: unknown) => styles },
}));
vi.mock("react-native-safe-area-context", () => ({ SafeAreaView: "SafeAreaView" }));
vi.mock("@/components/HouseOverviewReport", () => ({ HouseOverviewReport: "HouseOverviewReport" }));
vi.mock("@/context/auth-provider", () => ({ useAppAuth: () => ({ status: mocks.status }) }));
vi.mock("@/context/org-provider", () => ({ useActiveOrg: () => ({
  activeOrgSlug: mocks.slug, activeMembership: mocks.slug ? {} : null, hydrated: mocks.hydrated, needsPicker: !mocks.slug,
}) }));
vi.mock("@/hooks/use-house-overview", () => ({ useHouseOverview: () => ({
  summary: {}, houses: mocks.houses,
  summaryQuery: { isPending: mocks.pending, error: mocks.error, refetch: vi.fn() },
  housesQuery: { isPending: mocks.pending, error: null, refetch: vi.fn() },
}) }));
vi.mock("@/lib/api-client", () => ({ ApiResponseError: class extends Error {} }));
vi.mock("@/lib/env", () => ({ env: { recognitionCategoriesEnabled: true } }));
import HouseDetailsScreen from "../app/house/[houseId]";

type Props = { children?: ReactNode; href?: string; house?: { id: string }; accessibilityLabel?: string };
function elements(node: ReactNode): ReactElement<Props>[] {
  return Children.toArray(node).flatMap(child => isValidElement<Props>(child) ? [child, ...elements(child.props.children)] : []);
}
describe("house details route", () => {
  beforeEach(() => {
    mocks.status = "ready"; mocks.hydrated = true; mocks.slug = "org-a"; mocks.houseId = "a";
    mocks.houses = [{ id: "a", name: "Alpha" }]; mocks.pending = false; mocks.error = null;
  });
  it("passes the selected house from the current organization's response to its report", () => {
    expect(elements(HouseDetailsScreen()).find(node => node.props.house)?.props.house?.id).toBe("a");
  });
  it("never falls back to another house when the org changes or the ID is invalid", () => {
    mocks.slug = "org-b"; mocks.houses = [{ id: "b", name: "Beta" }];
    let nodes = elements(HouseDetailsScreen());
    expect(nodes.some(node => node.props.house)).toBe(false);
    expect(nodes.some(node => node.props.children === "This house is not available in your current organization.")).toBe(true);
    mocks.houseId = ["a", "b"];
    nodes = elements(HouseDetailsScreen());
    expect(nodes.some(node => node.props.house)).toBe(false);
  });
  it("requires authentication and an active organization", () => {
    mocks.status = "signedOut";
    expect(HouseDetailsScreen().props.href).toBe("/login");
    mocks.status = "ready"; mocks.slug = null;
    expect(HouseDetailsScreen().props.href).toBe("/pick-org");
  });
  it("shows loading and a safe retry error", () => {
    mocks.pending = true;
    expect(elements(HouseDetailsScreen()).some(node => node.props.accessibilityLabel === "Loading house details")).toBe(true);
    mocks.pending = false; mocks.error = new Error("internal detail");
    expect(elements(HouseDetailsScreen()).some(node => node.props.children === "Unable to load house details.")).toBe(true);
    expect(elements(HouseDetailsScreen()).some(node => node.props.children === "internal detail")).toBe(false);
  });
});
