// The <quetes-de-sysadmin> element, to put in any page:
//
//   <script type="module" src="https://sysadmin.rouages.net/integration/quetes-de-sysadmin.js"></script>
//   <quetes-de-sysadmin></quetes-de-sysadmin>
//
// Optional attributes: story="datacenter" (the story opened at start),
// save-key="…" (the localStorage key of the save), theme="light" | "dark",
// lang="fr" (without it: the page's language, otherwise English). The older
// French names still work: histoire, cle, theme="clair" | "sombre", langue.
// The game lives in a shadow root (Shadow DOM): its styles do not spill
// onto the page, and the page's styles do not break it. Colours are set
// from outside with the --qds-* variables (see styles.css).

import { mount } from './interface/game';

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

export class SysadminQuests extends HTMLElement {
  connectedCallback() {
    if (this.shadowRoot) return;
    const root = this.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = `:host { display: block; }\n${styles}`;
    root.append(style);
    // The English attribute first, then its older French name.
    const attribute = (name: string, old: string) => this.getAttribute(name) ?? this.getAttribute(old) ?? undefined;
    const story = attribute('story', 'histoire');
    mount(root, {
      story: story && Object.hasOwn(OLD_STORY_IDS, story) ? OLD_STORY_IDS[story] : story,
      saveKey: attribute('save-key', 'usb'),
      // lang on the element, then langue, then the page's language (lang), otherwise English.
      language: this.getAttribute('lang') ?? this.getAttribute('langue') ?? this.closest('[lang]')?.getAttribute('lang') ?? undefined,
    });
  }
}

if (!customElements.get('quetes-de-sysadmin')) customElements.define('quetes-de-sysadmin', SysadminQuests);
