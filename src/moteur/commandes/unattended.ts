// unattended-upgrades : les mises à jour automatiques de Debian, et
// apt-config. Comme le paquet unattended-upgrades (Debian 13) :
//   - /etc/apt/apt.conf.d/20auto-upgrades active les deux tâches du service
//     apt-daily-upgrade (APT::Periodic::Update-Package-Lists et
//     ::Unattended-Upgrade, « 0 » ou absent : rien ne se passe) ;
//   - 50unattended-upgrades dit quoi installer : Origins-Pattern (chaque
//     motif « clé=valeur,… » doit correspondre à l'origine du paquet ; par
//     défaut, Debian et ses mises à jour de sécurité), Package-Blacklist
//     (expressions régulières), Mail, MailReport, Automatic-Reboot,
//     Automatic-Reboot-Time ;
//   - le journal dans /var/log/unattended-upgrades/unattended-upgrades.log.
// Sources : https://wiki.debian.org/UnattendedUpgrades,
// https://manpages.debian.org/trixie/unattended-upgrades/unattended-upgrade.8.en.html,
// https://github.com/mvo5/unattended-upgrades/blob/master/data/50unattended-upgrades.Debian
// Écarts : pas d'autoremove, de MinimalSteps ni de mise en pause sur
// batterie ; les origines des paquets sont décrites par le chapitre ; la
// sortie de --debug est abrégée ; le redémarrage programmé n'est pas joué.

import type { Jeu, Shell } from '../shell';
import { journaliser, redemarrer, systemd } from '../systemd';
import { lireConfApt, vider, vrai, type ConfApt } from '../aptconf';
import { configurer, etat, misesDisponibles, SECURITE, type Origine } from './apt';
import { envoyer } from './supervision';
import { aide } from './manuel';
import type { Commande } from './index';

const CODENAME = 'trixie';
const JOURNAL = '/var/log/unattended-upgrades/unattended-upgrades.log';
export const UU = 'Unattended-Upgrade';

// Un motif d'Origins-Pattern correspond-il à cette origine ? (clés et alias d'unattended-upgrades)
function correspond(motif: string, o: Origine): boolean {
  const champs: Record<string, keyof Origine> = {
    o: 'o',
    origin: 'o',
    n: 'n',
    codename: 'n',
    l: 'l',
    label: 'l',
    a: 'n',
    archive: 'n',
    suite: 'n',
    site: 'site',
  };
  const texte = motif.replace(/\$\{distro_codename\}/g, CODENAME).replace(/\$\{distro_id\}/g, 'Debian');
  return texte.split(/(?<!\\),/).every((morceau) => {
    const [cle, ...v] = morceau.split('=');
    const champ = champs[cle.trim()];
    if (!champ) return false;
    const re = new RegExp(
      `^${v
        .join('=')
        .trim()
        .replace(/[.+^$()|[\]\\]/g, '\\$&')
        .replace(/\*/g, '.*')
        .replace(/\?/g, '.')}$`,
    );
    return re.test(o[champ]);
  });
}

const motifs = (c: ConfApt) =>
  (c.listes[`${UU}::Origins-Pattern`] ?? []).map((m) => m.replace(/\$\{distro_codename\}/g, CODENAME).replace(/\$\{distro_id\}/g, 'Debian'));

/** Ce qu'unattended-upgrades installerait, et ce qu'il laisse (origine non permise, liste noire). */
export function triMises(jeu: Shell, c: ConfApt) {
  const e = etat(jeu);
  const permis = motifs(c);
  const noire = (c.listes[`${UU}::Package-Blacklist`] ?? []).map((m) => new RegExp(`^(?:${m})`));
  const prises: [string, string][] = [];
  const laissees: { paquet: string; raison: 'origine' | 'noire' }[] = [];
  for (const [n, v] of misesDisponibles(e)) {
    const o = e.origines?.[n] ?? SECURITE;
    if (!permis.some((m) => correspond(m, o))) laissees.push({ paquet: n, raison: 'origine' });
    else if (noire.some((re) => re.test(n))) laissees.push({ paquet: n, raison: 'noire' });
    else prises.push([n, v]);
  }
  // Le nouveau noyau suit linux-image-amd64.
  const nouveaux = Object.entries(e.nouveaux ?? {}).filter(
    ([n]) => !e.installes[n] && prises.some(([m]) => m === 'linux-image-amd64') && n.startsWith('linux-image-'),
  );
  return { prises: [...nouveaux, ...prises], laissees, permis };
}

const horodatage = (jeu: Jeu) => {
  const ms = systemd(jeu)?.horloge ?? 0;
  return `${new Date(ms).toISOString().replace('T', ' ').slice(0, 19)},${String(ms % 1000).padStart(3, '0')}`;
};

function noter(jeu: Shell, lignes: string[]) {
  const texte = lignes.map((l) => `${horodatage(jeu)} INFO ${l}`).join('\n');
  const n = jeu.trouver(JOURNAL);
  if (n?.type === 'fichier' && typeof n.contenu === 'string') n.contenu = n.contenu ? `${n.contenu}\n${texte}` : texte;
  else {
    if (!jeu.existe('/var/log/unattended-upgrades'))
      jeu.placer('unattended-upgrade', '/var/log/unattended-upgrades', { type: 'dossier', enfants: {}, proprio: 'root' });
    jeu.placer('unattended-upgrade', JOURNAL, { type: 'fichier', contenu: texte, lignes: true, proprio: 'root', mode: 'rw-r--r--' });
  }
}

export interface ResultatUU {
  installes: string[];
  // Le redémarrage : « now » (fait), une heure (programmé), ou null.
  redemarrage: string | null;
}

/** Une passe d'unattended-upgrade, comme le lance apt-daily-upgrade.service (ou root à la main). */
export function passeUU(jeu: Shell, o: { seche?: boolean; bavard?: boolean } = {}): { sortie: string[]; resultat: ResultatUU } {
  const c = lireConfApt(jeu);
  const { prises, laissees, permis } = triMises(jeu, c);
  const noire = c.listes[`${UU}::Package-Blacklist`] ?? [];
  const info = [
    ...(o.seche ? ['Option --dry-run given, *not* performing real actions'] : []),
    'Starting unattended upgrades script',
    `Allowed origins are: ${permis.join(', ')}`,
    `Initial blacklist: ${noire.join(' ')}`,
    'Initial whitelist (not strict): ',
  ];
  const detail = o.bavard
    ? laissees.map(({ paquet, raison }) => {
        const or = etat(jeu).origines?.[paquet] ?? SECURITE;
        return raison === 'noire'
          ? `${paquet} is blacklisted`
          : `Checking: ${paquet} ([<Origin component:'main' archive:'${or.n}' origin:'${or.o}' label:'${or.l}' site:'${or.site}' isTrusted:True>])\nadjusting candidate version: ${paquet} not in allowed origins`;
      })
    : [];
  const resultat: ResultatUU = { installes: [], redemarrage: null };
  if (!prises.length) {
    const fin = [...info, 'No packages found that can be upgraded unattended and no pending auto-removals'];
    if (!o.seche) {
      noter(jeu, fin);
      // MailReport « always » : un rapport même quand il n'y avait rien à faire.
      if (c.valeurs[`${UU}::Mail`] && c.valeurs[`${UU}::MailReport`] === 'always') rapporter(jeu, c, [], false, fin);
    }
    return { sortie: o.bavard ? [...fin.slice(0, -1), ...detail, fin.at(-1)!] : [], resultat };
  }
  const noms = prises.map(([n]) => n).sort();
  const lignes = [
    ...info,
    `Packages that will be upgraded: ${noms.join(' ')}`,
    'Writing dpkg log to /var/log/unattended-upgrades/unattended-upgrades-dpkg.log',
  ];
  if (o.seche) return { sortie: o.bavard ? [...info, ...detail, ...lignes.slice(info.length)] : [], resultat };
  configurer(jeu, etat(jeu), prises);
  resultat.installes = noms;
  lignes.push('All upgrades installed');
  const aRedemarrer = jeu.existe('/var/run/reboot-required');
  // Le rapport par courrier (MailReport : on-change par défaut).
  if (c.valeurs[`${UU}::Mail`] && (c.valeurs[`${UU}::MailReport`] ?? 'on-change') !== 'only-on-error') rapporter(jeu, c, noms, aRedemarrer, lignes);
  if (aRedemarrer && vrai(c.valeurs[`${UU}::Automatic-Reboot`])) {
    const quand = c.valeurs[`${UU}::Automatic-Reboot-Time`] ?? 'now';
    lignes.push('Found /var/run/reboot-required, rebooting');
    resultat.redemarrage = quand;
  }
  noter(jeu, lignes);
  return { sortie: o.bavard ? [...lignes.slice(0, info.length), ...detail, ...lignes.slice(info.length)] : [], resultat };
}

// Le rapport par courrier, envoyé par root (MailReport : on-change par défaut).
function rapporter(jeu: Shell, c: ConfApt, noms: string[], aRedemarrer: boolean, lignes: string[]) {
  const hote = systemd(jeu)?.hote ?? 'localhost';
  const qui = jeu.qui;
  jeu.qui = 'root';
  envoyer(
    jeu,
    [c.valeurs[`${UU}::Mail`]],
    `${aRedemarrer ? '[reboot required] ' : ''}unattended-upgrades result for ${hote}: SUCCESS`,
    [
      `Unattended upgrade result: ${noms.length ? 'All upgrades installed' : 'No packages found that can be upgraded unattended and no pending auto-removals'}`,
      '',
      ...(aRedemarrer ? ['Warning: A reboot is required to complete this upgrade, or a previous one.', ''] : []),
      ...(noms.length ? ['Packages that were upgraded:', ` ${noms.join(' ')}`, ''] : []),
      'Unattended-upgrades log:',
      ...lignes,
    ].join('\n'),
  );
  jeu.qui = qui;
}

/** Applique le redémarrage demandé par une passe : tout de suite, ou programmé (shutdown -r HH:MM). */
export function redemarrerApres(jeu: Shell, r: ResultatUU) {
  const sd = systemd(jeu);
  if (!r.redemarrage || !sd) return;
  if (r.redemarrage === 'now') {
    redemarrer(jeu, sd);
    jeu.redemarrage = true;
  } else {
    jeu.etat.redemarrageProgramme = r.redemarrage;
    journaliser(sd, '', 'systemd-logind', 512, `Reboot scheduled for ${r.redemarrage}, use 'shutdown -c' to cancel.`);
  }
}

/** apt-daily-upgrade.service : apt.systemd.daily ne lance unattended-upgrade que si 20auto-upgrades le demande. */
export function apresQuotidien(jeu: Jeu) {
  const sh = jeu as Shell;
  const c = lireConfApt(sh);
  sh.etat.quotidiens = (sh.etat.quotidiens ?? 0) + 1;
  if (c.erreurs.length || c.valeurs['APT::Periodic::Enable'] === '0') return;
  if (!vrai(c.valeurs['APT::Periodic::Unattended-Upgrade'] ?? '0')) return;
  const { resultat } = passeUU(sh);
  sh.etat.passesAuto = (sh.etat.passesAuto ?? 0) + 1;
  redemarrerApres(sh, resultat);
}

/** Vérification au démarrage d'apt-daily-upgrade.service : une configuration illisible le fait échouer. */
export const verifierQuotidien = (jeu: Jeu) => {
  const e = lireConfApt(jeu).erreurs;
  return e.length ? e : null;
};

export const UNATTENDED: Record<string, Commande> = {
  'unattended-upgrade': {
    section: 8,
    propresOptions: true,
    lancer: ({ args, jeu }) => {
      const connues = ['--dry-run', '-d', '--debug', '-v', '--verbose', '-h', '--help'];
      const inconnue = args.find((a) => !connues.includes(a));
      if (inconnue) return jeu.erreur(`Usage: unattended-upgrade [options]\n\nunattended-upgrade: error: no such option: ${inconnue}`, 2);
      if (args.includes('-h') || args.includes('--help')) return aide('unattended-upgrade', UNATTENDED['unattended-upgrade'], jeu.t);
      if (jeu.qui !== 'root') return jeu.erreur('You need to be root to run this application', 1);
      const c = lireConfApt(jeu);
      if (c.erreurs.length) return jeu.erreur(c.erreurs.join('\n'), 1);
      const seche = args.includes('--dry-run');
      const bavard = args.some((a) => ['-d', '--debug', '-v', '--verbose'].includes(a));
      const { sortie, resultat } = passeUU(jeu, { seche, bavard });
      redemarrerApres(jeu, resultat);
      return sortie.join('\n');
    },
  },
  'apt-config': {
    section: 8,
    propresOptions: true,
    lancer: ({ args, jeu }) => {
      const [action] = args.filter((a) => !a.startsWith('-'));
      if (!action || args.includes('-h') || args.includes('--help')) return aide('apt-config', UNATTENDED['apt-config'], jeu.t);
      const c = lireConfApt(jeu);
      if (c.erreurs.length) return jeu.erreur(c.erreurs.join('\n'), 100);
      if (action === 'dump') {
        const filtre = args.filter((a) => !a.startsWith('-'))[1];
        const tout = vider(c);
        return filtre
          ? tout
              .split('\n')
              .filter((l) => l.startsWith(filtre))
              .join('\n')
          : tout;
      }
      return jeu.erreur(`E: Invalid operation ${action}`, 100);
    },
  },
  // La page de manuel du fichier de configuration d'apt.
  'apt.conf': { section: 5, lancer: () => '' },
};
