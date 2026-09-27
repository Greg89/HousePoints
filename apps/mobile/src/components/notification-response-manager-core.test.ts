import { describe, expect, it, vi } from "vitest";
import { createNotificationResponseQueue, type NotificationRoutingContext } from "./notification-response-manager-core";
import { organizationDeepLinkState } from "../lib/organization-deep-link";

const memberships = [{ organizationId: "org-1", organizationSlug: "acme" }, { organizationId: "org-2", organizationSlug: "other" }];
const ready: NotificationRoutingContext = { status: "ready", hydrated: true, navigationReady: true, memberships };
const tap = { id: "notification-1", data: { organizationId: "org-2", type: "POINT_AWARD_RECEIVED", entityId: "point-1", actionHref: "/?tab=activity" } };
const effects = () => ({ navigate: vi.fn(), acknowledge: vi.fn().mockResolvedValue(undefined), failed: vi.fn() });

describe("notification response lifecycle", () => {
  it("keeps a cold-start tap through sign-in, bootstrap, hydration and navigation readiness", async () => {
    const queue = createNotificationResponseQueue();
    const actions = effects();
    queue.enqueue(tap);
    for (const status of ["initializing", "signedOut", "bootstrapping", "error"] as const) {
      await queue.drain({ ...ready, status }, actions);
    }
    await queue.drain({ ...ready, hydrated: false }, actions);
    await queue.drain({ ...ready, navigationReady: false }, actions);
    expect(actions.navigate).not.toHaveBeenCalled();
    expect(actions.acknowledge).not.toHaveBeenCalled();
    await queue.drain(ready, actions);
    expect(actions.navigate).toHaveBeenCalledWith("/o/other/activity/point-1");
    expect(actions.acknowledge).toHaveBeenCalledWith(tap.id);
    expect(actions.navigate.mock.invocationCallOrder[0]).toBeLessThan(actions.acknowledge.mock.invocationCallOrder[0]);
  });

  it("deduplicates live and last-response delivery, including after a different tap", async () => {
    const queue = createNotificationResponseQueue();
    const actions = effects();
    queue.enqueue(tap);
    queue.enqueue(tap);
    await queue.drain(ready, actions);
    queue.enqueue({ id: "notification-2", data: { organizationId: "org-1", type: "SEASON_STARTED" } });
    await queue.drain(ready, actions);
    queue.enqueue(tap);
    await queue.drain(ready, actions);
    expect(actions.navigate.mock.calls).toEqual([["/o/other/activity/point-1"], ["/o/acme/dashboard"]]);
    expect(actions.acknowledge).toHaveBeenCalledTimes(2);
  });

  it("uses refreshed memberships and safely handles removed access", async () => {
    const queue = createNotificationResponseQueue();
    const actions = effects();
    queue.enqueue(tap);
    await queue.drain({ ...ready, status: "bootstrapping" }, actions);
    await queue.drain({ ...ready, memberships: [memberships[0]] }, actions);
    expect(actions.navigate).toHaveBeenCalledWith("/notification-unavailable");
    expect(actions.acknowledge).toHaveBeenCalledOnce();
  });

  it("does not acknowledge a failed navigation and retries the pending tap", async () => {
    const queue = createNotificationResponseQueue();
    const actions = effects();
    actions.navigate.mockImplementationOnce(() => { throw new Error("Router not ready"); });
    queue.enqueue(tap);
    await queue.drain(ready, actions);
    expect(actions.acknowledge).not.toHaveBeenCalled();
    await queue.drain(ready, actions);
    expect(actions.navigate).toHaveBeenCalledTimes(2);
    expect(actions.acknowledge).toHaveBeenCalledOnce();
  });

  it("does not duplicate navigation after an acknowledgement failure", async () => {
    const queue = createNotificationResponseQueue();
    const actions = effects();
    actions.acknowledge.mockRejectedValueOnce(new Error("Native API unavailable"));
    queue.enqueue(tap);
    await queue.drain(ready, actions);
    queue.enqueue(tap);
    await queue.drain(ready, actions);
    expect(actions.navigate).toHaveBeenCalledOnce();
    expect(actions.failed).toHaveBeenCalledOnce();
  });

  it("retains another tap when hydration pauses while acknowledgement is in flight", async () => {
    const queue = createNotificationResponseQueue();
    const actions = effects();
    let release!: () => void;
    actions.acknowledge.mockImplementationOnce(() => new Promise<void>(resolve => { release = resolve; }));
    queue.enqueue(tap);
    const draining = queue.drain(ready, actions);
    queue.enqueue({ ...tap, id: "notification-2" });
    await queue.drain({ ...ready, hydrated: false }, actions);
    release();
    await draining;
    expect(actions.navigate).toHaveBeenCalledOnce();
    await queue.drain(ready, actions);
    expect(actions.navigate).toHaveBeenCalledTimes(2);
  });

  it("stops queued navigation when the manager is unmounted", async () => {
    const queue = createNotificationResponseQueue();
    const actions = effects();
    let release!: () => void;
    actions.acknowledge.mockImplementationOnce(() => new Promise<void>(resolve => { release = resolve; }));
    queue.enqueue(tap);
    queue.enqueue({ ...tap, id: "notification-2" });
    const draining = queue.drain(ready, actions);
    queue.pause();
    release();
    await draining;
    expect(actions.navigate).toHaveBeenCalledOnce();
    await queue.drain(ready, actions);
    expect(actions.navigate).toHaveBeenCalledTimes(2);
  });
});

describe("organization route adapters", () => {
  const input = { status: "ready" as const, hydrated: true, memberships, slug: "other", activeOrgSlug: "acme", selectedSlug: null };
  it("waits for auth and hydration before deciding access", () => {
    expect(organizationDeepLinkState({ ...input, status: "bootstrapping", memberships: [] })).toBe("waiting");
    expect(organizationDeepLinkState({ ...input, hydrated: false })).toBe("waiting");
  });
  it("waits for both persisted selection and the active context before showing cross-org content", () => {
    expect(organizationDeepLinkState(input)).toBe("selecting");
    expect(organizationDeepLinkState({ ...input, selectedSlug: "other" })).toBe("selecting");
    expect(organizationDeepLinkState({ ...input, activeOrgSlug: "other" })).toBe("selecting");
    expect(organizationDeepLinkState({ ...input, activeOrgSlug: "other", selectedSlug: "other" })).toBe("ready");
  });
  it("rechecks access even after selecting the destination", () => {
    expect(organizationDeepLinkState({ ...input, memberships: [memberships[0]], activeOrgSlug: "other", selectedSlug: "other" })).toBe("unavailable");
  });
  it("opens a same-org destination after successful selection", () => {
    expect(organizationDeepLinkState({ ...input, slug: "acme", selectedSlug: "acme" })).toBe("ready");
  });
});
