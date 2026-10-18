// L'éditeur nano dans le terminal : barre de titre, zone de texte, ligne
// d'état et raccourcis. ^O écrit, ^X quitte (en proposant d'enregistrer si le
// texte a changé : O, N ou ^C). Les raccourcis sont aussi des boutons, pour
// les claviers sans touche Ctrl (mobiles).

import type { Traduire } from '../textes';

export interface OptionsEditeur {
  t: Traduire;
  chemin: string;
  texte: string;
  message: string;
  /** Écrit le texte ; renvoie le message de nano, et si c'est écrit. */
  enregistrer: (texte: string) => { message: string; ecrit: boolean };
  /** L'éditeur est fermé. */
  fermer: () => void;
}

function el<K extends keyof HTMLElementTagNameMap>(nom: K, attrs: Record<string, string> = {}, ...enfants: (Node | string)[]) {
  const e = document.createElement(nom);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  e.append(...enfants);
  return e;
}

const raccourci = (touche: string, libelle: string) =>
  el('button', { type: 'button', class: 'nano-touche' }, el('kbd', {}, touche), ` ${libelle}`);

export function editeur(o: OptionsEditeur): HTMLElement {
  const { t } = o;
  const modifie = el('span', { class: 'nano-modifie' });
  const zone = el('textarea', {
    class: 'nano-texte',
    spellcheck: 'false',
    autocapitalize: 'off',
    autocomplete: 'off',
    'aria-label': t('nano-zone', { chemin: o.chemin }),
  }) as HTMLTextAreaElement;
  zone.value = o.texte;
  const etat = el('div', { class: 'nano-etat', role: 'status', 'aria-live': 'polite' }, o.message);

  const ecrire = raccourci('^O', t('nano-ecrire'));
  const quitter = raccourci('^X', t('nano-quitter'));
  const aide = el('div', { class: 'nano-aide' }, ecrire, quitter);
  const oui = raccourci('O', t('nano-oui'));
  const non = raccourci('N', t('nano-non'));
  const annuler = raccourci('^C', t('nano-annuler'));
  const question = el('div', { class: 'nano-aide', hidden: '' }, oui, non, annuler);

  const racine = el(
    'div',
    { class: 'nano', role: 'group', 'aria-label': `nano ${o.chemin}` },
    el('div', { class: 'nano-titre' }, el('span', {}, 'GNU nano 7.2'), el('span', { class: 'nano-chemin' }, o.chemin), modifie),
    zone,
    etat,
    aide,
    question,
  );

  let enregistre = o.texte;
  const majModifie = () => (modifie.textContent = zone.value !== enregistre ? t('nano-modifie') : '');
  const fermer = () => {
    racine.remove();
    o.fermer();
  };
  const sauver = () => {
    const { message, ecrit } = o.enregistrer(zone.value);
    if (ecrit) enregistre = zone.value;
    etat.textContent = message;
    majModifie();
  };
  const demander = (oui: boolean) => {
    aide.hidden = oui;
    question.hidden = !oui;
    etat.textContent = oui ? t('nano-sauver') : '';
    (oui ? question.querySelector('button')! : zone).focus();
  };
  const sortir = () => (zone.value === enregistre ? fermer() : demander(true));

  zone.addEventListener('input', majModifie);
  ecrire.addEventListener('click', () => (sauver(), zone.focus()));
  quitter.addEventListener('click', sortir);
  oui.addEventListener('click', () => {
    sauver();
    if (zone.value === enregistre) fermer();
    else demander(false);
  });
  non.addEventListener('click', fermer);
  annuler.addEventListener('click', () => demander(false));
  racine.addEventListener('keydown', (e) => {
    const touche = e.key.toLowerCase();
    if (!question.hidden) {
      if (touche === 'o' || touche === 'y') oui.click();
      else if (touche === 'n') non.click();
      else if ((e.ctrlKey && touche === 'c') || e.key === 'Escape') annuler.click();
      else return;
      e.preventDefault();
      return;
    }
    if (!e.ctrlKey) return;
    if (touche === 'o' || touche === 's') sauver();
    else if (touche === 'x') sortir();
    else return;
    e.preventDefault();
  });
  queueMicrotask(() => zone.focus());
  return racine;
}
