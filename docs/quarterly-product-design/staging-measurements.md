# B1 measurement log

## October 11, 2026 baseline inspection

Observed approximately 12:08 EDT (16:08 UTC) through authenticated Railway UI. Collection has begun with an inventory and project-wide cost snapshot; a complete isolated staging baseline is still pending. No synthetic traffic, database mutation, deployment, or infrastructure change was performed.

Project: `HousePoints` (`64b4f475-ad33-4f3f-addd-de527f9195bf`). Staging is named **beta**, environment `b576f9f6-34f1-43b2-b06d-9919d6870caf`. API, web, Postgres and Seq were all shown online. Web domain: `beta.housepoints-ds.com`; API domain: `housepointsapi-beta.up.railway.app`.

### Project accounting snapshot — not isolated beta cost

Source: [Railway project usage](https://railway.com/project/64b4f475-ad33-4f3f-addd-de527f9195bf/settings/usage?environmentId=b576f9f6-34f1-43b2-b06d-9919d6870caf). The UI labels these Project Cost. Switching the selected environment from beta to production left the values unchanged, so do not attribute these figures to beta. Billing-period boundaries, account plan, credits and invoice reconciliation remain uncollected. All displayed monetary amounts below are USD.

| Resource | Quantity displayed | Rate displayed | Accrued cost |
|---|---:|---:|---:|
| Memory | 22,912.12 GB-minutes | $0.000231 / GB-minute | $5.3037 |
| CPU | 236.72 vCPU-minutes | $0.000463 / vCPU-minute | $0.1096 |
| Egress | 0.54 GB | $0.05 / GB | $0.0272 |
| Volume | 90,594.07 GB-minutes | $0.00000347 / GB-minute | $0.3146 |
| Backup | 2,428.57 GB-minutes | $0.00000347 / GB-minute | $0.0084 |

Displayed rounded current total: **$5.76**. Railway's estimated usage: **$10.52**, a provider projection rather than a measured monthly bill or a price recommendation. Quantity/rate rounding can prevent exact multiplication reconciliation.

Service totals shown in the same project view: Seq $2.02, API $1.66, web $1.49, Postgres $0.5966. The service view does not expose an environment split; do not divide these totals by organization/member counts.

### Beta-specific observations

- API active deployment: `cbb4ed4d-dc03-4118-b670-fe690f61f551`; title `feat: implement recovery flow for emulator launcher interruptions during mobile E2E tests`. Node 22.23.3, US East, one replica. Exact Git revision still to capture.
- API Metrics, Last day: memory chart visually around 190 MB, CPU near the chart floor. These are rough chart observations, not exported resource integrals or billable quantities.
- The API request/error/response-time panels report no request metrics available. That is missing instrumentation/evidence, not proof of zero application traffic.
- Environment Observability has no configured dashboard. Per-service Metrics remain available.

### Next measurements

1. Obtain beta-scoped resource integrals or exports for all four services and both volumes; capture the exact time range and deployment revisions. Establish billing-period boundaries and reconcile project aggregates to the account invoice.
2. Record synthetic fixture sizes and controlled activity rates for B1's member scenarios before applying load. Do not call ambient usage representative demand.
3. Capture seven consecutive days after that isolated baseline, including service/storage/backup/egress deltas and fixed external costs. Record deployment/configuration changes during the window.
4. Compare 19→20 and 49→50 member scenarios and prepare the cost/margin sheet. Keep B1's cost and price acceptance boxes unchecked until reviewed.

No recurring collector has been configured yet. This snapshot starts evidence gathering, not an assertion that B1's seven-day representative measurement requirement is met.
