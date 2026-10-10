import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
const mocks = vi.hoisted(() => ({ slug: "alpha" as string | null, api: vi.fn(), toast: vi.fn(), cleanup: undefined as undefined | (() => void), client: undefined as unknown }));
vi.mock("react", () => ({ useRef: (value: unknown) => ({ current: value }), useCallback: (fn: unknown) => fn }));
vi.mock("expo-router", () => ({ useFocusEffect: (fn: () => () => void) => { mocks.cleanup = fn(); } }));
vi.mock("@tanstack/react-query", async original => ({ ...await original<typeof import("@tanstack/react-query")>(), useQueryClient: () => mocks.client, useMutation: (options: unknown) => options, useQuery: (options: unknown) => options }));
vi.mock("@/context/auth-provider", () => ({ useAppAuth: () => ({ getAccessToken: async () => "token" }) }));
vi.mock("@/context/org-provider", () => ({ useActiveOrg: () => ({ activeOrgSlug: mocks.slug }) }));
vi.mock("@/context/toast-provider", () => ({ useToast: () => ({ showToast: mocks.toast }) }));
vi.mock("@/hooks/use-refresh-queries-on-focus", () => ({ useRefreshQueriesOnFocus: vi.fn() }));
vi.mock("@/lib/logger", () => ({ logger: { warn: vi.fn(), info: vi.fn() }, serializeError: () => ({}) }));
vi.mock("@/lib/mobile-query-keys", async () => import("../lib/mobile-query-keys"));
vi.mock("@/lib/api-client", () => ({ callApi: mocks.api, ApiResponseError: class extends Error { } }));
import { useManageContext, useManageMutation } from "./use-manage";
import { mobileQueryKeys } from "../lib/mobile-query-keys";
type Mutation = { mutationFn: (body: unknown) => Promise<unknown>; onSuccess: () => void; onError: (error: Error) => void };
describe("shared manage requests", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.slug = "alpha"; mocks.client = new QueryClient(); });
  it("uses the selected org for both requests and cache keys", async () => {
    const options = useManageContext() as unknown as { queryKey: unknown; queryFn: (context: { signal: AbortSignal }) => Promise<unknown> };
    expect(options.queryKey).toEqual(["admin-context", "alpha"]);
    const signal = new AbortController().signal;
    await options.queryFn({ signal });
    expect(mocks.api).toHaveBeenCalledWith("/admin/context", {}, { accessToken: "token", organizationSlug: "alpha", signal });
  });
  it("invalidates the original organization after leaving, without late navigation or toasts", async () => {
    const client = mocks.client as QueryClient;
    const alpha = mobileQueryKeys.adminContext("alpha"), beta = mobileQueryKeys.adminContext("beta");
    client.setQueryData(alpha, {}); client.setQueryData(beta, {});
    const saved = vi.fn();
    const options = useManageMutation("/admin/users/display-name", "Saved", saved) as unknown as Mutation;
    await options.mutationFn({ targetUserId: "u", displayName: "New name" });
    expect(mocks.api).toHaveBeenCalledWith("/admin/users/display-name", { targetUserId: "u", displayName: "New name" }, { accessToken: "token", organizationSlug: "alpha" });
    mocks.cleanup?.(); mocks.slug = "beta";
    options.onSuccess();
    expect(client.getQueryState(alpha)?.isInvalidated).toBe(true);
    expect(client.getQueryState(beta)?.isInvalidated).toBe(false);
    expect(saved).not.toHaveBeenCalled(); expect(mocks.toast).not.toHaveBeenCalled();
  });
  it("rejects unscoped mutations and hides unexpected error details", async () => {
    mocks.slug = null;
    const options = useManageMutation("/admin/houses", "Saved") as unknown as Mutation;
    await expect(options.mutationFn({ name: "House" })).rejects.toThrow("Organization required");
    expect(mocks.api).not.toHaveBeenCalled();
    options.onError(new Error("private database detail"));
    expect(mocks.toast).toHaveBeenCalledWith({ message: "Unable to save. Please try again.", variant: "error" });
  });
});
