import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import matter from "gray-matter";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parseArgs, syncRecipes } from "../scripts/sync-recipes.mjs";

let tmpDir;
let inputDir;
let outputDir;

async function writeRecipe(relativePath, content) {
  const targetPath = path.join(inputDir, relativePath);
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, content);
}

async function readGenerated(slug) {
  const raw = await fs.readFile(path.join(outputDir, `${slug}.md`), "utf8");
  return matter(raw);
}

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "rezepte-sync-"));
  inputDir = path.join(tmpDir, "Atlas", "Recipes");
  outputDir = path.join(tmpDir, "src", "content", "recipes");
  await fs.mkdir(inputDir, { recursive: true });
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe("syncRecipes", () => {
  it("parses the pnpm argument separator", () => {
    expect(parseArgs(["--", "--input", "Atlas/Recipes", "--output", "out"])).toEqual({
      input: "Atlas/Recipes",
      output: "out"
    });
  });

  it("includes only recipes with public: true", async () => {
    await writeRecipe(
      "Kartoffelsalat.md",
      `---
public: true
title: Kartoffelsalat
tags:
  - Beilage
---

Kartoffeln kochen.
`
    );
    await writeRecipe(
      "Private Sauce.md",
      `---
public: false
title: Private Sauce
---

Nicht veröffentlichen.
`
    );
    await writeRecipe("Ohne Public.md", "# Ohne Public\n\nNicht veröffentlichen.");

    const result = await syncRecipes({ input: inputDir, output: outputDir });
    const files = await fs.readdir(outputDir);

    expect(result.published).toBe(1);
    expect(result.skipped).toBe(2);
    expect(files).toContain("kartoffelsalat.md");
    expect(files).not.toContain("private-sauce.md");
    expect(files).not.toContain("ohne-public.md");
  });

  it("strips private frontmatter and converts Obsidian links to plain text", async () => {
    await writeRecipe(
      "Pasta.md",
      `---
public: true
title: Pasta
description: Schnell gekocht
tags: [Abendessen, Schnell]
category: Hauptgericht
date: 2026-06-01
rating: 5
private_note: geheim
---

Mit [[Vorrat/Tomatensauce|Tomatensauce]] und [[Basilikum]] servieren.
`
    );

    await syncRecipes({ input: inputDir, output: outputDir });
    const generated = await readGenerated("pasta");

    expect(generated.data).toEqual({
      title: "Pasta",
      description: "Schnell gekocht",
      tags: ["Abendessen", "Schnell"],
      category: "Hauptgericht",
      date: "2026-06-01"
    });
    expect(generated.data).not.toHaveProperty("public");
    expect(generated.data).not.toHaveProperty("rating");
    expect(generated.data).not.toHaveProperty("private_note");
    expect(generated.content).toContain("Tomatensauce");
    expect(generated.content).toContain("Basilikum");
    expect(generated.content).not.toContain("[[");
  });

  it("uses H1 and filename fallbacks for missing titles", async () => {
    await writeRecipe(
      "Suppen/Erbsensuppe.md",
      `---
public: true
---

# Grüne Erbsensuppe

Mit Minze.
`
    );
    await writeRecipe(
      "Dessert Ohne Titel.md",
      `---
public: true
---

Ohne Überschrift.
`
    );

    await syncRecipes({ input: inputDir, output: outputDir });

    expect((await readGenerated("suppen-erbsensuppe")).data.title).toBe("Grüne Erbsensuppe");
    expect((await readGenerated("dessert-ohne-titel")).data.title).toBe("Dessert Ohne Titel");
  });

  it("removes generated files when recipes are deleted or de-published", async () => {
    await writeRecipe(
      "Gulasch.md",
      `---
public: true
title: Gulasch
---

Schmoren.
`
    );
    await syncRecipes({ input: inputDir, output: outputDir });
    expect(await fs.readdir(outputDir)).toContain("gulasch.md");

    await writeRecipe(
      "Gulasch.md",
      `---
public: false
title: Gulasch
---

Schmoren.
`
    );
    await syncRecipes({ input: inputDir, output: outputDir });
    expect(await fs.readdir(outputDir)).not.toContain("gulasch.md");
  });

  it("fails clearly on duplicate slugs", async () => {
    await writeRecipe(
      "Foo Bar.md",
      `---
public: true
title: Foo Bar
---

One.
`
    );
    await writeRecipe(
      "Foo/Bar.md",
      `---
public: true
title: Nested Foo Bar
---

Two.
`
    );

    await expect(syncRecipes({ input: inputDir, output: outputDir })).rejects.toThrow(
      'Slug collision for "foo-bar"'
    );
  });
});
