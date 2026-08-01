# Google Play Console Declarations

Use this runbook when completing **Policy and programs > App content** and
**Grow users > Store presence > Store settings** for the Android application.
Answers must be rechecked against the exact build submitted for review.

## Store category

- Application type: **App**
- Recommended category: **Business**
- Rationale: the current listing positions HousePoints as an organization tool
  for recognition, team scoring, membership, roles, and administration. It is
  not presented as curriculum, a study aid, or an educational game.
- Tags: select only Play Console suggestions that plainly describe the shipped
  experience. Prefer organization/teamwork or productivity tags if offered;
  do not add school, classroom, social-network, or game tags solely for reach.

Reconsider **Education** only if the product and store listing are deliberately
repositioned for schools or classroom learning. That decision also affects the
target-audience and Families-policy analysis.

## Privacy policy

- Privacy-policy URL:
  `https://housepointsweb-production.up.railway.app/privacy`
- Status: published and publicly accessible without authentication.

## Ads

- Does the app contain ads? **No**
- Basis: the mobile dependency set and shipped UI contain no advertising SDK,
  banner, native ad, or display-ad integration.
- Revisit this answer before adding any advertising SDK or placement.

## App access

- Is all or some functionality restricted? **Yes**
- Restriction: Auth0 authentication and an active HousePoints organization
  membership are required.
- Reviewer access: provide a dedicated review account in Play Console. Never
  store its password in this repository.
- Instructions should explain:
  1. Open the app and select **Sign in with Auth0**.
  2. Enter the Play review account credentials.
  3. Select the preconfigured review organization if prompted.
  4. Use the seeded dashboard, leaderboard, activity, and notifications.
  5. Explain whether the supplied account is a member, admin, or owner and which
     role-gated features should appear.
- Confirm that MFA, CAPTCHA, expiring invitations, IP restrictions, or another
  challenge will not prevent unattended review.

## Target audience and content

The age groups cannot be selected safely until the release owner confirms the
intended audience. Do not infer the audience from the eventual content rating.

- If HousePoints is designed only for adult-run organizations: select only the
  applicable adult age group(s) and ensure the listing does not target children.
- If teenagers are intended users: select the exact teen groups the product was
  designed for and verify privacy, moderation, and store presentation for them.
- If any selected group includes children under 13: stop and complete a full
  Google Play Families-policy and child-privacy review before submission.

Decision required from the release owner:

- [ ] Record the intended age groups.
- [ ] Confirm whether children under 13 are an intended audience.

## Content rating (IARC)

- Questionnaire category: **Utility, Productivity, Communication or Other**
- Violence: **No**, based on shipped first-party content.
- Sexuality or sexual content: **No**, based on shipped first-party content.
- Controlled substances: **No**, based on shipped first-party content.
- Gambling: **No**. House points have no cash value and the app has no wagering.
- Purchases: **No**, unless billing is added to the submitted build.
- Location sharing: **No**.
- Digital purchases or paid random items: **No**.
- User-to-user communication: answer according to the questionnaire wording.
  There is no chat or direct messaging, but members communicate limited
  free-text award/deduction reasons to other members through Activity.
- User-generated content: **Yes**. Free-text point reasons and editable display
  names are contributed by users and visible to members of an organization.
- Content sharing is organization-scoped and authenticated, not public.

Treat the calculated regional ratings as results, not predetermined answers.
Retake the questionnaire whenever shipped content changes an answer.

## User-generated-content release blocker

Google Play's User Generated Content policy applies even when contributed
content is visible only to a closed school, company, or other verified group.
The current product does not provide all required safeguards.

Before public Play submission:

- [ ] Publish terms of use or an acceptable-use policy that defines and
  prohibits objectionable content and behavior.
- [ ] Require acceptance before a user can create user-generated content.
- [ ] Add an in-app way to report an Activity reason and its author.
- [ ] Add an in-app way to report a user.
- [ ] Establish an operator workflow to review reports and take action.
- [ ] Document moderation and response expectations.
- [ ] Reassess whether user blocking is required for the final interaction
  model; it is explicitly required for one-to-one interactions.

Do not answer **No** to UGC merely because content is organization-scoped or
because point reasons are limited in length.

## Other expected declarations

Based on the current build:

- News app: **No**
- Government app: **No**
- Health app: **No**
- Financial features: **No**
- Dating or matchmaking: **No**
- Real-money gambling or games: **No**
- Generative AI features: **No**
- COVID-19 contact tracing or status: **No**

Recheck the App content dashboard because Play Console may add or revise
declarations after this runbook is written.
