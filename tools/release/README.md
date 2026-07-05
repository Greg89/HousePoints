# Release Automation Tools

This folder is the future home for release-note generation.

The current production flow is still manual:

1. Update `site/releases/`.
2. Run the `Publish Release Notes` GitHub Actions workflow.

The future automated flow should render release metadata into the template in `templates/release-page.html`, update `site/releases/index.html`, and publish the `site` directory to GitHub Pages.

## Planned Inputs

The generator should receive:

- `version` - semantic version such as `v1.4.0`;
- `releasedAt` - release date in `YYYY-MM-DD`;
- `summary` - short plain-language release summary;
- `highlights` - generated or curated user-facing changes;
- `fixes` - generated fixes from Conventional Commits;
- `operationsNotes` - migrations, feature flags, rollout notes, or config changes;
- `verification` - CI, staging E2E, and production smoke evidence.

## Planned Semantic Release Integration

The intended semantic-release shape is:

1. `@semantic-release/commit-analyzer` determines release type from Conventional Commits.
2. `@semantic-release/release-notes-generator` generates release notes.
3. A HousePoints release script renders static Pages content from the generated notes.
4. `@semantic-release/github` creates the GitHub Release.
5. GitHub Pages publishes the updated `site` directory.

The semantic-release exec plugin can run custom shell commands during release lifecycle steps, including `prepare`, `publish`, `success`, and `fail`. That makes it a good fit for calling a future `tools/release/generate-release-site.mjs` script once the manual release shape is proven.

Do not wire in-app user notifications directly from semantic-release. In-app announcements should go through an app-owned API after production deployment and health checks succeed.
