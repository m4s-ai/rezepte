# Lessons Learned

## 2026-06-16: Source Sync Workflow Must Match Rezepte Node Engine

- Context: The `rabanopenclaw/second-brain` sync workflow pushes generated
  public recipes into `m4s-ai/rezepte` after running this repo's validation.
- Symptom or risk: The workflow synced 67 public recipes, then stopped in the
  `Verify` step before committing because `pnpm build` ran under Node 20.
- Cause: `docs/second-brain-rezepte-sync.workflow.yml` still used
  `node-version: 20` while `package.json` and Astro require Node `>=22.12.0`.
- Fix or rule: Keep the external source sync workflow on Node 22 or newer
  whenever this repo's engine/build requirement changes.
- Validation or evidence: GitHub Actions run `27557759625` failed with
  `Node.js v20.20.2 is not supported by Astro! Please upgrade Node.js to a
  supported version: ">=22.12.0"`.

## 2026-06-15: GitHub Pages Project Robots Are Not Host-Root Robots

- Context: The recipe site deploys as the GitHub Pages project URL
  `https://m4s-ai.github.io/rezepte/`.
- Symptom or risk: `public/robots.txt` is served as `/rezepte/robots.txt`, but
  compliant crawlers normally discover robots policy at the host root
  `/robots.txt`.
- Cause: GitHub Pages project sites are mounted below the repository name; a
  project repo cannot publish `https://m4s-ai.github.io/robots.txt`.
- Fix or rule: Keep page-level `noindex` in the shared layout, avoid publishing
  separate machine-readable recipe metadata unless needed, and create a
  host-root Pages repo or custom domain when authoritative robots blocking is
  required.
- Validation or evidence: `astro.config.mjs` sets `base: "/rezepte"`, and no
  `m4s-ai/m4s-ai.github.io` repository exists to host the root `robots.txt`.
