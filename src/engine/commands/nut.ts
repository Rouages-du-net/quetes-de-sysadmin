// The Network UPS Tools commands, on the model of ../nut.ts: upsc, upscmd,
// upsrw, upsmon (-c fsd|reload|stop, -K), upsd (-c reload|stop),
// upsdrvctl (start, stop, shutdown, -t), upssched (run by upsmon), and
// ipmitool's chassis and sel commands for the machine's power restore
// policy; man pages for ups.conf, upsd.conf, upsd.users, upsmon.conf,
// upssched.conf and nut.conf.
// After the NUT 2.8.1 man pages (https://networkupstools.org/docs/man/upsc.html,
// upscmd.html, upsrw.html, upsmon.html, upsd.html, upsdrvctl.html,
// upssched.html) and their sources (clients/upsc.c, upscmd.c, upsrw.c:
// usage texts, "Init SSL without certificate database", "OK" on stderr,
// "Instant command failed: Access denied"…); ipmitool 1.8.19's chassis
// status and policy (https://github.com/ipmitool/ipmitool, ipmitool(1)).
// Differences: no SSL; ipmitool talks only to the local BMC; upsmon and
// upsd started by hand start their service.

import type { Shell } from '../shell';
import type { Command } from './index';
import {
  ERROR_TEXT, INSTCMDS, PORT, RW, connectUpsd, instcmd, kill, nut, power, setVar, splitName, upsConf, variables, reloadUpsmon, nameOf, driverUnit, type NutState, readMonConf, ETC,
} from '../nut';
import { start, stop, reload, systemd } from '../systemd';

const SSL = 'Init SSL without certificate database';

/** upsname[@hostname[:port]], and the connection to its upsd (errors as the clients print them). */
function target(game: Shell, spec: string | undefined, prog: string): { server: Shell; ups: string; from: string } | string {
  if (!spec || spec.startsWith('-')) return prog === 'upsrw' ? 'Error: a UPS name must be specified (upsname[@hostname[:port]])' : 'Error: invalid UPS definition.\nRequired format: upsname[@hostname[:port]]';
  const { upsname, host, port } = splitName(spec);
  if (!upsname) return 'Error: invalid UPS definition.\nRequired format: upsname[@hostname[:port]]';
  const c = connectUpsd(game, host, port);
  if ('error' in c) return `Error: ${c.error}`;
  return { server: c.server, ups: upsname, from: c.from };
}

const fail = (game: Shell, text: string) => {
  game.error(text, 1);
  return '';
};

/** Asks what -u and -p did not give (upscmd.c, upsrw.c: "Username (you): ", getpass's "Password: "), then runs. */
function credentials(game: Shell, user: string | undefined, password: string | undefined, then: (user: string, password: string) => string): string {
  const who = game.who;
  const as = (f: () => string) => {
    const before = game.who;
    game.who = who;
    try {
      return f();
    } finally {
      game.who = before;
    }
  };
  const withPassword = (u: string) => {
    if (password !== undefined) return then(u, password);
    game.ask('Password: ', (typed) => as(() => then(u, typed)), true);
    return '';
  };
  if (user !== undefined) return withPassword(user);
  game.ask(`Username (${who}): `, (typed) => as(() => withPassword(typed.trim() || who)));
  return '';
}

/** The errors written while answering a prompt, then the output. */
const answer = (game: Shell, out: string) => [...game.recoverErrors(), out].filter(Boolean).join('\n');

// ——— upsc ———

const UPSC_USAGE = `Network UPS Tools upsc 2.8.1

usage: upsc -l | -L [<hostname>[:port]]
       upsc <ups> [<variable>]
       upsc -c <ups>

Demo program to display UPS variables.

First form (lists UPSes):
  -l         - lists each UPS on <hostname>, one per line.
  -L         - lists each UPS followed by its description (from ups.conf).
               Default hostname: localhost

Second form (lists variables and values):
  <ups>      - upsd server, <upsname>[@<hostname>[:<port>]] form
  <variable> - optional, display this variable only.
               Default: list all variables for <host>

Third form (lists clients connected to a device):
  -c         - lists each client connected on <ups>, one per line.
  <ups>      - upsd server, <upsname>[@<hostname>[:<port>]] form

Common arguments:
  -V         - display the version of this software
  -h         - display this help text`;

function upsc(game: Shell, args: string[]): string {
  const flag = args[0];
  if (flag === '-h') return UPSC_USAGE;
  if (flag === '-V') return 'Network UPS Tools upsc 2.8.1';
  if (flag && flag.startsWith('-') && !['-l', '-L', '-c'].includes(flag)) return fail(game, `upsc: invalid option -- '${flag.slice(1, 2)}'\n${UPSC_USAGE}`);
  game.error(SSL, 0);
  if (flag === '-l' || flag === '-L') {
    const [host, port] = (args[1] ?? 'localhost').split(':');
    const c = connectUpsd(game, host, Number(port ?? PORT));
    if ('error' in c) return fail(game, `Error: ${c.error}`);
    const d = (c.server.state.nut as NutState).upsd!;
    return Object.values(d.sections)
      .map((s) => (flag === '-L' ? `${s.name}: ${s.desc ?? 'Description unavailable'}` : s.name))
      .join('\n');
  }
  if (flag === '-c') {
    const t = target(game, args[1], 'upsc');
    if (typeof t === 'string') return fail(game, t);
    const d = (t.server.state.nut as NutState).upsd!;
    if (!d.sections[t.ups]) return fail(game, 'Error: Unknown UPS');
    return d.logins.filter((l) => l.ups === t.ups).map((l) => l.from).join('\n');
  }
  const t = target(game, args[0], 'upsc');
  if (typeof t === 'string') return fail(game, t);
  const vars = variables(t.server, t.ups);
  if (typeof vars === 'string') return fail(game, `Error: ${ERROR_TEXT[vars]}`);
  if (args[1]) {
    if (!(args[1] in vars)) return fail(game, 'Error: Variable not supported by UPS');
    return vars[args[1]];
  }
  return Object.entries(vars)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n');
}

// ——— upscmd and upsrw ———

const UPSCMD_USAGE = `Network UPS Tools upscmd 2.8.1

usage: upscmd [-h]
       upscmd [-l <ups>]
       upscmd [-u <username>] [-p <password>] [-w] [-t <timeout>] <ups> <command> [<value>]

Administration program to initiate instant commands on UPS hardware.

  -h		display this help text
  -V		display the version of this software
  -l <ups>	show available commands on UPS <ups>
  -u <username>	set username for command authentication
  -p <password>	set password for command authentication
  -w            wait for the completion of command by the driver
                and return its actual result from the device
  -t <timeout>	set a timeout when using -w (in seconds, default: 10)

  <ups>		UPS identifier - <upsname>[@<hostname>[:<port>]]
  <command>	Valid instant command - test.panel.start, etc.
  [<value>]	Additional data for command - number of seconds, etc.`;

/** getopt for the clients' -u -p -t -l -s: their values, the words left. */
function opts(args: string[], valued: string, flags: string): { o: Record<string, string>; rest: string[]; bad?: string } {
  const o: Record<string, string> = {};
  const rest: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (!a.startsWith('-') || a === '-' || rest.length) {
      rest.push(a);
      continue;
    }
    const letter = a[1];
    if (valued.includes(letter)) {
      const v = a.length > 2 ? a.slice(2) : args[++i];
      if (v === undefined) return { o, rest, bad: `option requires an argument -- '${letter}'` };
      o[letter] = v;
    } else if (flags.includes(letter)) o[letter] = '';
    else return { o, rest, bad: `invalid option -- '${letter}'` };
  }
  return { o, rest };
}

function upscmd(game: Shell, args: string[]): string {
  const { o, rest, bad } = opts(args, 'lupt', 'hVw');
  if (bad) return fail(game, `upscmd: ${bad}\n${UPSCMD_USAGE}`);
  if ('h' in o) return UPSCMD_USAGE;
  if ('V' in o) return 'Network UPS Tools upscmd 2.8.1';
  game.error(SSL, 0);
  if ('l' in o) {
    const t = target(game, o.l, 'upscmd');
    if (typeof t === 'string') return fail(game, t);
    const d = (t.server.state.nut as NutState).upsd!;
    if (!d.sections[t.ups]) return fail(game, 'Error: Unknown UPS');
    if (!(t.server.state.nut as NutState).drivers[t.ups]) return fail(game, 'Error: Driver not connected');
    return [`Instant commands supported on UPS [${t.ups}]:`, '', ...Object.entries(INSTCMDS).map(([k, v]) => `${k} - ${v}`)].join('\n');
  }
  if (rest.length < 2) return fail(game, `upscmd: ${UPSCMD_USAGE}`);
  const t = target(game, rest[0], 'upscmd');
  if (typeof t === 'string') return fail(game, t);
  const run = (u: string, p: string) => {
    const err = instcmd(t.server, t.ups, u, p, rest[1]);
    if (err) return fail(game, `Instant command failed: ${ERROR_TEXT[err]}`);
    game.error('OK', 0);
    return '';
  };
  if (o.u !== undefined && o.p !== undefined) return run(o.u, o.p);
  return credentials(game, o.u, o.p, (u, p) => answer(game, run(u, p)));
}

const UPSRW_USAGE = `Network UPS Tools upsrw 2.8.1

usage: upsrw [-h]
       upsrw [-s <variable>] [-u <username>] [-p <password>] [-w] [-t <timeout>] <ups>

Demo program to set variables within UPS hardware.

  -h            display this help text
  -V            display the version of this software
  -s <variable>	specify variable to be changed
		use -s VAR=VALUE to avoid prompting for value
  -l            show all possible read/write variables.
  -u <username> set username for command authentication
  -p <password> set password for command authentication
  -w            wait for the completion of setting by the driver
                and return its actual result from the device
  -t <timeout>	set a timeout when using -w (in seconds, default: 10)

  <ups>         UPS identifier - <upsname>[@<hostname>[:<port>]]

Call without -s to show all possible read/write variables (same as -l).`;

function upsrw(game: Shell, args: string[]): string {
  const { o, rest, bad } = opts(args, 'supt', 'hVlw');
  if (bad) return fail(game, `upsrw: ${bad}\n${UPSRW_USAGE}`);
  if ('h' in o) return UPSRW_USAGE;
  if ('V' in o) return 'Network UPS Tools upsrw 2.8.1';
  game.error(SSL, 0);
  const t = target(game, rest[0], 'upsrw');
  if (typeof t === 'string') return fail(game, t);
  if (o.s === undefined) {
    const vars = variables(t.server, t.ups);
    if (typeof vars === 'string') return fail(game, `Error: ${ERROR_TEXT[vars]}`);
    return Object.entries(RW)
      .filter(([k]) => k in vars)
      .map(([k, v]) => `[${k}]\n${v.desc}\nType: STRING\nMaximum length: ${v.max}\nValue: ${vars[k]}\n`)
      .join('\n')
      .trimEnd();
  }
  const [name, ...value] = o.s.split('=');
  const run = (u: string, p: string, v: string) => {
    const err = setVar(t.server, t.ups, u, p, name, v);
    if (err) return fail(game, `Set variable failed: ${ERROR_TEXT[err]}`);
    game.error('OK', 0);
    return '';
  };
  const withValue = (u: string, p: string) => {
    if (value.length) return run(u, p, value.join('='));
    game.ask(`Enter new value for ${name}: `, (typed) => answer(game, run(u, p, typed.trim())));
    return '';
  };
  if (o.u !== undefined && o.p !== undefined) return withValue(o.u, o.p);
  return credentials(game, o.u, o.p, (u, p) => answer(game, withValue(u, p)));
}

// ——— upsmon, upsd, upsdrvctl ———

const UPSMON_USAGE = `Network UPS Tools upsmon 2.8.1
Monitors UPS servers and may initiate shutdown if necessary.

usage: upsmon [OPTIONS]

  -c <cmd>	send command to running process
		commands:
		 - fsd: shutdown all primary-mode UPSes (use with caution)
		 - reload: reread configuration
		 - stop: stop monitoring and exit
  -P <pid>	send the signal above to specified PID (bypassing PID file)
  -D		raise debugging level (and stay foreground by default)
  -F		stay foregrounded even if no debugging is enabled
  -B		stay backgrounded even if debugging is bumped
  -V		display the version of this software
  -h		display this help
  -K		checks POWERDOWNFLAG, sets exit code to 0 if set
  -p		always run privileged (disable privileged parent)
  -u <user>	run child as user <user> (ignored when using -p)
  -4		IPv4 only
  -6		IPv6 only`;

const running = (game: Shell, unit: string) => systemd(game)?.services[unit]?.state === 'active';

function upsmon(game: Shell, args: string[]): string {
  const { o, bad } = opts(args, 'cPu', 'hVDFBKp46');
  if (bad) return fail(game, `upsmon: ${bad}\n${UPSMON_USAGE}`);
  if ('h' in o) return UPSMON_USAGE;
  const banner = 'Network UPS Tools upsmon 2.8.1';
  if ('V' in o) return banner;
  if ('K' in o) {
    const flag = readMonConf(game.read(`${ETC}/upsmon.conf`)).powerdownflag;
    if (!flag) return fail(game, `${banner}\nNo POWERDOWNFLAG set in upsmon.conf`);
    if (game.read(flag)?.startsWith('upsmon-shutdown-file')) return `${banner}\nPower down flag is set`;
    return fail(game, `${banner}\nPower down flag is not set`);
  }
  if ('c' in o) {
    const cmd = o.c;
    if (!['fsd', 'reload', 'stop'].includes(cmd)) return fail(game, `${banner}\nInvalid command: ${cmd}`);
    if (game.who !== 'root') return fail(game, `${banner}\nfopen /run/nut/upsmon.pid: Permission denied\nFailed to signal the currently running daemon (if any)`);
    if (!running(game, 'nut-monitor'))
      return fail(game, `${banner}\nfopen /run/nut/upsmon.pid: No such file or directory\nFailed to signal the currently running daemon (if any)\n${cmd === 'fsd' ? "Try to add '-P $PID' argument" : `Try 'systemctl ${cmd} nut-monitor.service' or add '-P $PID' argument`}`);
    const sd = systemd(game)!;
    if (cmd === 'reload') reloadUpsmon(game);
    else if (cmd === 'stop') stop(game, sd, 'nut-monitor');
    else {
      const mon = nut(game).upsmon;
      if (mon) mon.fsdRequested = true;
      game.state.fsdTyped = ((game.state.fsdTyped as number | undefined) ?? 0) + 1;
    }
    return banner;
  }
  if (running(game, 'nut-monitor')) return fail(game, `${banner}\nFatal error: A previous upsmon instance is already running!\nEither stop the previous instance first, or use the 'reload' command.`);
  // Started by hand, as root: the daemon (here, the service's).
  if (game.who !== 'root') return fail(game, `${banner}\nfopen /run/nut/upsmon.pid: Permission denied`);
  start(game, systemd(game)!, 'nut-monitor');
  return banner;
}

const UPSD_USAGE = `Network UPS Tools upsd 2.8.1
Network server for UPS data.

usage: upsd [OPTIONS]

  -c <command>	send <command> via signal to background process
		commands:
		 - reload: reread configuration files
		 - stop: stop process and exit
  -P <pid>	send the signal above to specified PID (bypassing PID file)
  -D		raise debugging level (and stay foreground by default)
  -F		stay foregrounded even if no debugging is enabled
  -FF		stay foregrounded and still save the PID file
  -B		stay backgrounded even if debugging is bumped
  -h		display this help text
  -V		display the version of this software
  -r <dir>	chroots to <dir>
  -q		raise log level threshold
  -u <user>	switch to <user> (if started as root)
  -4		IPv4 only
  -6		IPv6 only`;

function upsd(game: Shell, args: string[]): string {
  const { o, bad } = opts(args, 'cPru', 'hVDFBq46');
  if (bad) return fail(game, `upsd: ${bad}\n${UPSD_USAGE}`);
  const banner = 'Network UPS Tools upsd 2.8.1';
  if ('h' in o) return UPSD_USAGE;
  if ('V' in o) return banner;
  if ('c' in o) {
    if (!['reload', 'stop'].includes(o.c)) return fail(game, `${banner}\nInvalid command: ${o.c}`);
    if (game.who !== 'root') return fail(game, `${banner}\nfopen /run/nut/upsd.pid: Permission denied\nFailed to signal the currently running daemon (if any)`);
    const sd = systemd(game)!;
    if (!running(game, 'nut-server')) return fail(game, `${banner}\nfopen /run/nut/upsd.pid: No such file or directory\nFailed to signal the currently running daemon (if any)\nTry 'systemctl ${o.c} nut-server.service' or add '-P $PID' argument`);
    if (o.c === 'reload') reload(game, sd, 'nut-server');
    else stop(game, sd, 'nut-server');
    return banner;
  }
  if (running(game, 'nut-server')) return fail(game, `${banner}\nFatal error: A previous upsd instance is already running!\nEither stop the previous instance first, or use the 'reload' command.`);
  if (game.who !== 'root') return fail(game, `${banner}\nfopen /run/nut/upsd.pid: Permission denied`);
  start(game, systemd(game)!, 'nut-server');
  return banner;
}

const UPSDRVCTL_USAGE = `Starts and stops UPS drivers via ups.conf.

usage: upsdrvctl [OPTIONS] (start | stop | shutdown) [<ups>]

usage: upsdrvctl [OPTIONS] -c <command> [<ups>]

Common options:
  -h			display this help
  -r <path>		drivers will chroot to <path>
  -t			testing mode - prints actions without doing them
  -u <user>		drivers started will switch from root to <user>
  -D			raise debugging level
  -d			pass debugging level from upsdrvctl to driver
  -F			driver stays foregrounded even if no debugging is enabled
  -FF			driver stays foregrounded and still saves the PID file
  -B			driver(s) stay backgrounded even if debugging is bumped`;

function upsdrvctl(game: Shell, args: string[]): string {
  const { o, rest, bad } = opts(args, 'rucl', 'htDdFB');
  if (bad) return fail(game, `upsdrvctl: ${bad}\n${UPSDRVCTL_USAGE}`);
  if ('h' in o) return UPSDRVCTL_USAGE;
  const banner = 'Network UPS Tools - UPS driver controller 2.8.1';
  const [action, name] = rest;
  if (!['start', 'stop', 'shutdown'].includes(action ?? '')) return fail(game, `${banner}\n${UPSDRVCTL_USAGE}`);
  const conf = upsConf(game);
  const names = name ? [name] : Object.keys(conf);
  if (name && !conf[name]) return fail(game, `${banner}\nUPS: ${name} not found in ups.conf`);
  if ('t' in o)
    return [
      banner,
      '*** Testing mode: not calling exec/kill',
      ...names.map((n) => (action === 'shutdown' ? `0.000000	\n0.000123	Shutdown UPS: ${n}\n0.000150	exec:  /lib/nut/${conf[n].driver} -a ${n} -k` : `0.000000	\n0.000123	${action === 'start' ? 'exec' : 'stop'}:  /lib/nut/${conf[n].driver} -a ${n}`)),
    ].join('\n');
  if (game.who !== 'root') return fail(game, `${banner}\n${action === 'stop' ? `Can't open /run/nut/${conf[names[0]]?.driver}-${names[0]}.pid: Permission denied` : 'Network UPS Tools - Generic HID driver 0.52 (2.8.1)\nlibusb1: Could not open any HID devices: insufficient permissions on everything\nNo matching HID UPS found\nDriver failed to start (exit status=1)'}`);
  const sd = systemd(game)!;
  if (action === 'shutdown') {
    // The kill power command, now: the output goes off after offdelay (the load is cut!).
    for (const n of names) kill(game, n);
    game.state.killTyped = true;
    return `${banner}\nNetwork UPS Tools - Generic HID driver 0.52 (2.8.1)\nUSB communication driver (libusb 1.0) 0.46\nInitiating UPS shutdown`;
  }
  const out = [banner];
  for (const n of names) {
    const unit = driverUnit(n);
    if (action === 'start') {
      if (sd.services[unit]?.state === 'active') out.push(`Duplicate driver instance detected (PID file /run/nut/${conf[n].driver}-${n}.pid exists)! Terminating other driver!`);
      if (sd.services[unit]) start(game, sd, unit);
    } else if (sd.services[unit]?.state === 'active') stop(game, sd, unit);
  }
  return out.join('\n');
}

function upssched(game: Shell): string {
  void game;
  return fail(game, 'Error: environment variable UPSNAME must be set.\nThis program should only be run from upsmon.');
}

// ——— ipmitool: the machine's BMC ———

const POLICIES = ['always-off', 'always-on', 'previous'];

function ipmitool(game: Shell, args: string[]): string {
  const words = args.filter((a) => !a.startsWith('-'));
  if (args.includes('-h') || !words.length)
    return fail(game, 'ipmitool version 1.8.19\n\nusage: ipmitool [options...] <command>\n\nCommands:\n\tchassis\t\t\tGet chassis status and set power state\n\tpower\t\t\tShortcut to chassis power commands\n\tsel\t\t\tPrint System Event Log (SEL)');
  if (game.who !== 'root') return fail(game, 'Could not open device at /dev/ipmi0 or /dev/ipmi/0 or /dev/ipmidev/0: Permission denied');
  const w = power(game);
  const h = w.hosts[nameOf(game)];
  if (!h) return fail(game, 'Could not open device at /dev/ipmi0 or /dev/ipmi/0 or /dev/ipmidev/0: No such file or directory');
  const [cmd, sub, arg] = words;
  if (cmd === 'chassis' && sub === 'status')
    return [
      'System Power         : on',
      'Power Overload       : false',
      'Power Interlock      : inactive',
      'Main Power Fault     : false',
      'Power Control Fault  : false',
      `Power Restore Policy : ${h.policy}`,
      `Last Power Event     : ${h.lastEvent}`,
      'Chassis Intrusion    : inactive',
      'Front-Panel Lockout  : inactive',
      'Drive Fault          : false',
      'Cooling/Fan Fault    : false',
    ].join('\n');
  if ((cmd === 'chassis' && sub === 'power' && arg === 'status') || (cmd === 'power' && sub === 'status')) return 'Chassis Power is on';
  if (cmd === 'chassis' && sub === 'policy') {
    if (arg === 'list') return 'Supported chassis power policy:  always-off always-on previous';
    if (!arg || !POLICIES.includes(arg)) return fail(game, 'chassis policy <state>\n   list        : return supported policies\n   always-on   : turn on when power is restored\n   previous    : return to previous state when power is restored\n   always-off  : stay off after power is restored');
    h.policy = arg as typeof h.policy;
    return `Set chassis power restore policy to ${arg}`;
  }
  if (cmd === 'sel' && (sub === 'list' || sub === 'elist')) {
    if (!h.sel.length) return 'SEL has no entries';
    const d = (ms: number) => {
      const x = new Date(ms);
      const p = (n: number) => String(n).padStart(2, '0');
      return `${p(x.getUTCMonth() + 1)}/${p(x.getUTCDate())}/${x.getUTCFullYear()} | ${x.toISOString().slice(11, 19)}`;
    };
    return h.sel.map((e, i) => `${(i + 1).toString(16).padStart(4)} | ${d(e.time)} | ${e.sensor} | ${e.event}`).join('\n');
  }
  if (cmd === 'chassis' || cmd === 'power') return fail(game, `Invalid chassis command: ${sub ?? ''}`);
  return fail(game, `Invalid command: ${cmd}`);
}

const page = { section: 5, launch: () => '' };

export const NUT_COMMANDS: Record<string, Command> = {
  upsc: { ownOptions: true, launch: ({ args, game }) => upsc(game, args) },
  upscmd: { ownOptions: true, launch: ({ args, game }) => upscmd(game, args) },
  upsrw: { ownOptions: true, launch: ({ args, game }) => upsrw(game, args) },
  upsmon: { ownOptions: true, section: 8, launch: ({ args, game }) => upsmon(game, args) },
  upsd: { ownOptions: true, section: 8, launch: ({ args, game }) => upsd(game, args) },
  upsdrvctl: { ownOptions: true, section: 8, launch: ({ args, game }) => upsdrvctl(game, args) },
  upssched: { ownOptions: true, section: 8, launch: ({ game }) => upssched(game) },
  ipmitool: { ownOptions: true, launch: ({ args, game }) => ipmitool(game, args) },
  'ups.conf': page,
  'upsd.conf': page,
  'upsd.users': page,
  'upsmon.conf': page,
  'upssched.conf': page,
  'nut.conf': page,
};
