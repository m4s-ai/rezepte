#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import matter from "gray-matter";

const DEFAULT_INPUT_DIR = "Atlas/Recipes";
const DEFAULT_OUTPUT_DIR = "src/content/recipes";

function usage() {
  return [
    "Usage: pnpm sync:recipes -- --input <Atlas/Recipes> [--output src/content/recipes]",
    "",
    "Publishes only Markdown recipes with frontmatter public: true."
  ].join("\n");
}

export function parseArgs(argv) {
  const options = {
    input: DEFAULT_INPUT_DIR,
    output: DEFAULT_OUTPUT_DIR
  };
  let positionalInputUsed = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--") {
      continue;
    }

    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }

    if (arg === "--input" || arg === "-i") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("--input requires a path");
      }
      options.input = value;
      index += 1;
      continue;
    }

    if (arg.startsWith("--input=")) {
      options.input = arg.slice("--input=".length);
      continue;
    }

    if (arg === "--output" || arg === "-o") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("--output requires a path");
      }
      options.output = value;
      index += 1;
      continue;
    }

    if (arg.startsWith("--output=")) {
      options.output = arg.slice("--output=".length);
      continue;
    }

    if (!arg.startsWith("-") && !positionalInputUsed) {
      options.input = arg;
      positionalInputUsed = true;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function collectMarkdownFiles(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectMarkdownFiles(fullPath)));
      continue;
    }

    if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
      files.push(fullPath);
    }
  }

  return files.sort((left, right) => left.localeCompare(right));
}

export function plainObsidianLinks(markdown) {
  return markdown.replace(/\[\[([^\]]+)\]\]/g, (_match, rawTarget) => {
    const [targetWithHeading, alias] = String(rawTarget).split("|");
    const visibleText = alias?.trim() || targetWithHeading.split("#").pop() || targetWithHeading;
    return visibleText.split("/").pop()?.trim() || visibleText.trim();
  });
}

function stripInlineMarkdown(text) {
  return plainObsidianLinks(text)
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/[*_~>#]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function findFirstH1(markdown) {
  const match = markdown.match(/^#\s+(.+)$/m);
  return match ? stripInlineMarkdown(match[1]) : "";
}

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeTags(value) {
  if (Array.isArray(value)) {
    return value.map((tag) => cleanString(tag)).filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
  }

  return [];
}

function normalizeDate(value) {
  if (value instanceof Date && !Number.isNaN(value.valueOf())) {
    return value.toISOString().slice(0, 10);
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.valueOf()) ? undefined : parsed.toISOString().slice(0, 10);
  }

  return undefined;
}

function slugify(value) {
  const normalized = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "recipe";
}

function slugForRelativePath(relativePath) {
  const withoutExtension = relativePath.replace(/\.md$/i, "");
  return slugify(withoutExtension.split(path.sep).join("-"));
}

function titleForRecipe(data, body, relativePath) {
  const frontmatterTitle = cleanString(data.title);
  if (frontmatterTitle) {
    return frontmatterTitle;
  }

  const h1Title = findFirstH1(body);
  if (h1Title) {
    return h1Title;
  }

  return path.basename(relativePath, path.extname(relativePath));
}

function frontmatterForRecipe(data, body, relativePath) {
  const output = {
    title: titleForRecipe(data, body, relativePath)
  };

  const description = cleanString(data.description);
  if (description) {
    output.description = description;
  }

  const tags = normalizeTags(data.tags);
  if (tags.length > 0) {
    output.tags = tags;
  }

  const category = cleanString(data.category);
  if (category) {
    output.category = category;
  }

  const date = normalizeDate(data.date);
  if (date) {
    output.date = date;
  }

  return output;
}

async function resetOutputDirectory(outputDir) {
  await fs.rm(outputDir, { recursive: true, force: true });
  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(path.join(outputDir, ".gitkeep"), "");
}

export async function syncRecipes({ input = DEFAULT_INPUT_DIR, output = DEFAULT_OUTPUT_DIR } = {}) {
  const inputDir = path.resolve(input);
  const outputDir = path.resolve(output);

  if (!(await pathExists(inputDir))) {
    throw new Error(`Input recipe directory not found: ${inputDir}`);
  }

  const sourceFiles = await collectMarkdownFiles(inputDir);
  const recipes = [];
  const slugs = new Map();

  for (const sourcePath of sourceFiles) {
    const relativePath = path.relative(inputDir, sourcePath);
    const raw = await fs.readFile(sourcePath, "utf8");
    const parsed = matter(raw);

    if (parsed.data.public !== true) {
      continue;
    }

    const slug = slugForRelativePath(relativePath);
    const previous = slugs.get(slug);
    if (previous) {
      throw new Error(
        `Slug collision for "${slug}": ${previous} and ${relativePath}. Rename one source file.`
      );
    }
    slugs.set(slug, relativePath);

    const content = plainObsidianLinks(parsed.content).trimStart();
    const frontmatter = frontmatterForRecipe(parsed.data, content, relativePath);
    const outputMarkdown = matter.stringify(content, frontmatter);

    recipes.push({
      slug,
      title: frontmatter.title,
      sourcePath,
      relativePath,
      outputPath: path.join(outputDir, `${slug}.md`),
      markdown: outputMarkdown
    });
  }

  await resetOutputDirectory(outputDir);

  for (const recipe of recipes) {
    await fs.writeFile(recipe.outputPath, recipe.markdown);
  }

  return {
    inputDir,
    outputDir,
    scanned: sourceFiles.length,
    published: recipes.length,
    skipped: sourceFiles.length - recipes.length,
    recipes: recipes.map(({ slug, title, relativePath, outputPath }) => ({
      slug,
      title,
      sourcePath: relativePath,
      outputPath
    }))
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) {
      console.log(usage());
      process.exit(0);
    }

    const result = await syncRecipes(options);
    console.log(
      `Synced ${result.published} public recipe(s) from ${result.scanned} Markdown file(s).`
    );
    for (const recipe of result.recipes) {
      console.log(`- ${recipe.slug}: ${recipe.title}`);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    console.error("");
    console.error(usage());
    process.exit(1);
  }
}
