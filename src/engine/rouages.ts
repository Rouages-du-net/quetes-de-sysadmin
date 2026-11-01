// Les liens vers Les rouages du net (https://rouages.net), le site de
// vulgarisation d'où vient le jeu : après un chapitre, le module ou le mot du
// glossaire qui explique ce qui se passe sous le capot (DNS, TLS, NAT…).
// Les adresses visent des ancres stables du site (les étapes des modules,
// les entrées du glossaire) ; les textes des liens sont dans interface.ftl
// (rouages-lien-<id>).

export const ROUAGES = 'https://rouages.net';

/** Les pages de rouages.net, par identifiant. */
export const ROUAGES_PAGES: Record<string, string> = {
  'entree-nom': '/modules/entree-a-la-page/#nom',
  'entree-box': '/modules/entree-a-la-page/#box',
  'entree-liaison': '/modules/entree-a-la-page/#liaison',
  'entree-cadenas': '/modules/entree-a-la-page/#cadenas',
  'entree-voyage': '/modules/entree-a-la-page/#voyage',
  'entree-serveur': '/modules/entree-a-la-page/#serveur',
  'ordinateur-binaire': '/modules/ordinateur/#binaire',
  'ordinateur-memoire': '/modules/ordinateur/#memoire',
  'glossaire-ttl': '/glossaire/#ttl',
  'glossaire-port': '/glossaire/#port',
  'glossaire-nat': '/glossaire/#nat',
  'glossaire-routeur': '/glossaire/#routeur',
  'glossaire-commutateur': '/glossaire/#commutateur',
  'glossaire-hebergeur': '/glossaire/#hebergeur',
  'glossaire-chiffrement': '/glossaire/#chiffrement',
  'glossaire-autorite-certification': '/glossaire/#autorite-certification',
  'glossaire-code-http': '/glossaire/#code-http',
  'glossaire-requete': '/glossaire/#requete',
  'glossaire-datacenter': '/glossaire/#datacenter',
  'glossaire-octet': '/glossaire/#octet',
};

/** Pour chaque chapitre, les pages qui expliquent son concept. */
export const ROUAGES_LINKS: Record<string, string[]> = {
  racine: ['ordinateur-binaire'],
  'premier-jour': ['glossaire-datacenter'],
  incendie: ['glossaire-datacenter'],
  certificat: ['entree-cadenas', 'glossaire-autorite-certification'],
  'paquet-perdu': ['entree-nom', 'entree-voyage', 'entree-liaison'],
  archives: ['glossaire-octet'],
  'pare-feu': ['entree-liaison', 'glossaire-port'],
  colocation: ['entree-serveur', 'glossaire-hebergeur'],
  'chez-moi': ['entree-nom', 'glossaire-ttl'],
  concert: ['glossaire-code-http'],
  port: ['glossaire-port'],
  canari: ['glossaire-code-http'],
  memoire: ['ordinateur-memoire'],
  cles: ['glossaire-chiffrement'],
  hebergeur: ['entree-cadenas', 'glossaire-hebergeur'],
  proxy: ['entree-serveur', 'glossaire-requete'],
  vlan: ['glossaire-commutateur'],
  dhcp: ['entree-box'],
  zones: ['entree-box', 'glossaire-nat', 'glossaire-routeur'],
  vpn: ['glossaire-chiffrement', 'glossaire-routeur'],
  dmz: ['glossaire-nat'],
  annexe: ['glossaire-routeur'],
  exposition: ['glossaire-port'],
  traces: ['glossaire-chiffrement'],
  perimetre: ['glossaire-port'],
  'contre-visite': ['glossaire-port'],
};

/** Les liens d'un chapitre : adresse complète et identifiant (pour son texte). */
export const rouagesLinks = (chapter: string) => (ROUAGES_LINKS[chapter] ?? []).map((id) => ({ id, address: `${ROUAGES}${ROUAGES_PAGES[id]}` }));
