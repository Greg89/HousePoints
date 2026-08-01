# Google Play Data Safety Draft

Use this document to complete **Policy and programs > App content > Data
safety** for `com.housepoints.app`. It reflects the current Android source and
must be checked against the production build, Auth0 tenant, Expo configuration,
hosting configuration, and any SDK-generated native manifest before submission.

## Form overview

- Does the app collect or share required user data types? **Yes**
- Is all collected user data encrypted in transit? **Yes**, provided every
  production API, Auth0, Expo Updates, and Expo Push endpoint remains HTTPS.
- Does the app provide a data-deletion request mechanism? **Yes**. The published
  privacy and support pages direct requests to `dodson.gregory@gmail.com`.
- Is data shared with third parties? **Provisionally no**, when Auth0, Railway,
  Expo, and their infrastructure subprocessors act only as service providers
  processing data on the developer's behalf. Reconfirm contractual roles and
  production integrations before submitting the form.
- Is an independent security review available? **No**, unless a qualifying
  review is completed separately.

## Data-type answers

In the table, **required** means at least one distributed app flow requires the
collection. **Optional** means users can avoid that collection by not using the
feature or denying the related permission.

| Play data type | Collected | Shared | Required or optional | Purposes | HousePoints examples |
| --- | --- | --- | --- | --- | --- |
| Personal info: Name | Yes | No, subject to service-provider confirmation | Required | App functionality; Account management | Auth0/profile display name; member and activity display |
| Personal info: Email address | Yes | No, subject to service-provider confirmation | Required | App functionality; Account management; Fraud prevention, security, and compliance | Auth0 identity, membership identity, support/account administration |
| Personal info: User IDs | Yes | No, subject to service-provider confirmation | Required | App functionality; Account management; Fraud prevention, security, and compliance | Auth0 subject and HousePoints user identifier |
| Personal info: Other info | Yes | No | Required | App functionality; Account management; Personalization | Organization memberships, roles, house assignment, organization and house preferences |
| App activity: Other user-generated content | Yes | No | Optional | App functionality | Free-text award and deduction reasons |
| App activity: App interactions | Yes | No | Required | App functionality; Fraud prevention, security, and compliance | Authenticated endpoint use, active-organization context, notification read state |
| App activity: Other actions | Yes | No | Optional | App functionality | Point awards/deductions, reactions, invitations, member and role actions |
| Device or other IDs | Yes | No, subject to Expo service-provider confirmation | Optional | App functionality; Developer communications | Expo push token used for device registration and push delivery |

### Device-registration context

When push notifications are enabled on a physical device, HousePoints also
transmits the device platform, app version, and locale with the Expo push token.
Treat these as part of the applicable device identifier/other-info declaration
unless Play Console or current SDK guidance classifies them more specifically.

## Data types not collected by current first-party code

Do not select these unless the final native build, SDK disclosures, or
production services demonstrate collection:

- Approximate or precise location
- Phone number
- Race and ethnicity; political or religious beliefs; sexual orientation; or
  other sensitive personal information
- User payment information, purchase history, credit information, or other
  financial information
- Health or fitness information
- Emails, SMS/MMS, or other in-app messages
- Photos, videos, audio files, music files, documents, or other files
- Contacts
- Calendar information
- Web browsing history
- In-app search history
- Installed apps
- Crash logs, diagnostics, or other performance data transmitted by custom
  HousePoints mobile code

The structured mobile logger currently writes to the device console. Revisit
crash-log and diagnostics answers before adding remote error reporting,
analytics, performance monitoring, or session replay.

## Retention and deletion

- The privacy policy states that information is retained while an account or
  organization needs the service and as reasonably required for security,
  disputes, legal compliance, and backups.
- Membership removal is an organization-scoped archive operation; it is not
  deletion of the global HousePoints user or Auth0 identity.
- General access, correction, and deletion requests are accepted through the
  published support channel.

### Account-deletion decision and blocker

The release owner confirmed that the production Auth0 Universal Login permits
users to create an account. Google Play's account-deletion requirements apply.

- [x] Record that self-service account creation is enabled.
- [ ] If enabled, add a readily discoverable in-app path to initiate account
  and associated-data deletion.
- [ ] If enabled, publish a dedicated external account-deletion resource that
  lets former users initiate deletion without reinstalling the app.
- [ ] If enabled, enter that external URL in Play Console's account-deletion
  field.
- [ ] Define which records are deleted, anonymized, or retained for legitimate
  reasons and keep the privacy policy consistent.

Do not select Play Console's exemption for apps that do not create accounts.

## SDK and build verification

Before submitting the form:

- [ ] Generate the production Android native project/build.
- [ ] Review the merged Android manifest and runtime permissions.
- [ ] Review current data-safety guidance for `react-native-auth0`,
  `expo-notifications`, `expo-updates`, and any transitively included SDK.
- [ ] Confirm no analytics, advertising, crash-reporting, or session-replay SDK
  is present in the submitted artifact.
- [ ] Confirm Auth0 connections and rules/actions do not transfer data outside
  the disclosed service-provider model.
- [ ] Confirm Railway/API logs do not infer location from IP addresses or add
  undisclosed analytics profiles.
- [ ] Confirm all production endpoints use TLS.
- [ ] Export the completed Play Console form and retain it with release evidence.

## Change triggers

Revisit this form when adding analytics, remote error reporting, advertising,
billing, uploads, location, contacts, messaging, new authentication providers,
new push infrastructure, or any SDK that transmits user data off device.
