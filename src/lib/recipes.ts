import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import MarkdownIt from "markdown-it";

const recipesDirectory = path.join(process.cwd(), "src", "content", "recipes");
const markdown = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true
});

export interface Recipe {
  slug: string;
  title: string;
  description: string;
  excerpt: string;
  tags: string[];
  category: string;
  date: string;
  body: string;
}

async function collectMarkdownFiles(directory: string): Promise<string[]> {
  let entries;
  try {
    entries = await fs.readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return [];
    }
    throw error;
  }

  const files: string[] = [];
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

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeTags(value: unknown): string[] {
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

function normalizeDate(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(value.valueOf())) {
    return value.toISOString().slice(0, 10);
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.valueOf()) ? "" : parsed.toISOString().slice(0, 10);
  }

  return "";
}

function plainTextFromMarkdown(value: string): string {
  return value
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[*_~>#-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function excerptFrom(description: string, body: string): string {
  const text = description || plainTextFromMarkdown(body);
  if (text.length <= 180) {
    return text;
  }

  const shortened = text.slice(0, 177);
  const lastSpace = shortened.lastIndexOf(" ");
  return `${shortened.slice(0, lastSpace > 100 ? lastSpace : 177).trim()}...`;
}

function slugFromFile(filePath: string): string {
  return path.basename(filePath, path.extname(filePath));
}

function titleFromBody(body: string): string {
  const match = body.match(/^#\s+(.+)$/m);
  return match ? plainTextFromMarkdown(match[1]) : "";
}

function withoutLeadingDuplicateTitle(body: string, title: string): string {
  const match = body.match(/^#\s+(.+)(?:\r?\n|$)/);
  if (!match) {
    return body;
  }

  const headingTitle = plainTextFromMarkdown(match[1]);
  if (headingTitle.localeCompare(title, "de", { sensitivity: "base" }) !== 0) {
    return body;
  }

  return body.slice(match[0].length).trimStart();
}

export function sitePath(pathname: string): string {
  const base = import.meta.env.BASE_URL || "/";
  const normalizedBase = base.endsWith("/") ? base.slice(0, -1) : base;
  const normalizedPath = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${normalizedBase}${normalizedPath}` || normalizedPath;
}

export function recipePath(slug: string): string {
  return sitePath(`/r/${slug}/`);
}

export function homePath(): string {
  return sitePath("/");
}

export function filteredHomePath(filters: { category?: string; tag?: string }): string {
  const params = new URLSearchParams();

  if (filters.category) {
    params.set("category", filters.category);
  }

  if (filters.tag) {
    params.set("tag", filters.tag);
  }

  const query = params.toString();
  const path = homePath();
  return query ? `${path}?${query}` : path;
}

export function formatDate(date: string): string {
  if (!date) {
    return "";
  }

  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(new Date(date));
}

export async function getRecipes(): Promise<Recipe[]> {
  const files = await collectMarkdownFiles(recipesDirectory);
  const recipes = await Promise.all(
    files.map(async (filePath) => {
      const raw = await fs.readFile(filePath, "utf8");
      const parsed = matter(raw);
      const rawBody = parsed.content.trim();
      const title =
        cleanString(parsed.data.title) || titleFromBody(rawBody) || slugFromFile(filePath);
      const description = cleanString(parsed.data.description);
      const body = withoutLeadingDuplicateTitle(rawBody, title);

      return {
        slug: slugFromFile(filePath),
        title,
        description,
        excerpt: excerptFrom(description, body),
        tags: normalizeTags(parsed.data.tags),
        category: cleanString(parsed.data.category),
        date: normalizeDate(parsed.data.date),
        body
      };
    })
  );

  return recipes.sort((left, right) => {
    if (left.date && right.date && left.date !== right.date) {
      return right.date.localeCompare(left.date);
    }

    if (left.date && !right.date) {
      return -1;
    }

    if (!left.date && right.date) {
      return 1;
    }

    return left.title.localeCompare(right.title, "de");
  });
}

export async function getRecipeBySlug(slug: string): Promise<Recipe | undefined> {
  const recipes = await getRecipes();
  return recipes.find((recipe) => recipe.slug === slug);
}

export function renderRecipeHtml(body: string): string {
  return markdown.render(body);
}
