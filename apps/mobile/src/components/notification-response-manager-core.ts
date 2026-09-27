import { deepLinkFromNotificationData, routeForDeepLink, type NotificationMembership } from "../lib/deep-links";
import type { AuthBootstrapStatus } from "../lib/auth-bootstrap";

export type NotificationTap = { id: string; data: Record<string, unknown> };
export type NotificationRoutingContext = {
  status: AuthBootstrapStatus;
  hydrated: boolean;
  navigationReady: boolean;
  memberships: readonly NotificationMembership[];
};

/** Queue taps across bootstrap/hydration; acknowledge only after a route accepts them. */
export function createNotificationResponseQueue() {
  const pending = new Map<string, NotificationTap>();
  const handled = new Set<string>();
  let context: NotificationRoutingContext;
  let draining = false;
  return {
    pause() {
      if (context) context = { ...context, navigationReady: false };
    },
    enqueue(tap: NotificationTap) {
      if (!handled.has(tap.id)) pending.set(tap.id, tap);
    },
    async drain(next: NotificationRoutingContext, effects: {
      navigate: (route: string) => void;
      acknowledge: (id: string) => Promise<void>;
      failed: (error: unknown) => void;
    }) {
      context = next;
      if (draining) return;
      draining = true;
      try {
        while (pending.size && context.status === "ready" && context.hydrated && context.navigationReady) {
          const tap = pending.values().next().value!;
          const link = deepLinkFromNotificationData(tap.data, context.memberships);
          effects.navigate(link ? routeForDeepLink(link) : "/notification-unavailable");
          pending.delete(tap.id);
          handled.add(tap.id);
          // Failure to clear the OS response must not navigate twice in this session.
          try { await effects.acknowledge(tap.id); } catch (error) { effects.failed(error); }
        }
      } catch (error) {
        // A failed handoff stays pending; another tap or lifecycle change retries it.
        effects.failed(error);
      } finally { draining = false; }
    },
  };
}
