import { describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ status: "ready", role: "ADMIN", slug: "one" as string | null, hydrated: true, enabled: true }));
vi.mock("react-native", () => ({ ActivityIndicator: "Loading", View: "View", StyleSheet: { create: (s: unknown) => s } }));
vi.mock("react-native-keyboard-controller", () => ({ KeyboardAwareScrollView: "Scroll" }));
vi.mock("react-native-safe-area-context", () => ({ SafeAreaView: "SafeArea" }));
vi.mock("expo-router", () => ({ Redirect: "Redirect", Stack: { Screen: "Screen" } }));
vi.mock("@/context/auth-provider", () => ({ useAppAuth: () => ({ status: mocks.status }) }));
vi.mock("@/context/org-provider", () => ({ useActiveOrg: () => ({ activeOrgSlug: mocks.slug, hydrated: mocks.hydrated, activeMembership: mocks.slug ? { role: mocks.role } : null }) }));
vi.mock("@/lib/env", () => ({ env: { get mobileAdminEnabled() { return mocks.enabled; } } }));
vi.mock("@/lib/mobile-admin", async () => import("../../lib/mobile-admin"));
vi.mock("@/hooks/use-manage", () => ({ useManageContext: vi.fn() }));
import { ManageGate } from "./ManageUI";
describe("management route gate", () => {
  it("blocks signed-out, unhydrated, unscoped and non-admin routes", () => {
    mocks.status = "signedOut";
    expect(ManageGate({ children: null }).props.href).toBe("/login");
    mocks.status = "ready"; mocks.hydrated = false;
    expect(ManageGate({ children: null }).props.accessibilityLabel).toBe("Loading organization");
    mocks.hydrated = true; mocks.slug = null;
    expect(ManageGate({ children: null }).props.href).toBe("/pick-org");
    mocks.slug = "one"; mocks.role = "MEMBER";
    expect(ManageGate({ children: null }).props.href).toBe("/(tabs)");
    mocks.role = "ADMIN"; mocks.enabled = false;
    expect(ManageGate({ children: null }).props.href).toBe("/(tabs)");
    mocks.enabled = true;
  });
  it("remounts forms on organization or permission changes", () => {
    mocks.slug = "one"; mocks.role = "ADMIN";
    const key = ManageGate({ children: null }).key;
    mocks.slug = "two";
    expect(ManageGate({ children: null }).key).not.toBe(key);
    mocks.slug = "one"; mocks.role = "OWNER";
    expect(ManageGate({ children: null }).key).not.toBe(key);
  });
});
