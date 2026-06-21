import { render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ClientErrorReporter } from "./ClientErrorReporter";

describe("ClientErrorReporter", () => {
  const originalSendBeacon = navigator.sendBeacon;

  beforeEach(() => {
    Object.defineProperty(navigator, "sendBeacon", {
      configurable: true,
      value: vi.fn(() => true),
    });
  });

  afterEach(() => {
    Object.defineProperty(navigator, "sendBeacon", {
      configurable: true,
      value: originalSendBeacon,
    });
  });

  it("reports window error events to the client error route", async () => {
    render(<ClientErrorReporter />);

    window.dispatchEvent(
      new ErrorEvent("error", {
        message: "Widget exploded",
        error: new Error("Widget exploded"),
        filename: "https://housepoints.test/widget.js",
        lineno: 12,
        colno: 4,
      }),
    );

    await waitFor(() => {
      expect(navigator.sendBeacon).toHaveBeenCalledWith(
        "/api/client-errors",
        expect.any(Blob),
      );
    });
  });
});
