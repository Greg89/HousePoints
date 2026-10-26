# B1 API workload rehearsal

This bounded runner exercises the deployed beta API with a normal synthetic-user Auth0 access token. It does not provision accounts, bypass authentication, run browser sessions, or schedule recurring work. It is the API rehearsal slice of the [controlled experiment](../docs/quarterly-product-design/controlled-workload.md), not a complete seven-day load generator.

Copy `tools/beta-workload.example.json` into ignored `artifacts/railway-beta/` and replace its fixture identifiers. Use an existing dedicated `b1-synthetic-*` organization, a synthetic actor and recipient assigned to houses, and an active category. The actor cannot award themselves. Generate a new UUID v4 `runId` only for a genuinely new run. The plan's single organization slug and recipient list are explicit allowlists; the server independently enforces membership and category scope.

```powershell
# No network access or token needed; prints planned requests and stable keys.
node tools/beta-workload.mjs artifacts/railway-beta/plan.json

# Supply B1_ACCESS_TOKEN securely in the process environment beforehand.
node tools/beta-workload.mjs artifacts/railway-beta/plan.json --execute

# Interactive test-user login; executes the reviewed plan after approval.
node tools/beta-workload.mjs artifacts/railway-beta/plan.json --device-login
```

Railway CLI authentication cannot substitute for the application's Auth0 token. Never paste the token into chat, commit it, or add it to the plan. Token expiry stops the run; there is no automatic login/refresh. Review the dry-run before execution. The example's placeholders are not provisioned fixtures.

### Authentication setup investigation (October 20, 2026)

Read-only Auth0 dashboard inspection found the existing HousePoints Mobile native application has authorization-code and refresh-token grants enabled, device-code disabled, and only iOS/Android callback URLs. No settings were changed. The application list also reports an application-limit warning; availability for an additional client remains to be confirmed.

With explicit owner approval, created the separate native application **HousePoints B1 Rehearsal** in tenant `dev-0kihwasowi558bwz.us.auth0.com`. Creation succeeded despite the limit warning; no deletion or subscription change was needed. Public client ID: `flc6QWfj6uktmj9APT14sMYWULyEVFTg`.

Saved and re-opened Grant Types to verify **Device Code only**: implicit, authorization code, refresh token, password, MFA, passwordless OTP and passkey grants are disabled. Callback/origin fields remain empty. Existing web/mobile applications were not changed. The new app inherited the tenant's database, Google, GitHub and Microsoft connections.

Granted user-delegated access to **House Points API**, audience `https://api.housepoints.app`, with no custom scopes (the API defines none). No client-credentials or anonymous grants were added. The tenant's existing global policies also display user-delegated access to the Management API (current-user scopes) and Normaize API; these are inherited policies, not new per-app grants. They cannot be restricted per app while those APIs use the global policy. No shared API policy was changed. Do not describe this client as tenant-enforced HousePoints-only access; the runner must pin its requested audience to HousePoints and its HTTP target to beta.

The device-login wrapper requests only `openid profile email`, without `offline_access` or Management API scopes, and keeps the access token in process memory without output or persistence. It prints the provider's verification URL and user code, then polls for up to 15 minutes. Sign in with the dedicated test account; approval immediately executes the reviewed plan. The STOP file and Ctrl+C apply during login too. Pending approval and slowdown follow [RFC 8628](https://www.rfc-editor.org/rfc/rfc8628.html); denial, unexpected responses and network failures stop the login. No automatic refresh or resume is provided. A failed login still reserves the run ID and records an incomplete journal. Live automated acceptance remains pending. Local configuration evidence: `artifacts/railway-beta/auth0-rehearsal-created.jpg` (ignored by Git).

Supported actions are API dashboard-summary reads and one-point category awards with a fixed synthetic reason. All requests use the hard-coded beta origin and refuse redirects. Organization route context is checked at startup and before every award. Requests are serial, spaced 10–300 seconds apart, capped at 100 actions and a 30-minute execution budget (an in-flight request can take up to its 15-second timeout). Scope checks add requests and are not counted as measured actions.

Transport/5xx failures retry at most twice with the same body and idempotency key. Three consecutive failures stop execution. All 4xx responses, including 401/403/429, stop immediately. Create `artifacts/railway-beta/STOP` or send Ctrl+C to stop before the next request; waits are bounded by the selected interval. An in-flight award may already have committed.

Execution reserves an exclusive journal named `<runId>.jsonl` in `artifacts/railway-beta/`. It records a plan hash, action index/type, response status, timestamps and aggregate outcomes, not response contents or credentials. A repeated run ID is refused, even after a failure. Preserve the journal and check Activity for uncertain awards before making a new plan; do not delete the journal to bypass this guard. Automatic resume and seven-day token refresh are not implemented.

Validate locally with `node --test tools/beta-workload.test.mjs` and `node --check tools/beta-workload.mjs`. Live acceptance remains one real summary read and one synthetic award, with ledger confirmation. Full web/dashboard/report navigation, cohort provisioning, deductions/corrections/kickoff and recurring scheduling remain separate work before the seven-day experiment.
