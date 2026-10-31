// Histoire « Le Datacenter » — chapitre « Premier jour » : lire un journal
// de serveur avec head, tail, wc, grep, cut, sort, uniq et les tubes |,
// écrire avec > et >>, gérer les processus (ps, kill) et un service
// (systemctl), écrire dans un fichier de root avec sudo tee.
//
// Le journal suit le format « combined » de nginx, sans les deux derniers
// champs (page d'origine et navigateur). Toutes les adresses IP sont
// réservées à la documentation (RFC 5737).

import { chemin, d, f, joueur, type Chapitre, type Comptes } from '../world';
import type { Jeu } from '../shell';
import { instants } from '../activity';
import type { Processus } from '../commands/system';
import type { Traduire } from '../../texts';
import { nouveauSystemd } from '../systemd';

const M = '/home/vous';
const ROBOT = '198.51.100.77';
const BLOQUES = '/etc/nginx/blocked.conf';

// Journal d'accès déterministe : des visiteurs, puis un robot qui aspire le
// catalogue et fait tomber le service (erreurs 503).
const VISITEURS = ['192.0.2.14', '192.0.2.31', '192.0.2.58', '203.0.113.9', '203.0.113.42', '203.0.113.87', '192.0.2.120', '203.0.113.150'];
const PAGES = ['/', '/agenda', '/catalogue', '/horaires', '/catalogue/livre/1984', '/expositions', '/contact', '/catalogue/livre/beloved'];

function journal(): { texte: string; erreurs503: number; requetesRobot: number } {
  const visiteurs = VISITEURS;
  const pages = PAGES;
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
export const JOURNAL_NGINX = JOURNAL.texte;
export const ERREURS_503 = JOURNAL.erreurs503;
export const REQUETES_ROBOT = JOURNAL.requetesRobot;

// Pendant qu'on enquête, le site vit (activite.ts) : le robot continue
// d'aspirer le catalogue toutes les 2 s (503 tant que le service sature,
// 403 une fois bloqué par nginx), des visiteurs passent toutes les 7 s. Le
// journal grandit : tail -f /var/log/nginx/access.log le montre en direct.
const DEBUT_DIRECT = Date.UTC(2026, 9, 13, 18, 42, 0);
const enDirect = (j: Jeu): string[] => (j.etat.accesEnDirect ??= []) as string[];
const ligneAcces = (t: number, ip: string, page: string, statut: number, taille: number) =>
  `${ip} - - [13/Oct/2026:${new Date(t + 2 * 3_600_000).toISOString().slice(11, 19)} +0200] "GET ${page} HTTP/1.1" ${statut} ${taille}`;
const surcharge = (j: Jeu) => (j.etat.processus as Processus[]).some((p) => p.cpu > 90);
const bloque = (j: Jeu) => (j.etat.confChargee as string).includes(`deny ${ROBOT};`);

function visites(j: Jeu, de: number, a: number) {
  const robot = instants(de, a, 2).map((t) => ({ t, robot: true }));
  const humains = instants(de, a, 7).map((t) => ({ t, robot: false }));
  for (const { t, robot: estRobot } of [...robot, ...humains].sort((x, y) => x.t - y.t)) {
    const n = Math.floor(t / 1000);
    if (estRobot) {
      const statut = bloque(j) ? 403 : surcharge(j) ? 503 : 200;
      enDirect(j).push(ligneAcces(t, ROBOT, `/catalogue/recherche?q=${String.fromCharCode(97 + (n % 26))}${n % 1000}`, statut, statut === 403 ? 153 : statut === 503 ? 197 : 1200 + ((n * 7919) % 9000)));
    } else {
      const statut = surcharge(j) ? 503 : 200;
      enDirect(j).push(ligneAcces(t, VISITEURS[n % VISITEURS.length], PAGES[(n * 3) % PAGES.length], statut, statut === 503 ? 197 : 1200 + ((n * 7919) % 9000)));
    }
  }
}

// Les erreurs 503 du journal, à cet instant.
const erreurs503 = (j: Jeu) => (j.lire('/var/log/nginx/access.log') ?? '').split('\n').filter((l) => / 503 /.test(l)).length;
// Le nombre que donne le rapport : une ligne qui commence par un nombre (la sortie de wc -l).
const nombreDuRapport = (r: string) =>
  r
    .split('\n')
    .map((l) => /^\s*(\d+)(?![\d.])/.exec(l)?.[1])
    .filter((x): x is string => x !== undefined)
    .map(Number);

// Les comptes de la machine datacenter (chapitres 2 et 3), comme une Debian :
// www-data fait tourner le site, adm lit les journaux.
export const comptesDatacenter = (): Comptes => ({
  utilisateurs: {
    root: { uid: 0, groupe: 'root', maison: '/root' },
    'www-data': { uid: 33, groupe: 'www-data', maison: '/var/www', shell: '/usr/sbin/nologin' },
    nobody: { uid: 65534, groupe: 'nogroup', maison: '/nonexistent', shell: '/usr/sbin/nologin' },
    vous: { uid: 1000, groupe: 'vous' },
    awa: { uid: 1001, groupe: 'awa' },
    malo: { uid: 1002, groupe: 'malo' },
  },
  groupes: {
    root: { gid: 0, membres: [] },
    adm: { gid: 4, membres: ['vous'] },
    sudo: { gid: 27, membres: ['vous', 'awa'] },
    'www-data': { gid: 33, membres: [] },
    nogroup: { gid: 65534, membres: [] },
    vous: { gid: 1000, membres: [] },
    awa: { gid: 1001, membres: [] },
    malo: { gid: 1002, membres: [] },
    'web-team': { gid: 1003, membres: ['vous', 'awa', 'malo'] },
  },
});

const bloquesInitial = (t: Traduire) => `# ${t('premier-jour-bloques-commentaire')}
deny 203.0.113.5;
deny 192.0.2.99;`;

const catalogueStable = (): Processus => ({ pid: 4243, utilisateur: 'www-data', cpu: 1.2, mem: 2.1, commande: 'php-fpm: pool catalogue' });

export const datacenter: Chapitre = {
  id: 'premier-jour',
  numero: 1,
  commandes: ['ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'wc', 'grep', 'cut', 'sort', 'uniq', 'echo', 'tee', 'cp', 'mv', 'rm', 'ps', 'kill', 'systemctl', 'nano', 'sudo', 'whoami'],
  maison: M,
  accueil: 'courriel_awa.txt',
  noms: true,
  final: 'rapport',
  motDePasse: 'bienvenue-2026',
  activite: { pas: 5, depart: () => DEBUT_DIRECT, avancer: visites },
  // t : les textes dans la langue du jeu (français tant que le shell ne le
  // transmet pas).
  etat: (t) => ({
    processus: [
      { pid: 1, utilisateur: 'root', cpu: 0, mem: 0.1, commande: '/sbin/init' },
      { pid: 612, utilisateur: 'root', cpu: 0, mem: 0.3, commande: 'nginx: master process /usr/sbin/nginx' },
      { pid: 613, utilisateur: 'www-data', cpu: 4.8, mem: 0.6, commande: 'nginx: worker process' },
      { pid: 4242, utilisateur: 'www-data', cpu: 99.3, mem: 38.5, commande: 'php-fpm: pool catalogue' },
      { pid: 5120, utilisateur: joueur(t), cpu: 0, mem: 0.1, commande: '-bash' },
    ] satisfies Processus[],
    systemd: nouveauSystemd('datacenter', Date.UTC(2026, 9, 13, 8, 0, 0), Date.UTC(2026, 9, 13, 21, 5, 0), {
      nginx: {
        description: 'A high performance web server and a reverse proxy server',
        active: true,
        executable: 'nginx',
        processus: [
          { pid: 612, utilisateur: 'root', cpu: 0, mem: 0.3, commande: 'nginx: master process /usr/sbin/nginx' },
          { pid: 613, utilisateur: 'www-data', cpu: 4.8, mem: 0.6, commande: 'nginx: worker process' },
        ],
      },
      // Ses processus sont gérés par l'histoire (surKill).
      catalogue: { description: t('premier-jour-service-catalogue'), active: true, executable: 'php-fpm' },
    }),
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
                    'access.log': f((j) => [JOURNAL.texte, ...enDirect(j)].join('\n'), { proprio: 'root', lignes: true }),
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
                'blocked.conf': f(bloquesInitial(t), { proprio: 'root', lignes: true }),
                'blocked.conf.bak': f(bloquesInitial(t), { proprio: 'root', lignes: true }),
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
    // Coups de pouce : une piste trop longue (tout lire, compter à la main) renvoie aux notes d'Awa.
    {
      id: 'tout-lire',
      condition: (j) =>
        !j.drapeaux.has('compte') &&
        j.derniere.commandes.length === 1 &&
        ['cat', 'less', 'more'].includes(j.derniere.commandes[0][0]) &&
        j.derniere.commandes[0].some((a) => a.endsWith('access.log')),
      message: (j) => j.t('premier-jour-evenement-tout-lire'),
    },
    {
      id: 'grep-seul',
      condition: (j) => {
        const cmds = j.derniere.commandes.flat();
        return !j.drapeaux.has('compte') && cmds.includes('grep') && !cmds.includes('wc') && j.derniere.sortie.split('\n').filter((l) => / 503 /.test(l)).length >= 20;
      },
      message: (j) => j.t('premier-jour-evenement-grep-seul'),
    },
    {
      id: 'adresses-seules',
      condition: (j) => {
        const cmds = j.derniere.commandes.flat();
        return !j.drapeaux.has('robot') && cmds.includes('cut') && !cmds.includes('uniq') && j.derniere.sortie.split('\n').length >= 20;
      },
      message: (j) => j.t('premier-jour-evenement-adresses-seules'),
    },
    {
      id: 'compte',
      // Le journal grandit : le bon compte est celui du journal à cet instant.
      condition: (j) => {
        const cmds = j.derniere.commandes.flat();
        return cmds.includes('grep') && j.derniere.sortie.trim().split(/\s+/)[0] === String(erreurs503(j));
      },
      message: (j) => j.t('premier-jour-evenement-compte', { erreurs: String(erreurs503(j)) }),
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
      // Un compte pris à un moment de l'enquête : entre le journal du début et celui de maintenant.
      condition: (j) => {
        const r = j.lire(chemin(j.t, `${M}/rapport.txt`)) ?? '';
        return j.drapeaux.has('repare') && r.includes(ROBOT) && nombreDuRapport(r).some((n) => n >= ERREURS_503 && n <= erreurs503(j));
      },
      message: (j) => {
        const r = j.lire(chemin(j.t, `${M}/rapport.txt`)) ?? '';
        const n = nombreDuRapport(r).find((x) => x >= ERREURS_503 && x <= erreurs503(j)) ?? ERREURS_503;
        return j.t('premier-jour-evenement-rapport', { erreurs: String(n) });
      },
    },
  ],
};
