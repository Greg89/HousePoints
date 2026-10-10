import { Children, isValidElement, type ReactElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

type QueryOptions = { queryKey: readonly unknown[]; enabled: boolean; queryFn: (args: { signal: AbortSignal }) => Promise<unknown> };
const mocks = vi.hoisted(() => ({
  memberId: "m" as string | string[], slug: "org-a" as string | null, status: "ready",
  error: null as Error | null, pending: false,
  options: [] as QueryOptions[], api: vi.fn(),
}));
vi.mock("react", async (original) => ({ ...await original<typeof import("react")>(), useState: () => [false, vi.fn()] }));
vi.mock("react-native", () => ({
  ActivityIndicator: "ActivityIndicator", Pressable: "Pressable", RefreshControl: "RefreshControl",
  ScrollView: "ScrollView", Text: "Text", View: "View", StyleSheet: { create: (styles: unknown) => styles },
}));
vi.mock("react-native-safe-area-context", () => ({ SafeAreaView: "SafeAreaView" }));
vi.mock("expo-router", () => ({ Redirect: "Redirect", Stack: { Screen: "StackScreen" }, useLocalSearchParams: () => ({ memberId: mocks.memberId }) }));
vi.mock("@/context/auth-provider", () => ({ useAppAuth: () => ({ status: mocks.status, getAccessToken: async () => "token" }) }));
vi.mock("@/context/org-provider", () => ({ useActiveOrg: () => ({
  activeOrgSlug: mocks.slug, activeMembership: mocks.slug ? {} : null, hydrated: true, needsPicker: !mocks.slug,
}) }));
vi.mock("@/hooks/use-house-overview", () => ({ useHouseOverview: () => ({
  summary: { selectedSeason: { id: "s" } }, houses: [],
  summaryQuery: { isPending: false, error: null, refetch: vi.fn() }, housesQuery: { isPending: false, error: null, refetch: vi.fn() },
}) }));
vi.mock("@/hooks/use-refresh-queries-on-focus", () => ({ useRefreshQueriesOnFocus: vi.fn() }));
vi.mock("@/components/MemberPerformanceReport", () => ({ MemberPerformanceReport: "MemberPerformanceReport" }));
vi.mock("@/lib/mobile-query-keys", async () => import("../lib/mobile-query-keys"));
vi.mock("@/lib/api-client", () => ({
  callApi: mocks.api,
  ApiResponseError: class extends Error { statusCode = 403; },
}));
vi.mock("@tanstack/react-query", () => ({ useQuery: (options: QueryOptions) => {
  mocks.options.push(options);
  return { data: { member: { id: "m", displayName: "Alex" } }, error: mocks.error, isPending: mocks.pending, refetch: vi.fn() };
} }));
import { ApiResponseError } from "@/lib/api-client";
import MemberDetailsScreen from "../app/member/[memberId]";

type Props = { children?: ReactNode; performance?: unknown; href?: string; accessibilityLabel?: string };
function elements(node: ReactNode): ReactElement<Props>[] {
  return Children.toArray(node).flatMap(child => isValidElement<Props>(child) ? [child, ...elements(child.props.children)] : []);
}
describe("member details screen", () => {
  beforeEach(() => { mocks.memberId = "m"; mocks.slug = "org-a"; mocks.status = "ready"; mocks.pending = false; mocks.error = null; mocks.options = []; vi.clearAllMocks(); });
  it("uses member and season IDs in both the org-scoped cache and request", async () => {
    const nodes = elements(MemberDetailsScreen());
    expect(nodes.some(node => node.props.performance)).toBe(true);
    const query = mocks.options[0];
    expect(query.queryKey).toEqual(["member-performance", "org-a", "m", "s"]);
    const signal = new AbortController().signal;
    await query.queryFn({ signal });
    expect(mocks.api).toHaveBeenCalledWith("/members/performance", { memberId: "m", seasonId: "s" }, { accessToken: "token", organizationSlug: "org-a", signal });
    mocks.slug = "org-b";
    MemberDetailsScreen();
    expect(mocks.options[1].queryKey).toEqual(["member-performance", "org-b", "m", "s"]);
  });
  it("requires auth and organization selection before showing data", () => {
    mocks.status = "signedOut";
    expect(MemberDetailsScreen().props.href).toBe("/login");
    expect(mocks.options[0].enabled).toBe(false);
    mocks.status = "ready"; mocks.slug = null;
    expect(MemberDetailsScreen().props.href).toBe("/pick-org");
  });
  it("does not fetch a malformed member route", () => {
    mocks.memberId = ["m", "other"];
    expect(elements(MemberDetailsScreen()).some(node => node.props.children === "This member is not available.")).toBe(true);
    expect(mocks.options[0].enabled).toBe(false);
  });
  it("shows loading and safe error text, retaining cached data only for transient errors", () => {
    mocks.pending = true;
    expect(elements(MemberDetailsScreen()).some(node => node.props.accessibilityLabel === "Loading member performance")).toBe(true);
    mocks.pending = false; mocks.error = new Error("sensitive internal details");
    let nodes = elements(MemberDetailsScreen());
    expect(nodes.some(node => node.props.children === "Unable to load member performance.")).toBe(true);
    expect(nodes.some(node => node.props.performance)).toBe(true);
    mocks.error = Object.assign(new Error("Access revoked"), { statusCode: 403 });
    Object.setPrototypeOf(mocks.error, ApiResponseError.prototype);
    nodes = elements(MemberDetailsScreen());
    expect(nodes.some(node => node.props.performance)).toBe(false);
  });
});
