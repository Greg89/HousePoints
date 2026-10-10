import { useFocusEffect } from "expo-router";
import { useCallback, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { z } from "zod";
import type { ApiEndpoint, apiContracts } from "@housepoints/contracts";
import { useAppAuth } from "@/context/auth-provider";
import { useActiveOrg } from "@/context/org-provider";
import { useToast } from "@/context/toast-provider";
import { callApi, ApiResponseError } from "@/lib/api-client";
import { mobileMutationInvalidations, mobileQueryKeys, invalidateMobileQueries } from "@/lib/mobile-query-keys";
import { useRefreshQueriesOnFocus } from "@/hooks/use-refresh-queries-on-focus";
import { logger, serializeError } from "@/lib/logger";

const focusKeys = [["admin-context"], ["manage-categories"], ["manage-audit"]] as const;
export function useManageContext() {
  const { activeOrgSlug } = useActiveOrg();
  const { getAccessToken } = useAppAuth();
  useRefreshQueriesOnFocus(focusKeys);
  return useQuery({
    queryKey: mobileQueryKeys.adminContext(activeOrgSlug),
    enabled: !!activeOrgSlug,
    staleTime: 60_000,
    queryFn: async ({ signal }) => callApi("/admin/context", {}, { accessToken: await getAccessToken(), organizationSlug: activeOrgSlug, signal }),
  });
}

export function useManageMutation<T extends ApiEndpoint>(endpoint: T, message: string, afterSave?: (result: z.output<(typeof apiContracts)[T]["response"]>, body: Parameters<typeof callApi<T>>[1]) => void) {
  const { activeOrgSlug } = useActiveOrg();
  const { getAccessToken } = useAppAuth();
  const client = useQueryClient();
  const { showToast } = useToast();
  const mounted = useRef(true);
  useFocusEffect(useCallback(() => { mounted.current = true; return () => { mounted.current = false; }; }, []));
  return useMutation({
    mutationFn: async (body: Parameters<typeof callApi<T>>[1]) => {
      if (!activeOrgSlug) throw new Error("Organization required");
      return callApi(endpoint, body, { accessToken: await getAccessToken(), organizationSlug: activeOrgSlug });
    },
    onSuccess: (result, body) => {
      logger.info("mobile.admin.mutation_completed", { endpoint, organizationSlug: activeOrgSlug });
      // Invalidate the captured organization even if the user has left this screen.
      void invalidateMobileQueries(client, [
        ...mobileMutationInvalidations.memberChanged(activeOrgSlug),
        mobileQueryKeys.recognitionCategories(activeOrgSlug),
        ["manage-categories", activeOrgSlug],
      ]);
      void client.invalidateQueries({ queryKey: ["manage-audit", activeOrgSlug] });
      if (mounted.current) {
        showToast({ message, variant: "success" });
        afterSave?.(result, body);
      }
    },
    onError: error => {
      logger.warn("mobile.admin.mutation_failed", { endpoint, ...serializeError(error) });
      if (mounted.current) showToast({ message: error instanceof ApiResponseError ? error.message : "Unable to save. Please try again.", variant: "error" });
    },
  });
}
