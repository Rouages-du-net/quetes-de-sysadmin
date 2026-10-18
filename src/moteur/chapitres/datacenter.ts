// Histoire « Le Datacenter » — chapitre « Premier jour » : lire un journal
// de serveur avec head, tail, wc, grep, cut, sort, uniq et les tubes |,
// écrire avec > et >>, gérer les processus (ps, kill) et un service
// (systemctl), écrire dans un fichier de root avec sudo tee.
//
// Le journal suit le format « combined » de nginx, sans les deux derniers
// champs (page d'origine et navigateur). Toutes les adresses IP sont
// réservées à la documentation (RFC 5737).

import { d, f, type Chapitre } from '../monde';
import type { Processus } from '../commandes/systeme';
import type { Traduire } from '../../textes';

const M = '/home/vous';
const ROBOT = '198.51.100.77';
const BLOQUES = '/etc/nginx/bloques.conf';

// Journal d'accès déterministe : des visiteurs, puis un robot qui aspire le
// catalogue et fait tomber le service (erreurs 503).
function journal(): { texte: string; erreurs503: number; requetesRobot: number } {
  const visiteurs = ['192.0.2.14', '192.0.2.31', '192.0.2.58', '203.0.113.9', '203.0.113.42', '203.0.113.87', '192.0.2.120', '203.0.113.150'];
  const pages = ['/', '/agenda', '/catalogue', '/horaires', '/catalogue/livre/1984', '/expositions', '/contact', '/catalogue/livre/beloved'];
  let graine = 42;
  const hasard = () => (graine = (graine * 1103515245 + 12345) % 2147483648) / 2147483648;
  const lignes: string[] = [];
  let e503 = 0;
  let robot = 0;
  for (let i = 0; i < 360; i++) {
    const s = 20 * 3600 + i * 7;
    const heure = `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
    const estRobot = i >= 120 && hasard() < 0.7;
    const ip = estRobot ? ROBOT : visiteurs[Math.floor(hasard() * visiteurs.length)];
    const page = estRobot ? `/catalogue/recherche?q=${String.fromCharCode(97 + (i % 26))}${i}` : pages[Math.floor(hasard() * pages.length)];
    const surcharge = i >= 210 && hasard() < 0.75;
    const statut = surcharge ? 503 : 200;
    if (statut === 503) e503++;
    if (estRobot) robot++;
    const taille = statut === 503 ? 197 : 1200 + Math.floor(hasard() * 9000);
    lignes.push(`${ip} - - [13/Oct/2026:${heure} +0200] "GET ${page} HTTP/1.1" ${statut} ${taille}`);
  }
  return { texte: lignes.join('\n'), erreurs503: e503, requetesRobot: robot };
}

const JOURNAL = journal();
export const ERREURS_503 = JOURNAL.erreurs503;
export const REQUETES_ROBOT = JOURNAL.requetesRobot;

const bloquesInitial = (t: Traduire) => `# ${t('premier-jour-bloques-commentaire')}
deny 203.0.113.5;
deny 192.0.2.99;`;

const catalogueStable = (): Processus => ({ pid: 4243, utilisateur: 'www-data', cpu: 1.2, mem: 2.1, commande: 'php-fpm: pool catalogue' });

export const datacenter: Chapitre = {
  id: 'premier-jour',
  numero: 1,
  commandes: ['ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'wc', 'grep', 'cut', 'sort', 'uniq', 'echo', 'tee', 'cp', 'mv', 'rm', 'ps', 'kill', 'systemctl', 'sudo', 'whoami'],
  maison: M,
  accueil: 'courriel_awa.txt',
  final: 'rapport',
  motDePasse: 'bienvenue-2026',
  // t : les textes dans la langue du jeu (français tant que le shell ne le
  // transmet pas).
  etat: (t) => ({
    processus: [
      { pid: 1, utilisateur: 'root', cpu: 0, mem: 0.1, commande: '/sbin/init' },
      { pid: 612, utilisateur: 'root', cpu: 0, mem: 0.3, commande: 'nginx: master process /usr/sbin/nginx' },
      { pid: 613, utilisateur: 'www-data', cpu: 4.8, mem: 0.6, commande: 'nginx: worker process' },
      { pid: 4242, utilisateur: 'www-data', cpu: 99.3, mem: 38.5, commande: 'php-fpm: pool catalogue' },
      { pid: 5120, utilisateur: 'vous', cpu: 0, mem: 0.1, commande: '-bash' },
    ] satisfies Processus[],
    services: {
      nginx: { description: 'A high performance web server and a reverse proxy server', actif: true },
      catalogue: { description: t('premier-jour-service-catalogue'), actif: true },
    },
    // Configuration que nginx a réellement chargée (il ne relit le fichier
    // qu'au reload ou au restart).
    confChargee: bloquesInitial(t),
    surSystemctl: (jeu: any, action: string, nom: string) => {
      if (nom !== 'nginx' || action === 'stop') return '';
      jeu.etat.confChargee = jeu.lire(BLOQUES) ?? '';
      return '';
    },
    surKill: (jeu: any, p: Processus) => {
      if (p.commande !== 'php-fpm: pool catalogue') return '';
      // systemd relance automatiquement le service (Restart=always).
      const bloque = jeu.etat.confChargee.includes(`deny ${ROBOT};`);
      const nouveau = bloque ? catalogueStable() : { ...catalogueStable(), pid: p.pid + 2, cpu: 99.1, mem: 37.9 };
      jeu.etat.processus.push(nouveau);
      return jeu.t(bloque ? 'premier-jour-relance-calme' : 'premier-jour-relance-robot', { pid: String(nouveau.pid) });
    },
  }),
  creerMonde: (t) =>
    d(
      {
        home: d(
          {
            vous: d({
              'courriel_awa.txt': f(t('premier-jour-courriel-awa')),
              'notes_awa.txt': f(t('premier-jour-notes-awa')),
            }),
          },
          undefined,
          { proprio: 'root' },
        ),
        var: d(
          {
            log: d(
              {
                nginx: d(
                  {
                    'access.log': f(JOURNAL.texte, { proprio: 'root', lignes: true }),
                  },
                  undefined,
                  { proprio: 'root' },
                ),
              },
              undefined,
              { proprio: 'root' },
            ),
          },
          undefined,
          { proprio: 'root' },
        ),
        etc: d(
          {
            nginx: d(
              {
                'bloques.conf': f(bloquesInitial(t), { proprio: 'root', lignes: true }),
                'bloques.conf.bak': f(bloquesInitial(t), { proprio: 'root', lignes: true }),
              },
              undefined,
              { proprio: 'root' },
            ),
          },
          undefined,
          { proprio: 'root' },
        ),
      },
      undefined,
      { proprio: 'root' },
    ),
  evenements: [
    {
      id: 'compte',
      condition: (j) => {
        const cmds = j.derniere.commandes.flat();
        return cmds.includes('grep') && j.derniere.sortie.trim().split(/\s+/)[0] === String(ERREURS_503);
      },
      message: (j) => j.t('premier-jour-evenement-compte', { erreurs: String(ERREURS_503) }),
    },
    {
      id: 'robot',
      condition: (j) => j.derniere.commandes.flat().includes('uniq') && j.derniere.sortie.includes(ROBOT),
      message: (j) => j.t('premier-jour-evenement-robot', { robot: ROBOT, requetes: String(REQUETES_ROBOT) }),
    },
    {
      id: 'surcharge',
      condition: (j) => j.derniere.commandes[0]?.[0] === 'ps' && j.derniere.sortie.includes('99.3'),
      message: (j) => j.t('premier-jour-evenement-surcharge', { robot: ROBOT, bloques: BLOQUES }),
    },
    {
      id: 'ecrase',
      condition: (j) => !(j.lire(BLOQUES) ?? '').includes('deny 203.0.113.5;'),
      message: (j) => j.t('premier-jour-evenement-ecrase', { bloques: BLOQUES }),
    },
    {
      id: 'regle',
      condition: (j) => (j.lire(BLOQUES) ?? '').includes(`deny ${ROBOT};`),
      message: (j) => j.t('premier-jour-evenement-regle'),
    },
    {
      id: 'bloque',
      condition: (j) => j.etat.confChargee.includes(`deny ${ROBOT};`),
      message: (j) => {
        const p = (j.etat.processus as Processus[]).find((q) => q.cpu > 90);
        return p
          ? j.t('premier-jour-evenement-bloque-processus', { robot: ROBOT, pid: String(p.pid) })
          : j.t('premier-jour-evenement-bloque', { robot: ROBOT });
      },
    },
    {
      id: 'repare',
      condition: (j) =>
        j.drapeaux.has('bloque') && !(j.etat.processus as Processus[]).some((p) => p.cpu > 90),
      message: (j) => j.t('premier-jour-evenement-repare', { robot: ROBOT }),
    },
    {
      id: 'rapport',
      condition: (j) => {
        const r = j.lire(`${M}/rapport.txt`) ?? '';
        return j.drapeaux.has('repare') && r.includes(String(ERREURS_503)) && r.includes(ROBOT);
      },
      message: (j) => j.t('premier-jour-evenement-rapport', { erreurs: String(ERREURS_503) }),
    },
  ],
};
