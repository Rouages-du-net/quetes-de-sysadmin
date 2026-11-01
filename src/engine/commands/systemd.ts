// systemctl, journalctl et reboot, sur le systemd simulé (../systemd.ts).
// Messages d'après systemd (https://www.freedesktop.org/software/systemd/man/latest/) :
// ils restent en anglais, comme ceux du vrai systemctl.

import type { Shell } from '../shell';
import { stop, dateComplete, start, duration, writeLog, logLine, reload, restart, systemd, type Systemd } from '../systemd';
import type { Command } from './index';
import { colourise, sgr } from '../colours';
import { readSize } from '../memory';
import { loadUnits, readCalendar, nextCalendar, nextTrigger, timerFor } from '../timers';
import { toUtc } from '../systemd';

const CAPTION = [
  '',
  'LOAD   = Reflects whether the unit definition was properly loaded.',
  'ACTIVE = The high-level unit activation state, i.e. generalization of SUB.',
  'SUB    = The low-level unit activation state, values depend on unit type.',
];

const underState = (state: string) => (state === 'active' ? 'running' : state === 'failed' ? 'failed' : 'dead');
const unitName = (raw: string) => raw.replace(/\.service$/, '');

// Comme systemctl sur un terminal : le point vert d'un service actif, la croix rouge d'un échec.
type Paint = (code: string, text: string) => string;
const raw: Paint = (_code, text) => text;

function status(game: Shell, sd: Systemd, name: string, paint: Paint = raw): string {
  const s = sd.services[name];
  const unit = `${name}.service`;
  const language = game.t.language;
  const since = `since ${dateComplete(s.since, language, sd)}; ${duration(sd.clock - s.since)} ago`;
  const enabled =
    s.state === 'active'
      ? `${paint('0;1;32', `active (${s.activeRest ? 'exited' : 'running'})`)} ${since}`
      : s.state === 'failed'
        ? `${paint('0;1;31', 'failed')} (Result: ${s.result ?? 'exit-code'}) ${since}`
        : `inactive (dead)`;
  const lines = [
    // × (\u00d7) : le symbole d'échec de systemd.
    `${s.state === 'failed' ? paint('0;1;31', '\u00d7') : s.state === 'active' ? paint('0;1;32', '●') : '○'} ${unit} - ${s.description}`,
    `     Loaded: loaded (${s.file ?? `/usr/lib/systemd/system/${unit}`}; ${s.active ? 'enabled' : 'disabled'}; preset: enabled)`,
    ...(s.overrides?.length
      ? s.overrides.flatMap((path, i) => {
          const place = path.replace(/\/[^/]+$/, '');
          const newPlace = i === 0 || !s.overrides![i - 1].startsWith(place + '/');
          const last = !s.overrides![i + 1]?.startsWith(place + '/');
          return [...(newPlace ? [`${i === 0 ? '    Drop-In:' : '            '} ${place}`] : []), `             ${last ? '└─' : '├─'}${path.split('/').at(-1)}`];
        })
      : []),
    `     Active: ${enabled}`,
    ...(timerFor(sd, name) ? [`TriggeredBy: ● ${timerFor(sd, name)}.timer`] : []),
  ];
  if (s.state === 'active' && s.process[0]) lines.push(`   Main PID: ${s.process[0].pid} (${s.executable})`);
  // La mémoire du service (et sa limite, MemoryMax=), si la machine la suit.
  const rss = game.state.memory?.rss?.[s.process[0]?.pid ?? -1];
  if (s.state === 'active' && rss !== undefined) {
    const mo = (o: number) => `${(o / 1048576).toFixed(1)}M`;
    lines.push(`     Memory: ${mo(rss)}${s.maxMemory ? ` (max: ${mo(s.maxMemory)} available: ${mo(Math.max(0, s.maxMemory - rss))})` : ''}`);
  }
  const log = sd.log.filter((e) => e.unit === unit && e.boot === sd.boot).slice(-10);
  if (log.length) lines.push('', ...log.map((e) => logLine(e, sd, language, paint !== raw)));
  return lines.join('\n');
}

function listing(sd: Systemd, onlyFailures: boolean, paint: Paint = raw): string {
  const units = Object.entries(sd.services).filter(([, s]) => (onlyFailures ? s.state === 'failed' : s.state !== 'inactive'));
  const width = Math.max(4, ...units.map(([n]) => n.length + 8));
  const lines = [`  ${'UNIT'.padEnd(width)} LOAD   ACTIVE   SUB     DESCRIPTION`];
  for (const [name, s] of units)
    lines.push(
      s.state === 'failed'
        ? `${paint('0;1;31', '●')} ${paint('0;1;39', `${name}.service`.padEnd(width))} loaded ${paint('0;1;31', s.state.padEnd(8))} ${paint('0;1;31', underState(s.state).padEnd(7))} ${s.description}`
        : `  ${`${name}.service`.padEnd(width)} loaded ${s.state.padEnd(8)} ${underState(s.state).padEnd(7)} ${s.description}`,
    );
  return [...lines, ...CAPTION, '', `${units.length} loaded units listed.`].join('\n');
}

// Les fichiers de surcharge (/etc/systemd/system/NOM.service.d/*.conf, et
// ceux de systemctl set-property dans /etc/systemd/system.control) :
// MemoryMax=, IOReadBandwidthMax=, IOWriteBandwidthMax= et Restart= de la
// section [Service], relus par daemon-reload
// (systemctl edit et set-property le font tout seuls). D'après
// https://www.freedesktop.org/software/systemd/man/latest/systemd.unit.html
// (« drop-in »). Écart : les autres clés sont ignorées.
const OVERRIDES_PLACES = ['/etc/systemd/system.control', '/etc/systemd/system'];
const overridesPaths = (game: Shell, name: string) =>
  OVERRIDES_PLACES.flatMap((base) => {
    const place = game.find(`${base}/${name}.service.d`);
    return place?.type === 'dossier' ? Object.keys(place.children).filter((f) => f.endsWith('.conf')).sort().map((f) => `${base}/${name}.service.d/${f}`) : [];
  });
// Ce que disent les surcharges sur le disque (pour voir si elles ont changé depuis la dernière lecture).
// Le fichier d'unité écrit à la main (s'il y en a un) et ses surcharges, tels qu'ils sont sur le disque.
const fingerprint = (game: Shell, name: string) =>
  [`/etc/systemd/system/${name}.service`, ...overridesPaths(game, name)].map((c) => `${c}\n${game.read(c) ?? ''}`).join('\n');
export function loadOverrides(game: Shell, sd: Systemd) {
  for (const [name, s] of Object.entries(sd.services)) {
    const paths = overridesPaths(game, name);
    s.overridesFingerprint = fingerprint(game, name);
    s.overrides = paths.length ? paths : undefined;
    s.maxMemory = undefined;
    s.reboot = undefined;
    s.readIo = undefined;
    s.writeIo = undefined;
    // Le dernier fichier lu l'emporte (comme systemd : les noms sont triés, /etc/systemd/system après system.control ici).
    for (const path of paths) {
      let section = '';
      for (const line of (game.read(path) ?? '').split('\n')) {
        const l = line.trim();
        if (/^\[.*\]$/.test(l)) section = l;
        const m = /^(\w+)\s*=\s*(.*)$/.exec(l);
        if (!m || section !== '[Service]') continue;
        if (m[1] === 'MemoryMax') s.maxMemory = readSize(m[2]) ?? undefined;
        if (m[1] === 'Restart') s.reboot = m[2];
        const io = /^IO(Read|Write)BandwidthMax$/.exec(m[1]);
        const limit = io ? readIoLimit(m[2]) : null;
        if (io && limit) s[io[1] === 'Read' ? 'readIo' : 'writeIo'] = limit;
      }
    }
  }
}

/** « /dev/vda 20M » (IOWriteBandwidthMax=) → le disque et des octets par seconde ; null si illisible. */
function readIoLimit(text: string): { device: string; bytes: number } | null {
  const [device, rate, ...rest] = text.trim().split(/\s+/);
  const bytes = rate ? readSize(rate) : null;
  return device?.startsWith('/') && bytes !== null && !rest.length ? { device, bytes } : null;
}

/** Un moment pour journalctl --since/--until (heure de la machine, lue comme UTC) ; null si illisible. */
function readMoment(sd: Systemd, text: string): number | null {
  const now = sd.clock + (sd.difference ?? 0);
  const day = Math.floor(now / 86_400_000) * 86_400_000;
  if (text === 'now') return now;
  if (text === 'today') return day;
  if (text === 'yesterday') return day - 86_400_000;
  if (text === 'tomorrow') return day + 86_400_000;
  const relative = /^-(\d+)\s*(s|min|m|h|d)$/.exec(text.trim());
  if (relative) return now - Number(relative[1]) * { s: 1000, min: 60_000, m: 60_000, h: 3_600_000, d: 86_400_000 }[relative[2] as 's']!;
  const m = /^(?:(\d{4})-(\d{2})-(\d{2}))?\s*(?:(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/.exec(text.trim());
  if (!m || (!m[1] && !m[4])) return null;
  const base = m[1] ? Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : day;
  return base + (m[4] ? (Number(m[4]) * 3600 + Number(m[5]) * 60 + Number(m[6] ?? 0)) * 1000 : 0);
}

/** daemon-reload : les unités écrites à la main, puis les surcharges. */
function reread(game: Shell, sd: Systemd) {
  loadUnits(game, sd);
  loadOverrides(game, sd);
}

const dateOrDash = (game: Shell, sd: Systemd, ms: number | null | undefined) => (ms ? dateComplete(ms, game.t.language, sd) : '-');

function timersList(game: Shell, sd: Systemd, all: boolean): string {
  const timers = Object.entries(sd.timers ?? {}).filter(([, m]) => all || m.state === 'active');
  const lines = timers
    .map(([name, m]) => ({ name, m, next: nextTrigger(sd, m, sd.clock) }))
    .sort((a, b) => (a.next ?? Infinity) - (b.next ?? Infinity))
    .map(({ name, m, next }) => [
      dateOrDash(game, sd, next),
      next ? `${duration(next - sd.clock)} left` : '-',
      dateOrDash(game, sd, m.last),
      m.last ? `${duration(sd.clock - m.last)} ago` : '-',
      `${name}.timer`,
      `${m.unit}.service`,
    ]);
  const header = ['NEXT', 'LEFT', 'LAST', 'PASSED', 'UNIT', 'ACTIVATES'];
  const widths = header.map((e, i) => Math.max(e.length, ...lines.map((l) => l[i].length)));
  // Deux espaces entre les colonnes : le tableau reste d'un seul tenant à l'écran.
  const aligner = (l: string[]) => l.map((c, i) => (i === l.length - 1 ? c : c.padEnd(widths[i]))).join('  ');
  return [
    aligner(header),
    ...lines.map(aligner),
    '',
    `${lines.length} timers listed.`,
    ...(all ? [] : ['Pass --all to see loaded but inactive timers, too.']),
  ].join('\n');
}

// systemctl start, stop, enable, status… d'un timer.
function actionTimer(game: Shell, sd: Systemd, action: string, name: string, now: boolean): string {
  if (!sd.timers?.[name] && game.exists(`/etc/systemd/system/${name}.timer`)) reread(game, sd);
  const m = sd.timers?.[name];
  const unit = `${name}.timer`;
  if (!m) return game.error(action === 'status' || action.startsWith('is-') ? `Unit ${unit} could not be found.` : `Failed to ${action} ${unit}: Unit ${unit} not found.`);
  if (action === 'status') {
    const next = nextTrigger(sd, m, sd.clock);
    const service = sd.services[m.unit];
    return [
      `${m.state === 'active' ? '●' : '○'} ${unit} - ${m.description}`,
      `     Loaded: loaded (${m.file}; ${m.active ? 'enabled' : 'disabled'}; preset: enabled)`,
      `     Active: ${m.state === 'active' ? `active (waiting) since ${dateComplete(m.since, game.t.language, sd)}; ${duration(sd.clock - m.since)} ago` : 'inactive (dead)'}`,
      ...(m.state === 'active' ? [`    Trigger: ${next ? `${dateComplete(next, game.t.language, sd)}; ${duration(next - sd.clock)} left` : 'n/a'}`] : []),
      `   Triggers: ${service?.state === 'failed' ? '\u00d7' : '●'} ${m.unit}.service`,
      ...sd.log
        .filter((e) => e.unit === unit)
        .slice(-5)
        .map((e) => logLine(e, sd, game.t.language))
        .reduce<string[]>((l, x, i) => (i === 0 ? ['', x] : [...l, x]), []),
    ].join('\n');
  }
  if (action === 'is-active') return m.state;
  if (action === 'is-enabled') return m.active ? 'enabled' : 'disabled';
  if (game.who !== 'root') return refuse(game, action, unit);
  const startTimer = (): boolean => {
    if (m.state === 'active') return true;
    if (!m.calendar.length && m.afterBoot === undefined && m.afterActivation === undefined && m.afterLast === undefined) {
      writeLog(sd, unit, 'systemd', 1, `${unit}: Timer unit lacks value setting. Refusing.`, 3);
      game.error(`Failed to start ${unit}: Unit ${unit} has a bad unit file setting.\nSee system logs and 'systemctl status ${unit}' for details.`);
      return false;
    }
    if (!sd.services[m.unit] && !(game.exists(`/etc/systemd/system/${m.unit}.service`) && (reread(game, sd), sd.services[m.unit]))) {
      writeLog(sd, unit, 'systemd', 1, `${unit}: Refusing to start, unit ${m.unit}.service to trigger not loaded.`, 3);
      game.error(`Failed to start ${unit}: Unit ${m.unit}.service not found.`);
      return false;
    }
    m.state = 'active';
    m.since = sd.clock;
    writeLog(sd, unit, 'systemd', 1, `Started ${unit} - ${m.description}.`);
    return true;
  };
  const stopTimer = () => {
    if (m.state !== 'active') return;
    m.state = 'inactive';
    m.since = sd.clock;
    writeLog(sd, unit, 'systemd', 1, `${unit}: Deactivated successfully.`);
    writeLog(sd, unit, 'systemd', 1, `Stopped ${unit} - ${m.description}.`, 6, false);
  };
  const link = `/etc/systemd/system/timers.target.wants/${unit}`;
  switch (action) {
    case 'start':
      startTimer();
      return '';
    case 'stop':
      stopTimer();
      return '';
    case 'restart':
      stopTimer();
      startTimer();
      return '';
    case 'enable': {
      // Sans section [Install] (WantedBy=timers.target), rien à activer.
      if (!/^\s*WantedBy\s*=/m.test(game.read(m.file) ?? 'WantedBy=timers.target'))
        return [
          'The unit files have no installation config (WantedBy=, RequiredBy=, UpheldBy=,',
          'Also=, or Alias= settings in the [Install] section, and DefaultInstance= for',
          'template units). This means they are not meant to be enabled or disabled using systemctl.',
        ].join('\n');
      const output = m.active ? '' : `Created symlink ${link} → ${m.file}.`;
      m.active = true;
      if (now) startTimer();
      return output;
    }
    case 'disable': {
      const output = m.active ? `Removed "${link}".` : '';
      m.active = false;
      if (now) stopTimer();
      return output;
    }
    default:
      return game.error(`Failed to ${action} ${unit}: Operation not supported`);
  }
}

// systemctl edit : la surcharge s'ouvre dans l'éditeur ; à la fermeture, systemd la relit.
function editOverride(game: Shell, sd: Systemd, name: string): string {
  const place = `/etc/systemd/system/${name}.service.d`;
  const file = `${place}/override.conf`;
  for (const path of ['/etc/systemd', '/etc/systemd/system', place])
    if (!game.exists(path)) game.place('systemctl', path, { type: 'dossier', children: {}, owner: 'root' });
  const existing = game.read(file);
  const template = `### Editing ${file}\n### Anything between here and the comment below will become the contents of the drop-in file\n\n\n\n### Edits below this comment will be discarded\n`;
  const text = existing ?? template;
  game.edition = {
    path: file,
    text,
    root: true,
    conclude: true,
    message: game.t('nano-lines-read', { lines: text.split('\n').length }),
    after: () => {
      // Seules les lignes au-dessus du commentaire « Edits below… » sont gardées.
      const raw = game.read(file) ?? '';
      const kept = raw
        .split('### Edits below this comment will be discarded')[0]
        .split('\n')
        .filter((l) => !l.startsWith('### '))
        .join('\n')
        .trim();
      const n = game.find(file);
      if (!kept) {
        const d = game.find(place);
        if (d?.type === 'dossier') delete d.children['override.conf'];
      } else if (n?.type === 'fichier') n.content = kept;
      loadOverrides(game, sd);
      return '';
    },
  };
  return '';
}

// systemctl sans être root : systemd demanderait un mot de passe (polkit).
const refuse = (game: Shell, action: string, name: string) => game.error(game.t('systemctl-access-refuse', { action, service: name }));

export const SYSTEMD: Record<string, Command> = {
  // systemd-analyze calendar : tester une expression OnCalendar= avant de l'écrire dans un timer.
  'systemd-analyze': {
    ownOptions: true,
    launch: ({ args, game }) => {
      const sd = systemd(game);
      const [verb, ...expressions] = args.filter((a) => !a.startsWith('--'));
      if (verb !== 'calendar') return game.error(verb ? `Unknown command verb '${verb}'.` : 'Too few arguments.');
      if (!expressions.length) return game.error('Too few arguments.');
      const blocks: string[] = [];
      for (const text of expressions) {
        const c = readCalendar(text);
        if (!c) {
          game.error(`Failed to parse calendar specification '${text}': Invalid argument`);
          continue;
        }
        const now = sd?.clock ?? Date.UTC(2027, 0, 1);
        const next = nextCalendar(c, now);
        const utc = next ? new Date(toUtc(next)).toISOString() : '';
        const day = next ? new Intl.DateTimeFormat(game.t.language, { timeZone: 'UTC', weekday: 'short' }).format(new Date(toUtc(next))) : '';
        blocks.push(
          [
            `  Original form: ${text}`,
            `Normalized form: ${c.normal}`,
            `    Next elapse: ${next ? dateComplete(next, game.t.language, sd) : 'never'}`,
            ...(next ? [`       (in UTC): ${day} ${utc.slice(0, 10)} ${utc.slice(11, 19)} UTC`, `       From now: ${duration(next - now)} left`] : []),
          ].join('\n'),
        );
      }
      return blocks.join('\n\n');
    },
  },

  systemctl: {
    launch: (c) => {
      const { args, game } = c;
      // Sur un terminal, systemctl colore (pas dans un tube ni un fichier).
      const paint: Paint = colourise(c, 'auto') ? sgr : raw;
      const sd = systemd(game);
      if (!sd) return game.error('System has not been booted with systemd as init system (PID 1). Can\'t operate.');
      const now = args.includes('--now');
      const unknown = args.find((a) => /^-[^-]/.test(a));
      if (unknown) return game.error(`systemctl: invalid option -- '${unknown[1]}'`);
      const words = args.filter((a) => !a.startsWith('--') || a === '--failed');
      const [action = 'list-units', ...names] = words;
      const VERBS = ['status', 'start', 'stop', 'restart', 'reload', 'enable', 'disable', 'is-active', 'is-enabled', 'list-units', 'reboot', '--failed', 'edit', 'daemon-reload', 'set-property', 'list-timers', 'default'];
      if (!VERBS.includes(action)) return game.error(`Unknown command verb '${action}'.`);
      // Consulter l'état des services après un redémarrage : c'est vérifier.
      const consulter = () => (sd.checkedAfterBoot = true);
      if (action === '--failed' || (action === 'list-units' && args.includes('--failed'))) return consulter(), listing(sd, true, paint);
      if (action === 'list-units') return consulter(), listing(sd, false, paint);
      if (action === 'daemon-reload') {
        if (game.who !== 'root') return refuse(game, 'daemon-reload', 'systemd');
        reread(game, sd);
        // systemd relit aussi /etc/fstab (ses unités .mount en sont tirées).
        if (game.state.fstabRead !== undefined) game.state.fstabRead = game.read('/etc/fstab') ?? '';
        return '';
      }
      // default : quitter le mode secours, reprendre le démarrage normal (multi-user.target).
      if (action === 'default') {
        if (game.who !== 'root') return refuse(game, 'default', 'system');
        const resume = game.state.continueBoot as ((j: Shell) => string) | undefined;
        return resume ? resume(game) : '';
      }
      if (action === 'list-timers') return timersList(game, sd, args.includes('--all'));
      // set-property : la limite s'applique tout de suite, et reste (un fichier dans system.control).
      if (action === 'set-property') {
        const name = unitName(names[0] ?? '');
        const properties = names.slice(1);
        if (!names.length || !properties.length) return game.error('Too few arguments.');
        if (!sd.services[name]) return game.error(`Failed to set unit properties on ${name}.service: Unit ${name}.service not found.`);
        if (game.who !== 'root') return refuse(game, 'set-property', name);
        for (const p of properties) {
          const m = /^(\w+)=(.*)$/.exec(p);
          if (!m) return game.error(`Failed to set unit properties on ${name}.service: Not assignment: ${p}`);
          const io = /^IO(Read|Write)BandwidthMax$/.test(m[1]);
          if (m[1] !== 'MemoryMax' && !io) return game.error(`Failed to set unit properties on ${name}.service: Cannot set property ${m[1]}, or unknown property.`);
          if (io && !readIoLimit(m[2])) return game.error(`Failed to parse ${m[1]}= value: ${m[2]}`);
          if (!io && m[2] !== 'infinity' && readSize(m[2]) === null) return game.error(`Failed to parse MemoryMax= value: ${m[2]}`);
          const place = `/etc/systemd/system.control/${name}.service.d`;
          for (const path of ['/etc/systemd', '/etc/systemd/system.control', place])
            if (!game.exists(path)) game.place('systemctl', path, { type: 'dossier', children: {}, owner: 'root' });
          const file = `${place}/50-${m[1]}.conf`;
          const value = io ? `${readIoLimit(m[2])!.device} ${readIoLimit(m[2])!.bytes}` : m[2] === 'infinity' ? 'infinity' : readSize(m[2]);
          const content = `# This is a drop-in unit file extension, created via "systemctl set-property"\n# or an equivalent operation. Do not edit.\n[Service]\n${m[1]}=${value}`;
          const n = game.find(file);
          if (n?.type === 'fichier') n.content = content;
          else game.place('systemctl', file, { type: 'fichier', content, lines: true, owner: 'root' });
        }
        loadOverrides(game, sd);
        return '';
      }
      if (action === 'edit') {
        const name = unitName(names[0] ?? '');
        if (!names.length) return game.error('Too few arguments.');
        if (!sd.services[name]) return game.error(`No files found for ${name}.service.`);
        if (game.who !== 'root') return refuse(game, 'edit', name);
        return editOverride(game, sd, name);
      }
      if (action === 'reboot') {
        if (game.who !== 'root') return refuse(game, 'reboot', 'system');
        restart(game, sd);
        game.reboot = true;
        return '';
      }
      if (!names.length) return game.error(action === 'status' ? game.t('systemctl-usage') : `Too few arguments.`);
      const outputs: string[] = [];
      for (const raw of names) {
        if (raw.endsWith('.timer')) {
          const r = actionTimer(game, sd, action, raw.slice(0, -6), now);
          if (r) outputs.push(r);
          continue;
        }
        const name = unitName(raw);
        // Une unité écrite à la main et jamais chargée : systemd la lit à la demande.
        if (!sd.services[name] && game.exists(`/etc/systemd/system/${name}.service`)) reread(game, sd);
        const s = sd.services[name];
        if (!s) {
          if (action === 'status' || action.startsWith('is-')) game.error(`Unit ${name}.service could not be found.`);
          else game.error(`Failed to ${action} ${name}.service: Unit ${name}.service not found.`);
          continue;
        }
        // Une surcharge écrite à la main n'est lue qu'après daemon-reload : systemctl le rappelle.
        // (Jamais relue : l'état de départ, sans fichier d'unité ni surcharge.)
        if (fingerprint(game, name) !== (s.overridesFingerprint ?? `/etc/systemd/system/${name}.service\n`))
          outputs.push(`Warning: The unit file, source configuration file or drop-ins of ${name}.service changed on disk. Run 'systemctl daemon-reload' to reload units.`);
        if (action === 'status') {
          consulter();
          outputs.push(status(game, sd, name, paint));
        } else if (action === 'is-active') {
          consulter();
          outputs.push(s.state);
        } else if (action === 'is-enabled') outputs.push(s.active ? 'enabled' : 'disabled');
        else if (game.who !== 'root') refuse(game, action, name);
        else {
          const link = `/etc/systemd/system/multi-user.target.wants/${name}.service`;
          const failure = () =>
            game.error(
              `Job for ${name}.service failed because the control process exited with error code.\nSee "systemctl status ${name}.service" and "journalctl -xeu ${name}.service" for details.`,
            );
          if (action === 'enable') {
            if (!s.active) outputs.push(`Created symlink ${link} → /usr/lib/systemd/system/${name}.service.`);
            s.active = true;
            if (now && s.state !== 'active' && !start(game, sd, name)) failure();
          } else if (action === 'disable') {
            if (s.active) outputs.push(`Removed "${link}".`);
            s.active = false;
            if (now && s.state === 'active') stop(game, sd, name);
          } else if (action === 'stop') {
            if (s.state === 'active') stop(game, sd, name);
            else s.state = 'inactive';
          } else if (action === 'reload') {
            if (s.state !== 'active') game.error(`${name}.service is not active, cannot reload.`);
            else if (!reload(game, sd, name))
              game.error(
                `Job for ${name}.service failed because the control process exited with error code.\nSee "systemctl status ${name}.service" and "journalctl -xeu ${name}.service" for details.`,
              );
          } else {
            if (action === 'restart' && s.state === 'active') stop(game, sd, name);
            if (s.state !== 'active' && !start(game, sd, name)) failure();
          }
          const m = game.state.onSystemctl?.(game, action, name);
          if (m) outputs.push(m);
        }
      }
      return outputs.join('\n');
    },
  },

  journalctl: {
    // -n20, -xeu nginx : journalctl lit ses options lui-même.
    ownOptions: true,
    launch: (c) => {
      const { args, game } = c;
      // Sur un terminal, les messages graves sont mis en valeur (pas dans un tube).
      const colour = colourise(c, 'auto');
      const sd = systemd(game);
      if (!sd) return '-- No entries --';
      let unit: string | null = null;
      let count: number | null = null;
      let priority = 7;
      let onlyBoot = false;
      let onlyKernel = false;
      let since: number | null = null;
      let until: number | null = null;
      let follow = false;
      for (let i = 0; i < args.length; i++) {
        const a = args[i];
        if (a.startsWith('--')) {
          if (a.startsWith('--unit=')) unit = a.slice(7);
          else if (a === '--follow') follow = true;
          else if (a === '--no-pager' || a === '--pager-end') continue;
          // --since / --until : une date (« 2027-09-12 02:00 »), une heure (aujourd'hui), today, yesterday.
          else if (/^--(since|until)(=|$)/.test(a)) {
            const value = a.includes('=') ? a.slice(a.indexOf('=') + 1) : args[++i];
            const ms = value === undefined ? null : readMoment(sd, value);
            if (ms === null) return game.error(`Failed to parse timestamp: ${value ?? ''}`);
            if (a.startsWith('--since')) since = ms;
            else until = ms;
          }
          else return game.error(`journalctl: unrecognized option '${a}'`);
          continue;
        }
        if (!a.startsWith('-')) return game.error(game.t('journalctl-argument', { argument: a }));
        // Options courtes groupées, comme -xeu nginx : la dernière peut prendre une valeur.
        for (let j = 1; j < a.length; j++) {
          const l = a[j];
          if ('unp'.includes(l)) {
            const value = a.slice(j + 1) || args[++i];
            if (value === undefined) return game.error(`journalctl: option requires an argument -- '${l}'`);
            if (l === 'u') unit = value;
            else if (l === 'n') count = Number(value);
            else priority = { emerg: 0, alert: 1, crit: 2, err: 3, warning: 4, notice: 5, info: 6, debug: 7 }[value] ?? Number(value);
            break;
          }
          if (l === 'b') onlyBoot = true;
          // -k : les messages du noyau, depuis ce démarrage.
          else if (l === 'k') {
            onlyKernel = true;
            onlyBoot = true;
          }
          // -f : les dernières lignes, puis ce qui arrive, jusqu'à Ctrl-C (Shell.suivi).
          else if (l === 'f') follow = true;
          else if (l !== 'x' && l !== 'e' && l !== 'q') return game.error(`journalctl: invalid option -- '${l}'`);
        }
      }
      // Lire tout le journal : root, ou les groupes adm et systemd-journal.
      const allowed = game.who === 'root' || game.groupsFor(game.who).some((g) => g === 'adm' || g === 'systemd-journal');
      if (!allowed)
        return [
          'Hint: You are currently not seeing messages from other users and the system.',
          "      Users in groups 'adm', 'systemd-journal' can see all messages.",
          '      Pass -q to turn off this notice.',
          '-- No entries --',
        ].join('\n');
      const u = unit && (unit.endsWith('.service') ? unit : `${unit}.service`);
      // Les dates se lisent à l'heure de la machine (celle que le journal affiche).
      const shows = (e: { time: number }) => e.time + (sd.difference ?? 0);
      const kept = (e: (typeof sd.log)[number]) =>
        (!u || e.unit === u) &&
        (!onlyKernel || e.ident === 'kernel') &&
        e.priority <= priority &&
        (!onlyBoot || e.boot === sd.boot) &&
        (since === null || shows(e) >= since) &&
        (until === null || shows(e) <= until);
      let inputs = sd.log.filter(kept);
      // Comme le vrai journalctl, -f montre les 10 dernières lignes puis suit.
      if (count === null && follow) count = 10;
      if (count !== null) inputs = inputs.slice(-count);
      if (follow && c.last) {
        let views = sd.log.length;
        game.follow = {
          read: () => {
            const fresh = sd.log.slice(views).filter(kept);
            views = sd.log.length;
            return fresh.map((e) => logLine(e, sd, game.t.language, colour)).join('\n');
          },
        };
      }
      if (!inputs.length) return '-- No entries --';
      const lines: string[] = [];
      inputs.forEach((e, i) => {
        if (i > 0 && e.boot !== inputs[i - 1].boot) lines.push(`-- Boot ${String(e.boot).padStart(2, '0')}f3c1e9a7d54b2c8e06a1d9f4b7c2e5 --`);
        lines.push(logLine(e, sd, game.t.language, colour));
      });
      return lines.join('\n');
    },
  },

  reboot: {
    launch: ({ game }) => {
      const sd = systemd(game);
      if (game.who !== 'root') return game.error(game.t('reboot-refuse'));
      if (sd) restart(game, sd);
      game.reboot = true;
      return '';
    },
  },
};
