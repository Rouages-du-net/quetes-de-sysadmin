// Histoire « La Gazette » — chapitre « Le canari » : la 1.6.0 du Kiosque
// change beaucoup de choses ; cette fois, pas de bascule d'un coup. On
// l'installe sur blue (green sert la 1.5.0), puis un upstream nginx envoie
// une visite sur dix à blue (weight). Après une heure de lecteur·rices
// (simulée à chaque rechargement de nginx), access.log montre des 500 sur
// /kiosk/archives : un bogue que /health ne voit pas. On arrête le
// canari ; les développeur·ses publient la 1.6.1 ; nouveau canari, sans
// erreur ; puis tout le trafic va à blue, green restant allumé.
// Objectif vérifié sur l'état : nginx envoie tout /kiosk/ à une instance
// en 1.6.1 en bonne santé, après un canari de la 1.6.1 sans erreur, et
// l'autre instance tourne toujours.
// Sources : https://nginx.org/en/docs/http/ngx_http_upstream_module.html,
// https://martinfowler.com/bliki/CanaryRelease.html,
// https://sre.google/workbook/canarying-releases/

import { d, f, fichiersComptes, type Chapitre, type Comptes, type Droits } from '../monde';
import type { Jeu } from '../shell';
import { nouveauSystemd, systemd } from '../systemd';
import { chargerNginx, requete, verifierNginx } from '../nginx';
import { MIME, NGINX_CONF } from '../commandes/apt';
import { comptesGazette } from './depot-nu';
import { KIOSQUE, appliKiosque, dossierVersion, lecteurs, repartition, sante, serviceKiosque, uniteKiosque, type Lot } from './kiosque';

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

// La configuration de la fin du chapitre 3 : green sert le Kiosque.
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
const dernierLot = (j: Jeu): Lot | undefined => j.etat.dernierLot;
const sortie = (j: Jeu) => [j.derniere.sortie, ...j.derniere.erreurs].join('\n');

export const canari: Chapitre = {
  id: 'canari',
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
    'awk',
    'sort',
    'uniq',
    'wc',
    'cut',
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
    systemd: nouveauSystemd('gazette', Date.UTC(2027, 4, 2, 6, 40, 0), Date.UTC(2027, 5, 7, 9, 0, 0), {
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
    nginx: { charge: null, noms: ['gazette', GAZETTE, `www.${GAZETTE}`, '192.0.2.16'], journalAcces: true },
    applis: { '127.0.0.1:3001': appliKiosque('blue'), '127.0.0.1:3002': appliKiosque('green') },
  }),
  initialiser: (j) => {
    chargerNginx(j);
    sd(j).services['kiosk-blue'].charger!(j);
    sd(j).services['kiosk-green'].charger!(j);
    j.etat.configVue = JSON.stringify(j.etat.nginx.charge);
  },
  // À chaque nouvelle configuration de nginx, une heure de lecteur·rices passe.
  apresCommande: (j) => {
    const vue = JSON.stringify(j.etat.nginx.charge);
    if (vue === j.etat.configVue) return;
    j.etat.configVue = vue;
    const lot = lecteurs(j);
    j.etat.dernierLot = lot;
    j.etat.lots = [...(j.etat.lots ?? []), lot];
    if (lot.parVersion['1.6.1']?.visites && !lot.parVersion['1.6.1'].erreurs && (repartition(j).blue ?? 0) < 1) j.etat.canariPropre = true;
    return j.t('canari-une-heure', { visites: lot.total });
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
        vous: d({ 'message_de_samia.txt': f(t('canari-message-de-samia')) }),
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
              },
              kiosk,
            ),
            blue: f('', { ...kiosk, lien: `${KIOSQUE}/versions/1.4.2` }),
            green: f('', { ...kiosk, lien: `${KIOSQUE}/versions/1.5.0` }),
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
      id: 'tout-d-un-coup',
      condition: (j) => (repartition(j).blue ?? 0) === 1 && !!dernierLot(j)?.parVersion['1.6.0']?.erreurs && !j.etat.canari160,
      message: (j) => j.t('canari-evenement-tout-d-un-coup', { erreurs: dernierLot(j)!.erreurs }),
    },
    {
      id: 'canari-160',
      condition: (j) => {
        const parts = repartition(j);
        const ok = (parts.blue ?? 0) > 0 && (parts.blue ?? 0) <= 0.25 && !!dernierLot(j)?.parVersion['1.6.0'];
        if (ok) j.etat.canari160 = true;
        return ok;
      },
      message: (j) => j.t('canari-evenement-canari-160'),
    },
    {
      id: 'trop-gros',
      condition: (j) => (repartition(j).blue ?? 0) > 0.25 && (repartition(j).blue ?? 0) < 1,
      message: (j) => j.t('canari-evenement-trop-gros'),
    },
    {
      id: 'trouve',
      condition: (j) => !!j.etat.canari160 && /" 500 \d+ /.test(sortie(j)) && sortie(j).includes('/kiosk/archives'),
      message: (j) => j.t('canari-evenement-trouve'),
    },
    {
      id: 'arrete',
      condition: (j) => !!j.etat.canari160 && (repartition(j).blue ?? 0) === 0 && (repartition(j).green ?? 0) > 0,
      message: (j) => j.t('canari-evenement-arrete'),
      // Les développeur·ses publient le correctif.
      action: (j) => {
        const versions = j.trouver(`${KIOSQUE}/versions`);
        if (versions?.type === 'dossier') versions.enfants['1.6.1'] = dossierVersion(j.t, '1.6.1', 'canari-notes-161');
      },
    },
    { id: 'canari-161', condition: (j) => !!j.etat.canariPropre, message: (j) => j.t('canari-evenement-canari-161') },
    {
      id: 'fin',
      condition: (j) => {
        const s = sante(j, 'blue');
        return (
          !!j.etat.canariPropre &&
          (repartition(j).blue ?? 0) === 1 &&
          s?.status === 'ok' &&
          s.version === '1.6.1' &&
          actif(j, 'green') &&
          requete(j, GAZETTE, '/kiosk/archives', 80, false)?.code === 200
        );
      },
      message: (j) => j.t('canari-evenement-fin'),
    },
  ],
};
