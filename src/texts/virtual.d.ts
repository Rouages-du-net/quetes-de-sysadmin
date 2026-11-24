// The texts' groups, made by plugin.mjs.
declare module 'virtual:qds-texts' {
  export const LANGUAGES: string[];
  /** For each draft language, the stories it translates already. */
  export const TRANSLATED: Record<string, string[]>;
  export const GROUPS: Record<string, () => Promise<[string, string][]>>;
}
