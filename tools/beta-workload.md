# B1 API workload rehearsal

This bounded runner exercises the deployed beta API with a normal synthetic-user Auth0 access token. It does not provision accounts, bypass authentication, run browser sessions, or schedule recurring work. It is the API rehearsal slice of the [controlled experiment](../docs/quarterly-product-design/controlled-workload.md), not a complete seven-day load generator.

Copy `tools/beta-workload.example.json` into ignored `artifacts/railway-beta/` and replace its fixture identifiers. Use an existing dedicated `b1-synthetic-*` organization, a synthetic actor and recipient assigned to houses, and an active category. The actor cannot award themselves. Generate a new UUID v4 `runId` only for a genuinely new run. The plan's single organization slug and recipient list are explicit allowlists; the server independently enforces membership and category scope.

```powershell
# No network access or token needed; prints planned requests and stable keys.
node tools/beta-workload.mjs artifacts/railway-beta/plan.json

# Supply B1_ACCESS_TOKEN securely in the process environment beforehand.
node tools/beta-workload.mjs artifacts/railway-beta/plan.json --execute
```

Railway CLI authentication cannot substitute for the application's Auth0 token. Never paste the token into chat, commit it, or add it to the plan. Token expiry stops the run; there is no automatic login/refresh. Review the dry-run before execution. The example's placeholders are not provisioned fixtures.

Supported actions are API dashboard-summary reads and one-point category awards with a fixed synthetic reason. All requests use the hard-coded beta origin and refuse redirects. Organization route context is checked at startup and before every award. Requests are serial, spaced 10–300 seconds apart, capped at 100 actions and a 30-minute execution budget (an in-flight request can take up to its 15-second timeout). Scope checks add requests and are not counted as measured actions.

Transport/5xx failures retry at most twice with the same body and idempotency key. Three consecutive failures stop execution. All 4xx responses, including 401/403/429, stop immediately. Create `artifacts/railway-beta/STOP` or send Ctrl+C to stop before the next request; waits are bounded by the selected interval. An in-flight award may already have committed.

Execution reserves an exclusive journal named `<runId>.jsonl` in `artifacts/railway-beta/`. It records a plan hash, action index/type, response status, timestamps and aggregate outcomes, not response contents or credentials. A repeated run ID is refused, even after a failure. Preserve the journal and check Activity for uncertain awards before making a new plan; do not delete the journal to bypass this guard. Automatic resume and seven-day token refresh are not implemented.

Validate locally with `node --test tools/beta-workload.test.mjs` and `node --check tools/beta-workload.mjs`. Live acceptance remains one real summary read and one synthetic award, with ledger confirmation. Full web/dashboard/report navigation, cohort provisioning, deductions/corrections/kickoff and recurring scheduling remain separate work before the seven-day experiment.
