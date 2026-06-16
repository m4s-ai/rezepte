# AGENTS.md

## Project Snapshot

This repository is `m4s-ai/rezepte`, a public Astro static site deployed to
GitHub Pages at `https://m4s-ai.github.io/rezepte/`.

The app is intentionally small:

- `src/pages/index.astro` renders the German recipe browser, search, and filters.
- `src/pages/r/[slug].astro` renders static recipe detail pages.
- `src/lib/recipes.ts` loads Markdown recipes and provides route helpers.
- `src/content/recipes/` contains generated public recipe Markdown.
- `scripts/sync-recipes.mjs` imports publishable recipes from a Second Brain
  checkout.
- `.github/workflows/pages.yml` builds and deploys the site on pushes to `main`.

Keep the UI German, terminal-styled, and static-first. The public URL base is
`/rezepte`; route helpers must continue to respect `import.meta.env.BASE_URL`.

## Source Of Truth

Recipes originate from `rabanopenclaw/second-brain/Atlas/Recipes` and are
published only when frontmatter contains `public: true`.

Do not hand-edit `src/content/recipes/*.md` for normal recipe corrections.
Prefer fixing the source recipe or the sync script. It is acceptable to inspect
generated recipe files when debugging build output, filters, tags, categories,
or rendering behavior.

The public frontmatter contract is:

- required: `public: true` in the source repository
- allowed output keys: `title`, `description`, `tags`, `category`, `date`
- title fallback order: frontmatter `title`, first Markdown H1, filename
- Obsidian links are converted to plain text by the sync script

## Commands

Use `pnpm`.

- Install: `pnpm install --frozen-lockfile`
- Sync local recipes: `pnpm sync:recipes -- --input ../second-brain/Atlas/Recipes`
- Unit tests: `pnpm test`
- Production build: `pnpm build`
- Dev server: `pnpm dev`
- Production preview: `pnpm preview`

Before finishing source changes, run `pnpm test` and `pnpm build` unless the
change is documentation-only. For documentation-only changes, run at least
`git diff --check`.

When running local servers in managed Codex environments, local port binding may
require approval. Stop preview/dev servers before ending the task unless the user
explicitly asks to keep them running.

## Engineering Guidelines

- Keep changes small and scoped to the requested behavior.
- Prefer existing Astro, TypeScript, and CSS patterns over new abstractions.
- Keep route construction in `src/lib/recipes.ts`; do not hard-code `/rezepte`
  in pages or components.
- Use `URLSearchParams` or URL APIs for query strings.
- Preserve static output. Do not add server-only runtime dependencies unless the
  user explicitly changes the deployment target.
- Do not commit `dist/`, caches, screenshots, temporary browser profiles, or
  local config files.
- Avoid changing recipe sync semantics and UI behavior in the same commit unless
  the user requested one inseparable feature.
- Treat GitHub Pages deployment as the live verification path after pushing to
  `main`.
- Keep `docs/second-brain-rezepte-sync.workflow.yml` on a Node version that
  satisfies `package.json` engines; that external sync workflow runs this
  repo's `pnpm test` and `pnpm build` before pushing generated recipes.
- This is a GitHub Pages project site. `public/robots.txt` deploys under
  `/rezepte/robots.txt`, not host-root `/robots.txt`; use HTML `noindex` here
  and a host-root Pages repo or custom domain for authoritative crawler blocks.

## UI Guidelines

- Keep labels and visible copy in German.
- Preserve the black background, green monospace terminal feel.
- Favor compact controls and readable lists over marketing-style sections.
- Ensure mobile layout remains readable after filter or metadata changes.
- Use visible focus states for interactive controls and links.
- If adding filterable URLs or links, verify encoded values such as
  `food/skillet` as `%2F` in links and decoded select values in the browser.

## Planning Workflow

Use a lightweight plan in chat for small, single-session changes.

Use an ExecPlan for complex features, significant refactors, source-sync
changes, automation changes, or work likely to span more than one session. In
this repo, an ExecPlan is a living Markdown plan that is detailed enough for a
new agent or human maintainer to resume from the plan alone.

Store ExecPlans under `.agent/execplans/` using a stable slug:

```text
.agent/execplans/YYYY-MM-DD-<short-topic>.md
```

When creating an ExecPlan, include these sections:

- `Purpose / Big Picture`: user-visible outcome and how to see it working.
- `Progress`: checkbox list with dated updates at every stopping point.
- `Surprises & Discoveries`: unexpected repo, build, data, or deployment facts.
- `Decision Log`: decisions, rationale, date, and author.
- `Outcomes & Retrospective`: final result, gaps, and lessons.
- `Context and Orientation`: files, current behavior, and relevant constraints.
- `Plan of Work`: concrete sequence of edits.
- `Validation and Acceptance`: commands and observable expected behavior.
- `Idempotence and Recovery`: retry, rollback, or cleanup notes.
- `Interfaces and Dependencies`: public URLs, frontmatter, scripts, workflows,
  helper functions, or external dependencies that change.

ExecPlan rules:

- Keep the plan self-contained. Do not rely on unstated chat history.
- Update `Progress`, `Surprises & Discoveries`, and `Decision Log` as work
  proceeds.
- Prefer incremental milestones that can each be validated with `pnpm test`,
  `pnpm build`, or a concrete browser scenario.
- Record deferred work explicitly instead of silently dropping it.
- If implementation diverges from the plan, update the plan before continuing.

Do not create an ExecPlan for trivial copy edits, one-line fixes, or narrow
documentation updates unless the user asks for one.

## Lessons Learned Workflow

Use `LESSONS.md` for durable project lessons that should survive across agent
sessions. Create it if a durable lesson exists and the file is missing.

Add a lesson when any of these happen:

- A build, deploy, sync, or GitHub Pages issue required non-obvious diagnosis.
- A recipe-data edge case affected sync, filtering, routing, or rendering.
- A user corrected a recurring assumption about scope, UX, workflow, or deploys.
- A workaround is likely to be needed again.

Do not add lessons for ordinary implementation details or temporary task notes.

Each lesson entry should include:

- date
- context
- symptom or risk
- cause, when known
- fix or rule for future work
- validation command or evidence

Keep lessons concise. If a lesson changes agent behavior, also update this
`AGENTS.md` file so future agents do not need to read the entire lessons log to
follow core rules.

## Git Workflow

- Inspect `git status --short --branch` before editing and before committing.
- Do not revert user changes or unrelated generated sync commits.
- Stage explicit files. Avoid broad `git add .`.
- Use concise commit subjects in imperative mood.
- For issue-closing feature commits, include `Closes #<issue>` in the commit
  body only when the commit fully resolves the issue.
- If push is rejected because `origin/main` moved, fetch, inspect the incoming
  commit, rebase when safe, rerun validation, then push.
- After push, verify `git status --short --branch` is clean and tracking is
  even.

## Done Criteria

A task is done when:

- the requested behavior or documentation exists in the working tree;
- relevant tests/builds/checks have passed, or skipped checks are explained;
- generated or temporary artifacts are not staged;
- local dev/preview servers started by the agent are stopped;
- user-facing URLs, commands, or follow-up deploy expectations are stated
  clearly in the final response.
