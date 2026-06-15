# Lessons Learned

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
