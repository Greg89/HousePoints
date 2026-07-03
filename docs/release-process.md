# Release Process

## Purpose

HousePoints release communication should become predictable before it becomes automated. The first implementation slice publishes static release notes to GitHub Pages through a manual workflow. Later slices can generate notes from Conventional Commits, create GitHub Releases, and fan out in-app notifications.

## Current Release Notes Flow

One-time GitHub setup:

1. Open repository Settings.
2. Go to Pages.
3. Set the Pages source to GitHub Actions.
4. Confirm the workflow can deploy to the `github-pages` environment.

Per release:

1. Update the static release notes under `site/releases/`.
2. Commit the release note changes with the application release changes or in a small follow-up commit.
3. Run the `Publish Release Notes` GitHub Actions workflow manually.
4. Confirm the GitHub Pages deployment URL in the workflow summary.

The workflow publishes the `site` directory as the Pages artifact. The static site currently includes:

- `site/index.html` - redirects to the release notes index.
- `site/releases/index.html` - public release history.
- `site/releases/template.html` - copyable structure for future release entries.
- `site/assets/styles.css` - shared styling.

Automation scaffolding lives under `tools/release/`. It is not active yet, but it documents the future semantic-release integration point and includes the machine-oriented release-page template that a generator can render into `site/releases/`.

## Commit Convention

Use Conventional Commit prefixes for release intent going forward:

| Prefix | Use |
|---|---|
| `feat:` | User-visible feature or capability. |
| `fix:` | Bug fix or production behavior correction. |
| `docs:` | Documentation-only change. |
| `test:` | Test-only change. |
| `ci:` | Workflow or automation change. |
| `chore:` | Maintenance change with no user-facing behavior. |
| `refactor:` | Internal structure change with no intended behavior change. |

Examples:

```text
feat: add owner-only member removal
fix: tighten auth0 login selector in staging e2e
ci: publish release notes through github pages
docs: document release communication phases
```

Breaking changes should be called out explicitly in the commit body:

```text
BREAKING CHANGE: describe the required operator or user action.
```

## Release Note Shape

Each release note should lead with user impact, then include operational detail.

Recommended sections:

- Highlights
- Fixes
- Operations Notes
- Verification

Operations notes should include required environment variables, database migrations, feature flags, or rollout order.

Verification should include the relevant gates, for example:

```text
npm run lint
npm run typecheck
npm test
npm run build
npm run test:integration
Staging E2E workflow
```

## Future Automation Phases

1. Generate release notes from Conventional Commits.
2. Create GitHub Releases for production tags.
3. Publish generated release notes to GitHub Pages.
4. Create app-owned release records.
5. Broadcast in-app release notifications after production deploys and health checks pass.

GitHub Actions should trigger app behavior for user notifications. It should not write release notifications directly into the production database.

## Future Semantic Release Shape

The likely automated release pipeline is:

1. Production branch receives a promotion merge.
2. Semantic-release analyzes Conventional Commits since the previous production tag.
3. Semantic-release calculates the next version and generates release notes.
4. A HousePoints release script renders `tools/release/templates/release-page.html` into a new `site/releases/vX.Y.Z.html` page.
5. The script updates `site/releases/index.html`.
6. Semantic-release creates the GitHub Release with the same notes.
7. The Pages publishing workflow deploys the updated `site` directory.

Keep the manual release note process until the release-note structure is boring and repeatable. Automation should make the known process faster; it should not decide the product communication style before the team has learned what readers need.
