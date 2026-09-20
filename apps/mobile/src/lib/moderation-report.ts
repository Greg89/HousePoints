export type ReportCategory = "HARASSMENT" | "INAPPROPRIATE_CONTENT" | "SPAM" | "PRIVACY" | "OTHER";

export const ACTIVITY_REPORT_OPTIONS: Array<{ value: ReportCategory; label: string }> = [
  { value: "INAPPROPRIATE_CONTENT", label: "Inappropriate" },
  { value: "HARASSMENT", label: "Harassment" },
  { value: "SPAM", label: "Spam" },
  { value: "PRIVACY", label: "Privacy" },
  { value: "OTHER", label: "Other" },
];

export function activityReportPayload(targetId: string, category: ReportCategory, details: string) {
  const trimmedDetails = details.trim();
  return { targetType: "POINT_TRANSACTION" as const, targetId, category, details: trimmedDetails || undefined };
}
