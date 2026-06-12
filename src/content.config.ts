import { defineCollection, z } from "astro:content";

const recipes = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    tags: z.array(z.string()).optional(),
    category: z.string().optional(),
    date: z.coerce.date().optional()
  })
});

export const collections = { recipes };
