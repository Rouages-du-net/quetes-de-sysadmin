// Parts of the game load when they are first needed (a story's chapters and
// texts, the manual's pages: see story-registry.ts and src/texts/index.ts).
// The interface loads them before running what needs them; if something was
// still missing, the engine throws NeedsLoading before going on, and the
// interface loads it and runs the line again.

export class NeedsLoading extends Error {
  constructor(
    what: string,
    /** Loads what was missing. */
    readonly load: () => Promise<unknown>,
  ) {
    super(`Not loaded yet: ${what}`);
    this.name = 'NeedsLoading';
  }
}
