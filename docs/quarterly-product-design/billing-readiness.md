# Billing readiness and remaining release evidence

Updated October 11, 2026. Billing discovery is the next development checkpoint. S1–S3 are implemented and locally verified; release evidence is tracked separately below. This checklist does not approve prices or production charging.

## B1: collect evidence and close three decisions

The [B1 decision record](./b1-decision-record.md#acceptance-checklist) remains authoritative. Its only unchecked acceptance items are prices, accepted hosting costs, and seller-specific Stripe terms/fees/capabilities/tax responsibilities. Preserve the decisions already recorded there.

| Work | Evidence to collect | Completion |
|---|---|---|
| Measure hosting | Seven consecutive days of isolated staging usage; deployment revision, service configuration, invoice period, CPU/memory, storage/backup growth, egress, logs and attributable external service costs | Owner accepts the cost estimate; local query benchmarks alone do not qualify |
| Model capacity bands | Synthetic 4/12/20/30/50-member scenarios; low/typical/high activity assumptions; incremental 19→20 and 49→50 measurements; separate fixed and variable costs | Monthly costs and sensitivity are documented, including assumptions requiring pilot validation |
| Confirm seller terms | Account-specific Stripe fee schedule, contract/capability confirmation, refund/dispute costs, and seller tax responsibilities | Owner records confirmation in B1; public list pricing alone is insufficient |
| Decide prices | Standard 5–20 and Plus 21–50 monthly USD prices, informed by hosting/payment costs and an explicit support/reconciliation margin | Owner approves both prices and margin; no invented price approval |

Use B1 §3's measurement procedure. Store only aggregate synthetic usage and redacted billing evidence in the repository; keep credentials and personal/payment data out. Record evidence dates and locations so another reviewer can reproduce the estimate.

Collection status, October 11: the owner requested a new staging measurement period. Authenticated Railway inspection and the first project-wide accounting snapshot are recorded in the [measurement log](./staging-measurements.md). Beta-specific resource isolation and a complete baseline remain pending. Start the seven-day representative window from that verified baseline, not from this request date; no recurring collector is configured yet.

For each scenario, record: member count, activity rates, observation duration, retained-data size, measured resource deltas, applicable account rates, projected monthly variable cost, fixed-cost allocation and its assumed subscriber count, payment costs, support allowance, and resulting margin. Separate measured values from projections. Do not infer marginal cost from a shared invoice without a baseline and controlled comparison.

After those decisions, B2 needs isolated Stripe sandbox access and runnable lifecycle evidence. B3 then settles email delivery/content, operations, transition rehearsal and the paid-pilot go/defer decision. P1–P7 remain gated by B3. Do not begin a real-provider B2 run while B1's acceptance checklist is incomplete.

## Remaining release evidence (does not block B1 discovery)

- R3/R4: run the existing reporting smoke, then complete staging fixture coverage for revoked access, former-member contributions, and authenticated report URLs across roles. Preserve organization/season/filter scope and reconciliation evidence.
- S1–S3: deploy the documented additive migrations and compatible services through the normal release process, then record kickoff → recap → report and correction → updated winners/notices evidence. Local PostgreSQL validation is already complete.
- F2/F4: reconcile outstanding native retry and organization-routing device checks with release-owner evidence. Do not infer these passed solely because C4/C5 completed.
- Record deployment revision, environment, migration state, supported mobile versions, checks performed and artifact links. Keep incomplete gates open.

### Reporting smoke invocation

The `Staging E2E` workflow now exposes `reports_rehearsal` (default false). Enable it for a deployed staging web app with Railway web variable `REPORTS_DRILL_THROUGH_WEB_ENABLED=true`. This change adds no secrets and does not enable the application flag automatically.

Use the workflow's existing `staging` GitHub Environment secrets, including `E2E_BASE_URL`, `E2E_USER_EMAIL`, `E2E_USER_PASSWORD`, and `E2E_ORG_SLUG`; the full workflow also requires its existing admin/owner/target-member configuration. Use a dedicated synthetic organization with a house so the dashboard exposes a Full report link.

For a targeted local invocation against that staging environment, configure those values in the process environment and set `E2E_REPORTS_DRILL_THROUGH=true`, then run:

```powershell
npm.cmd run test:e2e -w @housepoints/web -- reports-drill-through.spec.ts
```

An opted-in run fails for missing required credentials, a missing report link, or a missing report route. A skipped default run is not release evidence. The three smoke cases cover navigation, type filtering and mobile-width layout; they do not replace the outstanding role/revocation/former-member scenarios.
