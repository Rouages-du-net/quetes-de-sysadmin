// Story "The Shelter": what its chapters share. Hillside Animal Shelters
// (les Refuges des Coteaux in French), two sites, Hillside and Riverbend,
// run their adoption site, their adoption app and its PostgreSQL database
// on paddock (enclos in French), a server in the cellar of Hillside's old
// barn. Every night it dumps the database and backs up to a restic
// repository on meadow (prairie), the shelters' small server at a hosting
// cooperative, over sftp. meadow also holds the written disaster recovery
// plan (/srv/drp/plan.md, Dariusz's, 2029) and is the hidden primary DNS
// server of hillsideshelters.example. Teuila coordinates; Mirela, a vet
// nurse, added the vet records sync (vetlink) in 2031; Rahel, the
// treasurer, keeps the sealed envelope with the repository's recovery
// password; Wiremu brings a donated machine, haven (abri).
// Chapter 1 inventories paddock against the plan (RPO and RTO per
// service, backups that meet them); in chapter 2 the cellar has flooded
// and paddock is gone: haven is rebuilt from the backups, in the plan's
// order; chapter 3 switches the site to haven (DNS), writes the review
// and schedules the next restore drill.
// Every machine here is an existing model: restic (sftp: repositories),
// PostgreSQL, nginx, systemd units and timers, BIND, ufw.
// Sources: NIST SP 800-34 Rev. 1, Contingency Planning Guide for Federal
// Information Systems (https://csrc.nist.gov/pubs/sp/800/34/r1/upd1/final),
// https://restic.readthedocs.io/en/stable/030_preparing_a_new_repo.html#sftp,
// https://restic.readthedocs.io/en/stable/050_restore.html,
// https://www.postgresql.org/docs/current/backup-dump.html.

import { accountsFiles, d, f, name, password, type Accounts, type Directory, type InternalHost, type Node, type Rights } from '../world';
import type { Game, Shell } from '../shell';
import type { Translate } from '../../texts';
import { newSystemd, systemd, toUtc, type DefinitionService, type Systemd } from '../systemd';
import { machineName } from '../machines';
import { MIME, NGINX_CONF } from '../commands/apt';
import { httpRequest, loadNginx, checkNginx } from '../nginx';
import { loadUnits, readCalendar, nextCalendar } from '../timers';
import { addSnapshot, applyPolicy, hex, writeRepo, type Repo, type Snapshot, type Version } from '../commands/restic';
import { copyOf, dumpSql, type Table } from '../postgres';
import { fileBytes, sha256 } from '../commands/checksums';
import { generateKey } from '../access';
import { verdict, type Firewall } from '../firewall';
import { query, type DnsState } from '../dns';
import { machineIdOf } from '../debian';

export const HOME = '/home/you';
export const PASSWORD = 'kibble-2031';
export const SITE = 'www.hillsideshelters.example';
export const DOMAIN = 'hillsideshelters.example';
export const MEADOW = '192.0.2.164';
export const PADDOCK = '192.0.2.165';
export const HAVEN = '192.0.2.166';
// Hillside's public address (its line went under with the cellar) and Riverbend's.
export const OLD_PUBLIC = '198.51.100.163';
export const NEW_PUBLIC = '203.0.113.163';
export const REGISTRAR = 'ns1.registrar.example';
export const RESOLVER = '198.51.100.54';

export const REPO = '/srv/restic';
export const PLAN = '/srv/drp/plan.md';
export const BACKUP_SCRIPT = '/usr/local/sbin/shelter-backup';
export const DRILL_DRAFT = '/usr/local/sbin/restore-drill';
export const DUMP = '/var/backups/shelter.sql';
export const SUMS = '/var/backups/shelter.sha256';
export const COUNTS = '/var/backups/shelter.counts';
export const WEB_ROOT = '/var/www/shelter';
export const ADOPT = '/srv/adopt';
export const VETLINK = '/srv/vetlink';
export const SITE_FILE = '/etc/nginx/sites-available/shelter';
export const ZONE_FILE = `/etc/bind/db.${DOMAIN}`;
export const SITEWATCH = '/var/log/sitewatch.log';
export const DAY = 86_400_000;

// The repository's keys: the nightly job's (on paddock, gone with it), the envelope's, the drill's (chapter 3).
export const NIGHTLY_PASSWORD = 'Hs7wQ2kLp9xVn4Rt-paddock';
export const ENVELOPE = 'lantern-thistle-otter-64';
export const DRILL_PASSWORD = 'Dr1ll-7mWq3zKc-meadow';

export type ChapterNo = 1 | 2 | 3;
// Monday 3 November 2031, 9:30; Friday 14 November, 8:40 (the night of the flood); the same day, 13:20.
export const NOW: Record<ChapterNo, number> = { 1: Date.UTC(2031, 10, 3, 9, 30, 0), 2: Date.UTC(2031, 10, 14, 8, 40, 0), 3: Date.UTC(2031, 10, 14, 13, 20, 0) };
// The flood: the last good check of the site, the first failed one.
export const LAST_OK = Date.UTC(2031, 10, 14, 2, 45, 1);
export const FIRST_DOWN = Date.UTC(2031, 10, 14, 2, 50, 1);
const BOOT = Date.UTC(2031, 9, 12, 6, 2, 0);

// ——— Helpers ———

export const typed = (j: Game) => j.last.line ?? '';
/** The last command's output (and errors) contains this; reading the manual doesn't count. */
export const seen = (j: Game, text: string | RegExp) => {
  if (/^\s*(man|apropos|whatis|help)\b|--help\b/.test(typed(j))) return false;
  const all = `${j.last.output}\n${j.last.errors.join('\n')}`;
  return typeof text === 'string' ? all.includes(text) : text.test(all);
};
export const sd = (j: Game): Systemd => systemd(j)!;
const hash = (s: string) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0;
  return h;
};
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const listOf = (text: string) =>
  text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
const clip = (s: string) => s.replace(/^\n+|\s+$/g, '');

const root: Rights = { owner: 'root' };
const place = (children: Record<string, Node>, rights: Rights = root) => d(children, undefined, rights);
const file = (text: string, rights: Rights = root) => f(text, { lines: true, ...rights });

/** The story's machines, by id, as the language names them. */
export const host = (t: Translate, id: 'meadow' | 'paddock' | 'haven') => machineName(t, id);
/** The repository, as the scripts and the envelope give it. */
export const repoUrl = (t: Translate) => `sftp:restic@${host(t, 'meadow')}.internal:${REPO}`;

// ——— The database `shelter` ———

const START = Date.UTC(2029, 5, 1);
// An animal arrives every two and a half days; about every other one is adopted a month later.
const arrival = (i: number) => START + Math.floor(i * 2.5) * DAY;

const computed = new WeakMap<Translate, Map<number, Record<string, Table>>>();

/** The database as it was dumped on the night of `night` (a check's reference: never change it). */
export function referenceTables(t: Translate, night: number): Record<string, Table> {
  let byNight = computed.get(t);
  if (!byNight) computed.set(t, (byNight = new Map()));
  let tables = byNight.get(night);
  if (!tables) byNight.set(night, (tables = buildTables(t, night)));
  return tables;
}

function buildTables(t: Translate, night: number): Record<string, Table> {
  const names = listOf(t('shelter-animal-names'));
  const species = listOf(t('shelter-species'));
  const firsts = listOf(t('shelter-volunteer-names'));
  const sites = [t('shelter-site-hillside'), t('shelter-site-riverbend')];
  const animals: string[][] = [];
  const adoptions: string[][] = [];
  for (let i = 0; arrival(i) < night; i++) {
    const id = String(i + 1);
    const adoptedOn = arrival(i) + (25 + (hash(`a${i}`) % 40)) * DAY;
    const adopted = hash(`ad${i}`) % 10 < 9 && adoptedOn < night;
    animals.push([id, names[i % names.length], species[hash(`s${i}`) % species.length], iso(arrival(i)), adopted ? 'adopted' : 'waiting']);
    if (adopted) adoptions.push([String(adoptions.length + 1), id, iso(adoptedOn), `F-${new Date(adoptedOn).getUTCFullYear()}-${String(adoptions.length + 1).padStart(4, '0')}`]);
  }
  const volunteers = firsts.map((n, i) => [String(i + 1), n, sites[i % 2], iso(START + (i * 23 + 4) * DAY)]);
  return {
    animals: { columns: ['id', 'name', 'species', 'arrived_on', 'status'], lines: animals },
    adoptions: { columns: ['id', 'animal_id', 'adopted_on', 'family_ref'], lines: adoptions },
    volunteers: { columns: ['id', 'first_name', 'site', 'since'], lines: volunteers },
  };
}

export const dumpOf = (t: Translate, night: number) => dumpSql('shelter', referenceTables(t, night), 'adopt');
export const countsOf = (t: Translate, night: number) =>
  Object.entries(referenceTables(t, night))
    .map(([n, x]) => `${n} ${x.lines.length}`)
    .join('\n');
export const sumsOf = (t: Translate, night: number) => `${sha256(fileBytes(dumpOf(t, night)))}  shelter.sql`;

/** The animals waiting for a home (what the app's /animals page counts). */
const waiting = (tables: Record<string, Table> | undefined) => tables?.animals?.lines.filter((l) => l[4] === 'waiting').length ?? 0;

// ——— The configuration files (paddock's, and what the backups hold) ———

export const SITE_CONF = `server {
    listen 80;
    listen [::]:80;
    server_name ${SITE} ${DOMAIN};

    root ${WEB_ROOT};
    index index.html;

    location / {
        try_files $uri $uri/ =404;
    }

    location /adopt/ {
        proxy_pass http://127.0.0.1:8000/;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}`;

export const ADOPT_UNIT = `[Unit]
Description=Adopt, the shelters' adoption app (gunicorn)
After=network.target postgresql.service
Requires=postgresql.service

[Service]
User=adopt
WorkingDirectory=${ADOPT}
EnvironmentFile=${ADOPT}/.env
ExecStart=${ADOPT}/venv/bin/gunicorn -b 127.0.0.1:8000 adopt.wsgi
Restart=on-failure

[Install]
WantedBy=multi-user.target`;

const VETLINK_SERVICE = `[Unit]
Description=Pull the vet clinic's records for the shelters' animals

[Service]
Type=oneshot
User=adopt
ExecStart=/usr/local/bin/vetlink-sync`;

const VETLINK_TIMER = `[Unit]
Description=Pull the vet clinic's records every hour

[Timer]
OnCalendar=hourly

[Install]
WantedBy=timers.target`;

const BACKUP_SERVICE = `[Unit]
Description=Nightly backup of paddock to meadow

[Service]
Type=oneshot
ExecStart=${BACKUP_SCRIPT}`;

export const BACKUP_TIMER = `[Unit]
Description=Nightly backup of paddock to meadow

[Timer]
OnCalendar=*-*-* 02:00:00

[Install]
WantedBy=timers.target`;

const ENV = (t: Translate) => `# ${t('shelter-env-comment')}
DATABASE_URL=postgresql:///shelter
SITE_URL=http://${SITE}/adopt/
SECRET_KEY=${hex('shelter-adopt-secret', 40)}`;

const APP_README = (t: Translate) => clip(t('shelter-adopt-readme'));

/** The nightly job (Dariusz's, 2029; chapter 1 adds /srv/vetlink). */
export const backupScript = (t: Translate, withVetlink: boolean) => `#!/bin/sh
# ${t('shelter-backup-comment')}
set -e
export RESTIC_REPOSITORY=${repoUrl(t)}
export RESTIC_PASSWORD_FILE=/root/.restic-pass
sudo -u postgres pg_dump shelter > ${DUMP}
cd /var/backups && sha256sum shelter.sql > shelter.sha256
for t in animals adoptions volunteers; do echo "$t $(sudo -u postgres psql shelter -At -c "SELECT count(*) FROM $t")"; done > ${COUNTS}
restic backup /etc /var/www /srv/adopt${withVetlink ? ` ${VETLINK}` : ''} /var/backups
restic forget --keep-daily 14 --keep-weekly 8 --prune
echo "$(date -Is) backup done"`;

const VETLINK_SCRIPT = (t: Translate) => `#!/bin/sh
# ${t('shelter-vetlink-comment')}
set -e
curl -s -H "Authorization: Bearer $(cat /srv/vetlink/.token)" https://api.vetclinic.example/v1/shelters/hillside/records -o /srv/vetlink/records/latest.json`;

/** The vet records (vetlink's files): one file per animal followed by the clinic. */
export function vetRecords(t: Translate): Record<string, string> {
  const names = listOf(t('shelter-animal-names'));
  const out: Record<string, string> = {};
  for (let i = 0; i < 6; i++) {
    const id = 180 + i * 4;
    out[`animal-${id}.json`] = JSON.stringify({ animal: id, name: names[(id - 1) % names.length], vaccinations: [`2031-${String(6 + i).padStart(2, '0')}-1${i}`], microchip: `250269${String(hash(`chip${i}`)).padStart(9, '0').slice(0, 9)}`, next_visit: `2031-12-0${i + 1}` });
  }
  return out;
}

const fstabOf = (uuid: string) => `# /etc/fstab: static file system information.
# <file system>                             <mount point>  <type>  <options>          <dump>  <pass>
UUID=${uuid}  /              ext4    errors=remount-ro  0       1
UUID=${hex(`${uuid}-swap`, 8)}-${hex(`${uuid}-s2`, 4)}-4${hex(`${uuid}-s3`, 3)}-a${hex(`${uuid}-s4`, 3)}-${hex(`${uuid}-s5`, 12)}  none  swap  sw  0  0`;

export const UUID = { paddock: '6f1d2c3b-8a47-4e2f-9b1a-0c4d7e2a9f53', haven: 'b83e1a5c-2d4f-4c6a-8e71-5f9a0b3c7d24' };
export const MACHINE_IDS = { paddock: machineIdOf('paddock-2029'), haven: machineIdOf('haven-2031') };
/** A machine's own SSH host key (the private one, then the public one). */
export const hostKeys = (id: 'paddock' | 'haven') => {
  const k = generateKey(`shelter-host-${id}`, `root@${id}`);
  return { private: k.isPrivate, public: k.isPublic };
};

const interfacesOf = (address: string) => `# This file describes the network interfaces available on your system
# and how to activate them. For more information, see interfaces(5).

source /etc/network/interfaces.d/*

auto lo
iface lo inet loopback

auto eth0
iface eth0 inet static
    address ${address}/24
    gateway ${address.replace(/\.\d+$/, '.1')}`;

/** The machine-specific files of /etc, by machine: what a wholesale restore of /etc overwrites. */
export function machineFiles(t: Translate, id: 'paddock' | 'haven'): Record<string, string> {
  const keys = hostKeys(id);
  const address = id === 'paddock' ? PADDOCK : HAVEN;
  return {
    '/etc/fstab': fstabOf(UUID[id]),
    '/etc/machine-id': MACHINE_IDS[id],
    '/etc/hostname': host(t, id),
    '/etc/hosts': `127.0.0.1\tlocalhost\n${address}\t${host(t, id)}.internal ${host(t, id)}\n::1\tlocalhost ip6-localhost ip6-loopback`,
    '/etc/network/interfaces': interfacesOf(address),
    '/etc/ssh/ssh_host_ed25519_key': keys.private,
    '/etc/ssh/ssh_host_ed25519_key.pub': keys.public,
  };
}

/** paddock's /etc as the backups hold it (what a restore of /etc gives back). */
function paddockEtc(t: Translate, vetlinkUnits = true): Record<string, string> {
  return {
    ...machineFiles(t, 'paddock'),
    '/etc/nginx/nginx.conf': NGINX_CONF,
    '/etc/nginx/mime.types': MIME,
    [SITE_FILE]: SITE_CONF,
    '/etc/nginx/sites-enabled/shelter': SITE_CONF,
    '/etc/systemd/system/adopt.service': ADOPT_UNIT,
    ...(vetlinkUnits ? { '/etc/systemd/system/vetlink-sync.service': VETLINK_SERVICE, '/etc/systemd/system/vetlink-sync.timer': VETLINK_TIMER } : {}),
    '/etc/systemd/system/shelter-backup.service': BACKUP_SERVICE,
    '/etc/systemd/system/shelter-backup.timer': BACKUP_TIMER,
  };
}

/** The adoption app's files (/srv/adopt). */
export const adoptFiles = (t: Translate): Record<string, string> => ({
  [`${ADOPT}/.env`]: ENV(t),
  [`${ADOPT}/NOTES`]: APP_README(t),
  [`${ADOPT}/adopt/wsgi.py`]: 'from adopt.app import create_app\n\napplication = create_app()',
  [`${ADOPT}/venv/bin/gunicorn`]: '#!/srv/adopt/venv/bin/python3\nimport re\nimport sys\nfrom gunicorn.app.wsgiapp import run\nif __name__ == "__main__":\n    sys.exit(run())',
});

export const siteIndex = (t: Translate) => clip(t('shelter-site-index'));

// ——— The restic repository on meadow ———

/** The nights the job ran (2:00), from 1 September 2031 to the chapter, as the forget policy keeps them. */
function nights(n: ChapterNo): number[] {
  const out: number[] = [];
  const until = n === 1 ? NOW[1] : Date.UTC(2031, 10, 14, 3, 0, 0);
  for (let ms = Date.UTC(2031, 8, 1, 2, 0, 31); ms < until; ms += DAY) out.push(ms + (hash(`n${ms}`) % 40) * 1000);
  return out;
}

const version = (content: string, modified: number, size?: number): Version => ({ content, size: size ?? new TextEncoder().encode(content).length, modified });

/** One night's snapshot of paddock (with vetlink's files once chapter 1 added them). */
function nightSnapshot(t: Translate, time: number, withVetlink: boolean, latest: boolean): Snapshot {
  const files: Record<string, Version> = {};
  const etcTime = Date.UTC(2031, 5, 20, 14, 0, 0);
  for (const [p, c] of Object.entries(paddockEtc(t))) files[p] = version(c, etcTime);
  files[`${WEB_ROOT}/index.html`] = version(siteIndex(t), Date.UTC(2031, 8, 2, 18, 0, 0));
  for (const [p, c] of Object.entries(adoptFiles(t))) files[p] = version(c, Date.UTC(2031, 3, 9, 11, 0, 0));
  if (withVetlink) for (const [n, c] of Object.entries(vetRecords(t))) files[`${VETLINK}/records/${n}`] = version(c, time - 3_600_000);
  // The dump of that night (the full text for the last one; the earlier ones only differ by their date).
  const night = time - 60_000;
  files[DUMP] = latest ? version(dumpOf(t, night), time - 20_000) : version(`-- PostgreSQL database dump (shelter) ${iso(time)}`, time - 20_000, 16_000 + Math.floor((time - START) / DAY) * 9);
  files[SUMS] = version(latest ? sumsOf(t, night) : `${hex(`sum${time}`)}  shelter.sql`, time - 15_000);
  files[COUNTS] = version(countsOf(t, night), time - 12_000);
  const paths = ['/etc', '/var/www', ADOPT, ...(withVetlink ? [VETLINK] : []), '/var/backups'];
  return { id: hex(`shelter-snapshot-${time}`), time, host: host(t, 'paddock'), paths, files };
}

/** The night of a chapter's last snapshot (its dump's reference). */
export const lastNight = (n: ChapterNo) => nights(n).at(-1)! - 60_000;

/** The repository as a chapter finds it: the nightly key and the envelope's (and the drill's in chapter 3). */
export function shelterRepo(t: Translate, n: ChapterNo): Repo {
  const paddock = host(t, 'paddock');
  const repo: Repo = { id: hex('shelter-repository-2029'), password: NIGHTLY_PASSWORD, snapshotList: [], packs: [], checked: false, pruneNeeded: false };
  repo.keys = [
    { id: hex('shelter-key-nightly'), password: NIGHTLY_PASSWORD, user: 'root', host: paddock, created: Date.UTC(2029, 4, 12, 21, 10, 0) },
    { id: hex('shelter-key-envelope'), password: password(t, ENVELOPE), user: 'root', host: paddock, created: Date.UTC(2029, 4, 12, 21, 14, 0) },
  ];
  if (n === 3) repo.keys.push({ id: hex('shelter-key-drill'), password: DRILL_PASSWORD, user: 'root', host: host(t, 'meadow'), created: NOW[3] - 3_600_000 });
  const all = nights(n);
  const kept = new Set(applyPolicy(all.map((time) => ({ id: String(time), time, host: '', paths: [], files: {} })), { daily: 14, weekly: 8 }).keys());
  const list = all.filter((x) => kept.has(String(x)));
  // From chapter 2: chapter 1's fix (a manual run on 3 November, then vetlink every night).
  const vetlinkFrom = Date.UTC(2031, 10, 3, 10, 0, 0);
  if (n > 1) list.push(vetlinkFrom + 12 * 60_000);
  list.sort((a, b) => a - b);
  list.forEach((time, i) => addSnapshot(repo, nightSnapshot(t, time, n > 1 && time >= vetlinkFrom, i === list.length - 1)));
  repo.checked = true;
  return repo;
}

// ——— The written plan: a table of services ———

export interface PlanRow {
  service: string;
  rpo: string;
  rto: string;
  backup: string;
  owner: string;
  line: string;
}

export type ServiceId = 'website' | 'adoptions' | 'vetlink' | 'newsletter';

/** A duration as the plan writes it (4h, 30 min, 1 day, 24 h, 2d, 1 w…), in milliseconds; null if unreadable. */
export function duration(text: string): number | null {
  const m = /^\s*(\d+(?:[.,]\d+)?)\s*(min|mins|minutes?|m|h|hrs?|hours?|heures?|d|days?|j|jours?|w|weeks?|sem|semaines?)\s*$/i.exec(text);
  if (!m) return null;
  const n = Number(m[1].replace(',', '.'));
  const u = m[2].toLowerCase();
  const unit = /^m/.test(u) ? 60_000 : /^h/.test(u) ? 3_600_000 : /^(d|j)/.test(u) ? DAY : 7 * DAY;
  return n * unit;
}

/** The rows of the plan's table (the header names its columns: Service, RPO, RTO, Backup, Owner, in any order). */
export function planRows(t: Translate, text: string): PlanRow[] {
  const cells = (l: string) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
  const lines = text.split('\n').filter((l) => l.trim().startsWith('|'));
  const head = lines.findIndex((l) => /\bRPO\b/i.test(l) && /\bRTO\b/i.test(l));
  if (head < 0) return [];
  const columns = cells(lines[head]).map((c) => c.toLowerCase());
  const col = (key: string) => columns.findIndex((c) => c.includes(t(`shelter-plan-col-${key}`).toLowerCase()));
  const at = { service: col('service'), rpo: columns.findIndex((c) => /\brpo\b/.test(c)), rto: columns.findIndex((c) => /\brto\b/.test(c)), backup: col('backup'), owner: col('owner') };
  const out: PlanRow[] = [];
  for (const l of lines.slice(head + 1)) {
    if (/^\s*\|?[\s:|-]+\|?\s*$/.test(l)) continue;
    const c = cells(l);
    const get = (i: number) => (i >= 0 ? (c[i] ?? '') : '');
    out.push({ service: get(at.service), rpo: get(at.rpo), rto: get(at.rto), backup: get(at.backup), owner: get(at.owner), line: l });
  }
  return out;
}

/** Which of paddock's services a row is about (vetlink, then the app and its database, then the site). */
export function serviceOf(row: PlanRow): ServiceId | null {
  const s = row.service.toLowerCase();
  if (/phplist|newsletter|lettre|infolettre/.test(s)) return 'newsletter';
  if (/vetlink|\bv(e|\u00e9)t/.test(s)) return 'vetlink';
  if (/adopt|postgres|database|\bbase\b|\bdb\b|\bapp/.test(s)) return 'adoptions';
  if (/nginx|web|site/.test(s)) return 'website';
  return null;
}

/** What a service's data is, in the backups. */
export const DATA_PATH: Record<Exclude<ServiceId, 'newsletter'>, string> = { website: `${WEB_ROOT}/index.html`, adoptions: DUMP, vetlink: `${VETLINK}/records/` };

/** The snapshots that hold a service's data. */
export const holding = (repo: Repo, id: Exclude<ServiceId, 'newsletter'>) =>
  repo.snapshotList.filter((s) => Object.keys(s.files).some((p) => (DATA_PATH[id].endsWith('/') ? p.startsWith(DATA_PATH[id]) : p === DATA_PATH[id])));

/** The interval between two runs of a calendar (OnCalendar=), from `now`: what the best RPO is. */
export function interval(calendar: string, now: number): number | null {
  const c = readCalendar(calendar);
  if (!c) return null;
  const a = nextCalendar(c, now);
  const b = a && nextCalendar(c, a);
  return a && b ? b - a : null;
}

// ——— The adoption app (gunicorn on 127.0.0.1:8000, behind nginx's /adopt/) ———

/** What gunicorn writes when it can't start: null if all is well. */
export function adoptCheck(j: Game): string[] | null {
  const ts = `[${new Date(sd(j).clock).toISOString().slice(0, 19).replace('T', ' ')} +0100]`;
  if (!j.find(`${ADOPT}/venv/bin/gunicorn`)) return [`adopt.service: Failed to locate executable ${ADOPT}/venv/bin/gunicorn: No such file or directory`];
  if (!j.find(`${ADOPT}/.env`)) return [`adopt.service: Failed to load environment files: No such file or directory`];
  const pg = j.state.postgres as { bases: Record<string, { tables: Record<string, Table> }> } | undefined;
  if (!pg || sd(j).services.postgresql?.state !== 'active')
    return [`${ts} [1904] [ERROR] Exception in worker process`, 'psycopg.OperationalError: connection is bad: connection to server on socket "/var/run/postgresql/.s.PGSQL.5432" failed: No such file or directory', `${ts} [1903] [ERROR] Worker (pid:1904) exited with code 3`, `${ts} [1903] [ERROR] Shutting down: Master`, `${ts} [1903] [ERROR] Reason: Worker failed to boot.`];
  if (!pg.bases.shelter)
    return [`${ts} [1904] [ERROR] Exception in worker process`, 'psycopg.OperationalError: connection failed: connection to server on socket "/var/run/postgresql/.s.PGSQL.5432" failed: FATAL:  database "shelter" does not exist', `${ts} [1903] [ERROR] Worker (pid:1904) exited with code 3`, `${ts} [1903] [ERROR] Reason: Worker failed to boot.`];
  if (!pg.bases.shelter.tables.animals)
    return [`${ts} [1904] [ERROR] Exception in worker process`, 'psycopg.errors.UndefinedTable: relation "animals" does not exist', `${ts} [1903] [ERROR] Worker (pid:1904) exited with code 3`, `${ts} [1903] [ERROR] Reason: Worker failed to boot.`];
  return null;
}

export const ADOPT_PROCESS = [
  { pid: 1903, user: 'adopt', cpu: 0, mem: 1.2, command: `${ADOPT}/venv/bin/python3 ${ADOPT}/venv/bin/gunicorn -b 127.0.0.1:8000 adopt.wsgi` },
  { pid: 1904, user: 'adopt', cpu: 0, mem: 2.1, command: `${ADOPT}/venv/bin/python3 ${ADOPT}/venv/bin/gunicorn -b 127.0.0.1:8000 adopt.wsgi` },
];

export const adoptService = (): DefinitionService => ({
  description: "Adopt, the shelters' adoption app (gunicorn)",
  active: true,
  executable: 'gunicorn',
  process: ADOPT_PROCESS,
  check: adoptCheck,
  modelled: true,
  unitFile: '/etc/systemd/system/adopt.service',
});

/** The app's pages: its home, the animals waiting, its health; a database gone gives a 500. */
export const adoptApp = () => ({
  service: 'adopt',
  pages: {},
  answer: (j: Game, path: string) => {
    const pg = j.state.postgres as { bases: Record<string, { tables: Record<string, Table> }> } | undefined;
    const tables = pg?.bases.shelter?.tables;
    if (!tables?.animals || sd(j).services.postgresql?.state !== 'active') return { code: 500, body: '<h1>Internal Server Error</h1>' };
    if (path === '/' || path === '') return { code: 200, body: clip(j.t('shelter-app-home')) };
    if (path === '/animals') return { code: 200, body: clip(j.t('shelter-app-animals', { count: waiting(tables) })) };
    if (path === '/health') return { code: 200, body: 'ok' };
    return { code: 404, body: '<h1>Not Found</h1>' };
  },
});

// ——— Accounts ———

const baseUsers = {
  root: { uid: 0, group: 'root', home: '/root' },
  'www-data': { uid: 33, group: 'www-data', home: '/var/www', shell: '/usr/sbin/nologin' },
  you: { uid: 1000, group: 'you' },
};
const baseGroups = {
  root: { gid: 0, members: [] },
  adm: { gid: 4, members: ['you'] },
  sudo: { gid: 27, members: ['you'] },
  'www-data': { gid: 33, members: [] },
  you: { gid: 1000, members: [] },
};

export const meadowAccounts = (): Accounts => ({
  users: { ...baseUsers, bind: { uid: 104, group: 'bind', home: '/var/cache/bind', shell: '/usr/sbin/nologin' }, restic: { uid: 998, group: 'restic', home: '/srv/restic', shell: '/bin/sh' } },
  groups: { ...baseGroups, bind: { gid: 110, members: [] }, restic: { gid: 998, members: [] } },
});

const paddockAccounts = (): Accounts => ({
  users: { ...baseUsers, postgres: { uid: 108, group: 'postgres', home: '/var/lib/postgresql', shell: '/bin/bash' }, adopt: { uid: 997, group: 'adopt', home: ADOPT, shell: '/usr/sbin/nologin' } },
  groups: { ...baseGroups, postgres: { gid: 113, members: [] }, adopt: { gid: 997, members: [] } },
});

// haven: a fresh install (root and you), or rebuilt (the accounts the packages and the app need).
const havenAccounts = (restored: boolean) => (): Accounts =>
  restored ? paddockAccounts() : { users: { root: baseUsers.root, you: baseUsers.you }, groups: { root: baseGroups.root, adm: baseGroups.adm, sudo: baseGroups.sudo, you: baseGroups.you } };

// ——— Time: the same clock on every machine of the story ———

/** Each command: half a minute, on every machine (and restic's clock with it). */
export function passTime(j: Game): void {
  const p = (j as Shell).principal;
  const main = sd(p);
  main.clock += 30_000;
  p.state.resticClock = main.clock;
  for (const id of ['paddock', 'haven']) {
    const s = p.internals.get(id);
    const x = s && systemd(s);
    if (!s || !x) continue;
    x.clock = main.clock;
    s.state.resticClock = main.clock;
  }
}

// ——— The machines ———

const proc = (pid: number, user: string, command: string) => ({ pid, user, cpu: 0, mem: 0.4, command });
const ssh = (): DefinitionService => ({ description: 'OpenBSD Secure Shell server', active: true, executable: 'sshd', process: [proc(611, 'root', 'sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups')] });
const cron = (): DefinitionService => ({ description: 'Regular background program processing daemon', active: true, executable: 'cron', process: [proc(598, 'root', '/usr/sbin/cron -f')] });
const nginxService = (): DefinitionService => ({
  description: 'A high performance web server and a reverse proxy server',
  active: true,
  executable: 'nginx',
  process: [proc(812, 'root', 'nginx: master process /usr/sbin/nginx -g daemon on; master_process on;'), proc(813, 'www-data', 'nginx: worker process')],
  check: (j) => checkNginx(j),
  checkToReload: true,
  load: (j) => loadNginx(j),
});
const postgresService = (): DefinitionService => ({ description: 'PostgreSQL RDBMS', active: true, executable: 'postgres', process: [proc(742, 'postgres', '/usr/lib/postgresql/17/bin/postgres -D /var/lib/postgresql/17/main -c config_file=/etc/postgresql/17/main/postgresql.conf')] });

/** A file tree from a list of absolute paths (path → content), with rights. */
function tree(files: Record<string, string>, rights: (p: string) => Rights = () => root): Record<string, Node> {
  const top: Directory = place({});
  for (const [p, content] of Object.entries(files)) {
    const parts = p.split('/').filter(Boolean);
    let at = top;
    for (const part of parts.slice(0, -1)) {
      const next = at.children[part];
      if (next?.type === 'directory') at = next;
      else at = at.children[part] = place({});
    }
    at.children[parts.at(-1)!] = file(content, rights(p));
  }
  return top.children;
}

/** Merges trees made by tree() and place(). */
function merge(...trees: Record<string, Node>[]): Record<string, Node> {
  const out: Record<string, Node> = {};
  for (const t of trees)
    for (const [k, v] of Object.entries(t)) {
      const old = out[k];
      if (old?.type === 'directory' && v.type === 'directory') out[k] = { ...old, children: merge(old.children, v.children) };
      else out[k] = v;
    }
  return out;
}

const playerKey = (t: Translate) => generateKey('shelter-meadow', `you@${host(t, 'meadow')}`);

/** The authorized key on the internal machines (the one meadow's account has). */
const authorized = (t: Translate) => ({ '.ssh': d({ authorized_keys: f(playerKey(t).isPublic, { lines: true, mode: 'rw-------' }) }, undefined, { mode: 'rwx------' }) });

const appRights = (p: string): Rights => (p.startsWith(ADOPT) ? { owner: 'adopt', group: 'adopt', mode: p.endsWith('.env') ? 'rw-r-----' : p.includes('/bin/') ? 'rwxr-xr-x' : 'rw-r--r--' } : p.startsWith(VETLINK) ? { owner: 'adopt', group: 'adopt' } : p.endsWith('_key') ? { owner: 'root', mode: 'rw-------' } : root);

/** paddock (chapter 1): the server in Hillside's cellar, as it runs. */
export function paddockHost(): InternalHost {
  return {
    address: PADDOCK,
    domain: 'paddock.internal',
    accounts: paddockAccounts,
    commands: PADDOCK_COMMANDS,
    state: (t) => ({
      systemd: newSystemd(host(t, 'paddock'), BOOT, NOW[1], { ssh: ssh(), cron: cron(), nginx: nginxService(), postgresql: postgresService(), adopt: adoptService() }),
      nginx: { load: null, names: ['localhost', '127.0.0.1', host(t, 'paddock'), SITE, DOMAIN] },
      postgres: { bases: { shelter: { owner: 'adopt', tables: copyOf(referenceTables(t, NOW[1] - 7 * 3_600_000)) } }, roles: ['postgres', 'adopt'], archives: {} },
      apps: { '127.0.0.1:8000': adoptApp() },
      resticClock: NOW[1],
      listening: [
        { proto: 'tcp', address: '0.0.0.0', port: 22, process: 'sshd', pid: 611 },
        { proto: 'tcp', address: '[::]', port: 22, process: 'sshd', pid: 611 },
        { proto: 'tcp', address: '0.0.0.0', port: 80, process: 'nginx', pid: 812 },
        { proto: 'tcp', address: '[::]', port: 80, process: 'nginx', pid: 812 },
        { proto: 'tcp', address: '127.0.0.1', port: 5432, process: 'postgres', pid: 742 },
        { proto: 'tcp', address: '127.0.0.1', port: 8000, process: 'gunicorn', pid: 1903 },
      ],
      mounts: [{ path: '/', capacity: 240 * 1024 ** 3, name: '/dev/sda1', system: 'ext4' }],
    }),
    initialise: (j) => {
      const s = sd(j);
      loadNginx(j);
      loadUnits(j as Shell, s);
      for (const [n, last] of [
        ['vetlink-sync', NOW[1] - 30 * 60_000],
        ['shelter-backup', nights(1).at(-1)!],
      ] as const) {
        const timer = s.timers?.[n];
        if (timer) Object.assign(timer, { active: true, state: 'active', last });
      }
    },
    beforeCommand: (j) => void (j.state.resticClock = sd(j).clock),
    afterCommand: (j) => passTime(j),
    createWorld: (t) => {
      const last = nights(1).at(-1)!;
      const night = last - 60_000;
      const etc = paddockEtc(t);
      delete etc['/etc/nginx/sites-enabled/shelter'];
      const log = nights(1)
        .slice(-14)
        .map((ms) => `${new Date(ms + 190_000).toISOString().slice(0, 19)}+01:00 backup done`)
        .join('\n');
      return place(
        merge(
          {
            etc: place({ ...accountsFiles(), nginx: place({ 'sites-enabled': place({ shelter: f('', { owner: 'root', link: SITE_FILE }) }), 'conf.d': place({}), 'modules-enabled': place({}) }) }),
            home: place({ you: d(authorized(t)) }),
            root: place({ '.restic-pass': file(NIGHTLY_PASSWORD, { owner: 'root', group: 'root', mode: 'rw-------' }) }, { owner: 'root', mode: 'rwx------' }),
            tmp: place({}, { owner: 'root', mode: 'rwxrwxrwt' }),
            var: place({ www: place({ html: place({}) }), log: place({ nginx: place({ 'access.log': file('', { owner: 'www-data', group: 'adm', mode: 'rw-r-----' }), 'error.log': file('', { owner: 'www-data', group: 'adm', mode: 'rw-r-----' }) }) }) }),
          },
          tree(etc, appRights),
          tree({ [`${WEB_ROOT}/index.html`]: siteIndex(t) }),
          tree(adoptFiles(t), appRights),
          tree(Object.fromEntries(Object.entries(vetRecords(t)).map(([n, c]) => [`${VETLINK}/records/${n}`, c])), appRights),
          tree({ [`${VETLINK}/.token`]: hex('vetlink-token', 32) }, () => ({ owner: 'adopt', group: 'adopt', mode: 'rw-------' })),
          tree({ [BACKUP_SCRIPT]: backupScript(t, false), '/usr/local/bin/vetlink-sync': VETLINK_SCRIPT(t) }, () => ({ owner: 'root', mode: 'rwxr-xr-x' })),
          tree({ [DUMP]: dumpOf(t, night), [SUMS]: sumsOf(t, night), [COUNTS]: countsOf(t, night) }),
          tree({ '/var/log/shelter-backup.log': log }, () => ({ owner: 'root', group: 'adm', mode: 'rw-r-----' })),
        ),
      );
    },
  };
}

export const PADDOCK_COMMANDS = ['ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'find', 'echo', 'nano', 'sudo', 'systemctl', 'journalctl', 'ss', 'crontab', 'nginx', 'curl', 'psql', 'pg_dump', 'restic', 'sha256sum', 'date', 'sh', 'export', 'df', 'du', 'exit'];
export const HAVEN_COMMANDS = ['ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'find', 'echo', 'tee', 'nano', 'cp', 'mv', 'rm', 'mkdir', 'ln', 'chmod', 'chown', 'diff', 'sudo', 'apt', 'systemctl', 'journalctl', 'ss', 'nginx', 'curl', 'psql', 'createdb', 'pg_dump', 'restic', 'sha256sum', 'ufw', 'date', 'export', 'df', 'exit'];

/** haven's machine-specific files are still its own (not paddock's, after a restore over /etc). */
export const clobbered = (j: Game): string[] => {
  const paddock = machineFiles(j.t, 'paddock');
  return Object.keys(paddock).filter((p) => p !== '/etc/hosts' && (j.read(p) ?? '').trim() === paddock[p].trim());
};

/** Puts haven's own machine-specific files back (Wiremu's copy of the fresh install). */
export function putBackMachineFiles(j: Game): void {
  const own = machineFiles(j.t, 'haven');
  for (const [p, c] of Object.entries(own)) {
    const n = j.find(p);
    if (n?.type === 'file') n.content = c;
  }
}

/** haven: in chapter 2, Wiremu's fresh Debian 13 (restic installed, nothing else); in chapter 3, rebuilt. */
export function havenHost(n: 2 | 3): InternalHost {
  const restored = n === 3;
  return {
    address: HAVEN,
    domain: 'haven.internal',
    accounts: havenAccounts(restored),
    commands: HAVEN_COMMANDS,
    state: (t) => ({
      systemd: newSystemd(host(t, 'haven'), Date.UTC(2031, 10, 14, 7, 55, 0), NOW[n], {
        ssh: ssh(),
        cron: cron(),
        ...(restored ? { nginx: nginxService(), postgresql: postgresService(), adopt: adoptService() } : {}),
      }),
      ...(restored
        ? {
            nginx: { load: null, names: ['localhost', '127.0.0.1', host(t, 'haven'), SITE, DOMAIN] },
            postgres: { bases: { postgres: { owner: 'postgres', tables: {} }, shelter: { owner: 'postgres', tables: copyOf(referenceTables(t, lastNight(2))) } }, roles: ['postgres'], archives: {} },
            apps: { '127.0.0.1:8000': adoptApp() },
            ufw: { enabled: true, incoming: 'deny', outgoing: 'allow', rules: [{ action: 'allow', to: 'OpenSSH', ports: [22], forEachOf: null }] } satisfies Firewall,
            apt: { lists: true, installed: { restic: '0.18.0-1+b3', nginx: '1.26.3-3+deb13u1', 'nginx-common': '1.26.3-3+deb13u1', postgresql: '17+278' } },
          }
        : { apt: { lists: false, installed: { restic: '0.18.0-1+b3' } } }),
      resticClock: NOW[n],
      mounts: [{ path: '/', capacity: 480 * 1024 ** 3, name: '/dev/nvme0n1p2', system: 'ext4' }],
    }),
    initialise: (j) => {
      if (restored) loadNginx(j);
      loadUnits(j as Shell, sd(j));
    },
    beforeCommand: (j) => {
      j.state.resticClock = sd(j).clock;
      modelAdopt(j);
    },
    afterCommand: (j) => {
      modelAdopt(j);
      watchHaven(j);
      passTime(j);
    },
    createWorld: (t) => {
      const own = machineFiles(t, 'haven');
      const files: Record<string, Node>[] = [
        {
          etc: place({ ...accountsFiles(), systemd: place({ system: place({}) }) }),
          home: place({ you: d(authorized(t)) }),
          root: place({}, { owner: 'root', mode: 'rwx------' }),
          srv: place({}),
          tmp: place({}, { owner: 'root', mode: 'rwxrwxrwt' }),
          var: place({ backups: place({}), log: place({}) }),
          usr: place({ bin: place({ restic: f('', { owner: 'root', mode: 'rwxr-xr-x', size: 27_828_408 }) }) }),
        },
        tree(own, appRights),
      ];
      if (restored) {
        const etc = paddockEtc(t);
        for (const k of Object.keys(machineFiles(t, 'paddock'))) delete etc[k];
        delete etc['/etc/nginx/sites-enabled/shelter'];
        files.push(
          { etc: place({ nginx: place({ 'sites-enabled': place({ shelter: f('', { owner: 'root', link: SITE_FILE }) }), 'conf.d': place({}), 'modules-enabled': place({}) }), ufw: place({ 'ufw.conf': file('# /etc/ufw/ufw.conf\nENABLED=yes\nLOGLEVEL=low') }) }) },
          tree(etc, appRights),
          tree({ [`${WEB_ROOT}/index.html`]: siteIndex(t) }),
          tree(adoptFiles(t), appRights),
          tree(Object.fromEntries(Object.entries(vetRecords(t)).map(([x, c]) => [`${VETLINK}/records/${x}`, c])), appRights),
          { var: place({ log: place({ nginx: place({ 'access.log': file('', { owner: 'www-data', group: 'adm', mode: 'rw-r-----' }), 'error.log': file('', { owner: 'www-data', group: 'adm', mode: 'rw-r-----' }) }) }) }) },
        );
      }
      return place(merge(...files));
    },
  };
}

/** The database on haven holds every row of the flood night's dump. */
export function restoredDb(h: Shell): boolean {
  const tables = (h.state.postgres as { bases: Record<string, { tables: Record<string, Table> }> } | undefined)?.bases.shelter?.tables;
  const want = referenceTables(h.t, lastNight(2));
  return !!tables && Object.entries(want).every(([n, x]) => JSON.stringify(tables[n]?.lines) === JSON.stringify(x.lines));
}

/** What the player checked on haven: the dump's checksum, the row counts, the site through curl. */
function watchHaven(j: Game): void {
  const h = j as Shell;
  const line = h.last.line ?? '';
  const sums = (h.state.sha256Checked as { ok: number; failed: number }[] | undefined) ?? [];
  if (/sha256sum/.test(line) && sums.at(-1)?.ok && !sums.at(-1)?.failed && /shelter\.sql: OK/.test(h.last.output)) h.state.dumpChecked = true;
  if (/count\(\*\)/i.test(line) && /\bpsql\b/.test(line) && !h.last.errors.length && restoredDb(h)) h.state.countsChecked = ((h.state.countsChecked as number) ?? 0) + 1;
  if (/\bcurl\b/.test(line) && /\/adopt\//.test(line) && havenServes(h).app && !h.last.errors.length) h.state.testedLocally = true;
}

/** Once its unit file is loaded (daemon-reload), adopt on haven is the modelled app (it needs its database). */
function modelAdopt(j: Game): void {
  const s = sd(j).services.adopt;
  if (!s || s.modelled) return;
  Object.assign(s, { modelled: true, check: adoptCheck, process: ADOPT_PROCESS, executable: 'gunicorn' });
  j.state.apps ??= { '127.0.0.1:8000': adoptApp() };
}

/** paddock, haven, once the player has connected to them (null before). */
export const inner = (j: Game, id: 'paddock' | 'haven'): Shell | null => (j as Shell).principal.internals.get(id) ?? null;

// ——— meadow: the plan, the repository, the DNS ———

export const ZONE = (t: Translate, serial: number, address: string, ttl: number) => `; ${t('shelter-zone-comment')}
$TTL 3600
@       IN  SOA ${REGISTRAR}. hostmaster.${DOMAIN}. (
                ${serial} ; serial
                3600       ; refresh
                900        ; retry
                1209600    ; expire
                300 )      ; negative cache TTL
@       IN  NS  ${REGISTRAR}.
@       IN  MX  10 mail.mailhost.example.
www     ${ttl} IN  A   ${address}`;

const NAMED_CONF_LOCAL = `// Hidden primary: the registrar's server serves the zone, from our copy.
zone "${DOMAIN}" {
    type primary;
    file "${ZONE_FILE}";
    allow-transfer { 198.51.100.53; };
    also-notify { 198.51.100.53; };
};`;

/** The monitoring log on meadow: a check of the site every five minutes (from 1:00 to the chapter). */
function sitewatch(n: ChapterNo): string {
  const lines: string[] = [];
  const end = NOW[n] - 60_000;
  for (let ms = (n === 1 ? NOW[1] : LAST_OK) - 6 * 300_000; ms < end; ms += 300_000) {
    const ok = n === 1 || ms <= LAST_OK;
    lines.push(`${new Date(ms).toISOString().slice(0, 19)}+01:00 http://${SITE}/ ${ok ? `200 ${(0.18 + (hash(`w${ms}`) % 9) / 100).toFixed(2)}s` : 'timeout after 10s'}`);
  }
  return lines.join('\n');
}

export const SERIAL = 2031110302;

export function meadowState(t: Translate, n: ChapterNo) {
  const services: Record<string, DefinitionService> = { ssh: ssh(), cron: cron() };
  if (n === 3) services.named = { description: 'BIND Domain Name Server', active: true, executable: 'named', process: [proc(733, 'bind', '/usr/sbin/named -f -u bind')] };
  return {
    systemd: newSystemd(host(t, 'meadow'), BOOT, NOW[n], services),
    restic: { [REPO]: shelterRepo(t, n) },
    resticClock: NOW[n],
    mounts: [{ path: '/', capacity: 160 * 1024 ** 3, name: '/dev/vda1', system: 'ext4' }],
    ...(n === 3
      ? {
          dns: {
            conf: '/etc/bind/named.conf.local',
            primary: {},
            secondary: {},
            cache: {},
            servers: { primary: ['localhost', '127.0.0.1', MEADOW, host(t, 'meadow')], secondary: [REGISTRAR, '198.51.100.53'], resolver: ['resolver.isp.example', RESOLVER] },
            charges: {},
          } satisfies DnsState,
        }
      : {}),
  };
}

export function meadowWorld(t: Translate, n: ChapterNo, home: Record<string, Node>): Directory {
  const key = playerKey(t);
  const hosts = [`127.0.0.1\tlocalhost`, `${MEADOW}\t${host(t, 'meadow')}.internal ${host(t, 'meadow')}`, ...(n === 1 ? [`${PADDOCK}\t${host(t, 'paddock')}.internal ${host(t, 'paddock')}`] : [`${PADDOCK}\t${host(t, 'paddock')}.internal ${host(t, 'paddock')}`, `${HAVEN}\t${host(t, 'haven')}.internal ${host(t, 'haven')}`])];
  return place({
    etc: place({
      ...accountsFiles(),
      hostname: file(host(t, 'meadow')),
      hosts: file(hosts.join('\n')),
      'resolv.conf': file(`nameserver ${RESOLVER}`),
      ...(n === 3
        ? {
            bind: place({ 'named.conf.local': file(NAMED_CONF_LOCAL), [`db.${DOMAIN}`]: file(ZONE(t, SERIAL, OLD_PUBLIC, 300)) }, { owner: 'root', group: 'bind', mode: 'rwxr-sr-x' }),
            systemd: place({ system: place({}) }),
          }
        : {}),
    }),
    home: place({ you: d({ ...home, '.ssh': d({ id_ed25519: f(key.isPrivate, { lines: true, mode: 'rw-------' }), 'id_ed25519.pub': f(key.isPublic, { lines: true }) }, undefined, { mode: 'rwx------' }) }) }),
    root: place(n === 3 ? { '.restic-drill': file(DRILL_PASSWORD, { owner: 'root', group: 'root', mode: 'rw-------' }) } : {}, { owner: 'root', mode: 'rwx------' }),
    srv: place({
      drp: place({ 'plan.md': file(clip(t(n === 1 ? 'shelter-plan-2029' : 'shelter-plan-2031')), { owner: 'you', group: 'you', mode: 'rw-rw-r--' }) }, { owner: 'you', group: 'you' }),
      // Its files are written at the start (initialiseMeadow): restic's names aren't translated.
      restic: { type: 'directory', children: {}, owner: 'restic', group: 'restic', mode: 'rwx------' },
    }),
    tmp: place({}, { owner: 'root', mode: 'rwxrwxrwt' }),
    usr: place({ local: place({ sbin: place(n === 3 ? { 'restore-drill': file(t('shelter-drill-draft', { repo: REPO }), { owner: 'root', mode: 'rwxr-xr-x' }) } : {}) }) }),
    var: place({ log: place({ 'sitewatch.log': file(sitewatch(n), { owner: 'root', group: 'adm', mode: 'rw-r-----' }) }) }),
  });
}

/** At a chapter's start: the repository's files as restic names them (the world's names are translated). */
export function initialiseMeadow(j: Game): void {
  const repo = (j.state.restic as Record<string, Repo>)[REPO];
  writeRepo(j as Shell, REPO, repo);
}

/** At chapter 3's start: named has loaded the zone, the registrar has a copy, the resolver remembers the old address. */
export function initialiseDns(j: Game): void {
  const dns = j.state.dns as DnsState;
  const text = j.read(ZONE_FILE) ?? '';
  const rrs = [{ name: `www.${DOMAIN}.`, ttl: 300, type: 'A', data: OLD_PUBLIC }];
  dns.primary[DOMAIN] = { serial: SERIAL, rrs: rrs.map((r) => ({ ...r })) };
  dns.secondary[DOMAIN] = { serial: SERIAL, rrs: rrs.map((r) => ({ ...r })) };
  dns.charges[DOMAIN] = text;
  // A visitor asked two minutes ago: the resolver keeps the old answer for its TTL (300 s).
  dns.cache[`www.${DOMAIN}. A`] = { rrs: rrs.map((r) => ({ ...r })), expires: toUtc(NOW[3]) + 180_000 };
}

// ——— Requests between the story's machines (curl): the site, as the internet sees it ———

const CURL_WITH_VALUE = ['-H', '--header', '-o', '--output', '-w', '--write-out', '-X', '--request', '-A', '--user-agent', '-m', '--max-time', '--connect-timeout'];

/** Who answers on port 80 at a public or internal address, seen from `from` (null: nobody, a timeout). */
function answerAt(from: Shell, address: string): Shell | 'local' | null {
  const p = from.principal;
  // Hillside's line and paddock: alive in chapter 1 only (the cellar flooded on the night of 13 November).
  if (address === OLD_PUBLIC || address === PADDOCK) return p.chapter.hosts?.paddock ? p.internal('paddock') : null;
  if (address === NEW_PUBLIC || address === HAVEN) {
    if (from.host === 'haven') return 'local';
    return p.chapter.hosts?.haven ? p.internal('haven') : null;
  }
  return null;
}

/** curl on a story machine towards the site's names or the story's addresses; null: curl's own way (localhost…). */
export function storyCurl(from: Shell, args: string[]): string | null {
  let requestHost: string | null = null;
  const positional: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (CURL_WITH_VALUE.includes(args[i])) {
      const v = args[++i] ?? '';
      const h = /^host:\s*(\S+)/i.exec(v);
      if ((args[i - 1] === '-H' || args[i - 1] === '--header') && h) requestHost = h[1];
    } else if (!args[i].startsWith('-')) positional.push(args[i]);
  }
  const m = /^(?:(https?):\/\/)?([^/:]+)(?::(\d+))?(.*)$/.exec(positional[0] ?? '');
  if (!m) return null;
  const target = m[2].toLowerCase();
  const port = Number(m[3] ?? (m[1] === 'https' ? 443 : 80));
  const path = m[4] || '/';
  const publicName = target === SITE || target === DOMAIN;
  const known = [OLD_PUBLIC, NEW_PUBLIC, PADDOCK, HAVEN].includes(target);
  if (!publicName && !known) return null;
  let address = target;
  const p = from.principal;
  if (publicName) {
    // The machine asks its resolver (/etc/resolv.conf); without the story's DNS, the zone as it was.
    const dns = p.state.dns as DnsState | undefined;
    if (dns) {
      const r = query(p, 'resolver', target, 'A', toUtc(sd(p).clock));
      const a = r.responses.find((x) => x.type === 'A')?.data;
      if (!a) return from.error(`curl: (6) Could not resolve host: ${target}`, 6);
      address = a;
    } else address = OLD_PUBLIC;
  }
  const timeout = () => from.error(`curl: (28) Failed to connect to ${target} port ${port} after 133002 ms: Timeout was reached`, 28);
  const who = answerAt(from, address);
  if (who === 'local' || who === from) return null;
  const st = (p.state.shelterCurls ??= []) as { from: string; address: string; code: number; via: string }[];
  if (!who || port !== 80) {
    st.push({ from: from.host, address, code: 0, via: target });
    return timeout();
  }
  // The firewall of the machine that answers, for a request from outside (or from meadow).
  const source = from.host === p.host ? MEADOW : '203.0.113.9';
  const v = who.state.ufw ? verdict(who.state.ufw as Firewall, port, source) : 'accepted';
  if (v === 'blocked') {
    st.push({ from: from.host, address, code: 0, via: target });
    return timeout();
  }
  if (v === 'refused' || !who.state.nginx || sd(who).services.nginx?.state !== 'active') {
    st.push({ from: from.host, address, code: 0, via: target });
    return from.error(`curl: (7) Failed to connect to ${target} port ${port} after 1 ms: Couldn't connect to server`, 7);
  }
  const r = httpRequest(who, requestHost ?? target, path, 80, true, { address: source, time: sd(who).clock, agent: 'curl/8.14.1' });
  if (!r) return from.error(`curl: (52) Empty reply from server`, 52);
  st.push({ from: from.host, address, code: r.code, via: target });
  const headers = args.includes('-I') || args.includes('--head');
  const withHeaders = args.includes('-i') || args.includes('--include');
  return headers ? r.headers.join('\n') : withHeaders ? `${r.headers.join('\n')}\n\n${r.body}` : r.body;
}

/** What the internet's visitors get now (the registrar's answer, then haven's firewall and nginx): a check without trace. */
export function visitorsReach(j: Game): 'old' | 'blocked' | 'down' | 'ok' {
  const p = (j as Shell).principal;
  const dns = p.state.dns as DnsState | undefined;
  const a = dns?.secondary[DOMAIN]?.rrs.find((r) => r.name === `www.${DOMAIN}.` && r.type === 'A')?.data;
  if (a !== NEW_PUBLIC) return 'old';
  const h = p.internal('haven');
  if (!h) return 'down';
  if (h.state.ufw && verdict(h.state.ufw as Firewall, 80, '203.0.113.9') !== 'accepted') return 'blocked';
  const r = h.state.nginx && sd(h).services.nginx?.state === 'active' ? httpRequest(h, SITE, '/adopt/animals', 80, false) : null;
  return r?.code === 200 ? 'ok' : 'down';
}

/** The site haven serves to a request for www (its home page and the app behind /adopt/), without trace. */
export function havenServes(h: Shell): { home: boolean; app: boolean } {
  if (!h.state.nginx || sd(h).services.nginx?.state !== 'active') return { home: false, app: false };
  const home = httpRequest(h, SITE, '/', 80, false);
  const app = httpRequest(h, SITE, '/adopt/animals', 80, false);
  return { home: home?.code === 200 && home.body.includes(siteIndex(h.t).split('\n').find((l) => l.includes('<h1>')) ?? '<h1>'), app: app?.code === 200 };
}

/** A deep copy of a tree (its functions kept: a file's content may be one). */
export function cloneTree<T>(x: T): T {
  if (Array.isArray(x)) return x.map(cloneTree) as T;
  if (x && typeof x === 'object') return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, cloneTree(v)])) as T;
  return x;
}

export { name };
