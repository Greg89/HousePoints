export type PushMessage = {
  to: string;
  title: string;
  body: string;
  data: Record<string, string>;
};

export type PushDispatchResult = {
  acceptedCount: number;
};

export interface PushDispatcher {
  send(messages: readonly PushMessage[]): Promise<PushDispatchResult>;
}

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const EXPO_BATCH_SIZE = 100;

type ExpoPushTicket = {
  status?: string;
  message?: string;
};

export class ExpoPushDispatcher implements PushDispatcher {
  constructor(
    private readonly accessToken?: string,
    private readonly fetchImplementation: typeof fetch = fetch,
  ) {}

  async send(messages: readonly PushMessage[]): Promise<PushDispatchResult> {
    let acceptedCount = 0;

    for (let offset = 0; offset < messages.length; offset += EXPO_BATCH_SIZE) {
      const batch = messages.slice(offset, offset + EXPO_BATCH_SIZE);
      const headers: Record<string, string> = {
        accept: "application/json",
        "content-type": "application/json",
      };
      if (this.accessToken) {
        headers.authorization = `Bearer ${this.accessToken}`;
      }

      const response = await this.fetchImplementation(EXPO_PUSH_URL, {
        method: "POST",
        headers,
        body: JSON.stringify(batch),
      });
      if (!response.ok) {
        throw new Error(`Expo Push API returned HTTP ${response.status}`);
      }

      const payload = await response.json() as { data?: ExpoPushTicket | ExpoPushTicket[] };
      const tickets = Array.isArray(payload.data) ? payload.data : payload.data ? [payload.data] : [];
      const failedTicket = tickets.find((ticket) => ticket.status !== "ok");
      if (failedTicket) {
        throw new Error(failedTicket.message || "Expo Push API rejected a notification");
      }
      acceptedCount += tickets.length;
    }

    return { acceptedCount };
  }
}

