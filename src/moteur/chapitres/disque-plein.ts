// Histoire « L'Astreinte » — chapitre « Le disque plein » : une nuit
// d'astreinte pour Radio Quartier. Le disque du serveur est plein : le relais
// du flux (radio-flux) écrit son journal en mode debug depuis trois jours
// (16 Go). Effacer le fichier ne rend rien : le programme le tient ouvert
// (df plein, du ne le voit plus, lsof +L1 le montre). On vide le fichier
// (truncate) ou on redémarre, on remet le niveau de journal normal, et on
// confie le journal à logrotate pour que ça ne recommence pas.
// Objectif vérifié sur l'état : le disque est sous 80 %, aucun fichier
// effacé n'est encore tenu ouvert, le relais tourne sans debug, et une
// configuration logrotate valable couvre son journal (et sait le faire
// rouvrir : copytruncate, ou un postrotate qui recharge le relais).
// Sources : https://man7.org/linux/man-pages/man8/logrotate.8.html,
// https://man7.org/linux/man-pages/man8/lsof.8.html,
// https://www.gnu.org/software/coreutils/manual/html_node/truncate-invocation.html

import { d, f, fichiersComptes, type Chapitre, type Comptes, type Droits } from '../monde';
import type { Jeu, Shell } from '../shell';
import { nouveauSystemd, systemd } from '../systemd';
import { efface, ouverts, ouvrir, placeFantome, tenu } from '../ouverts';

const M = '/home/vous';
const CONF = '/etc/radio/flux.conf';
const JOURNAL = '/var/log/radio/flux.log';
const ROTATION = '/etc/logrotate.d/radio';
const Go = 1_000_000_000;
const DISQUE = 20 * Go;

const comptes = (): Comptes => ({
  utilisateurs: {
    root: { uid: 0, groupe: 'root', maison: '/root' },
    radio: { uid: 996, groupe: 'radio', maison: '/var/lib/radio', shell: '/usr/sbin/nologin' },
    vous: { uid: 1000, groupe: 'vous' },
    zoe: { uid: 1001, groupe: 'zoe' },
  },
  groupes: {
    root: { gid: 0, membres: [] },
    adm: { gid: 4, membres: ['vous', 'zoe'] },
    sudo: { gid: 27, membres: ['vous', 'zoe'] },
    radio: { gid: 996, membres: [] },
    vous: { gid: 1000, membres: [] },
    zoe: { gid: 1001, membres: [] },
  },
});

// Le niveau de journal du relais, lu dans sa configuration (au démarrage).
const niveauConfig = (j: Jeu) => /^\s*loglevel\s*=\s*(\w+)/m.exec(j.lire(CONF) ?? '')?.[1] ?? 'info';

const sd = (j: Jeu) => systemd(j)!;
const shell = (j: Jeu) => j as Shell;
const occupation = (j: Jeu) => Math.min(1, (shell(j).taille(j.trouver('/')!) + placeFantome(j, '/')) / DISQUE);
const fantome = (j: Jeu) => ouverts(j).some((o) => tenu(j, o) && efface(j, o));
const actif = (j: Jeu) => sd(j).services['radio-flux']?.etat === 'active';

// La configuration logrotate du relais est-elle bonne ?
function rotationValable(j: Jeu): boolean {
  const texte = j.lire(ROTATION);
  if (!texte) return false;
  const jeu = shell(j);
  const avant = jeu.qui;
  jeu.qui = 'root';
  // logrotate -d ne touche à rien : s'il ne dit aucune erreur, la configuration se lit.
  const r = jeu.sousCommande(`logrotate -d ${ROTATION}`, '/');
  jeu.qui = avant;
  const bloc = /([^\n{]*)\{([^}]*)\}/.exec(texte);
  if (!r.ok || !bloc) return false;
  const motifs = bloc[1].trim().split(/\s+/);
  const couvre = motifs.some((m) => m === JOURNAL || (m.startsWith('/var/log/radio/') && /\*/.test(m)));
  const dedans = bloc[2];
  const garde = /^\s*rotate\s+\d+/m.test(dedans) && /^\s*(daily|weekly|monthly|size\s+\S+|maxsize\s+\S+)\s*$/m.test(dedans);
  const rouvre =
    /^\s*copytruncate\s*$/m.test(dedans) || /postrotate[\s\S]*systemctl\s+(reload|restart|kill)[\s\S]*radio-flux[\s\S]*endscript/.test(dedans);
  return couvre && garde && rouvre;
}

export const disquePlein: Chapitre = {
  id: 'disque-plein',
  numero: 1,
  commandes: [
    'ls',
    'cd',
    'pwd',
    'cat',
    'less',
    'head',
    'tail',
    'grep',
    'wc',
    'find',
    'du',
    'df',
    'cp',
    'mv',
    'rm',
    'mkdir',
    'touch',
    'echo',
    'id',
    'whoami',
    'ps',
    'sudo',
    'nano',
    'systemctl',
    'journalctl',
    'lsof',
    'truncate',
    'logrotate',
  ],
  maison: M,
  accueil: 'message_de_zoe.txt',
  final: 'fin',
  motDePasse: 'antenne-2027',
  comptes,
  etat: () => ({
    systemd: nouveauSystemd('radio', Date.UTC(2027, 7, 1, 6, 0, 0), Date.UTC(2027, 7, 15, 2, 47, 0), {
      ssh: {
        description: 'OpenBSD Secure Shell server',
        active: true,
        executable: 'sshd',
        processus: [{ pid: 598, utilisateur: 'root', cpu: 0, mem: 0.2, commande: 'sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups' }],
      },
      'radio-flux': {
        description: 'Radio Quartier stream relay',
        active: true,
        executable: 'flux',
        processus: [{ pid: 1730, utilisateur: 'radio', cpu: 3.2, mem: 1.1, commande: `/usr/local/bin/flux --config ${CONF}` }],
        // Au démarrage (et au rechargement), le relais relit sa configuration et rouvre son journal.
        charger: (j) => {
          j.etat.fluxNiveau = niveauConfig(j);
          ouvrir(j, { service: 'radio-flux', pid: 1730, utilisateur: 'radio', commande: 'flux', fd: 3, chemin: JOURNAL }, 'radio', 'adm');
        },
      },
      cron: { description: 'Regular background program processing daemon', active: true, executable: 'cron' },
    }),
    processus: [
      { pid: 1, utilisateur: 'root', cpu: 0, mem: 0.1, commande: '/sbin/init' },
      { pid: 598, utilisateur: 'root', cpu: 0, mem: 0.2, commande: 'sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups' },
      { pid: 1730, utilisateur: 'radio', cpu: 3.2, mem: 1.1, commande: `/usr/local/bin/flux --config ${CONF}` },
    ],
    montages: [{ chemin: '/', capacite: DISQUE, nom: '/dev/vda1', systeme: 'ext4' }],
  }),
  initialiser: (j) => sd(j).services['radio-flux'].charger!(j),
  // Le relais écrit : en debug, le journal enfle à chaque instant.
  apresCommande: (j) => {
    if (!actif(j)) return;
    const o = ouverts(j).find((x) => x.service === 'radio-flux');
    if (!o) return;
    const libre = DISQUE - occupation(j) * DISQUE;
    const ajout = Math.min(Math.max(0, libre), j.etat.fluxNiveau === 'debug' ? 400_000_000 : 40_000);
    o.noeud.taille = (o.noeud.taille ?? 0) + ajout;
  },
  creerMonde: (t) => {
    const racine: Droits = { proprio: 'root' };
    const lieu = (enfants: Parameters<typeof d>[0], droits: Droits = racine) => d(enfants, undefined, droits);
    const fichier = (texte: string, droits: Droits = racine) => f(texte, { lignes: true, ...droits });
    const journal = (texte: string, taille: number, proprio = 'root') =>
      f(texte, { lignes: true, proprio, groupe: 'adm', mode: 'rw-r-----', taille });
    return lieu({
      etc: lieu({
        ...fichiersComptes(),
        hostname: fichier('radio'),
        radio: lieu({ 'flux.conf': fichier(t('disque-plein-conf-flux')) }),
        'logrotate.conf': fichier(t('disque-plein-logrotate-conf')),
        'logrotate.d': lieu({ rsyslog: fichier(t('disque-plein-logrotate-rsyslog')), apt: fichier(t('disque-plein-logrotate-apt')) }),
      }),
      home: lieu({ vous: d({ 'message_de_zoe.txt': f(t('disque-plein-message-de-zoe')) }), zoe: lieu({}, { proprio: 'zoe', mode: 'rwx------' }) }),
      srv: lieu({
        radio: lieu({
          emissions: lieu(
            { 'matinale-2027-08-14.ogg': f(t('archives-son-ogg'), { lignes: true, proprio: 'radio', taille: 92_000_000 }) },
            { proprio: 'radio' },
          ),
        }),
      }),
      tmp: lieu({}, { proprio: 'root', mode: 'rwxrwxrwt' }),
      usr: lieu({
        lib: f('', { proprio: 'root', taille: 3_200_000_000 }),
        local: lieu({ bin: lieu({ flux: f('', { proprio: 'root', mode: 'rwxr-xr-x', taille: 8_400_000 }) }) }),
      }),
      var: lieu({
        lib: lieu({ radio: lieu({}, { proprio: 'radio' }), logrotate: lieu({ status: fichier('logrotate state -- version 2') }) }),
        log: lieu({
          syslog: journal(t('disque-plein-syslog'), 41_000_000),
          'syslog.1': journal('', 38_000_000),
          'syslog.2.gz': journal('', 4_100_000),
          'auth.log': journal('', 2_300_000),
          radio: lieu(
            { 'flux.log': journal(t('disque-plein-flux-log'), 16_640_000_000, 'radio') },
            { proprio: 'radio', groupe: 'adm', mode: 'rwxr-x---' },
          ),
        }),
      }),
    });
  },
  evenements: [
    {
      id: 'plein',
      condition: (j) => j.derniere.commandes.some((c) => c[0] === 'df') && occupation(j) > 0.97,
      message: (j) => j.t('disque-plein-evenement-plein'),
    },
    {
      id: 'coupable',
      condition: (j) =>
        j.derniere.commandes.some((c) => ['du', 'ls', 'find'].includes(c[0])) &&
        /\b1[5-9]G\b|flux\.log/.test(j.derniere.sortie) &&
        /radio/.test(j.derniere.ligne),
      message: (j) => j.t('disque-plein-evenement-coupable'),
    },
    { id: 'debug', condition: (j) => j.derniere.sortie.includes('DEBUG'), message: (j) => j.t('disque-plein-evenement-debug') },
    {
      id: 'fantome',
      condition: (j) => fantome(j) && j.derniere.commandes.some((c) => c[0] === 'df' || c[0] === 'du'),
      message: (j) => j.t('disque-plein-evenement-fantome'),
    },
    {
      id: 'renomme',
      condition: (j) => ouverts(j).some((o) => tenu(j, o) && o.service === 'radio-flux' && o.chemin !== JOURNAL),
      message: (j) => j.t('disque-plein-evenement-renomme'),
    },
    {
      id: 'respire',
      condition: (j) => occupation(j) < 0.8 && !fantome(j),
      message: (j) => j.t('disque-plein-evenement-respire', { pourcent: Math.round(occupation(j) * 100) }),
    },
    {
      id: 'fin',
      condition: (j) => occupation(j) < 0.8 && !fantome(j) && actif(j) && j.etat.fluxNiveau !== 'debug' && rotationValable(j),
      message: (j) => j.t('disque-plein-evenement-fin'),
    },
  ],
};
