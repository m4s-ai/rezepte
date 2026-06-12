import type { APIRoute } from "astro";
import { getRecipes, recipePath } from "../lib/recipes";

export const GET: APIRoute = async () => {
  const recipes = await getRecipes();
  const payload = recipes.map((recipe) => ({
    slug: recipe.slug,
    title: recipe.title,
    description: recipe.description,
    excerpt: recipe.excerpt,
    tags: recipe.tags,
    category: recipe.category,
    date: recipe.date,
    url: recipePath(recipe.slug)
  }));

  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8"
    }
  });
};
