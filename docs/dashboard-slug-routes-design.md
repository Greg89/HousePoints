# Dashboard Slug Routes Design

Product and engineering plan for making organization slugs visible in dashboard URLs while keeping organization membership and authorization derived from the authenticated user.

---

## Current State

The app currently has these user-facing routes:

- `/`: primary authenticated dashboard and compatibility entry point.
- `/o/{slug}`: slug-bearing authenticated dashboard entry point.
- `/settings`: signed-in user settings.
- `/o/{slug}/join/{token}`: slug-bearing invite join route.

Organization slugs are already durable enough to support URL work:

- `Organization.slug` stores the current canonical slug.
- `OrganizationSlugAlias` reserves current and retired slugs for the same organization.
- Invite links include the current slug for readability and user trust.
- Invite joining still uses the single-use token as the secure credential.

Dashboard routes now support `/o/{slug}`. The slug route first resolves route context through the API, then renders the same dashboard only when the authenticated actor is allowed to view their own organization. Dashboard data still reads the actor's organization from the authenticated session and API responses, not from the URL.

---

## Product Goal

Make the organization feel more visible and concrete by giving the dashboard a canonical URL:

```text
/o/{organizationSlug}
```

This should make shared screenshots, bookmarks, future invite flows, and user orientation feel more organization-aware without changing the current single-organization membership model.

---

## Design Principles

- The slug is a routing and trust affordance, not an authorization credential.
- The authenticated user's app membership remains the source of truth.
- API reads and writes continue deriving `organizationId` from the actor.
- Old slug aliases should resolve to the original organization and redirect to the current slug.
- Unknown or mismatched slugs should produce clear, safe states instead of silently showing the wrong organization.
- This is not org discovery and should not reveal private organization data to non-members.

---

## Recommended MVP

Add `/o/[slug]` as a dashboard entry point that reuses the existing dashboard experience.

Keep `/` working during the first implementation slice. Once the slugged dashboard has production confidence, `/` can optionally redirect authenticated org members to `/o/{currentSlug}`.

Recommended behavior:

| User state | Requested URL | Result |
|---|---|---|
| Signed out | `/o/acme` | Start login with return path back to `/o/acme`. |
| Signed in, member of `acme` | `/o/acme` | Render the dashboard. |
| Signed in, member of `acme` | `/o/old-acme` | Redirect to `/o/acme`. |
| Signed in, no organization | `/o/acme` | Show the normal org onboarding state. Do not join by slug alone. |
| Signed in, member of another org | `/o/acme` | Show a blocked state with a link to the user's own org dashboard and a sign-out option. |
| Signed in, unknown slug | `/o/not-real` | Show a safe not-found state. |
| Signed in, valid org but unassigned house | `/o/acme` | Show the existing assignment/waiting state. |

The different-organization state should not silently redirect to the actor's org. The visible slug represents user intent, and a blocked state is less surprising than landing in a different organization.

---

## Route Context

The web app needs a small route-context read before rendering `/o/[slug]`.

Recommended shape:

```ts
type OrgRouteContext =
  | {
      status: "MATCH";
      requestedSlug: string;
      organizationSlug: string;
    }
  | {
      status: "ALIAS_REDIRECT";
      requestedSlug: string;
      organizationSlug: string;
    }
  | {
      status: "DIFFERENT_ORG";
      requestedSlug: string;
      organizationSlug: string;
      actorOrganizationSlug: string;
      actorOrganizationName: string;
    }
  | {
      status: "NO_ACTOR_ORG";
      requestedSlug: string;
      organizationSlug?: string;
    }
  | {
      status: "NOT_FOUND";
      requestedSlug: string;
    };
```

The API should own slug alias resolution. The web app should not add a direct database dependency just to resolve route slugs.

The route-context endpoint can be authenticated and narrow:

- Resolve the requested slug through `OrganizationSlugAlias`.
- Compare the resolved organization to the actor's organization, if any.
- Return only routing context and minimal display fields.
- Do not return points, members, houses, or private reporting data unless the actor belongs to the organization.

---

## Navigation Changes

Phase the navigation changes so links can move to slugged URLs after the route works:

- Dashboard home links should use `/o/{currentSlug}` when the session has an organization slug.
- Invite join success should route to `/o/{joinedOrgSlug}` instead of `/`.
- The "Go to dashboard" action on invite preview should use the slugged dashboard.
- `/settings` can remain global for now because it is personal user settings, not an org dashboard.
- Manage can remain a dashboard tab. A future deep link such as `/o/{slug}/manage` should be designed separately if needed.

---

## Security Notes

- A slug must never grant access to another organization's data.
- All dashboard data endpoints should keep using actor-derived organization scope.
- Different-org requests should not call dashboard summary, admin, season, or reporting reads for the requested slug.
- Unknown slug handling should avoid exposing more than necessary.
- Old slug aliases should redirect only when the alias belongs to the actor's organization or to the same invite/join context already being validated.
- Raw invite tokens remain excluded from logs.

---

## Implementation Phases

### Phase 1 - Route Context Contract

- Add a shared contract for organization route context.
- Add an authenticated API route to resolve a requested slug against aliases.
- Cover current slug, old alias, unknown slug, no-org actor, and different-org actor states.

Status: implemented.

### Phase 2 - Slugged Dashboard Route

- Add `apps/web/src/app/o/[slug]/page.tsx`.
- Reuse the existing dashboard rendering path after route context validates access.
- Redirect alias requests to the canonical slug.
- Add blocked and not-found presentation states.
- Keep `/` rendering the existing dashboard.

Status: implemented.

### Phase 3 - Canonical Navigation

- Update dashboard links to prefer `/o/{slug}`.
- Update invite join and preview calls to navigate to `/o/{slug}` after successful or already-member flows.
- Keep `/` as a compatibility entry point.

Status: not started.

### Phase 4 - Optional Root Redirect

- Redirect authenticated users with an organization from `/` to `/o/{currentSlug}`.
- Preserve onboarding behavior for signed-in users without an organization.
- Preserve Auth0 login return behavior for signed-out users.

Status: not started.

---

## Test Plan

API and contract tests:

- Route context schema accepts all expected statuses.
- Current slug returns `MATCH` for same-org actor.
- Old slug alias returns `ALIAS_REDIRECT` with the current slug.
- Unknown slug returns `NOT_FOUND`.
- No-org actor does not gain membership or org data by requesting a slug.
- Different-org actor receives `DIFFERENT_ORG`.
- Invalid slug syntax returns a stable validation error.

Web tests:

- `/o/{currentSlug}` renders the dashboard for a same-org actor.
- `/o/{oldSlug}` redirects to `/o/{currentSlug}`.
- Different-org actor sees the blocked state and a link to their own org dashboard.
- Signed-in no-org actor sees onboarding rather than joining by slug.
- Unknown slug shows a safe not-found state.
- `/` continues to work until the optional root redirect phase is implemented.

Regression checks:

- `/o/{slug}/join/{token}` still previews and joins by token.
- Invite join success routes to the expected dashboard URL after navigation is updated.
- Dashboard widgets, activity, leaderboard, and Manage still read only the actor organization.
- Settings remains reachable at `/settings`.
