import { Children, isValidElement, type ReactNode, type ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ unread: 0, failed: false, push: vi.fn() }));
vi.mock("react", async original => ({ ...await original<typeof import("react")>(), useState: () => [false, vi.fn()], useCallback: (fn: unknown) => fn }));
vi.mock("react-native", () => ({ Pressable: "Pressable", Text: "Text", View: "View", ScrollView: "ScrollView", RefreshControl: "RefreshControl", ActivityIndicator: "ActivityIndicator", StyleSheet: { create: (s: unknown) => s } }));
vi.mock("@expo/vector-icons/MaterialCommunityIcons", () => ({ default: "Icon" }));
vi.mock("expo-router", () => ({ router: { push: mocks.push } }));
vi.mock("@/context/auth-provider", () => ({ useAppAuth: () => ({ user: { displayName: "Alex" } }) }));
vi.mock("@/context/org-provider", () => ({ useActiveOrg: () => ({ activeOrgSlug: "org", activeMembership: { organizationName: "School" } }) }));
vi.mock("@tanstack/react-query", () => ({ useQuery: () => ({ data: { unreadCount: mocks.unread } }) }));
vi.mock("@/lib/api-client", () => ({ callApi: vi.fn(), ApiResponseError: class extends Error {} }));
vi.mock("@/components/MemberDetailsLink", () => ({ MemberDetailsLink: "MemberDetailsLink" }));
vi.mock("@/components/HousesSection", () => ({ HousesSection: "HousesSection" }));
vi.mock("@/hooks/use-house-overview", () => ({ useHouseOverview: () => ({ summary: { selectedSeason: { name: "Autumn", startsAt: "2026-09-01", isActive: true, plannedEndsAt: "2026-09-30" } }, houses: [], summaryQuery: { error: mocks.failed ? new Error() : null }, housesQuery: {} }) }));
import HomeScreen from "../app/(tabs)/index";
import { AlertsHeaderButton } from "./AlertsHeaderButton";
type Props = { children?: ReactNode; name?: string; accessibilityLabel?: string; testID?: string; onPress?: () => void };
function nodes(node: ReactNode): ReactElement<Props>[] {
  return Children.toArray(node).flatMap(child => {
    if (!isValidElement<Props>(child)) return [];
    if (typeof child.type === "function") return nodes((child.type as (p: Props) => ReactNode)(child.props));
    return [child, ...nodes(child.props.children)];
  });
}
describe("home presentation", () => {
  beforeEach(() => { mocks.unread = 0; mocks.failed = false; vi.clearAllMocks(); });
  it("shows an outlined bell without unread notifications and opens notifications", () => {
    const button = AlertsHeaderButton();
    expect(button.props.accessibilityLabel).toBe("Notifications");
    expect(nodes(button).some(n => n.props.name === "bell-outline")).toBe(true);
    button.props.onPress();
    expect(mocks.push).toHaveBeenCalledWith("/notifications");
  });
  it("fills the bell and caps its badge while announcing the actual unread count", () => {
    mocks.unread = 123;
    const button = AlertsHeaderButton();
    expect(button.props.accessibilityLabel).toBe("Notifications, 123 unread");
    expect(nodes(button).some(n => n.props.name === "bell")).toBe(true);
    expect(nodes(button).some(n => n.props.children === "99+")).toBe(true);
  });
  it("groups the award action with season information and preserves navigation", () => {
    const all = nodes(HomeScreen());
    const season = all.find(n => Children.toArray(n.props.children).some(c => isValidElement<Props>(c) && c.props.children === "Autumn"));
    expect(season).toBeDefined();
    const awards = nodes(season).filter(n => n.props.testID === "mobile.home.award-points");
    expect(awards).toHaveLength(1);
    awards[0].props.onPress?.();
    expect(mocks.push).toHaveBeenCalledWith("/award");
    expect(all.filter(n => n.props.testID === "mobile.home.award-points")).toHaveLength(1);
  });
  it("retains the award action when dashboard loading fails", () => {
    mocks.failed = true;
    expect(nodes(HomeScreen()).filter(n => n.props.testID === "mobile.home.award-points")).toHaveLength(1);
  });
});
vi.mock("@/lib/mobile-query-keys", async () => import("../lib/mobile-query-keys"));
