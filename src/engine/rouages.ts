// The links to Les rouages du net (https://rouages.net), the popular-science
// site the game comes from: after a chapter, the module or glossary word
// that explains what happens under the hood (DNS, TLS, NAT…).
// The addresses target stable anchors of the site (the modules' steps, the
// glossary's entries); the links' texts are in interface.ftl
// (rouages-lien-<id>).

export const ROUAGES = 'https://rouages.net';

/** The pages of rouages.net, by identifier. */
export const ROUAGES_PAGES: Record<string, string> = {
  'entree-nom': '/modules/entree-a-la-page/#nom',
  'entree-box': '/modules/entree-a-la-page/#box',
  'entree-liaison': '/modules/entree-a-la-page/#liaison',
  'entree-cadenas': '/modules/entree-a-la-page/#cadenas',
  'entree-voyage': '/modules/entree-a-la-page/#journey',
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

/** For each chapter, the pages that explain its concept. */
export const ROUAGES_LINKS: Record<string, string[]> = {
  'root': ['ordinateur-binaire'],
  'first-day': ['glossaire-datacenter'],
  'fire': ['glossaire-datacenter'],
  'certificate': ['entree-cadenas', 'glossaire-autorite-certification'],
  'lost-packet': ['entree-nom', 'entree-voyage', 'entree-liaison'],
  archives: ['glossaire-octet'],
  'firewall': ['entree-liaison', 'glossaire-port'],
  'sharing': ['entree-serveur', 'glossaire-hebergeur'],
  'works-for-me': ['entree-nom', 'glossaire-ttl'],
  concert: ['glossaire-code-http'],
  port: ['glossaire-port'],
  'canary': ['glossaire-code-http'],
  'memory': ['ordinateur-memoire'],
  'keys': ['glossaire-chiffrement'],
  'web-host': ['entree-cadenas', 'glossaire-hebergeur'],
  proxy: ['entree-serveur', 'glossaire-requete'],
  vlan: ['glossaire-commutateur'],
  dhcp: ['entree-box'],
  zones: ['entree-box', 'glossaire-nat', 'glossaire-routeur'],
  'remote-work': ['glossaire-chiffrement', 'glossaire-routeur'],
  dmz: ['glossaire-nat'],
  'annex': ['glossaire-routeur'],
  'exposure': ['glossaire-port'],
  traces: ['glossaire-chiffrement'],
  'scope': ['glossaire-port'],
  'follow-up': ['glossaire-port'],
};

/** A chapter's links: full address and identifier (for its text). */
export const rouagesLinks = (chapter: string) => (ROUAGES_LINKS[chapter] ?? []).map((id) => ({ id, address: `${ROUAGES}${ROUAGES_PAGES[id]}` }));
