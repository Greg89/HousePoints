import "dotenv/config";
import { randomUUID } from "node:crypto";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { adjustPointsSchema } from "@housepoints/contracts";
import { prisma } from "@housepoints/db";
import { error, info, warn } from "./logging.js";

const serviceName = process.env.SERVICE_NAME ?? "housepoints-api";
const logLevel = process.env.LOG_LEVEL ?? "info";

const app = Fastify({
  logger: {
    level: logLevel,
    base: {
      service: serviceName,
      env: process.env.NODE_ENV ?? "development",
    },
  },
  requestIdHeader: "x-request-id",
  genReqId: () => randomUUID(),
  disableRequestLogging: true,
});

info(app.log, "api.starting", { port: Number(process.env.API_PORT ?? 4000) });

await app.register(cors, {
  origin: true,
});

app.addHook("onRequest", async (request) => {
  request.log = request.log.child({
    requestId: request.id,
    route: request.url,
    method: request.method,
  });

  info(request.log, "request.received", {
    query: request.query,
  });
});

app.addHook("onResponse", async (request, reply) => {
  info(request.log, "request.completed", {
    statusCode: reply.statusCode,
    durationMs: reply.elapsedTime,
  });
});

app.setErrorHandler(async (err, request, reply) => {
  error(request.log, "request.unhandled_error", { statusCode: 500 }, err);
  await reply.status(500).send({ message: "Internal server error" });
});

app.get("/health", async (request) => {
  info(request.log, "health.checked", {});
  return { ok: true };
});

app.get("/houses/leaderboard", async (request) => {
  const houses = await prisma.house.findMany({
    select: {
      id: true,
      name: true,
      _count: {
        select: {
          transactions: true,
        },
      },
      transactions: {
        select: {
          delta: true,
        },
      },
    },
  });

  const leaderboard = houses
    .map((house) => ({
      id: house.id,
      name: house.name,
      score: house.transactions.reduce((total, tx) => total + tx.delta, 0),
      transactions: house._count.transactions,
    }))
    .sort((a, b) => b.score - a.score);

  info(request.log, "leaderboard.fetched", {
    houses: leaderboard.length,
  });

  return leaderboard;
});

app.post("/points/adjust", async (request, reply) => {
  const parsed = adjustPointsSchema.safeParse(request.body);

  if (!parsed.success) {
    warn(request.log, "request.validation_failed", {
      issues: parsed.error.issues,
    });
    return reply.status(400).send({ errors: parsed.error.flatten() });
  }

  const transaction = await prisma.pointTransaction.create({
    data: parsed.data,
  });

  info(request.log, "points.adjusted", {
    transactionId: transaction.id,
    actorUserId: transaction.actorUserId,
    targetHouseId: transaction.targetHouseId,
    delta: transaction.delta,
  });

  return reply.status(201).send(transaction);
});

const port = Number(process.env.API_PORT ?? 4000);
await app.listen({ port, host: "0.0.0.0" });
info(app.log, "api.listening", { port });
