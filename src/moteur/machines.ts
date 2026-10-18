// Le réseau simulé : le poste de la joueuse ou du joueur, et une machine par
// histoire. Adresses de documentation (RFC 5737), domaine réservé aux
// exemples (RFC 6761). Les clés SSH et les empreintes sont fausses mais ont
// la forme des vraies (ed25519), et ne changent jamais : le jeu reste
// déterministe.

export interface Machine {
  nom: string;
  // Nom complet, résolu par /etc/hosts du poste.
  domaine: string;
  adresse: string;
  // Histoire jouée sur cette machine (absent pour le poste).
  histoire?: string;
}

const machine = (nom: string, adresse: string, histoire?: string): Machine => ({ nom, domaine: `${nom}.example`, adresse, histoire });

export const POSTE = machine('poste', '192.0.2.2');

export const MACHINES: Machine[] = [
  machine('royaume', '192.0.2.10', 'effaceur'),
  machine('datacenter', '192.0.2.11', 'datacenter'),
  machine('fourmiliere', '192.0.2.12', 'paquet'),
  machine('manuscrit', '192.0.2.13', 'temps'),
  machine('bibliotheque', '192.0.2.14', 'archives'),
  // Le serveur des Lettres du quartier : la même adresse que lettres.example
  // dans Le Paquet perdu.
  machine('lettres', '203.0.113.10', 'lettres'),
  machine('fabrique', '192.0.2.15', 'fabrique'),
];

export const machineDeHistoire = (histoire: string) => MACHINES.find((m) => m.histoire === histoire);
export const machineParAdresse = (adresse: string) => [POSTE, ...MACHINES].find((m) => m.adresse === adresse);

// Suite de caractères base64 tirée d'un nom (FNV-1a), toujours la même.
function base64(graine: string, longueur: number): string {
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

/** Empreinte d'une clé publique, comme ssh l'affiche : SHA256:… (43 caractères). */
export const empreinteDeCle = (cle: string) => `SHA256:${base64('empreinte-' + cle.split(' ').slice(0, 2).join(' '), 43)}`;

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

/** La clé publique correspondante (~/.ssh/id_<machine>.pub). */
export const clePublique = (m: Machine) => `ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAI${base64('cle-publique-' + m.nom, 43)} vous@poste`;
