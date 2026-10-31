// La page « Tableau de classe » : l'enseignant·e y glisse les fichiers de
// sauvegarde de ses élèves (ou colle leurs codes) ; tout est lu dans son
// navigateur, rien n'est envoyé. La logique est dans src/engine/classroom.ts.

import { HISTOIRES } from '../engine/chapters';
import { avancee, eleveDeFichier, elevesDeCodes, enCSV, gradeDe, meilleurTemps, totalChapitres, type Eleve, type ErreurClasse } from '../engine/classroom';
import { traducteur, type Langue } from '../texts';

function el<K extends keyof HTMLElementTagNameMap>(nom: K, attrs: Record<string, string> = {}, ...enfants: (Node | string)[]) {
  const e = document.createElement(nom);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  e.append(...enfants);
  return e;
}

export function monterClasse(racine: HTMLElement, langue: Langue) {
  const t = traducteur(langue);
  const eleves: Eleve[] = [];
  const erreurs: ErreurClasse[] = [];

  const champFichiers = el('input', { type: 'file', id: 'classe-fichiers', accept: '.json,application/json', multiple: '' }) as HTMLInputElement;
  const zone = el('div', { class: 'classe-zone' }, el('p', {}, el('label', { for: champFichiers.id }, t('classe-fichiers')), ' ', champFichiers), el('p', { class: 'discret' }, t('classe-glisser')));
  const champCodes = el('textarea', { id: 'classe-codes', rows: '4', spellcheck: 'false', placeholder: t('classe-codes-exemple') }) as HTMLTextAreaElement;
  const ajouterCodes = el('button', { type: 'button' }, t('classe-codes-ajouter'));
  const codes = el('p', {}, el('label', { for: champCodes.id }, t('classe-codes')), el('br'), champCodes, el('br'), ajouterCodes);
  const etat = el('p', { class: 'classe-etat', role: 'status' });
  const exporter = el('button', { type: 'button' }, t('classe-exporter'));
  const vider = el('button', { type: 'button' }, t('classe-vider'));
  const actions = el('p', { class: 'classe-actions' }, exporter, ' ', vider);
  const tableau = el('div', { class: 'classe-tableau', tabindex: '0', role: 'region', 'aria-label': t('classe-tableau') });
  racine.replaceChildren(zone, codes, etat, actions, tableau);

  const minutes = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;
  const date = (iso: string | null) => (iso ? new Intl.DateTimeFormat(t.langue, { dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso)) : '');
  const ENTETES = () => [
    t('classe-col-eleve'),
    t('classe-col-chapitres'),
    t('classe-col-grade'),
    t('classe-col-succes'),
    t('classe-col-examen'),
    t('classe-col-date'),
    ...HISTOIRES.map((h) => t(`histoire-${h.id}`)),
  ];
  const ligne = (e: Eleve) => [
    e.nom,
    `${e.termines.length}/${totalChapitres()}`,
    t(`grade-${gradeDe(e)}`),
    e.succes,
    meilleurTemps(e) === null ? '' : minutes(meilleurTemps(e)!),
    date(e.date),
    ...HISTOIRES.map((h) => {
      const a = avancee(e, h.id);
      return `${a.faits}/${a.total}`;
    }),
  ];

  const afficher = () => {
    eleves.sort((a, b) => a.nom.localeCompare(b.nom, t.langue));
    actions.hidden = eleves.length === 0;
    etat.replaceChildren(
      t('classe-compte', { nombre: eleves.length }),
      ...erreurs.map((x) => el('span', { class: 'classe-erreur' }, ' ', t('classe-erreur', { source: x.source, raison: t(`progression-${x.erreur}`) }))),
    );
    if (!eleves.length) return tableau.replaceChildren();
    tableau.replaceChildren(
      el(
        'table',
        {},
        el('caption', {}, t('classe-tableau')),
        el('thead', {}, el('tr', {}, ...ENTETES().map((x) => el('th', { scope: 'col' }, x)))),
        el(
          'tbody',
          {},
          ...eleves.map((e) =>
            el(
              'tr',
              {},
              ...ligne(e).map((x, i) => {
                const histoire = i - 6;
                const fini = histoire >= 0 && avancee(e, HISTOIRES[histoire].id).faits === HISTOIRES[histoire].chapitres.length;
                return i === 0 ? el('th', { scope: 'row' }, String(x)) : el('td', fini ? { class: 'fini' } : {}, String(x));
              }),
            ),
          ),
        ),
      ),
    );
  };

  const ajouter = (lus: (Eleve | ErreurClasse)[]) => {
    for (const x of lus) {
      if ('erreur' in x) erreurs.push(x);
      else {
        // Le même élève (même nom) remplace sa ligne : la sauvegarde la plus récente l'emporte.
        const i = eleves.findIndex((e) => e.nom === x.nom);
        if (i >= 0) eleves[i] = x;
        else eleves.push(x);
      }
    }
    afficher();
  };
  const lireFichiers = async (fichiers: FileList | File[]) => {
    erreurs.length = 0;
    ajouter(await Promise.all([...fichiers].map(async (f) => eleveDeFichier(f.name, await f.text()))));
  };
  champFichiers.addEventListener('change', () => {
    if (champFichiers.files) lireFichiers(champFichiers.files).then(() => (champFichiers.value = ''));
  });
  zone.addEventListener('dragover', (e) => {
    e.preventDefault();
    zone.classList.add('survol');
  });
  zone.addEventListener('dragleave', () => zone.classList.remove('survol'));
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('survol');
    if (e.dataTransfer?.files) lireFichiers(e.dataTransfer.files);
  });
  ajouterCodes.addEventListener('click', () => {
    erreurs.length = 0;
    ajouter(elevesDeCodes(champCodes.value));
    champCodes.value = '';
  });
  exporter.addEventListener('click', () => {
    const lien = el('a', {
      href: URL.createObjectURL(new Blob([`﻿${enCSV(eleves, ENTETES(), ligne)}`], { type: 'text/csv' })),
      download: t('classe-nom-fichier'),
    });
    lien.click();
    setTimeout(() => URL.revokeObjectURL(lien.href), 1000);
  });
  vider.addEventListener('click', () => {
    eleves.length = 0;
    erreurs.length = 0;
    afficher();
  });
  afficher();
}
