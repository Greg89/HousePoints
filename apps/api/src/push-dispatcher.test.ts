import { describe, expect, it, vi } from "vitest";
import { ExpoPushDispatcher, type PushMessage } from "./push-dispatcher.js";

const message = (index: number): PushMessage => ({
  to: `ExponentPushToken[${index}]`,
  title: "HousePoints",
  body: "You have an update.",
  data: { organizationId: "org-1" },
});

describe("ExpoPushDispatcher", () => {
  it("sends messages with an optional access token", async () => {
    const fetchImplementation = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: [{ status: "ok", id: "ticket-1" }],
    }), { status: 200 }));
    const dispatcher = new ExpoPushDispatcher("expo-secret", fetchImplementation);

    await expect(dispatcher.send([message(1)])).resolves.toEqual({ acceptedCount: 1 });
    expect(fetchImplementation).toHaveBeenCalledWith(
      "https://exp.host/--/api/v2/push/send",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          authorization: "Bearer expo-secret",
          "content-type": "application/json",
        }),
      }),
    );
  });

  it("chunks requests at the Expo limit of 100 messages", async () => {
    const fetchImplementation = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: Array.from({ length: 100 }, () => ({ status: "ok" })),
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: [{ status: "ok" }],
      }), { status: 200 }));
    const dispatcher = new ExpoPushDispatcher(undefined, fetchImplementation);

    await expect(dispatcher.send(Array.from({ length: 101 }, (_, index) => message(index))))
      .resolves.toEqual({ acceptedCount: 101 });
    expect(fetchImplementation).toHaveBeenCalledTimes(2);
  });

  it("rejects unsuccessful HTTP responses and Expo tickets", async () => {
    const httpFailure = new ExpoPushDispatcher(undefined, vi.fn().mockResolvedValue(
      new Response("", { status: 503 }),
    ));
    await expect(httpFailure.send([message(1)])).rejects.toThrow("HTTP 503");

    const ticketFailure = new ExpoPushDispatcher(undefined, vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        data: [{ status: "error", message: "DeviceNotRegistered" }],
      }), { status: 200 }),
    ));
    await expect(ticketFailure.send([message(1)])).rejects.toThrow("DeviceNotRegistered");
  });
});
