# Apple App Privacy review

Review date: October 18, 2026. App Store Connect: HousePoints-DS,
Apple ID `6823836742`, bundle `com.housepoints.app`.

Status: source/vendor review and authenticated Auth0 configuration inspection
completed for the tenant/application below, including a fresh iPhone login.
Production EAS-to-Auth0 mapping was subsequently verified read-only on October
18, 2026: the production environment uses the same domain/native client inspected
below. The submitted-binary privacy report remains pending. The tenant's
DEVELOPMENT label does not indicate a separate production authentication tenant.

## Authenticated Auth0 observations

Inspected October 18, 2026, through the dashboard, read-only:

- Tenant: `dev-0kihwasowi558bwz` (US), labeled DEVELOPMENT.
- Application: **HousePoints Mobile**, type Native, client ID
  `9j8AYgn5MPqL0xyJh2D7rgeZKU94SdAi`. Its callback/logout URLs match
  `com.housepoints.app` on iOS and Android.
- [Native app connections](https://manage.auth0.com/dashboard/us/dev-0kihwasowi558bwz/applications/9j8AYgn5MPqL0xyJh2D7rgeZKU94SdAi/connections):
  database, Google, and GitHub enabled; Microsoft disabled; no enterprise or
  passwordless connections available. This differs from the earlier database-only
  launch plan and must be reconciled with the intended production release.
- [MFA](https://manage.auth0.com/dashboard/us/dev-0kihwasowi558bwz/security/mfa):
  all factors disabled, policy Never, Adaptive MFA Risk Assessment off. No
  phone-number declaration is supported by MFA configuration alone.
- [Post Login](https://manage.auth0.com/dashboard/us/dev-0kihwasowi558bwz/actions/triggers/post-login)
  and [Post User Registration](https://manage.auth0.com/dashboard/us/dev-0kihwasowi558bwz/actions/triggers/post-user-registration):
  empty deployed flows, no custom Actions listed. Other triggers/legacy scripts
  were not exhaustively inspected.
- [Installed Extensions](https://manage.auth0.com/dashboard/us/dev-0kihwasowi558bwz/extensions/installed):
  no items. Log Streams page states unavailable on the current free plan.
- Google connection: only basic/extended profile permissions selected; extended
  profile includes name, profile URL, photo, country/language/timezone. No
  Gmail, Drive, contacts, calendar, or location scopes selected; profile syncing
  on every login enabled.
- GitHub connection: basic profile (including photo) and email selected; other
  listed permissions unchecked; profile syncing on every login enabled.
- Consequence: include Photos or Videos for social-login profile pictures under
  the currently enabled Google/GitHub profile-sync configuration. This follows
  the configured collection permissions; a social profile's individual picture
  value was not copied or independently inspected. A missing upload UI does not
  establish absence of provider-side profile-picture collection.
- [Logs](https://manage.auth0.com/dashboard/us/dev-0kihwasowi558bwz/logs): after
  the user signed out/in on iPhone, observed native-app refresh, logout, login,
  and authorization-code exchange events. The fresh database login occurred at
  `2026-10-19T00:48:38.522Z` (October 18, 2026, 8:48:38 p.m. America/New_York).
  It retained email/user ID, IP, browser/OS user agent, login count, session and
  transaction identifiers, authentication-stage timings and total elapsed time.
- The same mobile event retained `location_info` with country/region/city,
  timezone, and coordinates. This supports disclosing IP-derived approximate
  location. Coordinate decimal formatting alone does not establish GPS-level
  accuracy; no device-location permission/API was found in mobile source. This
  directly observed data overrides the general Auth0 documentation's statement
  that location is absent unless enriched. No personal log values, precise
  coordinates, session values, or secrets are recorded in this document.

## Scope and evidence

- Mobile configuration: Expo SDK 57, `expo-updates` enabled with an EAS Update
  URL and automatic checks on load, Expo Notifications, and React Native Auth0.
- Auth0 scopes: `openid profile email offline_access` in
  `apps/mobile/src/lib/auth.ts`. The installed React Native SDK podspec declares
  Auth0.swift `2.24.1`; the submitted archive's resolved pod versions have not
  been independently inspected.
- Push registration sends a push token, platform, app version, and locale,
  authenticated and scoped to the active organization.
- The mobile logger writes to console. No first-party mobile remote crash,
  behavioral analytics, ad, or session-replay integration was found. The API's
  web telemetry endpoint does not by itself establish mobile collection.
- The installed Expo Updates downloader sends `EAS-Client-ID`, runtime and
  platform metadata, update IDs, and recently failed update IDs. An installation
  identifier is a device-level identifier, not an advertising identifier.
- Installed Expo Notifications and Expo EAS Client privacy manifests declare
  tracking false and no tracking domains. These manifests are not a substitute
  for reviewing network services and app behavior.
- The repository privacy policy covers account information, organization data,
  activity, push tokens, error reports, and security logs. The deployed policy
  URL could not be fetched by the research tool in this review.

## Declaration working inventory

Use App Functionality as the purpose for the following operational uses. Mark
identity-linked Yes and tracking No, subject to the account checks below.

| Data type | Operational use |
| --- | --- |
| Name | Member profiles, recipient selection, activity attribution |
| Email Address | Authentication, account administration, invitations |
| Photos or Videos | Profile pictures imported through enabled social-login connections |
| Coarse Location | Auth0's retained IP-derived country/region/city estimate |
| Other User Content | Award/deduction reasons, organization/house names, report text |
| User ID | Authentication subjects, account and organization authorization |
| Device ID | Push token and EAS Update installation identifier |
| Product Interaction | Awards, reactions, notification read state, administrative actions |
| Other Data Types | Memberships, roles, house assignments, device context, retained IP/security context where applicable |
| Crash Data | Expo Updates failure/recovery reporting; vendor publishing guidance explicitly calls for disclosure |
| Performance Data | Auth0's retained authentication timings and total elapsed time |
| Other Diagnostic Data | Retained authentication context and technical security/operational log details |

Crash Data was initially omitted in the guided questionnaire because the
first-party logger is local. Correct that omission: Expo's guidance explicitly
requires Crash Data when using `expo-updates`. App Functionality fits update
reliability/crash prevention. Do not assume diagnostics are unlinked solely
because no account email is sent: the update requests include an installation
identifier and no precollection de-identification has been established.

Do not select Analytics merely because a service records operational events.
Revisit if those events are used to evaluate audience characteristics or product
feature usage. Do not add marketing purposes for future billing or hypothetical
campaigns; assess the distributed app's actual practices.

## Authenticated checks before publishing

- [x] Confirm the production Native Application and tenant through EAS
  `env:list production`: matches the inspected Auth0 domain/native client.
  API/web origins are production; staging TestFlight alone was not used as proof.
- [x] Inspect enabled database/social connections and MFA for the tested app.
  Phone factors disabled; Google/GitHub profile syncing enabled.
- [ ] Inspect Post Login/registration Actions, legacy Rules/Hooks if present,
  extensions, and log streams for analytics, marketing, enrichment, or external
  destinations. Do not assume none exist because they are absent from Git.
- [x] Inspect a representative native-app successful login's field names;
  timing, device/browser, account, and security context retained. No intentional
  failed login was generated, and failure-specific payloads were not inspected.
- [x] Check whether IP-derived location is retained: observed `location_info`
  in the actual native login event. Declare Coarse Location based on IP-derived
  accuracy; reassess Precise Location if more accurate location is ever collected.
- [ ] Confirm hosting/service-provider logging and any separate product
  analytics use. Request-time processing is distinct from retained collection.
- [ ] Inspect the submitted archive's combined SDK privacy report before the
  production submission; resolve discrepancies with this working inventory.
- [ ] Recheck the deployed privacy policy and save/export the final App Store
  Connect declaration. This review does not publish or change that declaration.

## Primary references

- [Apple App Privacy details](https://developer.apple.com/app-store/app-privacy-details/):
  collection, purposes, identity linkage, and advertising/data-broker tracking.
- [Expo app-store publishing guidance](https://docs.expo.dev/distribution/app-stores/):
  explicitly says to select Crash Data for `expo-updates`.
- [Expo end-user privacy explanation](https://expo.dev/privacy-explained): push
  token retention and update-service request context; distinguishes developer
  tooling data from end-user app data.
- [Auth0 PII in logs](https://auth0.com/docs/deploy-monitor/logs/pii-in-logs):
  server-side collection beyond the SDK itself.
- [Auth0 logs](https://auth0.com/docs/deploy-monitor/logs): authentication,
  security, error events, and potential analytics uses.
- [Auth0 attack-protection events](https://auth0.com/docs/secure/attack-protection/view-attack-protection-events):
  IP information and the distinction between raw IP and enriched location.
