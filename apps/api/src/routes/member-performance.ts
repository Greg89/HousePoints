import type { FastifyInstance } from "fastify";
import { memberPerformanceRequestSchema, memberPerformanceSchema } from "@housepoints/contracts";
import { parseBody, requireActor, resolveSeasonOrReject } from "../route-helpers.js";
import { mapSeason } from "../season-scope.js";
import { readMemberPerformance } from "../member-performance.js";
import { ReportReadError } from "../report-cursor.js";
import { info } from "../logging.js";

export async function registerMemberPerformanceRoutes(app: FastifyInstance) {
  app.post("/members/performance", async (request, reply) => {
    const parsed = await parseBody(memberPerformanceRequestSchema, request, reply);
    if (!parsed) return;
    const actor = await requireActor(request, reply);
    if (!actor) return;
    const season = await resolveSeasonOrReject(actor, parsed.seasonId, request, reply);
    if (!season) return;
    try {
      const report = memberPerformanceSchema.parse(await readMemberPerformance({
        organizationId: actor.organizationId, actorUserId: actor.id, membershipId: actor.membershipId,
        memberId: parsed.memberId, season: mapSeason(season),
      }));
      info(request.log, "members.performance.loaded", {
        organizationId: actor.organizationId, memberId: parsed.memberId, seasonId: season.id,
      });
      return report;
    } catch (error) {
      if (error instanceof ReportReadError) return reply.status(error.statusCode).send({ code: error.code, message: error.message });
      throw error;
    }
  });
}
