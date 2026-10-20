# B1 controlled workload specification

Prepared October 11, 2026. Status: experiment specification with a locally tested [bounded API rehearsal runner](../../tools/beta-workload.md). Dedicated staging fixtures and live runner validation remain pending. These rates are sensitivity assumptions, not observed demand or approved pricing inputs. Keep B1's acceptance items open until measurement and owner review.

## Fixtures

Use seven dedicated synthetic beta organizations with 4, 12, 19, 20, 30, 49 and 50 counted memberships. The additional 19/49 cohorts support marginal comparisons at the paid-band boundaries. Each includes one owner and one admin within the count, four houses, seeded recognition categories, an active season and a closed season. Use only synthetic identities and no real member data. Record organization IDs in a local run manifest and enforce that allowlist for every mutation.

Prepare a repeatable retained-history profile of 100 ledger entries per member, split evenly between active and closed seasons, with awards and deductions identifiable separately. This is an assumed storage/read sensitivity point. Record exact ledger, notification and audit counts plus database size after setup. Measure setup separately from steady-state operation; retain fixtures during the seven-day observation instead of deleting them between days. Start a new comparison when retained history or deployment configuration changes materially.

## Daily demand assumptions

| Profile | Dashboard sessions per member/day | Awards per member/day | Report opens per member/day |
|---|---:|---:|---:|
| Low | 1 | 0.1 | 0.1 |
| Middle | 3 | 0.5 | 0.5 |
| High | 10 | 2 | 2 |

Middle is deliberately not labeled typical: no pilot evidence supports that claim. A dashboard session means an authenticated web navigation through initial dashboard loading, not one API request. A report open includes the summary and first ledger page; paginate half of opens when another page exists. Fractional actions use a deterministic cumulative quota across days, not rounding each member up independently. Record scheduled, attempted, succeeded, retried and failed counts separately.

Deduction/correction/kickoff are separate bounded scenarios because their permissions, cooldowns and notification effects differ from routine awards. Run one deduction and a reasoned closed-season correction per cohort, and one prepared-season kickoff per cohort during the experiment; record timestamps and exclude those windows from ordinary award-cost comparisons. Measure durable notification effects with these writes. Synthetic users have no real push tokens or email destinations, so external delivery costs remain separate model inputs.

## Measurement sequence

1. Capture the active web/API revisions, service configuration, fixture counts and pre-run resource/storage baseline. Verify normal authenticated access for synthetic actors. Keep authentication intact; do not deploy test-token verification.
2. Rehearse one small cohort before scaling. Exercise low/middle/high profiles sequentially, labeling each window. Spread requests across the window; do not compress daily demand into an unlabelled burst. Enforce one in-flight mutation per actor, stable idempotency keys for retries and bounded retry attempts.
3. Observe seven consecutive days of middle-profile ambient workload across the cohorts. Record beta-wide totals as aggregate experiment costs; shared-service metrics cannot directly attribute this combined load to each organization.
4. Use separate isolated, paired observation windows for each size/profile and the 19→20 / 49→50 comparisons. Pause other synthetic workloads during each comparison and bracket it with idle measurements. Repeat with reversed order; record background beta traffic and deployments. Extend a window if four-minute resource samples do not resolve the difference. If a marginal difference is below measurement noise, report an upper bound/uncertainty rather than zero cost.
5. Capture daily raw resource snapshots with adjacent UTC windows using the existing collector. Preserve Railway's actual sample boundaries and deduplicate overlapping boundary samples. Record storage/backup growth and reconcile against the billing-period costs separately.

Stop the workload on an unexpected organization/environment, repeated authorization errors, three consecutive server errors, or sustained throttling. Record the failure rather than increasing retries. Do not change existing Railway spending limits to keep a run going. The workspace's observed $35 hard limit is shared with other projects; monitor headroom before starting load.

## Runner boundary and next implementation

The current `apps/api/src/benchmarks/dashboard-baseline.ts` measures an in-process Fastify instance with test authentication and hard-deletes created fixtures. Reuse its endpoint inventory and local query observations only; do not point it at shared staging as the billing workload runner. The default Prisma seed also does not provision this experiment's membership/history profiles.

The next implementation is a bounded staging runner with an explicit beta hostname and organization allowlist, normal synthetic-user authentication, a dry-run action manifest, rate limits, idempotent writes, a stop switch and aggregate outcome logging. First provision and verify the synthetic accounts/organizations, then test one read and one award through the real web/API path before scheduling the seven-day run. Credentials stay outside the repository. No recurring schedule or shared-database mutation is authorized by this document alone.

## Cost outputs

Report gross metered resource cost separately from the workspace cash bill. Allocate shared baseline costs explicitly; do not treat unused plan credit as a sustainable zero marginal cost. Include payment fees, email/push assumptions, support and fixed external costs separately. Neither this experiment nor Railway metrics alone settles seller tax responsibilities or Stripe contract terms.
