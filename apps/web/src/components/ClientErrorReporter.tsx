"use client";

import { useEffect } from "react";

type ClientErrorReport = {
  type: "error" | "unhandledrejection";
  message: string;
  stack?: string;
  source?: string;
  lineno?: number;
  colno?: number;
  url?: string;
  userAgent?: string;
};

function reportClientError(report: ClientErrorReport) {
  const body = JSON.stringify(report);

  if (navigator.sendBeacon) {
    const payload = new Blob([body], { type: "application/json" });
    navigator.sendBeacon("/api/client-errors", payload);
    return;
  }

  void fetch("/api/client-errors", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
    keepalive: true,
  });
}

function errorMessage(reason: unknown): string {
  if (reason instanceof Error) {
    return reason.message;
  }

  if (typeof reason === "string") {
    return reason;
  }

  return "Unknown browser error";
}

function errorStack(reason: unknown): string | undefined {
  return reason instanceof Error ? reason.stack : undefined;
}

export function ClientErrorReporter() {
  useEffect(() => {
    function handleError(event: ErrorEvent) {
      reportClientError({
        type: "error",
        message: event.message || errorMessage(event.error),
        stack: errorStack(event.error),
        source: event.filename || undefined,
        lineno: event.lineno || undefined,
        colno: event.colno || undefined,
        url: window.location.href,
        userAgent: window.navigator.userAgent,
      });
    }

    function handleUnhandledRejection(event: PromiseRejectionEvent) {
      reportClientError({
        type: "unhandledrejection",
        message: errorMessage(event.reason),
        stack: errorStack(event.reason),
        url: window.location.href,
        userAgent: window.navigator.userAgent,
      });
    }

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
    };
  }, []);

  return null;
}
