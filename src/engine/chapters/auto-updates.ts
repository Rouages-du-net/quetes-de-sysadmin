// Histoire « La Coopérative » — chapitre « Les mises à jour automatiques » :
// après la mise à jour à la main du chapitre précédent, de nouvelles mises
// à jour de sécurité sont déjà là. Marc avait installé unattended-upgrades…
// sans jamais l'activer (20auto-upgrades à « 0 »). L'activer, recevoir le
// rapport par courrier, redémarrer seul mais la nuit (la coopérative ouvre
// de 7 h à 20 h), et ne pas laisser passer nodejs (dépôt de NodeSource :
// une nouvelle version majeure que la caisse ne supporte pas).
// Preuve : lancer le service apt-daily-upgrade, comme le fera son timer.
// Pièges réels : un « ; » oublié (apt-config refuse tout le fichier) ;
// « origin=* » dans Origins-Pattern (nodejs passe en 22, la caisse ne
// redémarrera pas) ; Automatic-Reboot sans heure (redémarrage immédiat, en
// pleine journée) ; le service lancé avant d'activer 20auto-upgrades (il ne
// fait rien).
// Objectif vérifié sur l'état : les deux tâches activées, une passe
// automatique a installé les mises à jour de sécurité, nodejs reste en 20,
// un rapport est parti, le redémarrage automatique est réglé la nuit, la
// till tourne.
// Sources : https://wiki.debian.org/UnattendedUpgrades,
// https://github.com/mvo5/unattended-upgrades/blob/master/data/50unattended-upgrades.Debian

import { d, f, type Chapitre } from '../world';
import type { Jeu } from '../shell';
import { chargerNginx } from '../nginx';
import { systemd } from '../systemd';
import { lireConfApt, vrai } from '../apt-conf';
import { INSTALLES_DE_BASE, PAQUETS, type EtatApt } from '../commands/apt';
import { apresQuotidien, UU, verifierQuotidien } from '../commands/unattended';
import { comptesCooperative, M, mondeCooperative, MOT_DE_PASSE } from './coop';
import { SITE } from './updates';
import { CLE_NOUVELLE, envCaisse, etatCaisse, mondeCaisse, NGINX_BINAIRE, nginxCooperative, systemdCaisse } from './till-web';

const NOYAU = '6.12.48+deb13-amd64';
const NOUVEAU_NOYAU = '6.12.57+deb13-amd64';
const NODE = '20.19.5-1nodesource1';

// Après « Les mises à jour » : tout est à jour… jusqu'aux annonces de cette semaine.
const INSTALLES: Record<string, string> = {
  ...Object.fromEntries(INSTALLES_DE_BASE.map((p) => [p, PAQUETS[p].version])),
  nginx: '1.26.3-3+deb13u2',
  libc6: '2.41-12+deb13u1',
  openssl: '3.5.4-1~deb13u1',
  libssl3t64: '3.5.4-1~deb13u1',
  tzdata: '2025b-4',
  nodejs: NODE,
  'linux-image-amd64': '6.12.48-1',
  [`linux-image-${NOYAU}`]: '6.12.48-1',
};
const SECURITE: Record<string, string> = { openssl: '3.5.4-1~deb13u2', libssl3t64: '3.5.4-1~deb13u2', 'linux-image-amd64': '6.12.57-1' };
const MISES: Record<string, string> = { ...SECURITE, tzdata: '2025b-4+deb13u1', nodejs: '22.21.0-1nodesource1' };
const ORIGINES = {
  tzdata: { o: 'Debian', n: 'trixie', l: 'Debian', site: 'deb.debian.org' },
  nodejs: { o: 'Node Source', n: 'nodistro', l: 'Node Source', site: 'deb.nodesource.com' },
};

// Le fichier livré par Debian (abrégé), tel que Marc l'a laissé.
const CINQUANTE = `// Unattended-Upgrade::Origins-Pattern controls which packages are
// upgraded.
//
// Lines below have the format "keyword=value,...".  A
// package will be upgraded only if the values in its metadata match
// all the supplied keywords in a line.  (In other words, omitted
// keywords are wild cards.) The keywords originate from the Release
// file, but several aliases are accepted.  The accepted keywords are:
//   a,archive,suite (eg, "stable")
//   c,component     (eg, "main", "contrib", "non-free")
//   l,label         (eg, "Debian", "Debian-Security")
//   o,origin        (eg, "Debian", "Unofficial Multimedia Packages")
//   n,codename      (eg, "jessie", "jessie-updates")
//     site          (eg, "http.debian.net")
// The available values on the system are printed by the command
// "apt-cache policy", and can be debugged by running
// "unattended-upgrades -d" and looking at the log file.
//
// Within lines unattended-upgrades allows 2 macros whose values are
// derived from /etc/debian_version:
//   \${distro_id}            Installed origin.
//   \${distro_codename}      Installed codename (eg, "buster")
Unattended-Upgrade::Origins-Pattern {
        // Codename based matching:
        // This will follow the migration of a release through different
        // archives (e.g. from testing to stable and later oldstable).
        // Software will be the latest available for the named release,
        // but the Debian release itself will not be automatically upgraded.
//      "origin=Debian,codename=\${distro_codename}-updates";
//      "origin=Debian,codename=\${distro_codename}-proposed-updates";
        "origin=Debian,codename=\${distro_codename},label=Debian";
        "origin=Debian,codename=\${distro_codename},label=Debian-Security";
        "origin=Debian,codename=\${distro_codename}-security,label=Debian-Security";
};

// Python regular expressions, matching packages to exclude from upgrading
Unattended-Upgrade::Package-Blacklist {
    // The following matches all packages starting with linux-
//  "linux-";
};

// Send email to this address for problems or packages upgrades
// If empty or unset then no email is sent, make sure that you
// have a working mail setup on your system. A package that provides
// 'mailx' must be installed. E.g. "user@example.com"
//Unattended-Upgrade::Mail "";

// Set this value to one of:
//    "always", "only-on-error" or "on-change"
// If this is not set, then any legacy MailOnlyOnError (boolean) value
// is used to chose between "only-on-error" and "on-change"
//Unattended-Upgrade::MailReport "on-change";

// Automatically reboot *WITHOUT CONFIRMATION* if
//  the file /var/run/reboot-required is found after the upgrade
//Unattended-Upgrade::Automatic-Reboot "false";

// Automatically reboot even if there are users currently logged in
// when Unattended-Upgrade::Automatic-Reboot is set to true
//Unattended-Upgrade::Automatic-Reboot-WithUsers "true";

// If automatic reboot is enabled and needed, reboot at the specific
// time instead of immediately
//  Default: "now"
//Unattended-Upgrade::Automatic-Reboot-Time "02:00";
`;

// dpkg-reconfigure unattended-upgrades, à qui Marc a répondu « Non ».
const VINGT = 'APT::Periodic::Update-Package-Lists "0";\nAPT::Periodic::Unattended-Upgrade "0";\n';

const apt = (j: Jeu) => j.etat.apt as EtatApt;
const conf = (j: Jeu) => lireConfApt(j);
const active = (j: Jeu) => {
  const c = conf(j);
  return !c.erreurs.length && vrai(c.valeurs['APT::Periodic::Update-Package-Lists']) && vrai(c.valeurs['APT::Periodic::Unattended-Upgrade']);
};
const securiteInstallee = (j: Jeu) => Object.entries(SECURITE).every(([n, v]) => apt(j).installes[n] === v);
const nodeIntact = (j: Jeu) => apt(j).installes.nodejs === NODE;
// Une heure où la coopérative est fermée (20 h – 7 h).
const laNuit = (j: Jeu) => {
  const c = conf(j).valeurs;
  const m = /^(\d{1,2}):(\d{2})$/.exec(c[`${UU}::Automatic-Reboot-Time`] ?? 'now');
  return vrai(c[`${UU}::Automatic-Reboot`]) && !!m && (Number(m[1]) >= 20 || Number(m[1]) < 7) && Number(m[1]) < 24;
};
const rapport = (j: Jeu) => !!conf(j).valeurs[`${UU}::Mail`];
const caisseOk = (j: Jeu) => systemd(j)!.services.till.etat === 'active';

export const automatiques: Chapitre = {
  id: 'automatiques',
  numero: 6,
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
    'apt-config',
    'unattended-upgrade',
    'uname',
    'systemctl',
    'journalctl',
    'mail',
    'ps',
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
    // La caisse ne démarre qu'avec Node.js 20 (son package.json l'exige).
    s.services.till.verifier = (j) =>
      /^20\./.test(apt(j).installes.nodejs ?? '')
        ? null
        : [`till requires Node.js 20.x (found ${(apt(j).installes.nodejs ?? '').replace(/-.*/, '')})`, 'npm error engine Unsupported engine'];
    for (const [nom, description] of [
      ['apt-daily', 'Daily apt download activities'],
      ['apt-daily-upgrade', 'Daily apt upgrade and clean activities'],
    ] as const)
      s.services[nom] = {
        description,
        etat: 'inactive',
        active: false,
        processus: [],
        executable: 'apt.systemd.daily',
        depuis: s.horloge,
        ponctuel: true,
        ...(nom === 'apt-daily-upgrade' ? { verifier: verifierQuotidien, executer: (j: Jeu) => (apresQuotidien(j), 0) } : {}),
      };
    s.minuteries = {
      'apt-daily': {
        description: 'Daily apt download activities',
        unite: 'apt-daily',
        calendrier: ['*-*-* 6,18:00'],
        active: true,
        etat: 'active',
        depuis: s.horloge,
        fichier: '/usr/lib/systemd/system/apt-daily.timer',
      },
      'apt-daily-upgrade': {
        description: 'Daily apt upgrade and clean activities',
        unite: 'apt-daily-upgrade',
        calendrier: ['*-*-* 6:00'],
        active: true,
        etat: 'active',
        depuis: s.horloge,
        fichier: '/usr/lib/systemd/system/apt-daily-upgrade.timer',
      },
    };
    return {
      ...e,
      systemd: s,
      apt: {
        listes: true,
        installes: { ...INSTALLES },
        mises: { ...MISES },
        nouveaux: { [`linux-image-${NOUVEAU_NOYAU}`]: '6.12.57-1' },
        origines: ORIGINES,
      },
      noyau: { courant: NOYAU, installe: NOYAU },
    };
  },
  initialiser: (j) => {
    chargerNginx(j);
    const sd = systemd(j)!;
    sd.horloge = Date.UTC(2027, 9, 19, 13, 10, 0);
    for (const m of Object.values(sd.minuteries ?? {})) m.dernier = Date.UTC(2027, 9, 19, 4, 0, 0);
  },
  creerMonde: (t) =>
    mondeCooperative({
      sansMarc: true,
      maison: { 'courriel_awa.txt': f(t('automatiques-courriel-awa')) },
      etc: {
        ...nginxCooperative(SITE),
        apt: d(
          {
            'apt.conf.d': d(
              {
                '20auto-upgrades': f(VINGT, { lignes: true, proprio: 'root' }),
                '50unattended-upgrades': f(CINQUANTE, { lignes: true, proprio: 'root' }),
              },
              undefined,
              { proprio: 'root' },
            ),
            'sources.list.d': d(
              {
                'debian.sources': f(
                  'Types: deb\nURIs: http://deb.debian.org/debian\nSuites: trixie trixie-updates\nComponents: main\n\nTypes: deb\nURIs: http://security.debian.org/debian-security\nSuites: trixie-security\nComponents: main',
                  { lignes: true, proprio: 'root' },
                ),
                'nodesource.list': f('deb [signed-by=/usr/share/keyrings/nodesource.gpg] https://deb.nodesource.com/node_22.x nodistro main', {
                  lignes: true,
                  proprio: 'root',
                }),
              },
              undefined,
              { proprio: 'root' },
            ),
          },
          undefined,
          { proprio: 'root' },
        ),
      },
      sbin: NGINX_BINAIRE,
      plus: mondeCaisse({ env: envCaisse(CLE_NOUVELLE, 'loopback'), envMode: 'rw-------', accesLog: '', appLog: '' }),
    }),
  evenements: [
    { id: 'syntaxe', condition: (j) => conf(j).erreurs.length > 0, message: (j) => j.t('automatiques-evenement-syntaxe') },
    { id: 'rien', condition: (j) => (j.etat.quotidiens ?? 0) > 0 && !(j.etat.passesAuto ?? 0), message: (j) => j.t('automatiques-evenement-rien') },
    { id: 'nodejs', condition: (j) => !nodeIntact(j), message: (j) => j.t('automatiques-evenement-nodejs') },
    { id: 'en-journee', condition: (j) => systemd(j)!.demarrage > 1, message: (j) => j.t('automatiques-evenement-en-journee') },
    {
      id: 'sans-rapport',
      condition: (j) => (j.etat.passesAuto ?? 0) > 0 && !conf(j).valeurs[`${UU}::Mail`],
      message: (j) => j.t('automatiques-evenement-sans-rapport'),
    },
    {
      id: 'fin',
      condition: (j) => active(j) && (j.etat.passesAuto ?? 0) > 0 && securiteInstallee(j) && nodeIntact(j) && rapport(j) && laNuit(j) && caisseOk(j),
      message: (j) => j.t('automatiques-evenement-fin'),
    },
  ],
};
