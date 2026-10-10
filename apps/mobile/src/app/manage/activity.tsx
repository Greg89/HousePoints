import { useInfiniteQuery } from "@tanstack/react-query";
import { useAppAuth } from "@/context/auth-provider";
import { useActiveOrg } from "@/context/org-provider";
import { callApi, ApiResponseError } from "@/lib/api-client";
import { useRefreshQueriesOnFocus } from "@/hooks/use-refresh-queries-on-focus";
import { ManageGate, ManagePage, Card, Note, Action } from "@/components/manage/ManageUI";
const focusKeys = [["manage-audit"]] as const;
export default function ActivityScreen() {
  return <ManageGate>
    <Audit />
  </ManageGate>;
}
function Audit() {
  const { activeOrgSlug } = useActiveOrg();
  const { getAccessToken } = useAppAuth();
  useRefreshQueriesOnFocus(focusKeys);
  const query = useInfiniteQuery({
    queryKey: ["manage-audit", activeOrgSlug], initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam, signal }) => callApi("/admin/audit", { cursor: pageParam, limit: 20 }, { accessToken: await getAccessToken(), organizationSlug: activeOrgSlug, signal }),
    getNextPageParam: last => last.nextCursor ?? undefined,
  });
  const items = query.data?.pages.flatMap(page => page.items) ?? [];
  const accessDenied = query.error instanceof ApiResponseError && [401, 403, 404].includes(query.error.statusCode);
  const blocked = query.isError && (!query.isFetchNextPageError || accessDenied);
  return <ManagePage title="Admin activity" refreshing={query.isRefetching} onRefresh={() => void query.refetch()}>
    <Note>Administrative changes in this organization, most recent first.</Note>
    {query.isPending ? <Note>Loading activity…</Note> : blocked ? <Action label="Unable to load activity. Tap to retry" onPress={() => void query.refetch()} /> : <>
      {items.map(event => <Card key={event.id}>
        <Note>{event.summary}</Note>
        <Note>{event.actorName ?? "System"} · {new Date(event.occurredAt).toLocaleString()}</Note>
      </Card>)}
      {!items.length ? <Card>
        <Note>No admin activity yet.</Note>
      </Card> : null}
      {query.hasNextPage ? <Action label={query.isFetchingNextPage ? "Loading…" : query.isFetchNextPageError ? "Unable to load more. Retry" : "Load more"} disabled={query.isFetching} onPress={() => void query.fetchNextPage()} /> : null}
    </>}
  </ManagePage>;
}
