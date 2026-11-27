// The <quetes-de-sysadmin> element, to put in any page:
//
//   <script type="module" src="https://sysadmin.rouages.net/integration/quetes-de-sysadmin.js"></script>
//   <quetes-de-sysadmin></quetes-de-sysadmin>
//
// Optional attributes: story="datacenter" (the story opened at start),
// save-key="…" (the localStorage key of the save), theme="light" | "dark",
// lang="fr" (without it: the page's language, otherwise English),
// exam-control="page" (the page shows its own exam-mode checkbox, wired to
// the element's `exam` property and its `exam-change` event). The method
// openFeedback() opens "Report a problem or an idea" (the site's footer uses it). The older
// French names still work: histoire, cle, theme="clair" | "sombre", langue.
// stats="off": no visit statistics from this page (src/stats.ts; they are
// off anyway when the game was built without a statistics server).
// The game lives in a shadow root (Shadow DOM): its styles do not spill
// onto the page, and the page's styles do not break it. Colours are set
// from outside with the --qds-* variables (see styles.css).

import type { mount } from './interface/game';
import { elementCounter, send } from './stats';

// The stories' French ids, from before they were English: a page that
// still uses them opens the same story.
const OLD_STORY_IDS: Record<string, string> = {
  effaceur: 'eraser',
  paquet: 'packet',
  temps: 'time-machine',
  lettres: 'letters',
  fabrique: 'fablab',
  ludotheque: 'game-library',
  astreinte: 'on-call',
  maison: 'community-centre',
  cooperative: 'coop',
  ruche: 'hive',
  labo: 'lab',
  veille: 'watch',
  mail: 'junk-mail',
  flotte: 'fleet',
  rustine: 'patch',
};
import styles from './interface/styles.css?inline';

// The element itself is small: it shows an empty game frame at once, then
// fetches, side by side, the game (interface and engine), its texts in the
// page's language and the story it will open, each a separate file
// (chunk) next to this one: their addresses are resolved from this module's
// own URL, so they load from the game's site even when another site embeds
// it (docs/EMBEDDING.md). See docs/DEPLOYMENT.md, "Chunks".
export class SysadminQuests extends HTMLElement {
  private game?: ReturnType<typeof mount>;
  // Exam mode asked for before the game had loaded.
  private wantedExam?: boolean;
  /** Exam mode: no hints, a timer. Setting it restarts the current chapter (after confirmation if it is in progress). */
  get exam(): boolean {
    return this.game?.exam() ?? this.wantedExam ?? false;
  }
  set exam(yes: boolean) {
    if (this.game) this.game.askExam(!!yes);
    else this.wantedExam = !!yes;
  }
  // "Report a problem or an idea" asked for before the game had loaded.
  private wantedFeedback = false;
  /** Opens "Report a problem or an idea" (once the game has loaded). Nothing is sent: the player sends the report. */
  openFeedback() {
    if (this.game) this.game.openFeedback();
    else this.wantedFeedback = true;
  }
  connectedCallback() {
    if (this.shadowRoot) return;
    const root = this.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = `:host { display: block; }\n${styles}`;
    root.append(style);
    // The game's frame while it loads: the same size, so the page doesn't jump.
    const frame = document.createElement('div');
    frame.className = 'qds qds-loading';
    frame.setAttribute('aria-hidden', 'true');
    frame.append(document.createElement('div'));
    root.append(frame);
    this.setAttribute('aria-busy', 'true');
    // The English attribute first, then its older French name.
    const attribute = (name: string, old: string) => this.getAttribute(name) ?? this.getAttribute(old) ?? undefined;
    const asked = attribute('story', 'histoire');
    const story = asked && Object.hasOwn(OLD_STORY_IDS, asked) ? OLD_STORY_IDS[asked] : asked;
    const saveKey = attribute('save-key', 'usb');
    // lang on the element, then langue, then the page's language (lang), otherwise English.
    const language = this.getAttribute('lang') ?? this.getAttribute('langue') ?? this.closest('[lang]')?.getAttribute('lang') ?? undefined;
    // The story the game will open (the attribute's, otherwise where the player stopped): fetched with the rest.
    let departure = story;
    try {
      departure ??= JSON.parse(localStorage.getItem(saveKey ?? 'quetes-de-sysadmin') ?? '{}')?.story ?? undefined;
    } catch {}
    const texts = import('./texts').then((m) => m.loadTexts(language, 'core'));
    if (typeof departure === 'string') import('./engine/story-registry').then((r) => r.loadStory(departure, language)).catch(() => {});
    Promise.all([import('./interface/game'), texts]).then(([{ mount }]) => {
      frame.remove();
      this.removeAttribute('aria-busy');
      // Statistics (src/stats.ts): on the site's pages, the site's counter
      // (its pages count their own views, src/pwa/visit.ts); embedded in
      // another site, the embeds' counter, with one view for the game's
      // load, unless the page says stats="off". Never in exam mode.
      const counter = elementCounter(__QDS_EMBED__, this.getAttribute('stats'));
      const track = counter ? (name: string, data: Record<string, string>) => void (this.exam || send(counter, name, data)) : undefined;
      this.game = mount(root, {
        story,
        saveKey,
        language,
        track,
        examOutside: this.getAttribute('exam-control') === 'page',
        onExam: (exam) => this.dispatchEvent(new CustomEvent('exam-change', { detail: { exam }, bubbles: true })),
      });
      // The page's own checkbox follows the saved mode.
      if (this.game.exam()) this.dispatchEvent(new CustomEvent('exam-change', { detail: { exam: true }, bubbles: true }));
      if (this.wantedExam !== undefined) this.game.askExam(this.wantedExam);
      if (this.wantedFeedback) this.game.openFeedback();
      if (__QDS_EMBED__ && counter && !this.exam) send(counter, undefined, { language: this.game.language });
    });
  }
}

if (!customElements.get('quetes-de-sysadmin')) customElements.define('quetes-de-sysadmin', SysadminQuests);
