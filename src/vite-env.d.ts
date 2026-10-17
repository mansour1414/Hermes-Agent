/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_HERMES_MODE?: "mock" | "hermes";
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
