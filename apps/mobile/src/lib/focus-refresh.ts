import type { QueryClient, QueryKey } from "@tanstack/react-query";

export async function refreshStaleActiveQueries(
  queryClient: Pick<QueryClient, "refetchQueries">,
  queryKeys: readonly QueryKey[],
): Promise<void> {
  await Promise.all(
    queryKeys.map((queryKey) =>
      queryClient.refetchQueries(
        { queryKey, type: "active", stale: true },
        { cancelRefetch: false },
      ),
    ),
  );
}
