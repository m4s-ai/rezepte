import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://m4s-ai.github.io",
  base: "/rezepte",
  output: "static",
  trailingSlash: "always"
});
