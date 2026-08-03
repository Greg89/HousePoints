# Mobile Store Launch Checklist

Use this checklist to turn the mobile workspace into an installable TestFlight
and Google Play application, then complete roadmap task 6.8. Do not commit
tokens, passwords, service-account JSON, signing keys, or other credentials.

## Progress record

- Release owner: Gregory Dodson
- Target version: `1.0.0`
- Candidate commit:
- Target internal-release date:
- Target public-release date:
- Support email: `dodson.gregory@gmail.com`
- Production web URL: `https://housepointsweb-production.up.railway.app/`
- Beta web URL: `https://housepointsweb-beta.up.railway.app/`
- Live privacy-policy URL:
  `https://housepointsweb-production.up.railway.app/privacy`
- Live support URL:
  `https://housepointsweb-production.up.railway.app/support`
- Public product homepage:
  `https://housepointsweb-production.up.railway.app/about`

Keep links to completed workflow runs and store submissions in the evidence
section at the end of this document. Do not record credential values here.

## 1. Finalize application identity and assets

The identifiers already committed to the application are:

- Display name: `HousePoints`
- iOS bundle identifier: `com.housepoints.app`
- Android application ID: `com.housepoints.app`
- Deep-link scheme: `housepoints://`

Before the first store build:

- [x] Use `1.0.0` as the first public version in
  `apps/mobile/app.config.ts`.
- [x] Add a final application icon.
- [x] Add an Android adaptive icon.
- [x] Add final splash-screen artwork.
- [x] Reference the assets from `apps/mobile/app.config.ts`.
- [ ] Prepare phone screenshots for App Store Connect and Google Play.
- [x] Write short and full Google Play store descriptions in
  [Google Play Store Listing](./google-play-store-listing.md).
- [x] Publish the privacy-policy page at the production URL.
- [x] Publish the support page at the production URL; support
  email is `dodson.gregory@gmail.com`.
- [ ] Deploy and verify the public HousePoints product homepage at `/about`.
- [ ] Verify the production Railway URL in Google Search Console using
  `/googledacf7ffa3b911a1e.html`, then resubmit Google OAuth branding review.
- [ ] Choose store categories and complete content/age-rating answers using
  [Google Play Console Declarations](./google-play-console-declarations.md).
  Target ages require a release-owner decision, and the documented UGC
  safeguards are a public-release blocker.
- [ ] Complete Google Play Data Safety answers using
  [Google Play Data Safety Draft](./google-play-data-safety.md). Confirm the
  production SDK behavior and Auth0 account-creation/deletion requirements.
- [ ] Complete Apple privacy disclosures.

The repository contains the approved icon, Android adaptive icon, and splash
assets under `apps/mobile/assets`; keep the store listing and submitted binary
aligned with that branding.

## 2. Create the Expo/EAS project

- [ ] Create or select the team-owned Expo account.
- [ ] From `apps/mobile`, run `eas login`.
- [ ] Run `eas init` and link the app to the intended Expo project.
- [ ] Record the generated project UUID as `EXPO_PUBLIC_EAS_PROJECT_ID`.
- [ ] Create an Expo access token for GitHub Actions.
- [ ] Store the token only as the `EXPO_TOKEN` GitHub Environment secret.
- [ ] Confirm EAS can manage the iOS and Android signing credentials.

Useful references:

- [EAS Build introduction](https://docs.expo.dev/build/introduction/)
- [EAS Submit overview](https://docs.expo.dev/deploy/submit-to-app-stores/)

## 3. Configure EAS Environments

Create EAS Environments named `development`, `preview`, and `production`.
Define every variable from `apps/mobile/.env.example` in each Environment:

- [ ] `EXPO_PUBLIC_API_BASE_URL`
- [ ] `EXPO_PUBLIC_WEB_BASE_URL`
- [ ] `EXPO_PUBLIC_AUTH0_DOMAIN`
- [ ] `EXPO_PUBLIC_AUTH0_CLIENT_ID`
- [ ] `EXPO_PUBLIC_AUTH0_AUDIENCE`
- [ ] `EXPO_PUBLIC_EAS_PROJECT_ID`
- [ ] `EXPO_PUBLIC_DEFAULT_ORG_SLUG`
- [ ] `EXPO_PUBLIC_POINT_ADJUSTMENTS_ENABLED`
- [ ] `EXPO_PUBLIC_MOBILE_ADMIN_ENABLED`

Environment mapping:

- [ ] `development` points to development/local services.
- [ ] `preview` points to staging API, web, and Auth0 configuration.
- [ ] `production` points only to production services.
- [ ] Preview and production values have been compared for accidental
  cross-environment URLs.

All `EXPO_PUBLIC_*` values are embedded in the application. They are
configuration, not safe storage for secrets.

## 4. Configure Auth0

- [ ] Create a dedicated Auth0 **Native Application** for HousePoints.
- [ ] Set its client ID as `EXPO_PUBLIC_AUTH0_CLIENT_ID` in the relevant EAS
  Environments.
- [ ] Add `housepoints://com.housepoints.app/callback` as an allowed callback
  URL.
- [ ] Add `housepoints://com.housepoints.app/logout` as an allowed logout URL.
- [ ] Enable Authorization Code with PKCE.
- [ ] Enable and review refresh-token rotation.
- [ ] Allow the intended staging and production database connections.
- [ ] Disable Google and GitHub for the first Play release. Only the intended
  Auth0 database connection should appear in Universal Login.
- [ ] Test database signup, sign-in, refresh, logout, and password recovery on
  a physical Android device.
- [ ] Confirm the Native Application can request the existing API audience.
- [ ] Confirm `EXPO_PUBLIC_AUTH0_AUDIENCE` exactly matches the API identifier.
- [ ] Confirm no Auth0 client secret is present in mobile or EAS public
  variables.
- [x] Add an in-app account-deletion request path with last-owner protection.
- [ ] Deploy and verify the external account-deletion resource at
  `https://housepointsweb-production.up.railway.app/account-deletion`.

## 5. Prepare the production API

- [ ] Deploy the mobile device-registration, notification, reaction, member,
  invite, and point-adjustment API changes.
- [ ] Deploy all production database migrations.
- [ ] Confirm the public API and web origins use HTTPS.
- [ ] Confirm production Auth0 issuer and audience validation.
- [ ] Set `PUSH_DISPATCH_ENABLED=true` when production push is approved.
- [ ] Store `EXPO_ACCESS_TOKEN` in the API host's secret storage.
- [ ] Confirm API logs redact tokens and include mobile request IDs.
- [ ] Sign in on a physical device and confirm device registration is created.
- [ ] Sign out and confirm the registration is revoked.
- [ ] Trigger an eligible notification and confirm push delivery remains
  organization-scoped.

## 6. Create the Apple application

- [ ] Enroll the owning organization/person in the Apple Developer Program.
- [ ] Accept current App Store Connect agreements.
- [ ] Complete required tax and banking setup.
- [ ] Reserve `com.housepoints.app`.
- [ ] Create the HousePoints App Store Connect application record.
- [ ] Record its numeric Apple ID for `EXPO_ASC_APP_ID`.
- [ ] Create an App Store Connect API key suitable for EAS Submit.
- [ ] Configure the key and distribution credentials in EAS.
- [ ] Complete listing text, screenshots, privacy, compliance, age rating, and
  review contact information.
- [ ] Configure the desired internal TestFlight testers or groups.

EAS Submit uploads an iOS build to App Store Connect/TestFlight. An operator
must still select the processed build and submit it for App Review.

## 7. Create the Google Play application

- [ ] Create or verify the Google Play Console developer account.
- [ ] Reserve `com.housepoints.app`.
- [ ] Create the HousePoints Play Console application.
- [ ] Complete listing text, screenshots, app access, ads, content rating,
  target-audience, and Data Safety sections.
- [ ] Create a Google service account with the minimum release permissions.
- [ ] Configure its credential in EAS; do not commit its JSON key.
- [ ] Configure the internal-testing tester list or Google Group.
- [ ] Complete any required first manual Play Console upload before relying on
  API-based EAS submissions.

## 8. Configure GitHub Environments

Create `mobile-internal-release`:

- [ ] Secret: `EXPO_TOKEN`
- [ ] Variable: `EXPO_ASC_APP_ID`
- [ ] Limit deployment access to trusted branches/operators.

Create `mobile-production-release`:

- [ ] Secret: `EXPO_TOKEN`
- [ ] Variable: `EXPO_ASC_APP_ID`
- [ ] Add required reviewers.
- [ ] Limit deployment access to `master`.

The production workflow can send Android directly to the Play production
track. Environment approval is therefore a release-control boundary.

## 9. Configure Maestro staging E2E

In the GitHub `staging` Environment:

- [ ] Secret: `MOBILE_E2E_ANDROID_APP_URL`
- [ ] Secret: `MOBILE_E2E_USER_EMAIL`
- [ ] Secret: `MOBILE_E2E_USER_PASSWORD`
- [ ] Secret: `MOBILE_E2E_TARGET_MEMBER`
- [ ] Secret: `MAESTRO_CLOUD_API_KEY`
- [ ] Repository or Environment variable: `MAESTRO_PROJECT_ID`

Staging data:

- [ ] The mobile actor authenticates through the Auth0 Native Application.
- [ ] The actor belongs to exactly one staging organization.
- [ ] The actor has a house assignment.
- [ ] The target is a different assigned member in the same organization.
- [ ] `MOBILE_E2E_TARGET_MEMBER` exactly matches the displayed member name.
- [ ] The staging organization can tolerate the five-point Teamwork award
  created by each Maestro run.

See [Staging E2E Test Data Contract](./staging-e2e-test-data-contract.md) for
the authoritative fixture requirements.

## 10. Rehearse the internal release

- [ ] Dispatch `Mobile Store Release` with `release_stage=internal` and
  `platform=all`.
- [ ] Confirm the workflow builds the `develop` branch.
- [ ] Confirm the iOS submission appears and finishes processing in TestFlight.
- [ ] Confirm the Android submission appears in Play internal testing.
- [ ] Install both builds through their real tester distribution paths.
- [ ] Record the build and submission links below.

## 11. Run physical-device smoke tests

Test at least one physical iPhone and one physical Android phone:

- [ ] Fresh install.
- [ ] Auth0 sign-in and sign-out.
- [ ] Organization selection and switching.
- [ ] Dashboard, leaderboard, and paginated activity.
- [ ] Award points.
- [ ] Reaction add, update, details, and removal.
- [ ] Notifications list, unread count, and mark-read operations.
- [ ] Push delivery while foregrounded, backgrounded, and closed.
- [ ] Notification tap routing.
- [ ] Dashboard, activity, and invite deep links.
- [ ] Member, admin, and owner permission behavior.
- [ ] Invite sharing.
- [ ] Feature-gated point deduction when enabled.
- [ ] Session expiry and recovery.
- [ ] Light and dark appearance.
- [ ] Upgrade from the previous build.
- [ ] Preview OTA update and rollback on a compatible runtime.

## 12. Pass the public-release gate

- [ ] Run `Mobile Staging E2E` against the candidate staging APK.
- [ ] Run it a second time after the first clean completion.
- [ ] Confirm the latest two completed runs on `develop` both succeeded.
- [ ] Confirm no completed failure, cancellation, or timeout separates them.
- [ ] Merge the approved candidate to `master`.
- [ ] Confirm final release notes and store metadata.

## 13. Submit publicly

- [ ] Dispatch `Mobile Store Release` with `release_stage=public` and the
  intended platform.
- [ ] Review and approve `mobile-production-release`.
- [ ] Monitor EAS Build and EAS Submit.
- [ ] Confirm the Android production-track submission and review state.
- [ ] In App Store Connect, select the processed build.
- [ ] Attach final metadata and submit the iOS version for App Review.
- [ ] Monitor both review processes.
- [ ] Verify each live store listing and perform a clean production install.
- [ ] Mark roadmap task 6.8 done only after evidence is recorded.

## Release evidence

Fill these in as work completes:

- Expo project:
- Internal release workflow:
- TestFlight internal submission:
- Play internal submission:
- iOS physical-device smoke:
- Android physical-device smoke:
- First qualifying staging E2E run:
- Second qualifying staging E2E run:
- Public release workflow:
- App Store Connect submission:
- Google Play production submission:
- Live App Store listing:
- Live Google Play listing:

