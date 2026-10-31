// Histoire « La Gazette » — chapitre « La migration » : hier soir, Théo a
// mis la 2.0.0 du Kiosque sur green et basculé nginx. Au démarrage, la 2.0.0
// a migré la base (schéma 3 → 4 : la colonne courriel est devenue email).
// Elle ne marche pas (une variable de configuration a changé de nom), et le
// retour arrière vers blue (1.6.1) ne marche pas non plus : la 1.6.1 ne sait
// pas lire une base migrée. Il faut réparer en avant (la configuration
// annoncée dans les notes de version), puis mettre blue en 2.0.0 pour qu'il
// redevienne un vrai filet de sécurité.
// Objectif vérifié sur l'état : nginx sert une instance 2.x en bonne santé,
// l'autre instance tourne aussi en 2.x, en bonne santé.
// Sources : https://martinfowler.com/bliki/ParallelChange.html (étendre puis
// contracter), https://www.postgresql.org/docs/current/app-pgdump.html,
// https://www.freedesktop.org/software/systemd/man/latest/journalctl.html

import { d, f, fichiersComptes, type Chapitre, type Comptes, type Droits } from '../world';
import type { Jeu } from '../shell';
import { nouveauSystemd, systemd } from '../systemd';
import { chargerNginx, requete, verifierNginx } from '../nginx';
import { MIME, NGINX_CONF } from '../commands/apt';
import { comptesGazette } from './bare-repo';
import { KIOSQUE, appliKiosque, base, dossierVersion, repartition, sante, serviceKiosque, uniteKiosque } from './kiosk';

const M = '/home/vous';
const GAZETTE = 'gazette.example';
const SITE = '/etc/nginx/sites-available/gazette';

const comptes = (): Comptes => {
  const c = comptesGazette();
  c.utilisateurs.kiosk = { uid: 997, groupe: 'kiosk', maison: KIOSQUE, shell: '/usr/sbin/nologin' };
  c.groupes.kiosk = { gid: 997, membres: [] };
  c.groupes.adm = { gid: 4, membres: ['vous'] };
  return c;
};

// Théo a basculé nginx vers green, en 2.0.0.
const conf = (t: Jeu['t']) => `server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name ${GAZETTE} www.${GAZETTE};

    root /srv/gazette/current;
    index index.html;

    location / {
        try_files $uri $uri/ =404;
    }

    # ${t('bleu-vert-conf-commentaire')}
    location /kiosk/ {
        proxy_pass http://127.0.0.1:3002/;
    }
}`;

const sd = (j: Jeu) => systemd(j)!;
const actif = (j: Jeu, couleur: string) => sd(j).services[`kiosk-${couleur}`]?.etat === 'active';
const enDeux = (j: Jeu, couleur: string) => {
  const s = sante(j, couleur);
  return s?.status === 'ok' && s.version.startsWith('2.');
};
const lecteursOk = (j: Jeu) => requete(j, GAZETTE, '/kiosk/', 80, false)?.code === 200;
const servie = (j: Jeu) => Object.entries(repartition(j)).find(([, part]) => part === 1)?.[0] ?? null;
const sortie = (j: Jeu) => [j.derniere.sortie, ...j.derniere.erreurs].join('\n');

export const migration: Chapitre = {
  id: 'migration',
  numero: 5,
  commandes: [
    'ls',
    'cd',
    'pwd',
    'cat',
    'less',
    'head',
    'tail',
    'grep',
    'diff',
    'cp',
    'mv',
    'ln',
    'readlink',
    'echo',
    'id',
    'whoami',
    'date',
    'sudo',
    'nano',
    'curl',
    'nginx',
    'systemctl',
    'journalctl',
    'ps',
  ],
  maison: M,
  accueil: 'message_de_samia.txt',
  noms: true,
  final: 'fin',
  motDePasse: 'gazette-2027',
  comptes,
  etat: () => ({
    systemd: nouveauSystemd('gazette', Date.UTC(2027, 4, 2, 6, 40, 0), Date.UTC(2027, 5, 15, 8, 30, 0), {
      ssh: {
        description: 'OpenBSD Secure Shell server',
        active: true,
        executable: 'sshd',
        processus: [{ pid: 604, utilisateur: 'root', cpu: 0, mem: 0.2, commande: 'sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups' }],
      },
      nginx: {
        description: 'A high performance web server and a reverse proxy server',
        active: true,
        executable: 'nginx',
        processus: [
          { pid: 801, utilisateur: 'root', cpu: 0, mem: 0.3, commande: 'nginx: master process /usr/sbin/nginx -g daemon on; master_process on;' },
          { pid: 802, utilisateur: 'www-data', cpu: 0.1, mem: 0.6, commande: 'nginx: worker process' },
        ],
        verifier: verifierNginx,
        charger: chargerNginx,
        verifierAuRechargement: true,
      },
      'kiosk-blue': serviceKiosque('blue', 1501),
      'kiosk-green': serviceKiosque('green', 1502),
    }),
    processus: [
      { pid: 1, utilisateur: 'root', cpu: 0, mem: 0.1, commande: '/sbin/init' },
      { pid: 604, utilisateur: 'root', cpu: 0, mem: 0.2, commande: 'sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups' },
      { pid: 801, utilisateur: 'root', cpu: 0, mem: 0.3, commande: 'nginx: master process /usr/sbin/nginx -g daemon on; master_process on;' },
      { pid: 802, utilisateur: 'www-data', cpu: 0.1, mem: 0.6, commande: 'nginx: worker process' },
      { pid: 1501, utilisateur: 'kiosk', cpu: 0.6, mem: 3.1, commande: `node ${KIOSQUE}/blue/serveur.js` },
      { pid: 1502, utilisateur: 'kiosk', cpu: 0.6, mem: 3.1, commande: `node ${KIOSQUE}/green/serveur.js` },
    ],
    nginx: { charge: null, noms: ['gazette', GAZETTE, `www.${GAZETTE}`, '192.0.2.16'] },
    applis: { '127.0.0.1:3001': appliKiosque('blue'), '127.0.0.1:3002': appliKiosque('green') },
  }),
  initialiser: (j) => {
    chargerNginx(j);
    // Hier soir, 23 h : blue tourne en 1.6.1 ; Théo démarre green en 2.0.0, qui migre la base.
    const maintenant = sd(j).horloge;
    sd(j).horloge = Date.UTC(2027, 5, 14, 23, 4, 0);
    base(j).schema = 3;
    sd(j).services['kiosk-blue'].charger!(j);
    sd(j).services['kiosk-green'].charger!(j);
    sd(j).horloge = maintenant;
  },
  creerMonde: (t) => {
    const racine: Droits = { proprio: 'root' };
    const lieu = (enfants: Parameters<typeof d>[0], droits: Droits = racine) => d(enfants, undefined, droits);
    const fichier = (texte: string, droits: Droits = racine) => f(texte, { lignes: true, ...droits });
    const kiosk: Droits = { proprio: 'kiosk', groupe: 'kiosk' };
    return lieu({
      etc: lieu({
        ...fichiersComptes(),
        hostname: fichier('gazette'),
        kiosk: lieu({
          'kiosk.env': fichier(
            'KIOSK_BASE=postgres://kiosk@localhost/kiosk\nKIOSK_LIST=lettre@gazette.example\nKIOSK_SMTP=smtp.gazette.example',
            { proprio: 'root', groupe: 'kiosk', mode: 'rw-r-----' },
          ),
        }),
        nginx: lieu({
          'nginx.conf': fichier(NGINX_CONF),
          'mime.types': fichier(MIME),
          'conf.d': lieu({}),
          'modules-enabled': lieu({}),
          'sites-available': lieu({ gazette: fichier(conf(t)) }),
          'sites-enabled': lieu({ gazette: f('', { proprio: 'root', lien: SITE }) }),
        }),
        systemd: lieu({
          system: lieu({ 'kiosk-blue.service': fichier(uniteKiosque('blue')), 'kiosk-green.service': fichier(uniteKiosque('green')) }),
        }),
      }),
      home: lieu({
        vous: d({ 'message_de_samia.txt': f(t('migration-message-de-samia')), 'mot_de_theo.txt': f(t('migration-mot-de-theo')) }),
        samia: lieu({}, { proprio: 'samia', mode: 'rwx------' }),
        theo: lieu({}, { proprio: 'theo', mode: 'rwx------' }),
      }),
      srv: lieu({
        gazette: lieu({
          releases: lieu({ '20270524090000': lieu({ 'index.html': fichier(t('retour-arriere-site-accueil'), { proprio: 'vous' }) }) }),
          current: f('', { proprio: 'vous', lien: '/srv/gazette/releases/20270524090000' }),
        }),
        kiosk: lieu(
          {
            versions: lieu(
              {
                '1.4.2': dossierVersion(t, '1.4.2'),
                '1.5.0': dossierVersion(t, '1.5.0', 'bleu-vert-notes-150'),
                '1.6.0': dossierVersion(t, '1.6.0', 'canari-notes-160'),
                '1.6.1': dossierVersion(t, '1.6.1', 'canari-notes-161'),
                '2.0.0': dossierVersion(t, '2.0.0', 'migration-notes-200'),
              },
              kiosk,
            ),
            blue: f('', { ...kiosk, lien: `${KIOSQUE}/versions/1.6.1` }),
            green: f('', { ...kiosk, lien: `${KIOSQUE}/versions/2.0.0` }),
          },
          { ...kiosk, groupe: 'redaction', mode: 'rwxrwxr-x' },
        ),
      }),
      usr: lieu({ sbin: lieu({ nginx: f('', { proprio: 'root', mode: 'rwxr-xr-x', taille: 1_342_520 }) }) }),
      var: lieu({
        log: lieu({
          nginx: lieu(
            {
              'access.log': f('', { lignes: true, proprio: 'www-data', groupe: 'adm', mode: 'rw-r-----' }),
              'error.log': f('', { lignes: true, proprio: 'www-data', groupe: 'adm', mode: 'rw-r-----' }),
            },
            { proprio: 'root', groupe: 'adm' },
          ),
        }),
      }),
    });
  },
  evenements: [
    {
      id: 'vert-malade',
      condition: (j) => sortie(j).includes('KIOSK_SMTP_URL is not set'),
      message: (j) => j.t('migration-evenement-vert-malade'),
    },
    { id: 'schema', condition: (j) => sortie(j).includes('is newer than supported'), message: (j) => j.t('migration-evenement-schema') },
    {
      id: 'migration-vue',
      condition: (j) => sortie(j).includes('rename_abonnes_courriel_to_email'),
      message: (j) => j.t('migration-evenement-migration-vue'),
    },
    {
      id: 'retour-impossible',
      condition: (j) => servie(j) === 'blue' && !enDeux(j, 'blue') && !lecteursOk(j),
      message: (j) => j.t('migration-evenement-retour-impossible'),
    },
    {
      id: 'repare',
      condition: (j) => {
        const c = servie(j);
        return !!c && enDeux(j, c) && lecteursOk(j);
      },
      message: (j) => j.t('migration-evenement-repare'),
    },
    {
      id: 'fin',
      condition: (j) => {
        const c = servie(j);
        const autre = c === 'blue' ? 'green' : 'blue';
        return !!c && enDeux(j, c) && lecteursOk(j) && actif(j, autre) && enDeux(j, autre);
      },
      message: (j) => j.t('migration-evenement-fin'),
    },
  ],
};
