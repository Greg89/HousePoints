import { renderDashboardPage } from "./dashboard-page";
import { logError, serializeErrorForLog } from "@/lib/logging";

export const dynamic = "force-dynamic";

export default async function Home() {
  try {
    return await renderDashboardPage("/");
  } catch (error) {
    logError("web.dashboard.render_failed", {
      ...serializeErrorForLog(error),
      route: "/",
    });

    throw error;
  }
}
