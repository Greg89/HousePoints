import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import type { PagedNotifications } from "@housepoints/contracts";
import { NotificationPoller } from "./NotificationPoller";

const pushMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

vi.mock("sonner", () => ({
  toast: vi.fn(),
}));

const initialNotifications: PagedNotifications = {
  items: [
    {
      id: "notification-1",
      type: "MEMBER_NEEDS_HOUSE_ASSIGNMENT",
      severity: "ACTION_REQUIRED",
      title: "Existing member needs a house",
      body: "Existing member is waiting.",
      actionLabel: "Assign house",
      actionHref: "/?tab=manage&section=team",
      entityType: "User",
      entityId: "user-1",
      readAt: null,
      createdAt: "2026-06-26T21:24:13.084Z",
    },
  ],
  unreadCount: 1,
  nextCursor: null,
};

const newActionRequiredNotifications: PagedNotifications = {
  items: [
    {
      id: "notification-2",
      type: "MEMBER_NEEDS_HOUSE_ASSIGNMENT",
      severity: "ACTION_REQUIRED",
      title: "New member needs a house",
      body: "Taylor joined Acme and has not been assigned to a house yet.",
      actionLabel: "Assign house",
      actionHref: "/?tab=manage&section=team",
      entityType: "User",
      entityId: "user-2",
      readAt: null,
      createdAt: "2026-06-26T21:25:13.084Z",
    },
    ...initialNotifications.items,
  ],
  unreadCount: 2,
  nextCursor: null,
};

describe("NotificationPoller", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows a toast for newly observed unread action-required notifications", async () => {
    const onRefreshNotifications = vi.fn(async () => newActionRequiredNotifications);
    const onNotificationsChange = vi.fn();

    render(
      <NotificationPoller
        notifications={initialNotifications}
        onNotificationsChange={onNotificationsChange}
        onRefreshNotifications={onRefreshNotifications}
        pollIntervalMs={1_000}
      />,
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });

    expect(onRefreshNotifications).toHaveBeenCalledOnce();
    expect(onNotificationsChange).toHaveBeenCalledWith(newActionRequiredNotifications);
    expect(toast).toHaveBeenCalledWith("New member needs a house", {
      description: "Taylor joined Acme and has not been assigned to a house yet.",
      action: {
        label: "Assign house",
        onClick: expect.any(Function),
      },
    });

    const toastCall = vi.mocked(toast).mock.calls[0];
    const toastOptions = toastCall[1] as unknown as {
      action: { onClick: (event: unknown) => void };
    };
    toastOptions.action.onClick({});
    expect(pushMock).toHaveBeenCalledWith("/?tab=manage&section=team");
  });

  it("does not toast initial unread notifications or repeat the same observed notification", async () => {
    const onRefreshNotifications = vi.fn(async () => initialNotifications);

    render(
      <NotificationPoller
        notifications={initialNotifications}
        onNotificationsChange={vi.fn()}
        onRefreshNotifications={onRefreshNotifications}
        pollIntervalMs={1_000}
      />,
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
      await vi.advanceTimersByTimeAsync(1_000);
    });

    expect(onRefreshNotifications).toHaveBeenCalledTimes(2);
    expect(toast).not.toHaveBeenCalled();
  });

  it("updates notification state without toast for non-action notifications", async () => {
    const informationalNotifications: PagedNotifications = {
      items: [
        {
          ...initialNotifications.items[0],
          id: "notification-3",
          severity: "INFO",
          title: "Invite accepted",
          body: "A member accepted an invite.",
        },
      ],
      unreadCount: 1,
      nextCursor: null,
    };
    const onNotificationsChange = vi.fn();

    render(
      <NotificationPoller
        notifications={{ items: [], unreadCount: 0, nextCursor: null }}
        onNotificationsChange={onNotificationsChange}
        onRefreshNotifications={vi.fn(async () => informationalNotifications)}
        pollIntervalMs={1_000}
      />,
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });

    expect(onNotificationsChange).toHaveBeenCalledWith(informationalNotifications);
    expect(toast).not.toHaveBeenCalled();
  });
});
