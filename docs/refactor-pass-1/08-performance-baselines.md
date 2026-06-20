# Dashboard Performance Baselines

Recorded: June 20, 2026

## Purpose

This benchmark records a repeatable local baseline for the dashboard API bundle before more feature work grows the read path. It measures the same API dependencies used by the owner dashboard render after current-user bootstrap:

- `POST /users/bootstrap`
- `POST /houses/leaderboard`
- `POST /members`
- `POST /transactions/recent`
- `POST /users/scores`
- `POST /dashboard/summary`
- `POST /seasons/context`
- `POST /admin/context`

The benchmark runs against local PostgreSQL through the real Fastify app with Auth0 verification stubbed at the app boundary. It does not measure browser rendering, Auth0 network latency, Railway edge latency, or Next.js server component rendering.

## How To Run

From the repo root:

```powershell
npm run db:deploy
npm run benchmark:dashboard
```

The script loads `packages/db/.env`, creates isolated benchmark organizations, runs one warmup iteration and five measured iterations per scenario, then deletes the benchmark data.

## Scenario Shapes

| Scenario | Houses | Members | Point transactions |
|---|---:|---:|---:|
| Empty | 4 | 1 | 0 |
| Typical | 4 | 24 | 120 |
| Larger | 8 | 200 | 1000 |

## Query Budget

The current owner dashboard API bundle has an expected route-level Prisma operation budget of 26 operations:

| Endpoint | Expected Prisma operations |
|---|---:|
| Current user | 1 |
| Leaderboard | 4 |
| Members | 2 |
| Activity | 2 |
| Member scores | 3 |
| Dashboard summary | 9 |
| Season context | 2 |
| Admin context | 3 |
| Total | 26 |

These are expected operation counts derived from the current route implementations. If a route adds or removes Prisma reads, update both the benchmark metadata and this table in the same change.

## Local Baseline

Environment:

- Windows laptop
- Local Docker PostgreSQL
- Fastify `app.inject()`
- API rate limiting disabled only for the benchmark harness
- Normal request logging silenced only for the benchmark harness

Scenario bundle summary:

| Scenario | Iterations | Expected queries | Bundle p50 ms | Bundle p95 ms | Bundle max ms |
|---|---:|---:|---:|---:|---:|
| Empty | 5 | 26 | 44.3 | 47.4 | 47.4 |
| Typical | 5 | 26 | 41.9 | 50.2 | 50.2 |
| Larger | 5 | 26 | 51.1 | 60.0 | 60.0 |

Endpoint detail:

| Scenario | Endpoint | Expected queries | p50 ms | p95 ms | Avg payload bytes |
|---|---|---:|---:|---:|---:|
| Empty | Current user | 1 | 5.9 | 10.7 | 417 |
| Empty | Leaderboard | 4 | 33.6 | 35.6 | 589 |
| Empty | Members | 2 | 32.6 | 37.0 | 166 |
| Empty | Activity | 2 | 32.7 | 37.9 | 30 |
| Empty | Member scores | 3 | 35.6 | 39.0 | 2 |
| Empty | Dashboard summary | 9 | 36.6 | 42.1 | 3869 |
| Empty | Season context | 2 | 30.4 | 32.1 | 286 |
| Empty | Admin context | 3 | 29.6 | 34.0 | 731 |
| Typical | Current user | 1 | 5.5 | 6.4 | 423 |
| Typical | Leaderboard | 4 | 28.8 | 34.2 | 601 |
| Typical | Members | 2 | 29.7 | 35.3 | 4099 |
| Typical | Activity | 2 | 31.8 | 38.6 | 17592 |
| Typical | Member scores | 3 | 32.3 | 36.1 | 1273 |
| Typical | Dashboard summary | 9 | 36.3 | 45.0 | 11503 |
| Typical | Season context | 2 | 26.4 | 29.6 | 286 |
| Typical | Admin context | 3 | 27.6 | 31.2 | 5326 |
| Larger | Current user | 1 | 6.0 | 8.7 | 420 |
| Larger | Leaderboard | 4 | 32.6 | 34.2 | 1217 |
| Larger | Members | 2 | 34.7 | 38.6 | 34195 |
| Larger | Activity | 2 | 40.5 | 49.7 | 17491 |
| Larger | Member scores | 3 | 35.7 | 39.3 | 10581 |
| Larger | Dashboard summary | 9 | 43.8 | 52.3 | 34877 |
| Larger | Season context | 2 | 25.4 | 25.8 | 286 |
| Larger | Admin context | 3 | 30.0 | 31.4 | 40841 |

## Interpretation

The dashboard bundle is currently bounded and scales primarily with response payload size rather than query count. The largest local response bodies are `members`, `dashboard summary`, and `admin context` in the larger scenario. Those are the first places to revisit if production telemetry shows dashboard latency increasing as organizations grow.
