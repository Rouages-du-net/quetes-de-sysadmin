// L'interface du jeu : le terminal simulé (une console qui part du poste et
// se connecte en ssh aux machines des histoires), le menu des histoires et
// des chapitres (des raccourcis), la progression gardée dans le navigateur.
// monter() construit tout dans un conteneur (un élément ou la racine
// fantôme d'un composant), sans rien supposer de la page qui l'accueille.

import { Console } from '../moteur/console';
import { HISTOIRES } from '../moteur/chapitres';
import { machineDeHistoire } from '../moteur/machines';
import { description, enMarkdown, noter, type Carnet } from '../moteur/carnet';
import { liensRouages } from '../moteur/rouages';
import { carte, type Lieu } from '../moteur/carte';
import { disposer, reperes as reperesPlan, type ElementPlan } from '../moteur/plan';
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

// Les lignes gardées à l'écran pour une seule sortie.
const MAX_LIGNES = 2000;

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
  const aideCle = el('p', { class: 'cle-aide' }, typo(t('cle-aide')));
  const navHistoires = el('nav', { class: 'histoires', 'aria-label': t('histoires-titre') },
    el('ol', {}, el('li', {}, boutonPoste), ...boutonsHistoires.map((b) => el('li', {}, b))), aideCle);

  const navsChapitres = HISTOIRES.map((h, i) =>
    el('nav', { class: 'chapitres', 'aria-label': t('chapitres-titre', { histoire: titreHistoire(i) }), 'data-chapitres': String(i) },
      el('ol', {}, ...h.chapitres.map((c, j) =>
        el('li', {}, el('button', { type: 'button', 'data-chapitre': String(j) },
          el('span', { class: 'num' }, t('chapitre-numero', { numero: c.numero })),
          el('span', { class: 'titre' }, t(`chapitre-${c.id}`)),
          el('span', { class: 'resume' }, typo(t(`chapitre-${c.id}.resume`))),
          el('span', { class: 'etat' })))))),
  );

  // Le mode examen : pas d'indice, un chrono ; la case recommence le chapitre en cours.
  const caseExamen = el('input', { type: 'checkbox' }) as HTMLInputElement;
  const chrono = el('span', { class: 'chrono', role: 'timer' });
  // La carte : un bouton à côté du terminal ouvre, dans une fenêtre, les lieux
  // connus de la machine où l'on est (voir carte.ts).
  const boutonCarte = el('button', { type: 'button', class: 'bouton-carte', 'aria-haspopup': 'dialog' }, t('carte-bouton'));
  const barreExamen = el('p', { class: 'examen' }, el('label', {}, caseExamen, el('span', {}, t('examen-case'))), chrono, boutonCarte);
  const idCarte = `qds-carte-${Math.random().toString(36).slice(2, 8)}`;
  const carteTitre = el('h2', { id: idCarte });
  const carteArbre = el('div', { class: 'carte-arbre' });
  const fermerCarte = el('button', { type: 'button', class: 'bouton' }, t('carte-fermer'));
  // Deux onglets quand l'histoire a un réseau : les lieux de la machine, et le plan du réseau (voir plan.ts).
  const onglet = (suffixe: string, texte: string) =>
    el('button', { type: 'button', role: 'tab', id: `${idCarte}-onglet-${suffixe}`, 'aria-controls': `${idCarte}-${suffixe}` }, texte);
  const ongletLieux = onglet('lieux', t('carte-onglet-lieux'));
  const ongletReseau = onglet('reseau', t('carte-onglet-reseau'));
  const onglets = el('div', { role: 'tablist', class: 'carte-onglets' }, ongletLieux, ongletReseau);
  const panneauLieux = el(
    'div',
    { role: 'tabpanel', id: `${idCarte}-lieux`, 'aria-labelledby': ongletLieux.id },
    el('p', { class: 'carte-legende' }, typo(t('carte-legende'))),
    carteArbre,
  );
  const planSchema = el('div', { class: 'plan-schema' });
  const planListe = el('div', { class: 'carte-arbre' });
  const planTexte = el('details', { class: 'plan-texte' }, el('summary', {}, t('plan-version-texte')), planListe);
  const panneauReseau = el(
    'div',
    { role: 'tabpanel', id: `${idCarte}-reseau`, 'aria-labelledby': ongletReseau.id },
    el('p', { class: 'carte-legende' }, typo(t('plan-legende'))),
    planSchema,
    planTexte,
  );
  const fenetreCarte = el(
    'dialog',
    { class: 'fenetre-carte', 'aria-labelledby': idCarte },
    carteTitre,
    onglets,
    panneauLieux,
    panneauReseau,
    el('p', { class: 'carte-actions' }, fermerCarte),
  ) as HTMLDialogElement;
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
  // Après un chapitre : la page de Les rouages du net qui explique son concept.
  const listeRouages = el('ul', {});
  const pourComprendre = el('aside', { class: 'pour-comprendre', hidden: '' }, el('p', {}, typo(t('rouages-intro'))), listeRouages);
  // Le carnet du sysadmin : les commandes déjà lancées, avec leur ligne du manuel.
  const carnetCompte = el('span', { class: 'compte' });
  const carnetListe = el('dl', {});
  const carnetVide = el('p', {}, typo(t('carnet-vide')));
  const exporter = el('button', { type: 'button', class: 'lien' }, t('carnet-exporter'));
  const copierCarnet = el('button', { type: 'button', class: 'lien' }, t('carnet-copier'));
  const carnetEtat = el('span', { class: 'carnet-etat', role: 'status' });
  const carnetActions = el('p', { class: 'carnet-actions' }, exporter, ' · ', copierCarnet, ' ', carnetEtat);
  const panneauCarnet = el(
    'details',
    { class: 'carnet' },
    el('summary', {}, t('carnet-titre'), ' ', carnetCompte),
    el('p', { class: 'carnet-aide' }, typo(t('carnet-aide'))),
    carnetVide,
    carnetListe,
    carnetActions,
  );
  const recommencer = el('button', { type: 'button', class: 'lien' }, t('bouton-recommencer'));
  const astuces = el('p', { class: 'astuces' }, typo(t('astuces')), ' ', recommencer);
  const credit = el('p', { class: 'credit' }, typo(t('credit')), ' ',
    el('a', { href: 'https://github.com/Rouages-du-net/quetes-de-sysadmin' }, t('credit-lien-projet')), ' · ',
    el('a', { href: 'https://web.mit.edu/mprat/Public/web/Terminus/Web/main.html', hreflang: 'en' }, t('credit-lien-original')));

  const jeu = el('div', { class: 'qds', lang: t.langue }, navHistoires, ...navsChapitres, barreExamen, terminal, fin, pourComprendre, panneauCarnet, astuces, credit, fenetreCarte);
  racine.append(jeu);

  // ——— Progression gardée dans ce navigateur ———
  let sauve: {
    termines?: string[];
    histoire?: string | null;
    connus?: string;
    ssh?: { fichiers: Record<string, string>; phrases?: Record<string, string> };
    carnet?: Carnet;
    examen?: boolean;
    // Meilleurs temps en mode examen, par chapitre (ms).
    records?: Record<string, number>;
  } = {};
  try {
    sauve = JSON.parse(localStorage.getItem(CLE) ?? '{}');
  } catch {}
  const terminalJeu = new Console({ langue: t.langue, termines: sauve.termines, hotesConnus: sauve.connus, ssh: sauve.ssh });
  const termines = terminalJeu.termines;
  const carnet: Carnet = sauve.carnet && typeof sauve.carnet === 'object' ? sauve.carnet : {};
  const records: Record<string, number> = sauve.records && typeof sauve.records === 'object' ? sauve.records : {};
  terminalJeu.examen = sauve.examen === true;
  caseExamen.checked = terminalJeu.examen;
  // Le début du chapitre en cours, en mode examen (null : pas de chrono).
  let debutExamen: number | null = null;
  // Histoire et chapitre en cours (-1 : sur le poste).
  const histoire = () => (terminalJeu.distant ? HISTOIRES.indexOf(terminalJeu.distant.histoire) : -1);
  const courant = () => (terminalJeu.distant ? terminalJeu.distant.histoire.chapitres.indexOf(terminalJeu.distant.shell.chapitre) : -1);
  const sauver = () => {
    try {
      localStorage.setItem(
        CLE,
        JSON.stringify({ termines, histoire: terminalJeu.distant?.histoire.id ?? null, connus: terminalJeu.hotesConnus(), ssh: terminalJeu.ssh(), carnet, examen: terminalJeu.examen, records }),
      );
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
    let lignes = texte.split('\n');
    // Une sortie géante (ls d'un lieu de 60 000 fichiers) : comme l'historique
    // d'un terminal, on n'en garde que la fin, pour que la page reste fluide.
    if (lignes.length > MAX_LIGNES) {
      const coupees = lignes.length - MAX_LIGNES;
      lignes = lignes.slice(-MAX_LIGNES);
      sortie.appendChild(el('p', { class: 'coupure' }, t('sortie-coupee', { lignes: coupees })));
    }
    // Une ligne soulignée par ^~~~ (sudo, compilateurs) : la ligne et son soulignement ne se replient pas.
    const souligne = (i: number) => /^\s*\^~*\s*$/.test(lignes[i] ?? '');
    lignes.forEach((ligne, i) => {
      const fin = i < lignes.length - 1 ? '\n' : '';
      if (enColonnes(ligne) || souligne(i) || souligne(i + 1)) pre.append(el('span', { class: 'colonnes' }, ligne + fin));
      else pre.append(ligne + fin);
    });
    if (classe) pre.className = classe;
    sortie.appendChild(pre);
  };

  const majInvite = () => {
    invite.textContent = terminalJeu.invite();
    saisie.type = terminalJeu.shell.saisieMasquee() ? 'password' : 'text';
  };

  const majNav = () => {
    boutonPoste.setAttribute('aria-current', String(histoire() === -1));
    boutonsHistoires.forEach((b, h) => {
      b.setAttribute('aria-current', String(h === histoire()));
      b.disabled = !accessible(h);
      // Les histoires sans leur clé sont grisées : on avance de l'une à l'autre.
      b.toggleAttribute('data-verrouillee', !accessible(h));
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
    aideCle.hidden = boutonsHistoires.every((b) => !b.disabled);
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
    const liens = h >= 0 && terminalJeu.distant!.shell.termine ? liensRouages(terminalJeu.distant!.shell.chapitre.id) : [];
    pourComprendre.hidden = liens.length === 0;
    listeRouages.replaceChildren(
      ...liens.map((l) => el('li', {}, el('a', { href: l.adresse, hreflang: 'fr', target: '_blank', rel: 'noopener' }, typo(t(`rouages-lien-${l.id}`))))),
    );
  };

  const majCarnet = () => {
    const noms = Object.keys(carnet).sort((a, b) => a.localeCompare(b));
    carnetCompte.textContent = t('carnet-compte', { nombre: noms.length });
    carnetVide.hidden = noms.length > 0;
    carnetActions.hidden = noms.length === 0;
    carnetListe.replaceChildren(
      ...noms.flatMap((nom) => [
        el('dt', {}, el('code', {}, nom)),
        el('dd', {}, typo(description(nom, t)), ' ', el('code', { class: 'exemple' }, carnet[nom].ligne)),
      ]),
    );
  };

  // mm:ss (ou h:mm:ss) : des chiffres, comme un chronomètre.
  const minutes = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const h = Math.floor(s / 3600);
    const mmss = `${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
    return h ? `${h}:${mmss}` : mmss;
  };
  const majChrono = () => {
    chrono.textContent = debutExamen === null ? '' : t('examen-chrono', { temps: minutes(Date.now() - debutExamen) });
  };
  setInterval(() => debutExamen !== null && majChrono(), 1000);
  // Fin du chapitre en mode examen : le temps, et le record de ce navigateur.
  const finExamen = () => {
    if (debutExamen === null || !terminalJeu.distant?.shell.termine) return;
    const id = terminalJeu.distant.shell.chapitre.id;
    const temps = Date.now() - debutExamen;
    const ancien = records[id];
    if (ancien === undefined || temps < ancien) records[id] = temps;
    afficher(t(ancien === undefined || temps < ancien ? 'examen-fini-record' : 'examen-fini', { temps: minutes(temps), record: minutes(records[id]) }), 'examen-resultat');
    debutExamen = null;
    majChrono();
  };

  const apres = () => {
    finExamen();
    majCarnet();
    majInvite();
    majNav();
    sauver();
    terminal.scrollTop = terminal.scrollHeight;
  };

  // Les raccourcis du menu : un écran neuf, directement sur la bonne machine.
  const allerPoste = () => {
    debutExamen = null;
    majChrono();
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
    // En mode examen, un chapitre qui (re)commence lance le chrono ; un chapitre déjà fini, non.
    debutExamen = terminalJeu.examen && !terminalJeu.distant?.shell.termine ? Date.now() : null;
    if (debutExamen !== null) afficher(t('examen-debut'), 'examen-resultat');
    majChrono();
    apres();
  };

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const ligne = saisie.value;
    // Un mot de passe ne s'affiche pas et ne va pas dans l'historique.
    const secret = terminalJeu.shell.saisieMasquee();
    const reponse = secret || terminalJeu.shell.question !== null;
    afficher(secret ? (invite.textContent ?? '') : `${invite.textContent} ${ligne}`, 'cmd');
    if (ligne.trim() && !reponse) historique.push(ligne);
    position = historique.length;
    const shell = terminalJeu.shell;
    const resultat = terminalJeu.executer(ligne);
    // Une réponse à une question (un mot de passe…) n'est pas une commande pour le carnet.
    if (!reponse) noter(carnet, shell);
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

  // Copier-coller comme dans la plupart des terminaux Linux : le texte
  // sélectionné est copié, le clic droit (ou celui du milieu) le colle.
  // Maj + clic droit garde le menu du navigateur.
  const selection = () => ((racine as ShadowRoot & { getSelection?: () => Selection | null }).getSelection?.() ?? window.getSelection())?.toString() ?? '';
  let copie = '';
  terminal.addEventListener('mouseup', () => {
    const texte = selection();
    if (!texte) return;
    copie = texte;
    navigator.clipboard?.writeText(texte).catch(() => {});
  });
  const coller = async (e: MouseEvent) => {
    e.preventDefault();
    let texte = copie;
    if (!texte) texte = (await navigator.clipboard?.readText().catch(() => '')) ?? '';
    if (!texte) return;
    const nano = terminal.querySelector('textarea');
    // Dans nano, le texte garde ses lignes ; sur la ligne de commande, il tient sur une ligne.
    const cible = nano ?? saisie;
    if (!nano) texte = texte.replace(/\s*\n\s*/g, ' ').trim();
    const debut = cible.selectionStart ?? cible.value.length;
    const fin = cible.selectionEnd ?? debut;
    cible.setRangeText(texte, debut, fin, 'end');
    cible.focus();
  };
  terminal.addEventListener('contextmenu', (e) => {
    if (!e.shiftKey) coller(e);
  });
  terminal.addEventListener('auxclick', (e) => {
    if (e.button === 1) coller(e);
  });
  terminal.addEventListener('click', () => {
    if (!form.hidden && !selection()) saisie.focus();
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
  // Le carnet s'emporte : un fichier Markdown, ou le presse-papiers.
  const markdown = () => enMarkdown(carnet, t, termines);
  exporter.addEventListener('click', () => {
    const lien = el('a', { href: URL.createObjectURL(new Blob([markdown()], { type: 'text/markdown' })), download: t('carnet-fichier') });
    lien.click();
    setTimeout(() => URL.revokeObjectURL(lien.href), 1000);
  });
  copierCarnet.addEventListener('click', () => {
    navigator.clipboard
      ?.writeText(markdown())
      .then(() => (carnetEtat.textContent = t('carnet-copie')))
      .catch(() => (carnetEtat.textContent = t('carnet-copie-impossible')));
  });
  caseExamen.addEventListener('change', () => {
    terminalJeu.examen = caseExamen.checked;
    // Le chapitre en cours recommence : en examen, sur une machine neuve et chrono à zéro.
    if (histoire() >= 0) demarrer(histoire(), courant());
    else apres();
  });
  // Un lieu de la carte : son nom, ses repères en toutes lettres (lus aussi
  // par les lecteurs d'écran), puis les lieux qu'il contient.
  const dessinerLieu = (l: Lieu): HTMLElement => {
    const reperes = [l.maison && t('carte-maison'), l.ferme && t('carte-ferme'), !l.visite && t('carte-apercu')].filter(Boolean).join(', ');
    return el(
      'li',
      { class: [l.visite ? 'visite' : 'apercu', l.ici ? 'ici' : ''].join(' ').trim(), ...(l.ici ? { 'aria-current': 'location' } : {}) },
      el('span', { class: 'nom' }, l.nom === '/' ? '/' : `${l.nom}/`),
      ...(reperes ? [' ', el('span', { class: 'reperes' }, `(${reperes})`)] : []),
      ...(l.ici ? [' ', el('strong', { class: 'vous-etes-ici' }, t('carte-ici'))] : []),
      ...(l.enfants.length ? [el('ul', {}, ...l.enfants.map(dessinerLieu))] : []),
    );
  };
  // Le plan du réseau : un schéma (arbre couché, une colonne par niveau) et la même chose en liste.
  const SVG = 'http://www.w3.org/2000/svg';
  const svg = (nom: string, attrs: Record<string, string>, ...enfants: (Node | string)[]) => {
    const e = document.createElementNS(SVG, nom);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    e.append(...enfants);
    return e;
  };
  const LARGEUR = 176;
  const HAUTEUR = 54;
  const ECART_X = 36;
  const ECART_Y = 22;
  const classesPlan = (e: ElementPlan, ici: string, visitees: Set<string>) => {
    const r = reperesPlan(e, ici, visitees);
    return [e.role, r.ici ? 'ici' : '', e.hote && !r.visite ? 'pas-visite' : ''].filter(Boolean).join(' ');
  };
  const dessinerPlan = (racine: ElementPlan, ici: string, visitees: Set<string>) => {
    const { places, colonnes, lignes } = disposer(racine);
    const x = (c: number) => 2 + c * (LARGEUR + ECART_X);
    const y = (l: number) => ECART_Y + l * (HAUTEUR + ECART_Y);
    const largeur = x(colonnes) - ECART_X + 2;
    const hauteur = y(lignes);
    const liens = places
      .filter((p) => p.parent)
      .map((p) => {
        const de = p.parent!;
        const milieu = x(de.colonne) + LARGEUR + ECART_X / 2;
        return svg('path', {
          class: p.element.tunnel ? 'lien tunnel' : 'lien',
          d: `M${x(de.colonne) + LARGEUR} ${y(de.ligne) + HAUTEUR / 2} H${milieu} V${y(p.ligne) + HAUTEUR / 2} H${x(p.colonne)}`,
        });
      });
    const boites = places.map((p) => {
      const e = p.element;
      const bx = x(p.colonne);
      const by = y(p.ligne);
      return svg(
        'g',
        { class: `boite ${classesPlan(e, ici, visitees)}` },
        svg('rect', { x: String(bx), y: String(by), width: String(LARGEUR), height: String(HAUTEUR), rx: e.role === 'internet' ? '27' : '6' }),
        // Un nom seul (Internet) se centre dans sa boîte.
        svg('text', { x: String(bx + 10), y: String(by + (e.adresse || e.note ? 19 : HAUTEUR / 2 + 5)), class: 'nom' }, e.nom),
        ...(e.adresse ? [svg('text', { x: String(bx + 10), y: String(by + 34), class: 'adresse' }, e.adresse)] : []),
        ...(e.note ? [svg('text', { x: String(bx + 10), y: String(by + 48), class: 'note' }, e.note)] : []),
        ...(reperesPlan(e, ici, visitees).ici ? [svg('text', { x: String(bx), y: String(by - 6), class: 'repere-ici' }, `▼ ${t('plan-ici')}`)] : []),
      );
    });
    return svg('svg', { viewBox: `0 0 ${largeur} ${hauteur}`, width: String(largeur), height: String(hauteur), 'aria-hidden': 'true', focusable: 'false' }, ...liens, ...boites);
  };
  const dessinerElement = (e: ElementPlan, ici: string, visitees: Set<string>): HTMLElement => {
    const r = reperesPlan(e, ici, visitees);
    const notes = [e.note, e.tunnel && t('plan-tunnel'), e.hote && (r.visite ? t('plan-visite') : t('plan-pas-visite'))].filter(Boolean).join(', ');
    return el(
      'li',
      { class: classesPlan(e, ici, visitees), ...(r.ici ? { 'aria-current': 'location' } : {}) },
      el('span', { class: 'nom' }, e.nom),
      ...(e.adresse ? [' ', el('code', {}, e.adresse)] : []),
      ...(notes ? [' ', el('span', { class: 'reperes' }, `(${notes})`)] : []),
      ...(r.ici ? [' ', el('strong', { class: 'vous-etes-ici' }, `← ${t('plan-ici')}`)] : []),
      ...(e.enfants?.length ? [el('ul', {}, ...e.enfants.map((x) => dessinerElement(x, ici, visitees)))] : []),
    );
  };
  const choisirOnglet = (reseau: boolean) => {
    ongletLieux.setAttribute('aria-selected', String(!reseau));
    ongletReseau.setAttribute('aria-selected', String(reseau));
    ongletLieux.tabIndex = reseau ? -1 : 0;
    ongletReseau.tabIndex = reseau ? 0 : -1;
    panneauLieux.hidden = reseau;
    panneauReseau.hidden = !reseau;
  };
  ongletLieux.addEventListener('click', () => choisirOnglet(false));
  ongletReseau.addEventListener('click', () => choisirOnglet(true));
  // Les flèches passent d'un onglet à l'autre (comme dans toute liste d'onglets).
  onglets.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const reseau = ongletLieux.getAttribute('aria-selected') === 'true';
    choisirOnglet(reseau);
    (reseau ? ongletReseau : ongletLieux).focus();
    e.preventDefault();
  });
  boutonCarte.addEventListener('click', () => {
    const sh = terminalJeu.shell;
    carteTitre.textContent = t('carte-titre', { machine: sh.hote });
    carteArbre.replaceChildren(el('ul', { class: 'arbre' }, dessinerLieu(carte(sh))));
    const plan = terminalJeu.distant?.shell.chapitre.plan?.(t);
    onglets.hidden = !plan;
    if (plan) {
      planSchema.replaceChildren(dessinerPlan(plan, sh.hote, terminalJeu.visitees));
      planListe.replaceChildren(el('ul', { class: 'arbre' }, dessinerElement(plan, sh.hote, terminalJeu.visitees)));
      // Sur un petit écran, le schéma défile dans sa boîte : la liste s'ouvre d'office.
      planTexte.open = matchMedia('(max-width: 40rem)').matches;
    }
    choisirOnglet(false);
    fenetreCarte.showModal();
    fenetreCarte.querySelector('.ici')?.scrollIntoView({ block: 'center' });
  });
  // La fenêtre fermée (bouton ou Échap), on reprend la ligne de commande :
  // après que le navigateur a rendu le focus au bouton qui l'avait ouverte.
  fermerCarte.addEventListener('click', () => fenetreCarte.close());
  fenetreCarte.addEventListener('close', () => setTimeout(() => saisie.focus()));
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
