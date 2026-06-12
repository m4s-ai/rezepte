# Incremental Public Recipe Pages

## Summary
- Build `m4s-ai/rezepte` as a public Astro/GitHub Pages recipe browser at `https://m4s-ai.github.io/rezepte/`.
- Use the `rabanopenclaw` GitHub user/token for automation access and pushes.
- Publish only recipes from `rabanopenclaw/second-brain/Atlas/Recipes` with `public: true`.
- Work in small increments, with each step independently testable before adding the next layer.

## Incremental Steps
1. **Plan + Repo Bootstrap**
   - Create `PLAN.md` with this plan.
   - Add minimal Astro + pnpm project to `m4s-ai/rezepte`.
   - Configure Astro with `site: "https://m4s-ai.github.io"` and `base: "/rezepte"`.
   - Add a GitHub Pages deploy workflow for the empty starter site.

2. **Manual Recipe Import**
   - Add a sync script that reads a local `Atlas/Recipes` input folder.
   - Include only Markdown files with `public: true`.
   - Strip non-whitelisted frontmatter before writing generated recipe content into the Astro content directory.
   - Generate stable slugs and fail clearly on slug collisions.

3. **Basic Browse UI**
   - Add German UI labels.
   - Add homepage recipe list and individual recipe pages.
   - Use black background, green monospace text, terminal-style layout.
   - Keep the UI simple: no ASCII art generation in v1.

4. **Search + Tags**
   - Generate a static recipe search index.
   - Add client-side search across title, tags, category, and excerpt.
   - Add tag/category filtering.

5. **Source Repo Automation**
   - Add a workflow in `rabanopenclaw/second-brain` triggered by pushes to `main` affecting `Atlas/Recipes/**/*.md`.
   - Checkout `m4s-ai/rezepte`, run the sync script, commit changes, and push to `m4s-ai/rezepte`.
   - Store the `rabanopenclaw` fine-grained token as `REZEPTE_PUSH_TOKEN` in `second-brain`.

## Interfaces And Rules
- Recipe publish opt-in:
  - Required: `public: true`.
  - Optional: `title`, `description`, `tags`, `category`, `date`.
- Title fallback order:
  - `title` frontmatter.
  - First Markdown H1.
  - Filename.
- Private metadata:
  - Remove all frontmatter keys outside the whitelist.
- Obsidian links:
  - Convert `[[links]]` to plain text initially.
  - Later internal linking can be added only when the target is also public.
- URL shape:
  - Index: `/rezepte/`
  - Recipe detail: `/rezepte/r/<slug>/`

## Test Plan
- After each increment, run:
  - `pnpm install --frozen-lockfile`
  - `pnpm build`
- Add focused tests for the sync script:
  - includes `public: true`
  - excludes missing/false `public`
  - strips private frontmatter
  - removes deleted/de-published recipes
  - fails on duplicate slugs
- UI checks:
  - homepage lists recipes
  - detail pages render Markdown
  - search and tag filters work
  - desktop/mobile layouts remain readable

## Assumptions
- `rabanopenclaw` has access to `rabanopenclaw/second-brain` and permission to push to `m4s-ai/rezepte`.
- GitHub Pages source will be set to “GitHub Actions”.
- No custom domain in v1.
- Local/private image attachment publishing is out of scope for v1.
- Food-based ASCII art is a later enhancement, not part of the first deploy.
