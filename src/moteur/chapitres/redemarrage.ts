// Histoire « Le Datacenter » — chapitre « La nuit du redémarrage » :
// services systemd. Après les mises à jour automatiques, le serveur a
// redémarré cette nuit et le site est tombé : nginx avait été désactivé
// (disable), et le catalogue (php-fpm) ne peut plus écrire son journal car
// /var/log/catalogue appartient à root. Commandes : systemctl (status,
// --failed, start, restart, enable --now), journalctl -u / -xeu, chown,
// reboot. Objectif vérifié sur l'état : après un redémarrage lancé par le
// joueur ou la joueuse, les deux services tournent, et on l'a vérifié.
// Sources : https://www.freedesktop.org/software/systemd/man/latest/systemctl.html,
// https://www.freedesktop.org/software/systemd/man/latest/journalctl.html

import { d, f, fichiersComptes, type Chapitre } from '../monde';
import type { Jeu } from '../shell';
import { nouveauSystemd, systemd, type Systemd } from '../systemd';
import { comptesDatacenter, JOURNAL_NGINX } from './datacenter';

const M = '/home/vous';
const LOGS = '/var/log/catalogue';

const NGINX = 'A high performance web server and a reverse proxy server';
const nginx = [
  { pid: 801, utilisateur: 'root', cpu: 0, mem: 0.3, commande: 'nginx: master process /usr/sbin/nginx' },
  { pid: 802, utilisateur: 'www-data', cpu: 0.4, mem: 0.6, commande: 'nginx: worker process' },
];
const catalogue = [{ pid: 835, utilisateur: 'root', cpu: 0.2, mem: 1.1, commande: 'php-fpm: master process (/etc/php/8.2/fpm/php-fpm.conf)' }];

// L'heure au format de php-fpm : « [19-Oct-2026 03:12:05] » (toujours en anglais).
const MOIS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const heurePhp = (ms: number) => {
  const t = new Date(ms);
  return `[${String(t.getUTCDate()).padStart(2, '0')}-${MOIS[t.getUTCMonth()]}-${t.getUTCFullYear()} ${t.toISOString().slice(11, 19)}]`;
};

// php-fpm refuse de démarrer s'il ne peut pas écrire dans son dossier de journaux.
function verifierCatalogue(j: Jeu): string[] | null {
  const n = j.trouver(LOGS);
  if (n && j.peut(n, 'w', 'www-data') && j.peut(n, 'x', 'www-data')) return null;
  const h = heurePhp(systemd(j)!.horloge + 1000);
  return [
    `${h} ERROR: failed to open error_log (${LOGS}/error.log): Permission denied (13)`,
    `${h} ERROR: failed to post process the configuration`,
    `${h} ERROR: FPM initialization failed`,
  ];
}

// Vendredi : nginx tourne, Awa l'arrête et le désactive pour un test ;
// nuit de lundi : redémarrage après les mises à jour, le catalogue échoue.
function histoireDuServeur(description: string): Systemd {
  const sd = nouveauSystemd('datacenter', Date.UTC(2026, 9, 16, 8, 0, 0), Date.UTC(2026, 9, 16, 17, 42, 0), {
    nginx: { description: NGINX, active: true, executable: 'nginx', processus: nginx },
    catalogue: { description, active: true, executable: 'php-fpm', processus: catalogue, verifier: verifierCatalogue },
  });
  const ecrire = (temps: number, demarrage: number, unite: string, ident: string, pid: number, message: string, priorite = 6) =>
    sd.journal.push({ temps, demarrage, unite, ident, pid, message, priorite });
  const vendredi = (h: number, m: number, s: number) => Date.UTC(2026, 9, 16, h, m, s);
  ecrire(vendredi(17, 42, 0), 1, 'nginx.service', 'systemd', 1, `Stopping nginx.service - ${NGINX}...`);
  ecrire(vendredi(17, 42, 1), 1, 'nginx.service', 'systemd', 1, `Stopped nginx.service - ${NGINX}.`);
  ecrire(vendredi(17, 42, 9), 1, '', 'systemd', 1, 'Reloading finished in 212 ms.');
  ecrire(vendredi(17, 43, 30), 1, '', 'sudo', 4121, '     awa : TTY=pts/0 ; PWD=/home/awa ; USER=root ; COMMAND=/usr/bin/chown -R root: /var/log/catalogue');
  const nuit = (s: number) => Date.UTC(2026, 9, 19, 3, 12, s);
  ecrire(nuit(0), 1, 'unattended-upgrades.service', 'unattended-upgrade', 3310, 'Rebooting since a package requires it (linux-image-6.12.0-quetes).');
  ecrire(nuit(40), 2, '', 'kernel', 0, 'Linux version 6.12.0-quetes (datacenter)');
  ecrire(nuit(44), 2, 'catalogue.service', 'systemd', 1, `Starting catalogue.service - ${description}...`);
  const h = heurePhp(nuit(45));
  ecrire(nuit(45), 2, 'catalogue.service', 'php-fpm', 734, `${h} ERROR: failed to open error_log (${LOGS}/error.log): Permission denied (13)`, 3);
  ecrire(nuit(45), 2, 'catalogue.service', 'php-fpm', 734, `${h} ERROR: failed to post process the configuration`, 3);
  ecrire(nuit(45), 2, 'catalogue.service', 'php-fpm', 734, `${h} ERROR: FPM initialization failed`, 3);
  ecrire(nuit(45), 2, 'catalogue.service', 'systemd', 1, 'catalogue.service: Main process exited, code=exited, status=78/CONFIG', 4);
  ecrire(nuit(45), 2, 'catalogue.service', 'systemd', 1, "catalogue.service: Failed with result 'exit-code'.", 4);
  ecrire(nuit(45), 2, 'catalogue.service', 'systemd', 1, `Failed to start catalogue.service - ${description}.`, 3);
  sd.demarrage = 2;
  sd.services.nginx = { ...sd.services.nginx, etat: 'inactive', active: false, depuis: nuit(40) };
  sd.services.catalogue = { ...sd.services.catalogue, etat: 'failed', depuis: nuit(45) };
  sd.horloge = Date.UTC(2026, 9, 19, 8, 30, 0);
  return sd;
}

const sd = (j: Jeu) => systemd(j)!;
const tourne = (j: Jeu, nom: string) => sd(j).services[nom].etat === 'active';
const logsOuverts = (j: Jeu) => j.peut(j.trouver(LOGS)!, 'w', 'nobody');

export const redemarrage: Chapitre = {
  id: 'redemarrage',
  numero: 3,
  commandes: ['ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'id', 'ps', 'systemctl', 'journalctl', 'chown', 'chmod', 'nano', 'sudo', 'reboot', 'whoami'],
  maison: M,
  accueil: 'courriel_awa.txt',
  final: 'fin',
  motDePasse: 'bienvenue-2026',
  comptes: () => {
    const c = comptesDatacenter();
    c.groupes.adm.membres.push('malo');
    return c;
  },
  etat: (t) => ({ systemd: histoireDuServeur(t('premier-jour-service-catalogue')), processus: [{ pid: 1, utilisateur: 'root', cpu: 0, mem: 0.1, commande: '/sbin/init' }] }),
  creerMonde: (t) => {
    const racine = { proprio: 'root' };
    return d(
      {
        etc: d(fichiersComptes(), undefined, racine),
        home: d({ vous: d({ 'courriel_awa.txt': f(t('redemarrage-courriel-awa')), 'notes_awa.txt': f(t('redemarrage-notes-awa')) }) }, undefined, racine),
        var: d(
          {
            log: d(
              {
                // Après le « chown -R root: » de vendredi : php-fpm (www-data) ne peut plus y écrire.
                catalogue: d({ 'error.log': f('', { lignes: true, proprio: 'root' }) }, undefined, racine),
                nginx: d(
                  { 'access.log': f(JOURNAL_NGINX, { lignes: true, proprio: 'www-data', groupe: 'adm', mode: 'rw-r-----' }) },
                  undefined,
                  { proprio: 'root', groupe: 'adm' },
                ),
              },
              undefined,
              racine,
            ),
          },
          undefined,
          racine,
        ),
      },
      undefined,
      racine,
    );
  },
  evenements: [
    {
      id: 'logs-ouverts',
      condition: logsOuverts,
      message: (j) => j.t('redemarrage-evenement-logs-ouverts', { logs: LOGS }),
    },
    {
      id: 'nginx',
      condition: (j) => tourne(j, 'nginx'),
      message: (j) => j.t(sd(j).services.nginx.active ? 'redemarrage-evenement-nginx-active' : 'redemarrage-evenement-nginx'),
    },
    {
      id: 'catalogue',
      condition: (j) => tourne(j, 'catalogue'),
      message: (j) => j.t('redemarrage-evenement-catalogue'),
    },
    {
      id: 'oubli',
      condition: (j) => sd(j).demarrage > 2 && !tourne(j, 'nginx'),
      message: (j) => j.t('redemarrage-evenement-oubli'),
    },
    {
      id: 'fin',
      condition: (j) =>
        sd(j).demarrage > 2 &&
        sd(j).verifieApresDemarrage === true &&
        !sd(j).demarreALaMain &&
        tourne(j, 'nginx') &&
        tourne(j, 'catalogue') &&
        !logsOuverts(j),
      message: (j) => j.t('redemarrage-evenement-fin'),
    },
  ],
};
