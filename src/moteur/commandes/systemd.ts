// systemctl, journalctl et reboot, sur le systemd simulé (../systemd.ts).
// Messages d'après systemd (https://www.freedesktop.org/software/systemd/man/latest/) :
// ils restent en anglais, comme ceux du vrai systemctl.

import type { Shell } from '../shell';
import { arreter, dateComplete, demarrer, duree, journaliser, ligneJournal, recharger, redemarrer, systemd, type Systemd } from '../systemd';
import type { Commande } from './index';
import { colorer, sgr } from '../couleurs';
import { lireTaille } from '../memoire';
import { chargerUnites, lireCalendrier, prochainCalendrier, prochainDeclenchement, timerDe } from '../minuteries';
import { versUtc } from '../systemd';

const LEGENDE = [
  '',
  'LOAD   = Reflects whether the unit definition was properly loaded.',
  'ACTIVE = The high-level unit activation state, i.e. generalization of SUB.',
  'SUB    = The low-level unit activation state, values depend on unit type.',
];

const sousEtat = (etat: string) => (etat === 'active' ? 'running' : etat === 'failed' ? 'failed' : 'dead');
const nomUnite = (brut: string) => brut.replace(/\.service$/, '');

// Comme systemctl sur un terminal : le point vert d'un service actif, la croix rouge d'un échec.
type Peindre = (code: string, texte: string) => string;
const brut: Peindre = (_code, texte) => texte;

function statut(jeu: Shell, sd: Systemd, nom: string, peindre: Peindre = brut): string {
  const s = sd.services[nom];
  const unite = `${nom}.service`;
  const langue = jeu.t.langue;
  const depuis = `since ${dateComplete(s.depuis, langue, sd)}; ${duree(sd.horloge - s.depuis)} ago`;
  const actif =
    s.etat === 'active'
      ? `${peindre('0;1;32', `active (${s.resteActif ? 'exited' : 'running'})`)} ${depuis}`
      : s.etat === 'failed'
        ? `${peindre('0;1;31', 'failed')} (Result: ${s.resultat ?? 'exit-code'}) ${depuis}`
        : `inactive (dead)`;
  const lignes = [
    // × (\u00d7) : le symbole d'échec de systemd.
    `${s.etat === 'failed' ? peindre('0;1;31', '\u00d7') : s.etat === 'active' ? peindre('0;1;32', '●') : '○'} ${unite} - ${s.description}`,
    `     Loaded: loaded (${s.fichier ?? `/usr/lib/systemd/system/${unite}`}; ${s.active ? 'enabled' : 'disabled'}; preset: enabled)`,
    ...(s.surcharges?.length
      ? s.surcharges.flatMap((chemin, i) => {
          const lieu = chemin.replace(/\/[^/]+$/, '');
          const nouveauLieu = i === 0 || !s.surcharges![i - 1].startsWith(lieu + '/');
          const dernier = !s.surcharges![i + 1]?.startsWith(lieu + '/');
          return [...(nouveauLieu ? [`${i === 0 ? '    Drop-In:' : '            '} ${lieu}`] : []), `             ${dernier ? '└─' : '├─'}${chemin.split('/').at(-1)}`];
        })
      : []),
    `     Active: ${actif}`,
    ...(timerDe(sd, nom) ? [`TriggeredBy: ● ${timerDe(sd, nom)}.timer`] : []),
  ];
  if (s.etat === 'active' && s.processus[0]) lignes.push(`   Main PID: ${s.processus[0].pid} (${s.executable})`);
  // La mémoire du service (et sa limite, MemoryMax=), si la machine la suit.
  const rss = jeu.etat.memoire?.rss?.[s.processus[0]?.pid ?? -1];
  if (s.etat === 'active' && rss !== undefined) {
    const mo = (o: number) => `${(o / 1048576).toFixed(1)}M`;
    lignes.push(`     Memory: ${mo(rss)}${s.memoireMax ? ` (max: ${mo(s.memoireMax)} available: ${mo(Math.max(0, s.memoireMax - rss))})` : ''}`);
  }
  const journal = sd.journal.filter((e) => e.unite === unite && e.demarrage === sd.demarrage).slice(-10);
  if (journal.length) lignes.push('', ...journal.map((e) => ligneJournal(e, sd, langue)));
  return lignes.join('\n');
}

function liste(sd: Systemd, echecsSeulement: boolean, peindre: Peindre = brut): string {
  const unites = Object.entries(sd.services).filter(([, s]) => (echecsSeulement ? s.etat === 'failed' : s.etat !== 'inactive'));
  const largeur = Math.max(4, ...unites.map(([n]) => n.length + 8));
  const lignes = [`  ${'UNIT'.padEnd(largeur)} LOAD   ACTIVE   SUB     DESCRIPTION`];
  for (const [nom, s] of unites)
    lignes.push(
      s.etat === 'failed'
        ? `${peindre('0;1;31', '●')} ${peindre('0;1;39', `${nom}.service`.padEnd(largeur))} loaded ${peindre('0;1;31', s.etat.padEnd(8))} ${peindre('0;1;31', sousEtat(s.etat).padEnd(7))} ${s.description}`
        : `  ${`${nom}.service`.padEnd(largeur)} loaded ${s.etat.padEnd(8)} ${sousEtat(s.etat).padEnd(7)} ${s.description}`,
    );
  return [...lignes, ...LEGENDE, '', `${unites.length} loaded units listed.`].join('\n');
}

// Les fichiers de surcharge (/etc/systemd/system/NOM.service.d/*.conf, et
// ceux de systemctl set-property dans /etc/systemd/system.control) :
// MemoryMax=, IOReadBandwidthMax=, IOWriteBandwidthMax= et Restart= de la
// section [Service], relus par daemon-reload
// (systemctl edit et set-property le font tout seuls). D'après
// https://www.freedesktop.org/software/systemd/man/latest/systemd.unit.html
// (« drop-in »). Écart : les autres clés sont ignorées.
const LIEUX_SURCHARGES = ['/etc/systemd/system.control', '/etc/systemd/system'];
const cheminsSurcharges = (jeu: Shell, nom: string) =>
  LIEUX_SURCHARGES.flatMap((base) => {
    const lieu = jeu.trouver(`${base}/${nom}.service.d`);
    return lieu?.type === 'dossier' ? Object.keys(lieu.enfants).filter((f) => f.endsWith('.conf')).sort().map((f) => `${base}/${nom}.service.d/${f}`) : [];
  });
// Ce que disent les surcharges sur le disque (pour voir si elles ont changé depuis la dernière lecture).
// Le fichier d'unité écrit à la main (s'il y en a un) et ses surcharges, tels qu'ils sont sur le disque.
const empreinte = (jeu: Shell, nom: string) =>
  [`/etc/systemd/system/${nom}.service`, ...cheminsSurcharges(jeu, nom)].map((c) => `${c}\n${jeu.lire(c) ?? ''}`).join('\n');
export function chargerSurcharges(jeu: Shell, sd: Systemd) {
  for (const [nom, s] of Object.entries(sd.services)) {
    const chemins = cheminsSurcharges(jeu, nom);
    s.empreinteSurcharges = empreinte(jeu, nom);
    s.surcharges = chemins.length ? chemins : undefined;
    s.memoireMax = undefined;
    s.redemarrage = undefined;
    s.ioLecture = undefined;
    s.ioEcriture = undefined;
    // Le dernier fichier lu l'emporte (comme systemd : les noms sont triés, /etc/systemd/system après system.control ici).
    for (const chemin of chemins) {
      let section = '';
      for (const ligne of (jeu.lire(chemin) ?? '').split('\n')) {
        const l = ligne.trim();
        if (/^\[.*\]$/.test(l)) section = l;
        const m = /^(\w+)\s*=\s*(.*)$/.exec(l);
        if (!m || section !== '[Service]') continue;
        if (m[1] === 'MemoryMax') s.memoireMax = lireTaille(m[2]) ?? undefined;
        if (m[1] === 'Restart') s.redemarrage = m[2];
        const io = /^IO(Read|Write)BandwidthMax$/.exec(m[1]);
        const limite = io ? lireLimiteIO(m[2]) : null;
        if (io && limite) s[io[1] === 'Read' ? 'ioLecture' : 'ioEcriture'] = limite;
      }
    }
  }
}

/** « /dev/vda 20M » (IOWriteBandwidthMax=) → le disque et des octets par seconde ; null si illisible. */
function lireLimiteIO(texte: string): { appareil: string; octets: number } | null {
  const [appareil, debit, ...reste] = texte.trim().split(/\s+/);
  const octets = debit ? lireTaille(debit) : null;
  return appareil?.startsWith('/') && octets !== null && !reste.length ? { appareil, octets } : null;
}

/** Un moment pour journalctl --since/--until (heure de la machine, lue comme UTC) ; null si illisible. */
function lireMoment(sd: Systemd, texte: string): number | null {
  const maintenant = sd.horloge + (sd.ecart ?? 0);
  const jour = Math.floor(maintenant / 86_400_000) * 86_400_000;
  if (texte === 'now') return maintenant;
  if (texte === 'today') return jour;
  if (texte === 'yesterday') return jour - 86_400_000;
  if (texte === 'tomorrow') return jour + 86_400_000;
  const relatif = /^-(\d+)\s*(s|min|m|h|d)$/.exec(texte.trim());
  if (relatif) return maintenant - Number(relatif[1]) * { s: 1000, min: 60_000, m: 60_000, h: 3_600_000, d: 86_400_000 }[relatif[2] as 's']!;
  const m = /^(?:(\d{4})-(\d{2})-(\d{2}))?\s*(?:(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/.exec(texte.trim());
  if (!m || (!m[1] && !m[4])) return null;
  const base = m[1] ? Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : jour;
  return base + (m[4] ? (Number(m[4]) * 3600 + Number(m[5]) * 60 + Number(m[6] ?? 0)) * 1000 : 0);
}

/** daemon-reload : les unités écrites à la main, puis les surcharges. */
function relire(jeu: Shell, sd: Systemd) {
  chargerUnites(jeu, sd);
  chargerSurcharges(jeu, sd);
}

const dateOuTiret = (jeu: Shell, sd: Systemd, ms: number | null | undefined) => (ms ? dateComplete(ms, jeu.t.langue, sd) : '-');

function listeTimers(jeu: Shell, sd: Systemd, tous: boolean): string {
  const timers = Object.entries(sd.minuteries ?? {}).filter(([, m]) => tous || m.etat === 'active');
  const lignes = timers
    .map(([nom, m]) => ({ nom, m, prochain: prochainDeclenchement(sd, m, sd.horloge) }))
    .sort((a, b) => (a.prochain ?? Infinity) - (b.prochain ?? Infinity))
    .map(({ nom, m, prochain }) => [
      dateOuTiret(jeu, sd, prochain),
      prochain ? `${duree(prochain - sd.horloge)} left` : '-',
      dateOuTiret(jeu, sd, m.dernier),
      m.dernier ? `${duree(sd.horloge - m.dernier)} ago` : '-',
      `${nom}.timer`,
      `${m.unite}.service`,
    ]);
  const entete = ['NEXT', 'LEFT', 'LAST', 'PASSED', 'UNIT', 'ACTIVATES'];
  const largeurs = entete.map((e, i) => Math.max(e.length, ...lignes.map((l) => l[i].length)));
  // Deux espaces entre les colonnes : le tableau reste d'un seul tenant à l'écran.
  const aligner = (l: string[]) => l.map((c, i) => (i === l.length - 1 ? c : c.padEnd(largeurs[i]))).join('  ');
  return [
    aligner(entete),
    ...lignes.map(aligner),
    '',
    `${lignes.length} timers listed.`,
    ...(tous ? [] : ['Pass --all to see loaded but inactive timers, too.']),
  ].join('\n');
}

// systemctl start, stop, enable, status… d'un timer.
function actionTimer(jeu: Shell, sd: Systemd, action: string, nom: string, maintenant: boolean): string {
  if (!sd.minuteries?.[nom] && jeu.existe(`/etc/systemd/system/${nom}.timer`)) relire(jeu, sd);
  const m = sd.minuteries?.[nom];
  const unite = `${nom}.timer`;
  if (!m) return jeu.erreur(action === 'status' || action.startsWith('is-') ? `Unit ${unite} could not be found.` : `Failed to ${action} ${unite}: Unit ${unite} not found.`);
  if (action === 'status') {
    const prochain = prochainDeclenchement(sd, m, sd.horloge);
    const service = sd.services[m.unite];
    return [
      `${m.etat === 'active' ? '●' : '○'} ${unite} - ${m.description}`,
      `     Loaded: loaded (${m.fichier}; ${m.active ? 'enabled' : 'disabled'}; preset: enabled)`,
      `     Active: ${m.etat === 'active' ? `active (waiting) since ${dateComplete(m.depuis, jeu.t.langue, sd)}; ${duree(sd.horloge - m.depuis)} ago` : 'inactive (dead)'}`,
      ...(m.etat === 'active' ? [`    Trigger: ${prochain ? `${dateComplete(prochain, jeu.t.langue, sd)}; ${duree(prochain - sd.horloge)} left` : 'n/a'}`] : []),
      `   Triggers: ${service?.etat === 'failed' ? '\u00d7' : '●'} ${m.unite}.service`,
      ...sd.journal
        .filter((e) => e.unite === unite)
        .slice(-5)
        .map((e) => ligneJournal(e, sd, jeu.t.langue))
        .reduce<string[]>((l, x, i) => (i === 0 ? ['', x] : [...l, x]), []),
    ].join('\n');
  }
  if (action === 'is-active') return m.etat;
  if (action === 'is-enabled') return m.active ? 'enabled' : 'disabled';
  if (jeu.qui !== 'root') return refuse(jeu, action, unite);
  const demarrerTimer = (): boolean => {
    if (m.etat === 'active') return true;
    if (!m.calendrier.length && m.apresDemarrage === undefined && m.apresActivation === undefined && m.apresDerniere === undefined) {
      journaliser(sd, unite, 'systemd', 1, `${unite}: Timer unit lacks value setting. Refusing.`, 3);
      jeu.erreur(`Failed to start ${unite}: Unit ${unite} has a bad unit file setting.\nSee system logs and 'systemctl status ${unite}' for details.`);
      return false;
    }
    if (!sd.services[m.unite] && !(jeu.existe(`/etc/systemd/system/${m.unite}.service`) && (relire(jeu, sd), sd.services[m.unite]))) {
      journaliser(sd, unite, 'systemd', 1, `${unite}: Refusing to start, unit ${m.unite}.service to trigger not loaded.`, 3);
      jeu.erreur(`Failed to start ${unite}: Unit ${m.unite}.service not found.`);
      return false;
    }
    m.etat = 'active';
    m.depuis = sd.horloge;
    journaliser(sd, unite, 'systemd', 1, `Started ${unite} - ${m.description}.`);
    return true;
  };
  const arreterTimer = () => {
    if (m.etat !== 'active') return;
    m.etat = 'inactive';
    m.depuis = sd.horloge;
    journaliser(sd, unite, 'systemd', 1, `${unite}: Deactivated successfully.`);
    journaliser(sd, unite, 'systemd', 1, `Stopped ${unite} - ${m.description}.`, 6, false);
  };
  const lien = `/etc/systemd/system/timers.target.wants/${unite}`;
  switch (action) {
    case 'start':
      demarrerTimer();
      return '';
    case 'stop':
      arreterTimer();
      return '';
    case 'restart':
      arreterTimer();
      demarrerTimer();
      return '';
    case 'enable': {
      // Sans section [Install] (WantedBy=timers.target), rien à activer.
      if (!/^\s*WantedBy\s*=/m.test(jeu.lire(m.fichier) ?? 'WantedBy=timers.target'))
        return [
          'The unit files have no installation config (WantedBy=, RequiredBy=, UpheldBy=,',
          'Also=, or Alias= settings in the [Install] section, and DefaultInstance= for',
          'template units). This means they are not meant to be enabled or disabled using systemctl.',
        ].join('\n');
      const sortie = m.active ? '' : `Created symlink ${lien} → ${m.fichier}.`;
      m.active = true;
      if (maintenant) demarrerTimer();
      return sortie;
    }
    case 'disable': {
      const sortie = m.active ? `Removed "${lien}".` : '';
      m.active = false;
      if (maintenant) arreterTimer();
      return sortie;
    }
    default:
      return jeu.erreur(`Failed to ${action} ${unite}: Operation not supported`);
  }
}

// systemctl edit : la surcharge s'ouvre dans l'éditeur ; à la fermeture, systemd la relit.
function editerSurcharge(jeu: Shell, sd: Systemd, nom: string): string {
  const lieu = `/etc/systemd/system/${nom}.service.d`;
  const fichier = `${lieu}/override.conf`;
  for (const chemin of ['/etc/systemd', '/etc/systemd/system', lieu])
    if (!jeu.existe(chemin)) jeu.placer('systemctl', chemin, { type: 'dossier', enfants: {}, proprio: 'root' });
  const existant = jeu.lire(fichier);
  const modele = `### Editing ${fichier}\n### Anything between here and the comment below will become the contents of the drop-in file\n\n\n\n### Edits below this comment will be discarded\n`;
  const texte = existant ?? modele;
  jeu.edition = {
    chemin: fichier,
    texte,
    root: true,
    conclure: true,
    message: jeu.t('nano-lignes-lues', { lignes: texte.split('\n').length }),
    apres: () => {
      // Seules les lignes au-dessus du commentaire « Edits below… » sont gardées.
      const brut = jeu.lire(fichier) ?? '';
      const garde = brut
        .split('### Edits below this comment will be discarded')[0]
        .split('\n')
        .filter((l) => !l.startsWith('### '))
        .join('\n')
        .trim();
      const n = jeu.trouver(fichier);
      if (!garde) {
        const d = jeu.trouver(lieu);
        if (d?.type === 'dossier') delete d.enfants['override.conf'];
      } else if (n?.type === 'fichier') n.contenu = garde;
      chargerSurcharges(jeu, sd);
      return '';
    },
  };
  return '';
}

// systemctl sans être root : systemd demanderait un mot de passe (polkit).
const refuse = (jeu: Shell, action: string, nom: string) => jeu.erreur(jeu.t('systemctl-acces-refuse', { action, service: nom }));

export const SYSTEMD: Record<string, Commande> = {
  // systemd-analyze calendar : tester une expression OnCalendar= avant de l'écrire dans un timer.
  'systemd-analyze': {
    propresOptions: true,
    lancer: ({ args, jeu }) => {
      const sd = systemd(jeu);
      const [verbe, ...expressions] = args.filter((a) => !a.startsWith('--'));
      if (verbe !== 'calendar') return jeu.erreur(verbe ? `Unknown command verb '${verbe}'.` : 'Too few arguments.');
      if (!expressions.length) return jeu.erreur('Too few arguments.');
      const blocs: string[] = [];
      for (const texte of expressions) {
        const c = lireCalendrier(texte);
        if (!c) {
          jeu.erreur(`Failed to parse calendar specification '${texte}': Invalid argument`);
          continue;
        }
        const maintenant = sd?.horloge ?? Date.UTC(2027, 0, 1);
        const prochain = prochainCalendrier(c, maintenant);
        const utc = prochain ? new Date(versUtc(prochain)).toISOString() : '';
        const jour = prochain ? new Intl.DateTimeFormat(jeu.t.langue, { timeZone: 'UTC', weekday: 'short' }).format(new Date(versUtc(prochain))) : '';
        blocs.push(
          [
            `  Original form: ${texte}`,
            `Normalized form: ${c.normal}`,
            `    Next elapse: ${prochain ? dateComplete(prochain, jeu.t.langue, sd) : 'never'}`,
            ...(prochain ? [`       (in UTC): ${jour} ${utc.slice(0, 10)} ${utc.slice(11, 19)} UTC`, `       From now: ${duree(prochain - maintenant)} left`] : []),
          ].join('\n'),
        );
      }
      return blocs.join('\n\n');
    },
  },

  systemctl: {
    lancer: (c) => {
      const { args, jeu } = c;
      // Sur un terminal, systemctl colore (pas dans un tube ni un fichier).
      const peindre: Peindre = colorer(c, 'auto') ? sgr : brut;
      const sd = systemd(jeu);
      if (!sd) return jeu.erreur('System has not been booted with systemd as init system (PID 1). Can\'t operate.');
      const maintenant = args.includes('--now');
      const inconnue = args.find((a) => /^-[^-]/.test(a));
      if (inconnue) return jeu.erreur(`systemctl: invalid option -- '${inconnue[1]}'`);
      const mots = args.filter((a) => !a.startsWith('--') || a === '--failed');
      const [action = 'list-units', ...noms] = mots;
      const VERBES = ['status', 'start', 'stop', 'restart', 'reload', 'enable', 'disable', 'is-active', 'is-enabled', 'list-units', 'reboot', '--failed', 'edit', 'daemon-reload', 'set-property', 'list-timers'];
      if (!VERBES.includes(action)) return jeu.erreur(`Unknown command verb '${action}'.`);
      // Consulter l'état des services après un redémarrage : c'est vérifier.
      const consulter = () => (sd.verifieApresDemarrage = true);
      if (action === '--failed' || (action === 'list-units' && args.includes('--failed'))) return consulter(), liste(sd, true, peindre);
      if (action === 'list-units') return consulter(), liste(sd, false, peindre);
      if (action === 'daemon-reload') {
        if (jeu.qui !== 'root') return refuse(jeu, 'daemon-reload', 'systemd');
        relire(jeu, sd);
        return '';
      }
      if (action === 'list-timers') return listeTimers(jeu, sd, args.includes('--all'));
      // set-property : la limite s'applique tout de suite, et reste (un fichier dans system.control).
      if (action === 'set-property') {
        const nom = nomUnite(noms[0] ?? '');
        const proprietes = noms.slice(1);
        if (!noms.length || !proprietes.length) return jeu.erreur('Too few arguments.');
        if (!sd.services[nom]) return jeu.erreur(`Failed to set unit properties on ${nom}.service: Unit ${nom}.service not found.`);
        if (jeu.qui !== 'root') return refuse(jeu, 'set-property', nom);
        for (const p of proprietes) {
          const m = /^(\w+)=(.*)$/.exec(p);
          if (!m) return jeu.erreur(`Failed to set unit properties on ${nom}.service: Not assignment: ${p}`);
          const io = /^IO(Read|Write)BandwidthMax$/.test(m[1]);
          if (m[1] !== 'MemoryMax' && !io) return jeu.erreur(`Failed to set unit properties on ${nom}.service: Cannot set property ${m[1]}, or unknown property.`);
          if (io && !lireLimiteIO(m[2])) return jeu.erreur(`Failed to parse ${m[1]}= value: ${m[2]}`);
          if (!io && m[2] !== 'infinity' && lireTaille(m[2]) === null) return jeu.erreur(`Failed to parse MemoryMax= value: ${m[2]}`);
          const lieu = `/etc/systemd/system.control/${nom}.service.d`;
          for (const chemin of ['/etc/systemd', '/etc/systemd/system.control', lieu])
            if (!jeu.existe(chemin)) jeu.placer('systemctl', chemin, { type: 'dossier', enfants: {}, proprio: 'root' });
          const fichier = `${lieu}/50-${m[1]}.conf`;
          const valeur = io ? `${lireLimiteIO(m[2])!.appareil} ${lireLimiteIO(m[2])!.octets}` : m[2] === 'infinity' ? 'infinity' : lireTaille(m[2]);
          const contenu = `# This is a drop-in unit file extension, created via "systemctl set-property"\n# or an equivalent operation. Do not edit.\n[Service]\n${m[1]}=${valeur}`;
          const n = jeu.trouver(fichier);
          if (n?.type === 'fichier') n.contenu = contenu;
          else jeu.placer('systemctl', fichier, { type: 'fichier', contenu, lignes: true, proprio: 'root' });
        }
        chargerSurcharges(jeu, sd);
        return '';
      }
      if (action === 'edit') {
        const nom = nomUnite(noms[0] ?? '');
        if (!noms.length) return jeu.erreur('Too few arguments.');
        if (!sd.services[nom]) return jeu.erreur(`No files found for ${nom}.service.`);
        if (jeu.qui !== 'root') return refuse(jeu, 'edit', nom);
        return editerSurcharge(jeu, sd, nom);
      }
      if (action === 'reboot') {
        if (jeu.qui !== 'root') return refuse(jeu, 'reboot', 'system');
        redemarrer(jeu, sd);
        jeu.redemarrage = true;
        return '';
      }
      if (!noms.length) return jeu.erreur(action === 'status' ? jeu.t('systemctl-usage') : `Too few arguments.`);
      const sorties: string[] = [];
      for (const brut of noms) {
        if (brut.endsWith('.timer')) {
          const r = actionTimer(jeu, sd, action, brut.slice(0, -6), maintenant);
          if (r) sorties.push(r);
          continue;
        }
        const nom = nomUnite(brut);
        // Une unité écrite à la main et jamais chargée : systemd la lit à la demande.
        if (!sd.services[nom] && jeu.existe(`/etc/systemd/system/${nom}.service`)) relire(jeu, sd);
        const s = sd.services[nom];
        if (!s) {
          if (action === 'status' || action.startsWith('is-')) jeu.erreur(`Unit ${nom}.service could not be found.`);
          else jeu.erreur(`Failed to ${action} ${nom}.service: Unit ${nom}.service not found.`);
          continue;
        }
        // Une surcharge écrite à la main n'est lue qu'après daemon-reload : systemctl le rappelle.
        // (Jamais relue : l'état de départ, sans fichier d'unité ni surcharge.)
        if (empreinte(jeu, nom) !== (s.empreinteSurcharges ?? `/etc/systemd/system/${nom}.service\n`))
          sorties.push(`Warning: The unit file, source configuration file or drop-ins of ${nom}.service changed on disk. Run 'systemctl daemon-reload' to reload units.`);
        if (action === 'status') {
          consulter();
          sorties.push(statut(jeu, sd, nom, peindre));
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
            else if (!recharger(jeu, sd, nom))
              jeu.erreur(
                `Job for ${nom}.service failed because the control process exited with error code.\nSee "systemctl status ${nom}.service" and "journalctl -xeu ${nom}.service" for details.`,
              );
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
      let noyauSeul = false;
      let depuis: number | null = null;
      let jusque: number | null = null;
      for (let i = 0; i < args.length; i++) {
        const a = args[i];
        if (a.startsWith('--')) {
          if (a.startsWith('--unit=')) unite = a.slice(7);
          else if (a === '--no-pager' || a === '--pager-end') continue;
          // --since / --until : une date (« 2027-09-12 02:00 »), une heure (aujourd'hui), today, yesterday.
          else if (/^--(since|until)(=|$)/.test(a)) {
            const valeur = a.includes('=') ? a.slice(a.indexOf('=') + 1) : args[++i];
            const ms = valeur === undefined ? null : lireMoment(sd, valeur);
            if (ms === null) return jeu.erreur(`Failed to parse timestamp: ${valeur ?? ''}`);
            if (a.startsWith('--since')) depuis = ms;
            else jusque = ms;
          }
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
          // -k : les messages du noyau, depuis ce démarrage.
          else if (l === 'k') {
            noyauSeul = true;
            demarrageSeul = true;
          }
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
      // Les dates se lisent à l'heure de la machine (celle que le journal affiche).
      const affiche = (e: { temps: number }) => e.temps + (sd.ecart ?? 0);
      let entrees = sd.journal.filter(
        (e) =>
          (!u || e.unite === u) &&
          (!noyauSeul || e.ident === 'kernel') &&
          e.priorite <= priorite &&
          (!demarrageSeul || e.demarrage === sd.demarrage) &&
          (depuis === null || affiche(e) >= depuis) &&
          (jusque === null || affiche(e) <= jusque),
      );
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
