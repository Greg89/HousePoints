import { Children, isValidElement, type ReactNode, type ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ error: null as Error | null, options: undefined as unknown, api: vi.fn() }));
vi.mock("@/context/org-provider", () => ({ useActiveOrg: () => ({ activeOrgSlug: "alpha" }) }));
vi.mock("@/context/auth-provider", () => ({ useAppAuth: () => ({ getAccessToken: async () => "token" }) }));
vi.mock("@/hooks/use-refresh-queries-on-focus", () => ({ useRefreshQueriesOnFocus: vi.fn() }));
vi.mock("@/lib/api-client", () => ({ callApi: mocks.api, ApiResponseError: class extends Error { statusCode = 403; } }));
vi.mock("@tanstack/react-query", () => ({ useInfiniteQuery: (options: unknown) => {
  mocks.options = options;
  return { data: { pages: [{ items: [{ id: "event", summary: "Private admin event", occurredAt: "2026-10-10T00:00:00Z", actorName: "Alex" }] }] }, error: mocks.error, isError: !!mocks.error, isFetchNextPageError: !!mocks.error, hasNextPage: true };
} }));
vi.mock("@/components/manage/ManageUI", () => ({ ManageGate: ({ children }: { children: ReactNode }) => children, ManagePage: "Page", Card: "Card", Note: "Note", Action: "Action" }));
import { ApiResponseError } from "@/lib/api-client";
import ActivityScreen from "../../app/manage/activity";
type Props = { children?: ReactNode; label?: string };
function nodes(node: ReactNode): ReactElement<Props>[] {
  return Children.toArray(node).flatMap(child => {
    if (!isValidElement<Props>(child)) return [];
    if (typeof child.type === "function") return nodes((child.type as (p: Props) => ReactNode)(child.props));
    return [child, ...nodes(child.props.children)];
  });
}
describe("admin activity pagination", () => {
  it("passes the cursor and org scope to the existing API", async () => {
    mocks.error = null; nodes(ActivityScreen());
    const options = mocks.options as { queryKey: unknown; queryFn: (args: { pageParam: string; signal: AbortSignal }) => Promise<unknown>; getNextPageParam: (page: { nextCursor: string | null }) => string | undefined };
    expect(options.queryKey).toEqual(["manage-audit", "alpha"]);
    const signal = new AbortController().signal;
    await options.queryFn({ pageParam: "next", signal });
    expect(mocks.api).toHaveBeenCalledWith("/admin/audit", { cursor: "next", limit: 20 }, { accessToken: "token", organizationSlug: "alpha", signal });
    expect(options.getNextPageParam({ nextCursor: null })).toBeUndefined();
  });
  it("retains history after transient pagination errors but hides it on revoked access", () => {
    mocks.error = new Error("Network error");
    expect(nodes(ActivityScreen()).some(n => n.props.children === "Private admin event")).toBe(true);
    mocks.error = new ApiResponseError(403, "FORBIDDEN", "Access revoked");
    expect(nodes(ActivityScreen()).some(n => n.props.children === "Private admin event")).toBe(false);
  });
});
