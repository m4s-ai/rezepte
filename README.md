# Rezepte

Public Astro recipe browser for `https://m4s-ai.github.io/rezepte/`.

Only Markdown recipes from `rabanopenclaw/second-brain/Atlas/Recipes` with `public: true` are published. The sync script strips all non-public frontmatter before writing generated files into `src/content/recipes`.

## Local Commands

```sh
pnpm install
pnpm sync:recipes -- --input ../second-brain/Atlas/Recipes
pnpm test
pnpm build
pnpm dev
```

## Recipe Frontmatter

Required:

```yaml
public: true
```

Optional public keys:

```yaml
title: Kartoffelsalat
description: Klassisch, sauer, frisch.
tags:
  - Beilage
category: Salat
date: 2026-06-12
```

Title fallback order is `title`, first Markdown `# H1`, then filename. Obsidian links such as `[[Vorrat/Tomatensauce|Tomatensauce]]` are converted to plain text.

## Source Repo Automation

Install the workflow template at `docs/second-brain-rezepte-sync.workflow.yml` into:

```text
rabanopenclaw/second-brain/.github/workflows/sync-rezepte.yml
```

Add a write-enabled deploy key to `m4s-ai/rezepte`, then store the matching private key in `rabanopenclaw/second-brain` as the Actions secret `REZEPTE_DEPLOY_KEY`.
