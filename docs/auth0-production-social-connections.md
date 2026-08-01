# Auth0 Production Social Connections

Use this runbook to replace Auth0 development keys for the two enabled social
providers: Google and GitHub. Never commit provider client secrets or place
them in `EXPO_PUBLIC_*` or other mobile application configuration.

## Environment boundary

Preferred topology:

- Development Auth0 tenant and provider OAuth applications for local work.
- Staging Auth0 tenant and provider OAuth applications for beta/E2E.
- Production Auth0 tenant and provider OAuth applications for store builds.

At minimum, production must use provider credentials owned by the release
owner or organization and must not use Auth0 development keys. Separate GitHub
OAuth applications are required for different Auth0 tenant callbacks because a
GitHub OAuth application accepts only one callback URL.

For each Auth0 tenant, record outside this repository:

- Auth0 tenant domain and environment tag
- Native Application client ID
- API audience
- Enabled database and social connections
- Provider OAuth application owner
- Credential rotation owner and recovery process

## Shared production Auth0 checks

- [ ] Tag the production tenant as **Production**.
- [ ] Set the tenant friendly name to `HousePoints`.
- [ ] Set the support email to `dodson.gregory@gmail.com`.
- [ ] Set the support URL to
  `https://housepointsweb-production.up.railway.app/support`.
- [ ] Configure HousePoints branding in Universal Login.
- [ ] Verify the Native Application callbacks and logout URLs.
- [ ] Enable only Google, GitHub, and the intentionally supported database
  connection for the production Native Application.
- [ ] Confirm no enabled connection uses Auth0 development keys.
- [ ] Request only identity information needed by HousePoints.
- [ ] Review brute-force, breached-password, suspicious-IP, bot-detection, MFA,
  and refresh-token-rotation settings.
- [ ] Decide whether signup remains open to everyone or requires an
  organization invitation; keep Universal Login and API behavior consistent.

## Google production connection

Create a production Google Cloud project controlled by the release owner or
organization.

### Google Auth Platform

- [ ] Configure the application name as `HousePoints`.
- [ ] Set the user support email to `dodson.gregory@gmail.com`.
- [ ] Set the homepage to
  `https://housepointsweb-production.up.railway.app/`.
- [ ] Set the privacy-policy URL to
  `https://housepointsweb-production.up.railway.app/privacy`.
- [ ] Add the Auth0 tenant domain as an authorized domain.
- [ ] Select the correct audience. Use **External** for public Google-account
  access; Internal limits access to one Google Workspace organization.
- [ ] Request only basic identity scopes needed for name and email.
- [ ] Publish the OAuth application to production.
- [ ] Complete branding or scope verification if Google requests it.

### Google OAuth client

Create the OAuth web client used by Auth0:

- Authorized JavaScript origin: `https://YOUR_AUTH0_DOMAIN`
- Authorized redirect URI: `https://YOUR_AUTH0_DOMAIN/login/callback`

Copy the client ID and client secret into the Auth0 Google social connection.
Do not place the client secret in EAS, Railway public variables, or this
repository.

## GitHub production connection

Create a GitHub OAuth application under an organization when possible, or a
release-owner account with documented recovery access.

- Application name: `HousePoints`
- Homepage URL: `https://housepointsweb-production.up.railway.app/`
- Authorization callback URL:
  `https://YOUR_AUTH0_DOMAIN/login/callback`
- Device Flow: leave disabled; HousePoints uses Auth0 browser authorization.

Generate a GitHub client secret and copy the client ID and secret into the
Auth0 GitHub social connection. GitHub displays secrets only at creation or
rotation time; keep recovery and rotation ownership documented outside the
repository.

In Auth0, enable only the minimum GitHub permissions required for identity:

- **Read user** for profile information
- **Email address** only if HousePoints requires access to private GitHub email
  addresses

Do not request repository, organization, gist, notification, project, or write
permissions. Test a GitHub user whose public email is hidden and confirm the
HousePoints nullable-email path behaves correctly.

## Verification matrix

Run every row against the production Native Application on a physical Android
device before internal Play submission:

| Flow | Google | GitHub |
| --- | --- | --- |
| New-user signup | [ ] | [ ] |
| Returning-user sign-in | [ ] | [ ] |
| Consent screen shows HousePoints ownership | [ ] | [ ] |
| Name/profile bootstrap | [ ] | [ ] |
| Hidden or missing email behavior | [ ] | [ ] |
| API audience and organization bootstrap | [ ] | [ ] |
| Access-token refresh | [ ] | [ ] |
| Sign-out and device unregister | [ ] | [ ] |
| Repeat sign-in/SSO | [ ] | [ ] |
| Account-linking behavior for matching emails | [ ] | [ ] |

Also test a rejected consent, canceled login, revoked provider grant, expired
refresh token, and an account without organization membership.

## Launch evidence

Record non-secret evidence in the mobile launch checklist or release system:

- Provider OAuth application owner
- Production/live or verification status
- Date and operator of the physical-device checks
- Auth0 tenant environment tag
- Confirmation that development-key warnings are cleared

Never record client IDs when internal policy treats them as confidential, and
never record client secrets, refresh tokens, passwords, or test-user recovery
codes.
