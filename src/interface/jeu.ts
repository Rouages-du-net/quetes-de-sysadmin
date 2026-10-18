// L'interface du jeu : choix de l'histoire et du chapitre, terminal simulé,
// progression gardée dans le navigateur. monter() construit tout dans un
// conteneur (un élément ou la racine fantôme d'un composant), sans rien
// supposer de la page qui l'accueille.

import { Shell } from '../moteur/shell';
import { HISTOIRES } from '../moteur/chapitres';
import { traducteur, typographie, type Langue } from '../textes';

export interface Options {
  langue?: Langue;
  /** Histoire à ouvrir au départ (identifiant, ex. « datacenter »). */
  histoire?: string;
  /** Clé de sauvegarde dans localStorage (à changer si plusieurs jeux partagent un site). */
  cle?: string;
}


function el<K extends keyof HTMLElementTagNameMap>(nom: K, attrs: Record<string, string> = {}, ...enfants: (Node | string)[]) {
  const e = document.createElement(nom);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  e.append(...enfants);
  return e;
}

export function monter(racine: HTMLElement | ShadowRoot, options: Options = {}) {
  const t = traducteur(options.langue);
  const typo = (texte: string) => typographie(texte, t.langue);
  const titreHistoire = (h: number) => t(`histoire-${HISTOIRES[h].id}`);
  const CLE = options.cle ?? 'quetes-de-sysadmin';
  const chapitres = (h: number) => HISTOIRES[h].chapitres;

  // ——— Construction ———
  const boutonsHistoires = HISTOIRES.map((h, i) =>
    el('button', { type: 'button', 'data-histoire': String(i) },
      el('span', { class: 'titre' }, titreHistoire(i)),
      el('span', { class: 'resume' }, typo(t(`histoire-${h.id}.resume`))),
      el('span', { class: 'etat' })),
  );
  const navHistoires = el('nav', { class: 'histoires', 'aria-label': t('histoires-titre') },
    el('ol', {}, ...boutonsHistoires.map((b) => el('li', {}, b))));

  const navsChapitres = HISTOIRES.map((h, i) =>
    el('nav', { class: 'chapitres', 'aria-label': t('chapitres-titre', { histoire: titreHistoire(i) }), 'data-chapitres': String(i) },
      el('ol', {}, ...h.chapitres.map((c, j) =>
        el('li', {}, el('button', { type: 'button', 'data-chapitre': String(j) },
          el('span', { class: 'num' }, t('chapitre-numero', { numero: c.numero })),
          el('span', { class: 'titre' }, t(`chapitre-${c.id}`)),
          el('span', { class: 'resume' }, typo(t(`chapitre-${c.id}.resume`))),
          el('span', { class: 'etat' })))))),
  );

  const sortie = el('div', { class: 'sortie', role: 'log', 'aria-live': 'polite' });
  const id = `qds-saisie-${Math.random().toString(36).slice(2, 8)}`;
  const invite = el('label', { class: 'invite', for: id });
  const saisie = el('input', {
    id, type: 'text', spellcheck: 'false', autocapitalize: 'off', autocorrect: 'off', autocomplete: 'off',
    'aria-label': t('saisie-etiquette'),
  }) as HTMLInputElement;
  const form = el('form', { autocomplete: 'off' }, invite, saisie);
  const terminal = el('div', { class: 'terminal' }, sortie, form);
  const suivant = el('button', { type: 'button', class: 'bouton principal' }, t('bouton-suivant'));
  const fin = el('div', { class: 'fin', hidden: '' }, suivant);
  const recommencer = el('button', { type: 'button', class: 'lien' }, t('bouton-recommencer'));
  const astuces = el('p', { class: 'astuces' }, typo(t('astuces')), ' ', recommencer);
  const credit = el('p', { class: 'credit' }, typo(t('credit')), ' ',
    el('a', { href: 'https://github.com/Rouages-du-net/quetes-de-sysadmin' }, t('credit-lien-projet')), ' · ',
    el('a', { href: 'https://web.mit.edu/mprat/Public/web/Terminus/Web/main.html', hreflang: 'en' }, t('credit-lien-original')));

  const jeu = el('div', { class: 'qds', lang: t.langue }, navHistoires, ...navsChapitres, terminal, fin, astuces, credit);
  racine.append(jeu);

  // ——— Progression gardée dans ce navigateur ———
  let termines: string[] = [];
  let histoire = Math.max(0, HISTOIRES.findIndex((h) => h.id === options.histoire));
  try {
    const sauve = JSON.parse(localStorage.getItem(CLE) ?? '{}');
    termines = sauve.termines ?? [];
    if (!options.histoire) histoire = Math.max(0, HISTOIRES.findIndex((h) => h.id === sauve.histoire));
  } catch {}
  const sauver = () => {
    try {
      localStorage.setItem(CLE, JSON.stringify({ termines, histoire: HISTOIRES[histoire].id }));
    } catch {}
  };
  const ouvert = (h: number, c: number) => c === 0 || termines.includes(chapitres(h)[c - 1].id);

  let shell: Shell;
  let courant = 0;
  const historique: string[] = [];
  let position = 0;

  const afficher = (texte: string, classe?: string) => {
    if (!texte) return;
    const pre = document.createElement('pre');
    pre.textContent = texte;
    if (classe) pre.className = classe;
    sortie.appendChild(pre);
  };

  const majInvite = () => {
    invite.textContent = shell.invite();
    saisie.type = shell.attente ? 'password' : 'text';
  };

  const majNav = () => {
    boutonsHistoires.forEach((b, h) => {
      b.setAttribute('aria-current', String(h === histoire));
      const faits = chapitres(h).filter((c) => termines.includes(c.id)).length;
      const total = chapitres(h).length;
      b.querySelector('.etat')!.textContent =
        faits === total ? t('etat-histoire-terminee') : total > 1 ? t('etat-chapitres-faits', { faits, total }) : '';
    });
    navsChapitres.forEach((nav, h) => {
      nav.hidden = h !== histoire || chapitres(h).length < 2;
      nav.querySelectorAll<HTMLButtonElement>('[data-chapitre]').forEach((b, c) => {
        b.disabled = !ouvert(h, c);
        b.setAttribute('aria-current', String(h === histoire && c === courant));
        b.querySelector('.etat')!.textContent = termines.includes(chapitres(h)[c].id)
          ? t('etat-chapitre-termine')
          : ouvert(h, c)
            ? ''
            : t('etat-verrouille');
      });
    });
  };

  const demarrer = (h: number, c: number) => {
    histoire = h;
    courant = c;
    const chapitre = chapitres(h)[c];
    shell = new Shell(chapitre, t.langue);
    sortie.replaceChildren();
    fin.hidden = true;
    const titre =
      chapitres(h).length > 1
        ? t('chapitre-titre-complet', { histoire: titreHistoire(h), numero: chapitre.numero, titre: t(`chapitre-${chapitre.id}`) })
        : titreHistoire(h);
    afficher(`— ${titre} —`);
    afficher(shell.executer(`cat ${chapitre.accueil}`) ?? '');
    majInvite();
    majNav();
    sauver();
  };

  // Reprend une histoire à son premier chapitre pas encore terminé.
  const reprendre = (h: number) => {
    const c = chapitres(h).findIndex((ch) => !termines.includes(ch.id));
    demarrer(h, c === -1 ? chapitres(h).length - 1 : c);
  };

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const ligne = saisie.value;
    // Un mot de passe ne s'affiche pas et ne va pas dans l'historique.
    const secret = shell.attente !== null;
    afficher(secret ? (invite.textContent ?? '') : `${invite.textContent} ${ligne}`, 'cmd');
    if (ligne.trim() && !secret) historique.push(ligne);
    position = historique.length;
    const dejaFini = shell.termine;
    const resultat = shell.executer(ligne);
    if (resultat === null) sortie.replaceChildren();
    else afficher(resultat);
    if (shell.termine && !dejaFini) {
      const id = chapitres(histoire)[courant].id;
      if (!termines.includes(id)) termines.push(id);
      sauver();
      majNav();
      fin.hidden = courant >= chapitres(histoire).length - 1;
    }
    saisie.value = '';
    majInvite();
    terminal.scrollTop = terminal.scrollHeight;
  });

  saisie.addEventListener('keydown', (e) => {
    if (shell.attente) return;
    if (e.key === 'Tab') {
      e.preventDefault();
      saisie.value = shell.completer(saisie.value);
    } else if (e.key === 'ArrowUp' && position > 0) {
      e.preventDefault();
      saisie.value = historique[--position];
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      position = Math.min(position + 1, historique.length);
      saisie.value = historique[position] ?? '';
    }
  });

  terminal.addEventListener('click', () => {
    if (!window.getSelection()?.toString()) saisie.focus();
  });
  boutonsHistoires.forEach((b, h) =>
    b.addEventListener('click', () => {
      reprendre(h);
      saisie.focus();
    }),
  );
  navsChapitres.forEach((nav, h) =>
    nav.querySelectorAll<HTMLButtonElement>('[data-chapitre]').forEach((b, c) =>
      b.addEventListener('click', () => {
        demarrer(h, c);
        saisie.focus();
      }),
    ),
  );
  suivant.addEventListener('click', () => {
    demarrer(histoire, courant + 1);
    saisie.focus();
  });
  recommencer.addEventListener('click', () => {
    demarrer(histoire, courant);
    saisie.focus();
  });

  reprendre(histoire);
  return { racine: jeu };
}
