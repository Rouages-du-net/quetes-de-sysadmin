// L'élément <quetes-de-sysadmin>, à poser dans n'importe quelle page :
//
//   <script type="module" src="https://sysadmin.rouages.net/integration/quetes-de-sysadmin.js"></script>
//   <quetes-de-sysadmin></quetes-de-sysadmin>
//
// Attributs facultatifs : histoire="datacenter" (histoire ouverte au départ),
// cle="…" (clé de sauvegarde), theme="clair" | "sombre", langue="fr".
// Le jeu vit dans une racine fantôme (Shadow DOM) : ses styles ne débordent
// pas sur la page, et ceux de la page ne le cassent pas. Les couleurs se
// règlent de l'extérieur avec les variables --qds-* (voir styles.css).

import { monter } from './interface/jeu';
import styles from './interface/styles.css?inline';
import type { Langue } from './textes';

export class QuetesDeSysadmin extends HTMLElement {
  connectedCallback() {
    if (this.shadowRoot) return;
    const racine = this.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = `:host { display: block; }\n${styles}`;
    racine.append(style);
    monter(racine, {
      histoire: this.getAttribute('histoire') ?? undefined,
      cle: this.getAttribute('cle') ?? undefined,
      langue: (this.getAttribute('langue') as Langue | null) ?? undefined,
    });
  }
}

if (!customElements.get('quetes-de-sysadmin')) customElements.define('quetes-de-sysadmin', QuetesDeSysadmin);
