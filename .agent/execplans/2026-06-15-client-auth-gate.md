# Client-Only Terminal Login Gate

## Purpose / Big Picture

Add a German, terminal-styled password gate to every static Astro page. Visitors without a valid browser cookie see only the login screen. Visitors with a valid `rezepte_access` cookie can view the recipe browser and detail pages.

This is client-only deterrence for a GitHub Pages site. The generated HTML and assets remain publicly served and can be bypassed through direct requests or client-side inspection. The site must fail closed in the browser when `PUBLIC_REZEPTE_ACCESS_HASH` is missing or invalid.

## Progress

- [x] 2026-06-15: Created this ExecPlan before implementation.
- [x] 2026-06-15: Implemented shared auth gate and client helper module.
- [x] 2026-06-15: Added focused tests for hashing, cookies, and lockout helpers.
- [x] 2026-06-15: Documented env and deployment configuration.
- [x] 2026-06-15: Validated with `pnpm test`, Node 22 `pnpm build`, `git diff --check`, and generated HTML/CSS inspection.
- [x] 2026-06-15: Configured the GitHub repository variable `PUBLIC_REZEPTE_ACCESS_HASH`; the passphrase itself is not stored in the repo.

## Surprises & Discoveries

- The existing shared `BaseLayout.astro` wraps both the homepage and recipe detail pages, so the gate can be added once there.
- The GitHub Pages workflow currently runs `pnpm build` without `PUBLIC_REZEPTE_ACCESS_HASH`; it needs an env handoff from a repo variable or secret for the deployed gate to unlock.
- The local default `node` is v20.19.2, which lets tests run with an engine warning but makes Astro reject `pnpm build`; the build was validated with a temporary Node v22.12.0 binary extracted under `/tmp`.

## Decision Log

- 2026-06-15, Codex: Keep auth entirely client-side and static-compatible to preserve GitHub Pages deployment.
- 2026-06-15, Codex: Store the expected password as a lowercase SHA-256 hex digest in `PUBLIC_REZEPTE_ACCESS_HASH`; never commit the password itself.
- 2026-06-15, Codex: Use `rezepte_access` as the cookie name with `Path=/rezepte/`, `SameSite=Lax`, `Secure`, and a 30-day max age.
- 2026-06-15, Codex: Use localStorage lockout keys `rezepte_auth_failures` and `rezepte_auth_next_allowed_at`; treat lockout only as a bypassable client-side throttle.
- 2026-06-15, Codex: Pass the public hash into the Pages build from `vars.PUBLIC_REZEPTE_ACCESS_HASH` first, falling back to `secrets.PUBLIC_REZEPTE_ACCESS_HASH`.
- 2026-06-15, Codex: Configure the deployed build via GitHub repository variable instead of committing a local `.env` file.

## Outcomes & Retrospective

Implemented the client-only terminal login gate across all pages through the shared layout. The page content starts hidden with `auth-pending` and `data-auth-content aria-hidden="true"` until the client verifies the cookie or a correct password. Missing or invalid `PUBLIC_REZEPTE_ACCESS_HASH` leaves the site closed in the browser and shows a German configuration error.

Automated browser interaction was not run in this session. The core behavior is covered by Vitest helper tests, and generated homepage/detail HTML was inspected after a production build.

## Context and Orientation

- `src/layouts/BaseLayout.astro` is the shared layout for all public pages.
- `src/pages/index.astro` renders the German recipe browser and filter controls.
- `src/pages/r/[slug].astro` renders each static recipe detail page.
- `src/styles/global.css` owns the terminal look and mobile behavior.
- `astro.config.mjs` sets `base: "/rezepte"`; cookie path and route behavior must respect this base.
- The project is static-first and deployed through `.github/workflows/pages.yml`.

## Plan of Work

1. Create a testable `src/lib/auth-gate.ts` module for SHA-256 hashing, hash normalization, cookie helpers, failure tracking, lockout delay calculation, logout handling, and DOM initialization.
2. Create a shared `AuthGate.astro` component with German terminal login markup and a client script that initializes the module.
3. Update `BaseLayout.astro` so the auth gate renders before the normal content and the normal content is hidden until the client unlocks it.
4. Add CSS for pending, locked, config-error, and unlocked states while preserving the black/green monospace style.
5. Add Vitest coverage for hash normalization, lockout delay calculation, cookie helpers, localStorage failure tracking, and SHA-256 hashing.
6. Update README and the GitHub Pages workflow with the `PUBLIC_REZEPTE_ACCESS_HASH` contract.

## Validation and Acceptance

Run:

```sh
pnpm test
PUBLIC_REZEPTE_ACCESS_HASH=<64-char-sha256-hex> pnpm build
```

Actual validation:

- `pnpm test` passed: 2 files, 11 tests. The local Node v20.19.2 emitted the expected engine warning.
- `PATH=/tmp/node-v22.12.0-linux-x64/bin:$PATH PUBLIC_REZEPTE_ACCESS_HASH=9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08 pnpm build` passed with Node v22.12.0.
- `git diff --check` passed.
- `dist/index.html` and `dist/r/pasta-bohnen-carbonara/index.html` contain the auth gate, client script, `body class="auth-pending"`, and `data-auth-content aria-hidden="true"`.
- Built CSS contains `body:not(.auth-unlocked) .auth-content { display: none; }` and `body.auth-unlocked .auth-gate { display: none; }`.
- `gh variable set PUBLIC_REZEPTE_ACCESS_HASH --repo m4s-ai/rezepte --body <sha256>` succeeded, and `gh variable list --repo m4s-ai/rezepte` confirmed the variable is present.

Inspect generated output:

- `dist/index.html` contains auth gate markup and starts with hidden normal content.
- One `dist/r/.../index.html` detail page contains the same auth gate.
- `dist/` remains unstaged.

Manual browser scenarios to verify when running a preview:

- No cookie shows only the login screen.
- A wrong password increments failures and eventually shows a local lockout message.
- The correct password sets the cookie and reveals content.
- Reload keeps access while the cookie is valid.
- `?logout=1` clears the cookie and returns to the login screen.

## Idempotence and Recovery

- Removing `PUBLIC_REZEPTE_ACCESS_HASH` keeps the site closed in the browser and shows a German configuration error.
- Clearing browser cookies/localStorage resets local access and lockout state.
- Reverting the layout/component/module/CSS changes restores the public static site behavior.
- Do not commit `dist/`, temporary browser profiles, or local preview artifacts.

## Interfaces and Dependencies

- Env var: `PUBLIC_REZEPTE_ACCESS_HASH`, lowercase SHA-256 hex digest.
- Cookie: `rezepte_access`.
- Cookie max age: 30 days.
- Cookie attributes: `Path=/rezepte/`, `SameSite=Lax`, `Secure`.
- localStorage keys: `rezepte_auth_failures`, `rezepte_auth_next_allowed_at`.
- Public URL base: `/rezepte`.
- No new runtime dependencies.
