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

import { d, f, type Chapitre } from '../world';
import type { Jeu } from '../shell';
import { nouveauSystemd, systemd } from '../systemd';
import { lireConfApt, vrai } from '../apt-conf';
import { M, MAINTENANT, MOT_DE_PASSE, aptVeille, comptesVeille, ecouteVeille, initialiserVeille, mondeVeille, nginxVeille, scanVeille, serviceSsh } from './watch';

const DEMARRE = MAINTENANT - 14 * 86_400_000;
const VINGT = '/etc/apt/apt.conf.d/20auto-upgrades';
const CINQUANTE = '/etc/apt/apt.conf.d/50unattended-upgrades';

const VINGT_CONTENU = 'APT::Periodic::Update-Package-Lists "0";\nAPT::Periodic::Unattended-Upgrade "0";\n';

const CINQUANTE_CONTENU = `Unattended-Upgrade::Origins-Pattern {
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

const conf = (j: Jeu) => lireConfApt(j);
const activeOk = (j: Jeu) => {
  const c = conf(j);
  return !c.erreurs.length && vrai(c.valeurs['APT::Periodic::Update-Package-Lists']) && vrai(c.valeurs['APT::Periodic::Unattended-Upgrade']);
};
const lignesCinquante = (j: Jeu) => (j.lire(CINQUANTE) ?? '').split('\n');
const active = (l: string) => !/^\s*\/\//.test(l) && /"origin=/.test(l);
const securiteSeuleOk = (j: Jeu) => {
  const l = lignesCinquante(j);
  return !l.some((x) => active(x) && /label=Debian"/.test(x)) && l.some((x) => active(x) && /label=Debian-Security/.test(x));
};
const rapportOk = (j: Jeu) => lignesCinquante(j).some((l) => !/^\s*\/\//.test(l) && /Unattended-Upgrade::Mail\s+"[^"]/.test(l));

// Un timer (ou une tâche cron) actif, écrit à la main (persistant), dont la
// commande s'intéresse aux mises à jour ET en envoie le résultat par courrier.
const sd = (j: Jeu) => systemd(j)!;
const timerOk = (j: Jeu) =>
  Object.values(sd(j).minuteries ?? {}).some((m) => {
    if (m.etat !== 'active' || !m.fichier.startsWith('/etc/')) return false;
    const service = sd(j).services[m.unite];
    const texte = (service?.fichier ? (j.lire(service.fichier) ?? '') : '').toLowerCase();
    return /exec/.test(texte) && texte.includes('apt') && texte.includes('mail');
  });
const cronOk = (j: Jeu) =>
  Object.values((j.etat.crontabs ?? {}) as Record<string, string>).some((t) =>
    t.split('\n').some((l) => {
      const s = l.trim().toLowerCase();
      return !!s && !s.startsWith('#') && s.includes('apt') && s.includes('mail');
    }),
  );
const periodiqueOk = (j: Jeu) => timerOk(j) || cronOk(j);

const autoOk = (j: Jeu) => activeOk(j) && securiteSeuleOk(j) && rapportOk(j);

export const routine: Chapitre = {
  id: 'routine',
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
    'apt-config',
    'unattended-upgrade',
    'systemctl',
    'journalctl',
    'crontab',
    'mail',
  ],
  maison: M,
  accueil: 'courriel_salome.txt',
  noms: true,
  final: 'fin',
  etapes: ['active', 'securite', 'periodique', 'fin'],
  motDePasse: MOT_DE_PASSE,
  comptes: comptesVeille,
  etat: () => ({
    sshd: { charge: {}, connexionsAuChargement: 1, recharges: 0 },
    ecoute: ecouteVeille(),
    nginx: nginxVeille(),
    scan: scanVeille(),
    apt: aptVeille(true),
    crontabs: {},
    systemd: nouveauSystemd('petrin', DEMARRE, MAINTENANT, {
      ssh: serviceSsh(),
      nginx: { description: 'A high performance web server and a reverse proxy server', active: true, executable: 'nginx' },
      cron: { description: 'Regular background program processing daemon', active: true, executable: 'cron' },
    }),
  }),
  initialiser: initialiserVeille,
  creerMonde: (t) =>
    mondeVeille(t, {
      maison: { 'courriel_salome.txt': f(t('routine-courriel-salome')) },
      etc: {
        apt: d(
          { 'apt.conf.d': d({ '20auto-upgrades': f(VINGT_CONTENU, { lignes: true, proprio: 'root' }), '50unattended-upgrades': f(CINQUANTE_CONTENU, { lignes: true, proprio: 'root' }) }, undefined, { proprio: 'root' }) },
          undefined,
          { proprio: 'root' },
        ),
      },
    }),
  evenements: [
    { id: 'syntaxe', condition: (j) => conf(j).erreurs.length > 0, message: (j) => j.t('routine-evenement-syntaxe') },
    { id: 'active', condition: activeOk, message: (j) => j.t('routine-evenement-active') },
    { id: 'securite', condition: (j) => activeOk(j) && securiteSeuleOk(j) && rapportOk(j), message: (j) => j.t('routine-evenement-securite') },
    { id: 'periodique', condition: periodiqueOk, message: (j) => j.t('routine-evenement-periodique') },
    { id: 'fin', condition: (j) => autoOk(j) && periodiqueOk(j), message: (j) => j.t('routine-evenement-fin') },
  ],
};
