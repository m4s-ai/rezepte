/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly PUBLIC_REZEPTE_ACCESS_HASH?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
