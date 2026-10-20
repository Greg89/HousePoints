# Beta resource collection

Use `tools/collect-beta-metrics.ps1` from PowerShell to capture resource metrics for HousePoints beta. The project and environment IDs are fixed in the script; it never relies on the CLI's currently linked environment. It executes only `railway metrics` through the pinned official npm package `@railway/cli@5.64.2`.

## Setup and capture

Authenticate locally with `npm.cmd exec --yes --package=@railway/cli@5.64.2 -- railway login`. The user completes Railway's browser authorization. Browser-session authentication does not automatically authenticate the CLI. The standard CLI login requests account-level permissions broader than these read-only commands; review its consent screen. Never put login credentials in this repository or chat.

Preview an exact window without network access:

```powershell
./tools/collect-beta-metrics.ps1 -PlanOnly -Since '2026-10-10T16:00:00Z' -Until '2026-10-11T16:00:00Z'
```

Omit `-PlanOnly` to collect that window. With no dates, it captures the preceding 24 hours. Use adjacent explicit UTC boundaries for a seven-day series; do not sum overlapping rolling windows. The script rejects inverted, empty, future, and longer-than-seven-day windows. A missing login, failed command, or malformed/empty JSON fails collection. Existing snapshots for the same window are not overwritten.

Raw output goes to ignored `artifacts/railway-beta/`, with collection time, requested interval, project/environment IDs, CLI version, and an ambient-traffic label. This folder is local evidence, not automatically backed up or committed. Summarize reviewed aggregates in [the measurement log](./staging-measurements.md); preserve needed raw evidence in an approved private evidence location.

## Interpretation and acceptance

The official CLI supports environment-specific metrics, exact time boundaries and raw JSON. CPU, memory, public network and volume metrics are requested; logs, request paths, variables and database records are excluded. Source: [Railway CLI overview](https://docs.railway.com/cli), plus the installed version's `railway metrics --help` verified October 11, 2026.

Successful JSON capture does not prove completeness. Inspect returned service coverage, time-series gaps, sampling intervals and units before deriving costs. Empty series are unavailable evidence, not zeros. Confirm all four services and applicable volumes; do not infer backup billing from disk usage. Record deployment/configuration changes separately. Do not sum sampled gauges as if they were billable resource integrals.

[Railway usage](https://docs.railway.com/cli/usage) provides billing-period summaries and project/service costs, which must be kept separate from beta-scoped resource metrics until reconciled. Account fees, credits, backup costs and other external costs still need evidence. The raw collector does not calculate a price or substitute for B1's controlled member/activity scenarios.

## Validation and current status

Run `./tools/collect-beta-metrics.test.ps1` for local window/scope checks. These do not contact Railway. No application runtime is changed by this tooling.

October 11: local checks and first live capture pass. Raw metrics require one request per service (`--all` conflicts with `--raw`); the collector queries all four known services separately and validates the returned beta environment and metric shape before saving. See the measurement log for the verified capture. No scheduled collector is configured, and the representative seven-day B1 window has not started.

The initial browser callback sign-in timed out. `railway login --browserless` succeeded after the user completed device authorization. Use that fallback if the local callback is unreachable; do not mistake a browser consent click for a completed CLI login.
