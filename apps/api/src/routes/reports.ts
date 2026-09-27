import type { FastifyInstance } from "fastify";
import { reportPageRequestSchema, reportPageResponseSchema } from "@housepoints/contracts";
import { info } from "../logging.js";
import { parseReportCursorSecret, ReportReadError } from "../report-cursor.js";
import { readReportPage } from "../report-service.js";
import { parseBody, requireActor } from "../route-helpers.js";

export async function registerReportRoutes(
  app: FastifyInstance,
  options: { cursorSecret?: string } = {},
): Promise<void> {
  const cursorSecret = parseReportCursorSecret(options.cursorSecret);

  app.post("/reports/query", async (request, reply) => {
    const parsed = await parseBody(reportPageRequestSchema, request, reply);
    if (!parsed) return;
    const actor = await requireActor(request, reply);
    if (!actor) return;
    if (!cursorSecret) {
      return reply.status(503).send({
        code: "REPORTS_NOT_CONFIGURED",
        message: "Reports are temporarily unavailable.",
      });
    }

    try {
      const report = reportPageResponseSchema.parse(await readReportPage({
        organizationId: actor.organizationId,
        membershipId: actor.membershipId,
        actorUserId: actor.id,
        request: parsed,
        cursorSecret,
      }));
      info(request.log, "reports.query.loaded", {
        organizationId: actor.organizationId,
        seasonId: parsed.seasonId,
        revision: report.revision,
        items: report.items.length,
        hasNextPage: report.nextCursor !== null,
      });
      return report;
    } catch (error) {
      if (error instanceof ReportReadError) {
        return reply.status(error.statusCode).send({ code: error.code, message: error.message });
      }
      throw error;
    }
  });
}
