// Histoire « La Veille » — chapitre « Mettre en veille » : une vérification
// ponctuelle ne suffit pas, la veille est une habitude. Deux choses à
// mettre en place, qui tournent seules sans remplacer la décision humaine :
//   - unattended-upgrades, restreint aux mises à jour de SÉCURITÉ
//     seulement (pas tout, qui casserait sans prévenir) : activer les deux
//     tâches périodiques (20auto-upgrades), et dans
//     50unattended-upgrades, ne garder que les lignes Origins-Pattern
//     « Debian-Security », avec une adresse pour le rapport ;
//   - un rendez-vous hebdomadaire qui rappelle de lire le prochain bulletin :
//     un timer systemd (ou une tâche cron) qui envoie par courrier la liste
//     des paquets en attente de mise à jour.
// Objectif vérifié sur l'état : les deux tâches de 20auto-upgrades
// activées, 50unattended-upgrades limité aux mises à jour de sécurité avec
// un rapport par courrier, et un timer (ou une tâche cron) actif et
// persistant qui envoie un résumé hebdomadaire.
// Pièges prévus : activer sans restreindre aux mises à jour de sécurité (ou
// l'inverse), un timer qui ne survit pas au redémarrage (pas dans /etc).
// Sources : https://wiki.debian.org/UnattendedUpgrades,
// https://www.freedesktop.org/software/systemd/man/latest/systemd.timer.html,
// https://manpages.debian.org/bookworm/cron/crontab.5.en.html

import { d, f, type Chapter } from '../world';
import type { Game } from '../shell';
import { newSystemd, systemd } from '../systemd';
import { readConfApt, yes } from '../apt-conf';
import { M, NOW, PASSWORD, watchApt, watchAccounts, watchListening, initialiseWatch, watchWorld, watchNginx, watchScan, serviceSsh } from './watch';

const STARTED = NOW - 14 * 86_400_000;
const TWENTY = '/etc/apt/apt.conf.d/20auto-upgrades';
const FIFTY = '/etc/apt/apt.conf.d/50unattended-upgrades';

const TWENTY_CONTENT = 'APT::Periodic::Update-Package-Lists "0";\nAPT::Periodic::Unattended-Upgrade "0";\n';

const FIFTY_CONTENT = `Unattended-Upgrade::Origins-Pattern {
        // Codename based matching:
        "origin=Debian,codename=\${distro_codename},label=Debian";
        "origin=Debian,codename=\${distro_codename},label=Debian-Security";
        "origin=Debian,codename=\${distro_codename}-security,label=Debian-Security";
};

// Send email to this address for problems or packages upgrades
// If empty or unset then no email is sent, make sure that you
// have a working mail setup on your system.
//Unattended-Upgrade::Mail "";

// Automatically reboot *WITHOUT CONFIRMATION* if
//  the file /var/run/reboot-required is found after the upgrade
//Unattended-Upgrade::Automatic-Reboot "false";
`;

const conf = (j: Game) => readConfApt(j);
const okActive = (j: Game) => {
  const c = conf(j);
  return !c.errors.length && yes(c.values['APT::Periodic::Update-Package-Lists']) && yes(c.values['APT::Periodic::Unattended-Upgrade']);
};
const fiftyLines = (j: Game) => (j.read(FIFTY) ?? '').split('\n');
const active = (l: string) => !/^\s*\/\//.test(l) && /"origin=/.test(l);
const okOnlySecurity = (j: Game) => {
  const l = fiftyLines(j);
  return !l.some((x) => active(x) && /label=Debian"/.test(x)) && l.some((x) => active(x) && /label=Debian-Security/.test(x));
};
const okReport = (j: Game) => fiftyLines(j).some((l) => !/^\s*\/\//.test(l) && /Unattended-Upgrade::Mail\s+"[^"]/.test(l));

// Un timer (ou une tâche cron) actif, écrit à la main (persistant), dont la
// commande s'intéresse aux mises à jour ET en envoie le résultat par courrier.
const sd = (j: Game) => systemd(j)!;
const timerOk = (j: Game) =>
  Object.values(sd(j).timers ?? {}).some((m) => {
    if (m.state !== 'active' || !m.file.startsWith('/etc/')) return false;
    const service = sd(j).services[m.unit];
    const text = (service?.file ? (j.read(service.file) ?? '') : '').toLowerCase();
    return /exec/.test(text) && text.includes('apt') && text.includes('mail');
  });
const cronOk = (j: Game) =>
  Object.values((j.state.crontabs ?? {}) as Record<string, string>).some((t) =>
    t.split('\n').some((l) => {
      const s = l.trim().toLowerCase();
      return !!s && !s.startsWith('#') && s.includes('apt') && s.includes('mail');
    }),
  );
const okPeriodic = (j: Game) => timerOk(j) || cronOk(j);

const autoOk = (j: Game) => okActive(j) && okOnlySecurity(j) && okReport(j);

export const routine: Chapter = {
  id: 'routine',
  number: 5,
  commands: [
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
    'systemctl',
    'journalctl',
    'crontab',
    'mail',
  ],
  home: M,
  welcome: 'courriel_salome.txt',
  names: true,
  final: 'fin',
  steps: ['active', 'securite', 'periodique', 'fin'],
  password: PASSWORD,
  accounts: watchAccounts,
  state: () => ({
    sshd: { load: {}, connectionsToLoad: 1, reloads: 0 },
    ecoute: watchListening(),
    nginx: watchNginx(),
    scan: watchScan(),
    apt: watchApt(true),
    crontabs: {},
    systemd: newSystemd('petrin', STARTED, NOW, {
      ssh: serviceSsh(),
      nginx: { description: 'A high performance web server and a reverse proxy server', active: true, executable: 'nginx' },
      cron: { description: 'Regular background program processing daemon', active: true, executable: 'cron' },
    }),
  }),
  initialise: initialiseWatch,
  createWorld: (t) =>
    watchWorld(t, {
      home: { 'courriel_salome.txt': f(t('routine-courriel-salome')) },
      etc: {
        apt: d(
          { 'apt.conf.d': d({ '20auto-upgrades': f(TWENTY_CONTENT, { lines: true, owner: 'root' }), '50unattended-upgrades': f(FIFTY_CONTENT, { lines: true, owner: 'root' }) }, undefined, { owner: 'root' }) },
          undefined,
          { owner: 'root' },
        ),
      },
    }),
  events: [
    { id: 'syntaxe', condition: (j) => conf(j).errors.length > 0, message: (j) => j.t('routine-evenement-syntaxe') },
    { id: 'active', condition: okActive, message: (j) => j.t('routine-evenement-active') },
    { id: 'securite', condition: (j) => okActive(j) && okOnlySecurity(j) && okReport(j), message: (j) => j.t('routine-evenement-securite') },
    { id: 'periodique', condition: okPeriodic, message: (j) => j.t('routine-evenement-periodique') },
    { id: 'fin', condition: (j) => autoOk(j) && okPeriodic(j), message: (j) => j.t('routine-evenement-fin') },
  ],
};
