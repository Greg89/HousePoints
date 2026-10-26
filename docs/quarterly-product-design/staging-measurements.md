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

## Repeatable capture tooling

The [beta resource collector](./metrics-collection.md) provides pinned, read-only CLI capture with explicit project/environment IDs and UTC windows. Local scope/date checks pass. Device authorization and the first live capture succeeded October 11 after the initial browser callback timed out.

## First verified beta capture

Local raw evidence: `artifacts/railway-beta/beta-20261010T162748Z-20261011T162748Z.json` (ignored by Git). Requested window: October 10, 16:27:48 UTC through October 11, 16:27:48 UTC (12:27:48 EDT each day). Each response explicitly identifies environment `beta` and the expected service name.

Each of the seven returned series per service has 361 samples. Actual sample boundaries are October 10, 16:24 UTC through October 11, 16:24 UTC, at four-minute intervals. Railway rounds sampling boundaries; these are not exactly the requested endpoints. Preserve this distinction and deduplicate timestamps when combining captures.

| Beta service | Mean sampled memory (GB) | Mean sampled CPU (`CPU_USAGE`) | Mean sampled disk (GB) |
|---|---:|---:|---:|
| API | 0.188636 | 0.0000046104 | 0 |
| Web | 0.146555 | 0.0000176916 | 0 |
| Postgres | 0.057370 | 0.0000754203 | 1.132511 |
| Seq | 0.221617 | 0.0066891215 | 1.224509 |

Values are arithmetic sample means, not invoice integrals. Network RX/TX and CPU/memory limits were also captured. The web series includes a zero-valued bucket, including its limits; investigate lifecycle/sampling context before interpreting that as idle demand. No backup cost, invoice period, controlled member count, or representative activity rates are established by this capture. Network semantics and cost conversions remain to validate. No monthly cost or price is inferred here.

This establishes repeatable beta-scoped resource capture and an ambient baseline. It does not start the controlled seven-day member-capacity experiment or configure recurring collection.

## Billing-period reconciliation, October 11

The project-scoped CLI usage query reports the current period as **September 29, 2026 00:08:25 UTC through October 29, 2026 00:08:25 UTC**. At this later inspection HousePoints accrued usage was **$5.883657**, comprising Seq $2.062973, API $1.696034, web $1.514618 and Postgres $0.610033. Postgres backup usage contributed $0.008585. These totals span the project, not beta alone, and changed since the earlier snapshot as usage accrued.

With explicit owner permission, the workspace summary was inspected for shared-cost context. The authenticated Plans/Billing pages confirm **Pro with $20 monthly included usage**. Railway's [billing explanation](https://docs.railway.com/pricing/understanding-your-bill) describes a $20 minimum monthly commitment that covers the first $20 of usage; do not add the full plan amount to already-covered resource costs. The workspace is shared, so do not allocate its entire bill or all included usage to HousePoints without an explicit allocation assumption.

The CLI's current-bill field mirrors accrued metered usage and is below the plan minimum at this inspection; it is not a final invoice total. Tax, prior-period overages, other credits and invoice timing still require reconciliation. No payment details or invoice access links were copied into the repository. The existing shared compute limits are $10 soft / $35 hard and were not changed.

The [controlled workload specification](./controlled-workload.md) now defines cohort sizes, assumed activity rates, isolated marginal comparisons and the next runner work. No load has been started.

## Rehearsal fixture setup, October 11

Created **B1 Synthetic Rehearsal** (`b1-synthetic-rehearsal`) through the authenticated beta UI at `https://beta.housepoints-ds.com`. Gregory Dodson is the setup owner, assigned to B1 House A. This is a separate organization from existing beta organizations.

- Four houses persist after reload: B1 House A, B1 House B, B1 House C and B1 House D.
- Season 0 is active. The initial dashboard showed one member and zero points. No point awards or automated load were run.
- Membership setup uses single-use invitation links valid for 72 hours. No invitation was generated or sent during this setup.
- A separate user-controlled test identity is still needed for the recipient and dedicated workload actor. The personal setup owner is not evidence of a fully synthetic cohort.
- Local screenshot evidence: `artifacts/railway-beta/rehearsal-houses.jpg` (ignored by Git).

This verifies browser-based setup and authenticated page reads only. It does not verify the CLI workload runner, supply its access token, establish the required cohort sizes or start the seven-day controlled measurement window. Next: enroll test identities, assign houses, then verify one read and one award before scheduling any load.

## Browser rehearsal completed, October 20

The owner confirmed that a separately controlled test account joined using the single-use invitation. The beta Members view showed two members, with only the test member awaiting assignment. Assigned that member to **B1 House B** and verified the success notice and zero unassigned members.

Using the existing setup-owner session, submitted exactly one **+1 Collaboration** award with note `B1 synthetic workload rehearsal`. The success notice and Activity feed confirmed the recipient's B1 House B, Season 0, category, note and +1 amount. No other organization was changed. Account email and invitation token are deliberately omitted from this record.

Local screenshot evidence: `artifacts/railway-beta/rehearsal-award.jpg` (ignored by Git). This completes the small authenticated **browser** read/award rehearsal. It does not prove automated-runner authentication, retries or workload scheduling. The organization still has only two members; representative cohorts, retained-data fixtures and the controlled seven-day measurement window remain pending. Next: establish normal application authentication for the bounded runner using a dedicated test actor, then run and verify its minimal plan before expanding the workload.
