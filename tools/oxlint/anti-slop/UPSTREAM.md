# anti-slop provenance

- Source: https://github.com/dmmulroy/anti-slop
- Commit: `13909c9e07590f5a85d93c62712259fe14a883f7` (2026-10-13)
- Copied from: `skills/install-anti-slop/assets/anti-slop/` at that commit, which is upstream `src/` without the rule tests.
- Installed plugins: `./tools/oxlint/anti-slop/index.ts` (`anti-slop`) and `./tools/oxlint/anti-slop/effect/index.ts` (`anti-slop-effect`), registered in `.oxlintrc.json`.
- Licenses: `LICENSE` (anti-slop, MIT) and `vendor/eslint-stylistic/LICENSE` (ESLint Stylistic, MIT, provenance in `vendor/eslint-stylistic/UPSTREAM.md`).

## Local deviations

The vendored source is unchanged. Configuration differs from upstream's recommended set:

- `anti-slop/no-module-mocking` is off. 12 test files use `vi.mock`; replacing them with dependency seams is deferred.
- `anti-slop-effect/no-service-constructor-imports` is off. The gateways are built by `make*` factories; turning them into `Context.Service` layers is deferred.
