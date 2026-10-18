// L'interface du jeu : le terminal simulé (une console qui part du poste et
// se connecte en ssh aux machines des histoires), le menu des histoires et
// des chapitres (des raccourcis), la progression gardée dans le navigateur.
// monter() construit tout dans un conteneur (un élément ou la racine
// fantôme d'un composant), sans rien supposer de la page qui l'accueille.

import { Console } from '../moteur/console';
import { HISTOIRES } from '../moteur/chapitres';
import { machineDeHistoire } from '../moteur/machines';
import { editeur } from './editeur';
import { traducteur, typographie, type Langue } from '../textes';

export interface Options {
  langue?: Langue;
  /** Histoire à ouvrir au départ (identifiant, ex. « datacenter »), même sans sa clé. */
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
  const boutonPoste = el('button', { type: 'button', 'data-poste': '' }, el('span', { class: 'titre' }, t('poste-titre')));
  const navHistoires = el('nav', { class: 'histoires', 'aria-label': t('histoires-titre') },
    el('ol', {}, el('li', {}, boutonPoste), ...boutonsHistoires.map((b) => el('li', {}, b))));

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
  let sauve: { termines?: string[]; histoire?: string | null; connus?: string } = {};
  try {
    sauve = JSON.parse(localStorage.getItem(CLE) ?? '{}');
  } catch {}
  const terminalJeu = new Console({ langue: t.langue, termines: sauve.termines, hotesConnus: sauve.connus });
  const termines = terminalJeu.termines;
  // Histoire et chapitre en cours (-1 : sur le poste).
  const histoire = () => (terminalJeu.distant ? HISTOIRES.indexOf(terminalJeu.distant.histoire) : -1);
  const courant = () => (terminalJeu.distant ? terminalJeu.distant.histoire.chapitres.indexOf(terminalJeu.distant.shell.chapitre) : -1);
  const sauver = () => {
    try {
      localStorage.setItem(CLE, JSON.stringify({ termines, histoire: terminalJeu.distant?.histoire.id ?? null, connus: terminalJeu.hotesConnus() }));
    } catch {}
  };
  const ouvert = (h: number, c: number) => c === 0 || termines.includes(chapitres(h)[c - 1].id);
  // L'attribut histoire ouvre son histoire même sans la clé (intégration dans un cours).
  const accessible = (h: number) => terminalJeu.ouverte(HISTOIRES[h].id) || HISTOIRES[h].id === options.histoire;

  const historique: string[] = [];
  let position = 0;

  // Les tableaux d'au moins trois colonnes (ls -l, ufw status, ss, ps…) ne
  // se replient pas : sur un petit écran, le bloc défile de côté. Le reste,
  // paragraphes et consignes (« tape :   ls »), passe à la ligne. Les traits
  // qui soulignent un tableau (------, ======) restent aussi d'un seul tenant.
  // Une tabulation sépare aussi des colonnes (dig).
  const enColonnes = (ligne: string) => (ligne.match(/\S(?: {2,}|\t)(?=\S)/g) ?? []).length >= 2 || /^[-=]{20,}$/.test(ligne);
  const afficher = (texte: string, classe?: string) => {
    if (!texte) return;
    const pre = document.createElement('pre');
    const lignes = texte.split('\n');
    lignes.forEach((ligne, i) => {
      const fin = i < lignes.length - 1 ? '\n' : '';
      if (enColonnes(ligne)) pre.append(el('span', { class: 'colonnes' }, ligne + fin));
      else pre.append(ligne + fin);
    });
    if (classe) pre.className = classe;
    sortie.appendChild(pre);
  };

  const majInvite = () => {
    invite.textContent = terminalJeu.invite();
    saisie.type = terminalJeu.shell.attente ? 'password' : 'text';
  };

  const majNav = () => {
    boutonPoste.setAttribute('aria-current', String(histoire() === -1));
    boutonsHistoires.forEach((b, h) => {
      b.setAttribute('aria-current', String(h === histoire()));
      b.disabled = !accessible(h);
      const faits = chapitres(h).filter((c) => termines.includes(c.id)).length;
      const total = chapitres(h).length;
      b.querySelector('.etat')!.textContent = !accessible(h)
        ? t('etat-cle-manquante')
        : faits === total
          ? t('etat-histoire-terminee')
          : total > 1
            ? t('etat-chapitres-faits', { faits, total })
            : '';
    });
    navsChapitres.forEach((nav, h) => {
      nav.hidden = h !== histoire() || chapitres(h).length < 2;
      nav.querySelectorAll<HTMLButtonElement>('[data-chapitre]').forEach((b, c) => {
        b.disabled = !ouvert(h, c);
        b.setAttribute('aria-current', String(h === histoire() && c === courant()));
        b.querySelector('.etat')!.textContent = termines.includes(chapitres(h)[c].id)
          ? t('etat-chapitre-termine')
          : ouvert(h, c)
            ? ''
            : t('etat-verrouille');
      });
    });
    // « Chapitre suivant » : après un chapitre fini, s'il en reste un.
    const h = histoire();
    fin.hidden = !(h >= 0 && terminalJeu.distant!.shell.termine && courant() < chapitres(h).length - 1);
  };

  const apres = () => {
    majInvite();
    majNav();
    sauver();
    terminal.scrollTop = terminal.scrollHeight;
  };

  // Les raccourcis du menu : un écran neuf, directement sur la bonne machine.
  const allerPoste = () => {
    sortie.replaceChildren();
    if (terminalJeu.distant) terminalJeu.deconnecter();
    afficher(`— ${t('poste-titre')} —`);
    afficher(terminalJeu.reinitialiserPoste());
    apres();
  };
  const demarrer = (h: number, c?: number) => {
    sortie.replaceChildren();
    const chapitre = c === undefined ? undefined : chapitres(h)[c];
    if (terminalJeu.distant?.histoire === HISTOIRES[h] && chapitre) afficher(terminalJeu.ouvrir(chapitre));
    else afficher(terminalJeu.connecter(machineDeHistoire(HISTOIRES[h].id)!.nom, chapitre));
    apres();
  };

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const ligne = saisie.value;
    // Un mot de passe ne s'affiche pas et ne va pas dans l'historique.
    const secret = terminalJeu.shell.attente !== null;
    const reponse = secret || terminalJeu.shell.question !== null;
    afficher(secret ? (invite.textContent ?? '') : `${invite.textContent} ${ligne}`, 'cmd');
    if (ligne.trim() && !reponse) historique.push(ligne);
    position = historique.length;
    const resultat = terminalJeu.executer(ligne);
    if (resultat === null) sortie.replaceChildren();
    else afficher(resultat);
    saisie.value = '';
    apres();
    ouvrirEditeur();
  });

  // nano : l'éditeur prend la place de la ligne de commande jusqu'à ^X.
  const ouvrirEditeur = () => {
    const edition = terminalJeu.edition;
    if (!edition) return;
    form.hidden = true;
    terminal.append(
      editeur({
        t,
        chemin: edition.chemin,
        texte: edition.texte,
        message: edition.message,
        enregistrer: (texte) => terminalJeu.enregistrer(texte),
        fermer: () => {
          afficher(terminalJeu.quitterEdition());
          form.hidden = false;
          apres();
          saisie.focus();
        },
      }),
    );
    terminal.scrollTop = terminal.scrollHeight;
  };

  saisie.addEventListener('keydown', (e) => {
    if (terminalJeu.shell.attente || terminalJeu.shell.question) return;
    if (e.key === 'Tab') {
      e.preventDefault();
      saisie.value = terminalJeu.completer(saisie.value);
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
    if (!form.hidden && !window.getSelection()?.toString()) saisie.focus();
  });
  boutonPoste.addEventListener('click', () => {
    allerPoste();
    saisie.focus();
  });
  boutonsHistoires.forEach((b, h) =>
    b.addEventListener('click', () => {
      demarrer(h);
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
    demarrer(histoire(), courant() + 1);
    saisie.focus();
  });
  recommencer.addEventListener('click', () => {
    if (histoire() === -1) allerPoste();
    else demarrer(histoire(), courant());
    saisie.focus();
  });

  // Au départ : l'histoire demandée par l'attribut, sinon celle où l'on
  // s'était arrêté, sinon le poste.
  const depart = HISTOIRES.findIndex((h) => h.id === (options.histoire ?? sauve.histoire));
  if (depart >= 0 && accessible(depart)) demarrer(depart);
  else allerPoste();
  return { racine: jeu };
}
