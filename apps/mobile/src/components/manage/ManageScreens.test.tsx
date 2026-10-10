import { Children, isValidElement, type ReactNode, type ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ role: "ADMIN", states: [] as unknown[], index: 0, mutations: {} as Record<string, ReturnType<typeof vi.fn>>, alerts: vi.fn(), push: vi.fn(), memberId: "m", categories: [] as unknown[] }));
vi.mock("react", async original => ({ ...await original<typeof import("react")>(), useState: (initial: unknown) => [mocks.states[mocks.index++] ?? initial, vi.fn()], useRef: (initial: unknown) => ({ current: initial }) }));
vi.mock("react-native", () => ({ Alert: { alert: mocks.alerts } }));
vi.mock("expo-router", () => ({ router: { push: mocks.push, back: vi.fn() }, useLocalSearchParams: () => ({ memberId: mocks.memberId }) }));
vi.mock("@/context/org-provider", () => ({ useActiveOrg: () => ({ activeOrgSlug: "org", activeMembership: { role: mocks.role } }) }));
vi.mock("@/context/auth-provider", () => ({ useAppAuth: () => ({ getAccessToken: async () => "token" }) }));
vi.mock("@/lib/api-client", () => ({ callApi: vi.fn() }));
vi.mock("@/lib/env", () => ({ env: { recognitionCategoriesEnabled: true } }));
vi.mock("@/lib/request-id", () => ({ generateRequestId: () => "29b2f600-1d44-401b-b18a-bf02c6d58d98" }));
vi.mock("@/lib/member-management", async () => import("../../lib/member-management"));
vi.mock("@tanstack/react-query", () => ({ useQuery: () => ({ data: { categories: mocks.categories }, isPending: false, isError: false }) }));
vi.mock("@/hooks/use-manage", () => ({ useManageMutation: (endpoint: string) => ({ mutate: mocks.mutations[endpoint] ??= vi.fn(), isPending: false }) }));
vi.mock("@/components/manage/ManageUI", () => ({
  ManageGate: ({ children }: { children: ReactNode }) => children,
  ContextPage: ({ children }: { children: (context: unknown) => ReactNode }) => children({ users: [{ id: "m", displayName: "Alex", email: null, role: "MEMBER", houseId: "h" }], houses: [{ id: "h", name: "House", color: "#123456" }] }),
  Card: "Card", Heading: "Heading", Note: "Note", Action: "Action", Field: "Field", Row: "Row",
}));
import MemberScreen from "../../app/manage/member/[memberId]";
import CategoriesScreen from "../../app/manage/categories";
import HousesScreen from "../../app/manage/houses";
type Props = { children?: ReactNode; label?: string; disabled?: boolean; onPress?: () => void };
function nodes(node: ReactNode): ReactElement<Props>[] {
  return Children.toArray(node).flatMap(child => {
    if (!isValidElement<Props>(child)) return [];
    if (typeof child.type === "function") return nodes((child.type as (p: Props) => ReactNode)(child.props));
    return [child, ...nodes(child.props.children)];
  });
}
function action(all: ReactElement<Props>[], label: string) { const found = all.find(node => node.props.label === label); expect(found).toBeDefined(); return found!.props; }
describe("manage forms and permissions", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.role = "ADMIN"; mocks.states = []; mocks.index = 0; mocks.mutations = {}; mocks.memberId = "m"; mocks.categories = []; });
  it("lets admins rename members but disables owner-only access controls", () => {
    mocks.states = [" New name "];
    const all = nodes(MemberScreen());
    expect(action(all, "Promote to admin").disabled).toBe(true);
    expect(action(all, "Remove member").disabled).toBe(true);
    expect(action(all, "Save name").disabled).toBe(false);
    action(all, "Save name").onPress?.();
    expect(mocks.mutations["/admin/users/display-name"]).toHaveBeenCalledWith({ targetUserId: "m", displayName: "New name" });
    action(all, "View performance").onPress?.();
    expect(mocks.push).toHaveBeenCalledWith({ pathname: "/member/[memberId]", params: { memberId: "m" } });
  });
  it("requires confirmation before owner removal", () => {
    mocks.role = "OWNER";
    const all = nodes(MemberScreen());
    action(all, "Remove member").onPress?.();
    expect(mocks.mutations["/admin/users/remove"]).not.toHaveBeenCalled();
    const buttons = mocks.alerts.mock.calls[0][2];
    buttons.find((button: { text: string }) => button.text === "Remove").onPress();
    expect(mocks.mutations["/admin/users/remove"]).toHaveBeenCalledWith({ targetUserId: "m" });
  });
  it("does not render an editor for an unknown member", () => {
    mocks.memberId = "other-org-member";
    expect(nodes(MemberScreen()).some(node => node.props.label === "Save name")).toBe(false);
  });
  it("restricts house and category creation to owners", () => {
    expect(action(nodes(HousesScreen()), "+ Create house").disabled).toBe(true);
    mocks.index = 0;
    expect(action(nodes(CategoriesScreen()), "+ Create category").disabled).toBe(true);
  });
  it("validates category fields and reuses a submission key on retries", () => {
    mocks.role = "OWNER"; mocks.states = [true, false, "New category", "Description"];
    const all = nodes(CategoriesScreen());
    expect(action(all, "Create category").disabled).toBe(false);
    action(all, "Create category").onPress?.(); action(all, "Create category").onPress?.();
    const create = mocks.mutations["/recognition-categories/create"];
    expect(create.mock.calls[0][0]).toEqual({ name: "New category", description: "Description", idempotencyKey: "29b2f600-1d44-401b-b18a-bf02c6d58d98" });
    expect(create.mock.calls[1][0]).toEqual(create.mock.calls[0][0]);
    mocks.index = 0; mocks.states = [true, false, " ", ""];
    expect(action(nodes(CategoriesScreen()), "Create category").disabled).toBe(true);
  });
  it("prevents archiving the last active category", () => {
    mocks.role = "OWNER"; mocks.categories = [{ id: "c", name: "Only category", archivedAt: null }];
    expect(action(nodes(CategoriesScreen()), "Archive category").disabled).toBe(true);
  });
});
