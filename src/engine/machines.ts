// Le réseau simulé : le poste de la joueuse ou du joueur, et une machine par
// histoire. Adresses de documentation (RFC 5737), domaine réservé aux
// exemples (RFC 6761). Les clés SSH et les empreintes sont fausses mais ont
// la forme des vraies (ed25519), et ne changent jamais : le jeu reste
// déterministe.

import type { Traduire } from '../texts';

export interface Machine {
  // L'identifiant de la machine (en français) ; le nom qu'on tape dépend de la langue (nomMachine).
  nom: string;
  // Nom complet, résolu par /etc/hosts du poste.
  domaine: string;
  adresse: string;
  // Histoire jouée sur cette machine (absent pour le poste).
  histoire?: string;
  // Le jeu ne donne pas de clé : on crée la sienne (ssh-keygen, ssh-copy-id).
  sansCle?: boolean;
}

const machine = (nom: string, adresse: string, histoire?: string, sansCle = false): Machine => ({
  nom,
  domaine: `${nom}.internal`,
  adresse,
  histoire,
  ...(sansCle ? { sansCle } : {}),
});

export const POSTE = machine('poste', '192.0.2.2');

export const MACHINES: Machine[] = [
  machine('royaume', '192.0.2.10', 'effaceur'),
  machine('datacenter', '192.0.2.11', 'datacenter'),
  machine('fourmiliere', '192.0.2.12', 'paquet'),
  machine('manuscrit', '192.0.2.13', 'temps'),
  machine('bibliotheque', '192.0.2.14', 'archives'),
  // Le serveur des Lettres du quartier : la même adresse que letters.example
  // dans Le Paquet perdu.
  machine('lettres', '203.0.113.10', 'lettres'),
  machine('fabrique', '192.0.2.15', 'fabrique'),
  machine('gazette', '192.0.2.16', 'gazette'),
  machine('ludotheque', '192.0.2.17', 'ludotheque'),
  machine('radio', '192.0.2.18', 'astreinte'),
  // La Maison des associations : une passerelle, devant son réseau interne.
  machine('maison', '192.0.2.19', 'maison', true),
  machine('cooperative', '192.0.2.20', 'cooperative'),
  machine('ruche', '192.0.2.21', 'ruche'),
  machine('fournil', '192.0.2.22', 'audit'),
  machine('labo', '192.0.2.23', 'labo'),
  // Le Fournil, six mois plus tard (histoire 16) : un nouveau serveur
  // (migration pendant la croissance de l'activité), mêmes personnages.
  machine('petrin', '192.0.2.24', 'veille'),
  // Les Jardins partagés : leur serveur, avec leur nom public gardens.example (même adresse).
  machine('jardin', '203.0.113.30', 'courrier'),
  // Le poste de pilotage des maisons de quartier : Ansible, et derrière lui trois serveurs.
  machine('pilote', '192.0.2.25', 'flotte'),
  // La Rustine, l'atelier vélo : son petit serveur public (cycles.example), avec Caddy.
  machine('rustine', '203.0.113.40', 'rustine'),
];

/** Le nom d'une machine dans la langue (machines.ftl : royaume → kingdom) ; une machine sans traduction garde le sien. */
export const nomMachine = (t: Traduire, id: string) => (t.existe(`machine-${id}`) ? t(`machine-${id}`) : id);
/** Son nom complet (royaume.internal → kingdom.internal). */
export const domaineMachine = (t: Traduire, m: Machine) => `${nomMachine(t, m.nom)}.internal`;

/** Un nom d'hôte dans la langue : royaume → kingdom, royaume.internal → kingdom.internal, wiki.maison.internal → wiki.community.internal. */
export function hoteDansLaLangue(t: Traduire, n: string): string {
  const id = (x: string) => [POSTE, ...MACHINES].some((m) => m.nom === x);
  if (id(n)) return nomMachine(t, n);
  return n.replace(/(?<=^|\.)([a-z0-9-]+)(?=\.internal$)/, (x) => (id(x) ? nomMachine(t, x) : x));
}

/**
 * Les noms de machines d'un texte sauvegardé (known_hosts, ~/.ssh/config)
 * passés dans la langue de la partie : une sauvegarde faite en français
 * (royaume, royaume.internal, id_royaume) sert aussi en anglais (kingdom…).
 */
export function traduireHotes(texte: string, t: Traduire, autres: Traduire[]): string {
  let r = texte;
  for (const m of [POSTE, ...MACHINES]) {
    const voulu = nomMachine(t, m.nom);
    for (const a of autres) {
      const ancien = nomMachine(a, m.nom);
      if (ancien === voulu) continue;
      r = r.replace(new RegExp(`(?:(?<![\\w.-])|(?<=id_))${ancien}(?![\\w-])|(?<=\\.)${ancien}(?=\\.internal\\b)`, 'g'), voulu);
    }
  }
  return r;
}

export const machineDeHistoire = (histoire: string) => MACHINES.find((m) => m.histoire === histoire);
export const machineParAdresse = (adresse: string) => [POSTE, ...MACHINES].find((m) => m.adresse === adresse);

// Suite de caractères base64 tirée d'un nom (FNV-1a), toujours la même.
export function base64(graine: string, longueur: number): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let h = 0x811c9dc5;
  let s = '';
  for (let i = 0; s.length < longueur; i++) {
    h ^= graine.charCodeAt(i % graine.length) + i;
    h = Math.imul(h, 0x01000193) >>> 0;
    s += alphabet[h % 64];
  }
  return s;
}

// Une machine réinstallée a une nouvelle clé d'hôte : `generation` vient du
// chapitre joué (Chapitre.cleHote), vide pour la clé d'origine.

/** Clé publique d'hôte (ligne de known_hosts, sans le nom). */
export const cleHote = (m: Machine, generation = '') => `ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAI${base64('cle-hote-' + m.nom + generation, 43)}`;

/** Un texte de toute longueur résumé en 8 chiffres hexadécimaux (FNV-1a) : base64 ne lit que le début de sa graine. */
export function condense(texte: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < texte.length; i++) h = Math.imul(h ^ texte.charCodeAt(i), 0x01000193) >>> 0;
  return h.toString(16).padStart(8, '0');
}

/** Empreinte d'une clé publique, comme ssh l'affiche : SHA256:… (43 caractères). */
export const empreinteDeCle = (cle: string) => `SHA256:${base64(condense(cle.split(' ').slice(0, 2).join(' ')) + '-empreinte', 43)}`;

/** Empreinte de la clé d'hôte d'une machine. */
export const empreinte = (m: Machine, generation = '') => empreinteDeCle(cleHote(m, generation));

/** La clé privée qui ouvre une session sur la machine. */
export const clePrivee = (m: Machine) =>
  [
    '-----BEGIN OPENSSH PRIVATE KEY-----',
    ...base64('cle-privee-' + m.nom, 70 * 5)
      .match(/.{70}/g)!
      .map((l, i) => (i === 0 ? 'b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW' + l.slice(68) : l)),
    '-----END OPENSSH PRIVATE KEY-----',
  ].join('\n');

/** La clé publique correspondante (~/.ssh/id_<machine>.pub), commentée du compte qui l'a créée sur le poste (vous@poste, you@desk…). */
export const clePublique = (m: Machine, compte = 'vous', poste = 'poste') => `ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAI${base64('cle-publique-' + m.nom, 43)} ${compte}@${poste}`;
