// Constants written into the code at build time (see src/version.mjs).
declare const __QDS_VERSION__: string;
// true in the embeddable build (vite.integration.config.ts), false on the
// site's pages and in the tests: which statistics counter the element uses
// (src/stats.ts).
declare const __QDS_EMBED__: boolean;

// The statistics server, read by Vite at build time (src/stats.ts,
// .env.example); missing: no statistics.
interface ImportMetaEnv {
  readonly PUBLIC_UMAMI_HOST?: string;
  readonly PUBLIC_UMAMI_SITE_ID?: string;
  readonly PUBLIC_UMAMI_EMBED_ID?: string;
}
