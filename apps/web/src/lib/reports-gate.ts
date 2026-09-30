import "server-only";

// R3 drill-through UI gate. The API endpoint requires REPORT_CURSOR_SECRET
// regardless; this flag controls whether the web routes and standings links
// are exposed so environments can enable them independently.
export const reportsDrillThroughWebEnabled = process.env.REPORTS_DRILL_THROUGH_WEB_ENABLED === "true";
