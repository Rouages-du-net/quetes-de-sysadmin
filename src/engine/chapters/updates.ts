// Histoire « La Coopérative » — chapitre « Les mises à jour » : le serveur
// n'a pas été mis à jour depuis des mois. Avant l'ouverture : apt update,
// apt list --upgradable, apt upgrade… pendant que le wifi de la coopérative
// coupe (la connexion tombe une fois, au milieu de la mise à jour).
//   - sans tmux : dpkg meurt avec la session ; apt refuse de continuer tant
//     qu'on n'a pas lancé dpkg --configure -a ;
//   - dans tmux : la mise à jour va au bout ; on s'y rattache (tmux attach) ;
//   - un nouveau noyau : /var/run/reboot-required, uname -r ; redémarrer ;
//   - après le redémarrage, la caisse ne repart pas (son service n'a jamais
//     été activé, Marc la lançait à la main) : systemctl enable --now.
// Objectif vérifié sur l'état : plus de mise à jour en attente, dpkg propre,
// le nouveau noyau tourne, nginx et la caisse actifs, la caisse activée.
// Sources : https://manpages.debian.org/trixie/apt/apt.8.en.html,
// https://man.openbsd.org/tmux, https://www.debian.org/doc/manuals/debian-reference/ch02.en.html

import { f, type Chapitre } from '../world';
import type { Jeu, Shell } from '../shell';
import { chargerNginx } from '../nginx';
import { systemd } from '../systemd';
import { INSTALLES_DE_BASE, PAQUETS } from '../commands/apt';
import { comptesCooperative, M, mondeCooperative, MOT_DE_PASSE } from './coop';
import { CLE_NOUVELLE, envCaisse, etatCaisse, mondeCaisse, NGINX_BINAIRE, nginxCooperative, systemdCaisse } from './till-web';

const ANCIEN_NOYAU = '6.12.38+deb13-amd64';
const NOUVEAU_NOYAU = '6.12.48+deb13-amd64';

// Le site, tel qu'il est après « Le secret » et « Le proxy ».
export const SITE = `server {
    listen 80 default_server;
    listen [::]:80 default_server;

    server_name coop.example www.coop.example;

    root /srv/till/app;
    index index.html;

    deny 203.0.113.77;

    location ~ /\\. {
        deny all;
    }

    location /till/ {
        proxy_pass http://127.0.0.1:3000/;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}`;

// Les paquets installés, et les mises à jour de sécurité qui attendent.
const INSTALLES: Record<string, string> = {
  ...Object.fromEntries(INSTALLES_DE_BASE.map((p) => [p, PAQUETS[p].version])),
  nginx: '1.26.3-3+deb13u1',
  libc6: '2.41-12',
  openssl: '3.5.1-1',
  'linux-image-amd64': '6.12.38-1',
  [`linux-image-${ANCIEN_NOYAU}`]: '6.12.38-1',
};
const MISES: Record<string, string> = {
  nginx: '1.26.3-3+deb13u2',
  libc6: '2.41-12+deb13u1',
  openssl: '3.5.4-1~deb13u1',
  'openssh-server': '1:10.0p1-7+deb13u1',
  'linux-image-amd64': '6.12.48-1',
};

type EtatApt = { installes: Record<string, string>; mises: Record<string, string>; interrompu?: string[]; listes: boolean };
const apt = (j: Jeu) => j.etat.apt as EtatApt;
const sd = (j: Jeu) => systemd(j)!;
const aJour = (j: Jeu) => Object.entries(MISES).every(([n, v]) => apt(j).installes[n] === v) && !apt(j).interrompu?.length;
const noyau = (j: Jeu) => j.etat.noyau as { courant: string; installe: string };
const redemarre = (j: Jeu) => noyau(j).courant === NOUVEAU_NOYAU;
const servicesOk = (j: Jeu) => sd(j).services.nginx.etat === 'active' && sd(j).services.till.etat === 'active' && sd(j).services.till.active;
const tmuxOuvert = (j: Jeu) => Object.keys(j.etat.tmux ?? {}).length > 0 && !(j as Shell).tmux;

export const misesAJour: Chapitre = {
  id: 'mises-a-jour',
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
    'nano',
    'sudo',
    'id',
    'whoami',
    'apt',
    'dpkg',
    'uname',
    'tmux',
    'systemctl',
    'journalctl',
    'reboot',
    'curl',
    'ps',
    'who',
  ],
  maison: M,
  accueil: 'courriel_awa.txt',
  noms: true,
  final: 'fin',
  motDePasse: MOT_DE_PASSE,
  comptes: () => comptesCooperative(false),
  etat: () => {
    const e = etatCaisse(envCaisse(CLE_NOUVELLE, 'loopback'));
    const s = systemdCaisse();
    // Marc lançait la caisse à la main : elle tourne, mais son service n'est pas activé.
    s.services.till.active = false;
    return {
      ...e,
      systemd: s,
      apt: { listes: false, installes: { ...INSTALLES }, mises: { ...MISES }, nouveaux: { [`linux-image-${NOUVEAU_NOYAU}`]: '6.12.48-1' } },
      noyau: { courant: ANCIEN_NOYAU, installe: ANCIEN_NOYAU },
      // Le wifi de la coopérative coupe une fois, au milieu de la mise à jour.
      coupureReseau: true,
    };
  },
  initialiser: (j) => chargerNginx(j),
  creerMonde: (t) =>
    mondeCooperative({
      sansMarc: true,
      maison: { 'courriel_awa.txt': f(t('mises-a-jour-courriel-awa')) },
      etc: nginxCooperative(SITE),
      sbin: NGINX_BINAIRE,
      plus: mondeCaisse({ env: envCaisse(CLE_NOUVELLE, 'loopback'), envMode: 'rw-------', accesLog: '', appLog: '' }),
    }),
  evenements: [
    { id: 'interrompu', condition: (j) => !!apt(j).interrompu?.length, message: (j) => j.t('mises-a-jour-evenement-interrompu') },
    { id: 'dans-tmux', condition: (j) => aJour(j) && tmuxOuvert(j) && !redemarre(j), message: (j) => j.t('mises-a-jour-evenement-dans-tmux') },
    {
      id: 'a-jour',
      condition: (j) => aJour(j) && !redemarre(j),
      message: (j) => j.t('mises-a-jour-evenement-a-jour', { ancien: ANCIEN_NOYAU, nouveau: NOUVEAU_NOYAU }),
    },
    {
      id: 'caisse-tombee',
      condition: (j) => redemarre(j) && sd(j).services.till.etat !== 'active',
      message: (j) => j.t('mises-a-jour-evenement-caisse-tombee'),
    },
    { id: 'fin', condition: (j) => aJour(j) && redemarre(j) && servicesOk(j), message: (j) => j.t('mises-a-jour-evenement-fin') },
  ],
};
