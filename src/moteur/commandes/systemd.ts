// systemctl, journalctl et reboot, sur le systemd simulé (../systemd.ts).
// Messages d'après systemd (https://www.freedesktop.org/software/systemd/man/latest/) :
// ils restent en anglais, comme ceux du vrai systemctl.

import type { Shell } from '../shell';
import { arreter, dateComplete, demarrer, duree, journaliser, ligneJournal, redemarrer, systemd, type Systemd } from '../systemd';
import type { Commande } from './index';

const LEGENDE = [
  '',
  'LOAD   = Reflects whether the unit definition was properly loaded.',
  'ACTIVE = The high-level unit activation state, i.e. generalization of SUB.',
  'SUB    = The low-level unit activation state, values depend on unit type.',
];

const sousEtat = (etat: string) => (etat === 'active' ? 'running' : etat === 'failed' ? 'failed' : 'dead');
const nomUnite = (brut: string) => brut.replace(/\.service$/, '');

function statut(jeu: Shell, sd: Systemd, nom: string): string {
  const s = sd.services[nom];
  const unite = `${nom}.service`;
  const langue = jeu.t.langue;
  const depuis = `since ${dateComplete(s.depuis, langue)}; ${duree(sd.horloge - s.depuis)} ago`;
  const actif =
    s.etat === 'active' ? `active (running) ${depuis}` : s.etat === 'failed' ? `failed (Result: exit-code) ${depuis}` : `inactive (dead)`;
  const lignes = [
    // × (\u00d7) : le symbole d'échec de systemd.
    `${s.etat === 'failed' ? '\u00d7' : s.etat === 'active' ? '●' : '○'} ${unite} - ${s.description}`,
    `     Loaded: loaded (/usr/lib/systemd/system/${unite}; ${s.active ? 'enabled' : 'disabled'}; preset: enabled)`,
    `     Active: ${actif}`,
  ];
  if (s.etat === 'active' && s.processus[0]) lignes.push(`   Main PID: ${s.processus[0].pid} (${s.executable})`);
  const journal = sd.journal.filter((e) => e.unite === unite && e.demarrage === sd.demarrage).slice(-10);
  if (journal.length) lignes.push('', ...journal.map((e) => ligneJournal(e, sd, langue)));
  return lignes.join('\n');
}

function liste(sd: Systemd, echecsSeulement: boolean): string {
  const unites = Object.entries(sd.services).filter(([, s]) => (echecsSeulement ? s.etat === 'failed' : s.etat !== 'inactive'));
  const largeur = Math.max(4, ...unites.map(([n]) => n.length + 8));
  const lignes = [`  ${'UNIT'.padEnd(largeur)} LOAD   ACTIVE   SUB     DESCRIPTION`];
  for (const [nom, s] of unites)
    lignes.push(`${s.etat === 'failed' ? '●' : ' '} ${`${nom}.service`.padEnd(largeur)} loaded ${s.etat.padEnd(8)} ${sousEtat(s.etat).padEnd(7)} ${s.description}`);
  return [...lignes, ...LEGENDE, '', `${unites.length} loaded units listed.`].join('\n');
}

// systemctl sans être root : systemd demanderait un mot de passe (polkit).
const refuse = (jeu: Shell, action: string, nom: string) => jeu.erreur(jeu.t('systemctl-acces-refuse', { action, service: nom }));

export const SYSTEMD: Record<string, Commande> = {
  systemctl: {
    lancer: ({ args, jeu }) => {
      const sd = systemd(jeu);
      if (!sd) return jeu.erreur('System has not been booted with systemd as init system (PID 1). Can\'t operate.');
      const maintenant = args.includes('--now');
      const inconnue = args.find((a) => /^-[^-]/.test(a));
      if (inconnue) return jeu.erreur(`systemctl: invalid option -- '${inconnue[1]}'`);
      const mots = args.filter((a) => !a.startsWith('--') || a === '--failed');
      const [action = 'list-units', ...noms] = mots;
      const VERBES = ['status', 'start', 'stop', 'restart', 'reload', 'enable', 'disable', 'is-active', 'is-enabled', 'list-units', 'reboot', '--failed'];
      if (!VERBES.includes(action)) return jeu.erreur(`Unknown command verb '${action}'.`);
      // Consulter l'état des services après un redémarrage : c'est vérifier.
      const consulter = () => (sd.verifieApresDemarrage = true);
      if (action === '--failed' || (action === 'list-units' && args.includes('--failed'))) return consulter(), liste(sd, true);
      if (action === 'list-units') return consulter(), liste(sd, false);
      if (action === 'reboot') {
        if (jeu.qui !== 'root') return refuse(jeu, 'reboot', 'system');
        redemarrer(jeu, sd);
        jeu.redemarrage = true;
        return '';
      }
      if (!noms.length) return jeu.erreur(action === 'status' ? jeu.t('systemctl-usage') : `Too few arguments.`);
      const sorties: string[] = [];
      for (const brut of noms) {
        const nom = nomUnite(brut);
        const s = sd.services[nom];
        if (!s) {
          if (action === 'status' || action.startsWith('is-')) jeu.erreur(`Unit ${nom}.service could not be found.`);
          else jeu.erreur(`Failed to ${action} ${nom}.service: Unit ${nom}.service not found.`);
          continue;
        }
        if (action === 'status') {
          consulter();
          sorties.push(statut(jeu, sd, nom));
        } else if (action === 'is-active') {
          consulter();
          sorties.push(s.etat);
        } else if (action === 'is-enabled') sorties.push(s.active ? 'enabled' : 'disabled');
        else if (jeu.qui !== 'root') refuse(jeu, action, nom);
        else {
          const lien = `/etc/systemd/system/multi-user.target.wants/${nom}.service`;
          const echec = () =>
            jeu.erreur(
              `Job for ${nom}.service failed because the control process exited with error code.\nSee "systemctl status ${nom}.service" and "journalctl -xeu ${nom}.service" for details.`,
            );
          if (action === 'enable') {
            if (!s.active) sorties.push(`Created symlink ${lien} → /usr/lib/systemd/system/${nom}.service.`);
            s.active = true;
            if (maintenant && s.etat !== 'active' && !demarrer(jeu, sd, nom)) echec();
          } else if (action === 'disable') {
            if (s.active) sorties.push(`Removed "${lien}".`);
            s.active = false;
            if (maintenant && s.etat === 'active') arreter(jeu, sd, nom);
          } else if (action === 'stop') {
            if (s.etat === 'active') arreter(jeu, sd, nom);
            else s.etat = 'inactive';
          } else if (action === 'reload') {
            if (s.etat !== 'active') jeu.erreur(`${nom}.service is not active, cannot reload.`);
            else journaliser(sd, `${nom}.service`, 'systemd', 1, `Reloaded ${nom}.service - ${s.description}.`);
          } else {
            if (action === 'restart' && s.etat === 'active') arreter(jeu, sd, nom);
            if (s.etat !== 'active' && !demarrer(jeu, sd, nom)) echec();
          }
          const m = jeu.etat.surSystemctl?.(jeu, action, nom);
          if (m) sorties.push(m);
        }
      }
      return sorties.join('\n');
    },
  },

  journalctl: {
    // -n20, -xeu nginx : journalctl lit ses options lui-même.
    propresOptions: true,
    lancer: ({ args, jeu }) => {
      const sd = systemd(jeu);
      if (!sd) return '-- No entries --';
      let unite: string | null = null;
      let nombre: number | null = null;
      let priorite = 7;
      let demarrageSeul = false;
      for (let i = 0; i < args.length; i++) {
        const a = args[i];
        if (a.startsWith('--')) {
          if (a.startsWith('--unit=')) unite = a.slice(7);
          else if (a === '--no-pager' || a === '--pager-end') continue;
          else return jeu.erreur(`journalctl: unrecognized option '${a}'`);
          continue;
        }
        if (!a.startsWith('-')) return jeu.erreur(jeu.t('journalctl-argument', { argument: a }));
        // Options courtes groupées, comme -xeu nginx : la dernière peut prendre une valeur.
        for (let j = 1; j < a.length; j++) {
          const l = a[j];
          if ('unp'.includes(l)) {
            const valeur = a.slice(j + 1) || args[++i];
            if (valeur === undefined) return jeu.erreur(`journalctl: option requires an argument -- '${l}'`);
            if (l === 'u') unite = valeur;
            else if (l === 'n') nombre = Number(valeur);
            else priorite = { emerg: 0, alert: 1, crit: 2, err: 3, warning: 4, notice: 5, info: 6, debug: 7 }[valeur] ?? Number(valeur);
            break;
          }
          if (l === 'b') demarrageSeul = true;
          else if (l === 'f') return jeu.erreur(jeu.t('journalctl-suivre'));
          else if (l !== 'x' && l !== 'e' && l !== 'q') return jeu.erreur(`journalctl: invalid option -- '${l}'`);
        }
      }
      // Lire tout le journal : root, ou les groupes adm et systemd-journal.
      const autorise = jeu.qui === 'root' || jeu.groupesDe(jeu.qui).some((g) => g === 'adm' || g === 'systemd-journal');
      if (!autorise)
        return [
          'Hint: You are currently not seeing messages from other users and the system.',
          "      Users in groups 'adm', 'systemd-journal' can see all messages.",
          '      Pass -q to turn off this notice.',
          '-- No entries --',
        ].join('\n');
      const u = unite && (unite.endsWith('.service') ? unite : `${unite}.service`);
      let entrees = sd.journal.filter((e) => (!u || e.unite === u) && e.priorite <= priorite && (!demarrageSeul || e.demarrage === sd.demarrage));
      if (nombre !== null) entrees = entrees.slice(-nombre);
      if (!entrees.length) return '-- No entries --';
      const lignes: string[] = [];
      entrees.forEach((e, i) => {
        if (i > 0 && e.demarrage !== entrees[i - 1].demarrage) lignes.push(`-- Boot ${String(e.demarrage).padStart(2, '0')}f3c1e9a7d54b2c8e06a1d9f4b7c2e5 --`);
        lignes.push(ligneJournal(e, sd, jeu.t.langue));
      });
      return lignes.join('\n');
    },
  },

  reboot: {
    lancer: ({ jeu }) => {
      const sd = systemd(jeu);
      if (jeu.qui !== 'root') return jeu.erreur(jeu.t('reboot-refuse'));
      if (sd) redemarrer(jeu, sd);
      jeu.redemarrage = true;
      return '';
    },
  },
};
