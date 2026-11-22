// The texts' groups, made by plugin.mjs.
declare module 'virtual:qds-texts' {
  export const LANGUAGES: string[];
  export const GROUPS: Record<string, () => Promise<[string, string][]>>;
}
