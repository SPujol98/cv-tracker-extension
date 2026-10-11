# Contributing

Thank you for helping. This project is small and strict about privacy, so please read these rules first.

## Clean-room rule

Contributions must be derived from the written specification and design in this repository. Do not copy code, assets or text from any other extension or product, and do not vendor third-party extension directories. Every pull request carries an attestation checklist (see the pull request template).

## No personal data

Never commit real names, email addresses, phone numbers, API keys, job offers, CVs or tracker data from any person. All fixtures and tests use freshly authored synthetic data. A pre-commit hook and CI scan for this; do not bypass the hook.

## Test-driven development

Work is test-driven: write a failing test first, make it pass with the smallest change, then refactor. Run the suite with `pnpm test` (Vitest) and the browser smoke tests with `pnpm e2e` (Playwright, headless Chromium).

## Commits and pull requests

- Use [Conventional Commits](https://www.conventionalcommits.org/) (`feat(scope): ...`, `fix: ...`, `docs: ...`, `test: ...`, `build: ...`).
- Keep each pull request focused and about 400 changed lines or fewer, excluding lockfiles.
- Update `CHANGELOG.md` under `[Unreleased]` for user-visible changes.

## Local setup

```sh
pnpm install   # also installs the pre-commit hook
pnpm exec playwright install chromium
```

Node 22.18 or newer is required; `.nvmrc` pins the version CI uses.

## Local checks

```sh
pnpm typecheck
pnpm lint
pnpm depcruise
pnpm check:deps
pnpm check:repo-policy --all
pnpm secretlint
pnpm test
pnpm build
pnpm e2e
```

## Required status checks

Merging to `main` requires every step of the `CI` workflow to pass: install with a frozen lockfile, type check, lint, layer boundaries, telemetry dependency check, repository policy, secret scan, dependency audit, tests with coverage, build, build tests and the end-to-end smoke test. The `CodeQL` workflow must also pass.

Maintainers: enable branch protection on `main` with these checks marked as required, and require pull requests before merging. This is configured in the repository settings, not in code.
