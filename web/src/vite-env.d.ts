/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the API. Empty in development, where the Vite proxy handles it. */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
