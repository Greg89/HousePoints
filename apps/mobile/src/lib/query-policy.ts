export const MOBILE_QUERY_STALE_MS = {
  default: 30_000,
  members: 60_000,
  adminContext: 60_000,
} as const;

export function mobileQueryDefaultOptions() {
  return {
    retry: 1,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    staleTime: MOBILE_QUERY_STALE_MS.default,
  } as const;
}
