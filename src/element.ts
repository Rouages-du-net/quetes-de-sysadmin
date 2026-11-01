// L'élément <quetes-de-sysadmin>, à poser dans n'importe quelle page :
//
//   <script type="module" src="https://sysadmin.rouages.net/integration/quetes-de-sysadmin.js"></script>
//   <quetes-de-sysadmin></quetes-de-sysadmin>
//
// Optional attributes: story="datacenter" (the story opened at start),
// save-key="…" (the localStorage key of the save), theme="light" | "dark",
// lang="fr" (without it: the page's language, otherwise English). The older
// French names still work: histoire, cle, theme="clair" | "sombre", langue.
// Le jeu vit dans une racine fantôme (Shadow DOM) : ses styles ne débordent
// pas sur la page, et ceux de la page ne le cassent pas. Les couleurs se
// règlent de l'extérieur avec les variables --qds-* (voir styles.css).

import { mount } from './interface/game';
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
    mount(root, {
      story: attribute('story', 'histoire'),
      saveKey: attribute('save-key', 'cle'),
      // lang on the element, then langue, then the page's language (lang), otherwise English.
      language: this.getAttribute('lang') ?? this.getAttribute('langue') ?? this.closest('[lang]')?.getAttribute('lang') ?? undefined,
    });
  }
}

if (!customElements.get('quetes-de-sysadmin')) customElements.define('quetes-de-sysadmin', SysadminQuests);
