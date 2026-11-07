# anti-slop provenance

- Source: https://github.com/dmmulroy/anti-slop
- Commit: `13909c9e07590f5a85d93c62712259fe14a883f7`, from 2026-10-13.
- Copied from: `skills/install-anti-slop/assets/anti-slop/` at that commit, which is upstream `src/` without the rule tests.
- Installed plugins: `anti-slop` from `./tools/oxlint/anti-slop/index.ts` and `anti-slop-effect` from `./tools/oxlint/anti-slop/effect/index.ts`, both registered in `.oxlintrc.json`.
- Licenses: `LICENSE` for anti-slop and `vendor/eslint-stylistic/LICENSE` for ESLint Stylistic, both MIT. `vendor/eslint-stylistic/UPSTREAM.md` records where the ESLint Stylistic code came from.

## Local deviations

The vendored source is unchanged. Configuration differs from upstream's recommended set:

- `anti-slop/no-module-mocking` is off. 12 test files use `vi.mock`, and replacing those module mocks with injected dependencies is deferred.
- `anti-slop-effect/no-service-constructor-imports` is off. `make*` factories build the gateways, and turning them into `Context.Service` layers is deferred.
