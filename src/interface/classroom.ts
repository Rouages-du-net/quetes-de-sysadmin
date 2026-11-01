// La page « Tableau de classe » : l'enseignant·e y glisse les fichiers de
// sauvegarde de ses élèves (ou colle leurs codes) ; tout est lu dans son
// navigateur, rien n'est envoyé. La logique est dans src/engine/classroom.ts.

import { STORIES } from '../engine/chapters';
import { progress, fileStudent, codesStudents, inCsv, gradeFor, bestTime, chaptersTotal, type Student, type ClassError } from '../engine/classroom';
import { translator, type Language } from '../texts';

function el<K extends keyof HTMLElementTagNameMap>(name: K, attrs: Record<string, string> = {}, ...children: (Node | string)[]) {
  const e = document.createElement(name);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  e.append(...children);
  return e;
}

export function mountClass(root: HTMLElement, language: Language) {
  const t = translator(language);
  const students: Student[] = [];
  const errors: ClassError[] = [];

  const filesField = el('input', { type: 'file', id: 'classe-fichiers', accept: '.json,application/json', multiple: '' }) as HTMLInputElement;
  const zone = el('div', { class: 'classe-zone' }, el('p', {}, el('label', { for: filesField.id }, t('classe-fichiers')), ' ', filesField), el('p', { class: 'discret' }, t('classe-glisser')));
  const codesField = el('textarea', { id: 'classe-codes', rows: '4', spellcheck: 'false', placeholder: t('classe-codes-exemple') }) as HTMLTextAreaElement;
  const addCodes = el('button', { type: 'button' }, t('classe-codes-ajouter'));
  const codes = el('p', {}, el('label', { for: codesField.id }, t('classe-codes')), el('br'), codesField, el('br'), addCodes);
  const state = el('p', { class: 'classe-etat', role: 'status' });
  const exported = el('button', { type: 'button' }, t('classe-exporter'));
  const empty = el('button', { type: 'button' }, t('classe-vider'));
  const actions = el('p', { class: 'classe-actions' }, exported, ' ', empty);
  const grid = el('div', { class: 'classe-tableau', tabindex: '0', role: 'region', 'aria-label': t('classe-tableau') });
  root.replaceChildren(zone, codes, state, actions, grid);

  const minutes = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;
  const date = (iso: string | null) => (iso ? new Intl.DateTimeFormat(t.language, { dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso)) : '');
  const HEADERS = () => [
    t('classe-col-eleve'),
    t('classe-col-chapitres'),
    t('classe-col-grade'),
    t('classe-col-succes'),
    t('classe-col-examen'),
    t('classe-col-date'),
    ...STORIES.map((h) => t(`histoire-${h.id}`)),
  ];
  const line = (e: Student) => [
    e.name,
    `${e.finished.length}/${chaptersTotal()}`,
    t(`grade-${gradeFor(e)}`),
    e.achievements,
    bestTime(e) === null ? '' : minutes(bestTime(e)!),
    date(e.date),
    ...STORIES.map((h) => {
      const a = progress(e, h.id);
      return `${a.done}/${a.total}`;
    }),
  ];

  const show = () => {
    students.sort((a, b) => a.name.localeCompare(b.name, t.language));
    actions.hidden = students.length === 0;
    state.replaceChildren(
      t('classe-compte', { nombre: students.length }),
      ...errors.map((x) => el('span', { class: 'classe-erreur' }, ' ', t('classe-erreur', { source: x.source, raison: t(`progression-${x.error}`) }))),
    );
    if (!students.length) return grid.replaceChildren();
    grid.replaceChildren(
      el(
        'table',
        {},
        el('caption', {}, t('classe-tableau')),
        el('thead', {}, el('tr', {}, ...HEADERS().map((x) => el('th', { scope: 'col' }, x)))),
        el(
          'tbody',
          {},
          ...students.map((e) =>
            el(
              'tr',
              {},
              ...line(e).map((x, i) => {
                const story = i - 6;
                const finished = story >= 0 && progress(e, STORIES[story].id).done === STORIES[story].chapters.length;
                return i === 0 ? el('th', { scope: 'row' }, String(x)) : el('td', finished ? { class: 'fini' } : {}, String(x));
              }),
            ),
          ),
        ),
      ),
    );
  };

  const add = (read: (Student | ClassError)[]) => {
    for (const x of read) {
      if ('error' in x) errors.push(x);
      else {
        // Le même élève (même nom) remplace sa ligne : la sauvegarde la plus récente l'emporte.
        const i = students.findIndex((e) => e.name === x.name);
        if (i >= 0) students[i] = x;
        else students.push(x);
      }
    }
    show();
  };
  const readFiles = async (files: FileList | File[]) => {
    errors.length = 0;
    add(await Promise.all([...files].map(async (f) => fileStudent(f.name, await f.text()))));
  };
  filesField.addEventListener('change', () => {
    if (filesField.files) readFiles(filesField.files).then(() => (filesField.value = ''));
  });
  zone.addEventListener('dragover', (e) => {
    e.preventDefault();
    zone.classList.add('survol');
  });
  zone.addEventListener('dragleave', () => zone.classList.remove('survol'));
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('survol');
    if (e.dataTransfer?.files) readFiles(e.dataTransfer.files);
  });
  addCodes.addEventListener('click', () => {
    errors.length = 0;
    add(codesStudents(codesField.value));
    codesField.value = '';
  });
  exported.addEventListener('click', () => {
    const link = el('a', {
      href: URL.createObjectURL(new Blob([`﻿${inCsv(students, HEADERS(), line)}`], { type: 'text/csv' })),
      download: t('classe-nom-fichier'),
    });
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  });
  empty.addEventListener('click', () => {
    students.length = 0;
    errors.length = 0;
    show();
  });
  show();
}
