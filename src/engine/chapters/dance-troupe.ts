// Story "The Dance Troupe": what its chapters share. The Kestrel Dance
// Company (la Compagnie de danse Kestrel in French) is a volunteer-run
// community dance troupe: classes for every age, a spring gala, a few
// partner festivals. Its files live in a small Garage cluster, an S3
// object store written for self-hosting: three nodes in three places,
// each piece of data copied on all three. wings (coulisses in French, the
// story's main machine, 192.0.2.160, RFC 5737) is the studio's server and
// one of the nodes; vault, at the Old Mill theatre (198.51.100.162), is
// another, and the S3 gateway s3.kestrel.example and the website
// www.kestrel.example go through it; porch is at Siosaia's home
// (203.0.113.171). Esperanza is the artistic director, Teodora set the
// cluster up before moving away and left notes, Linh helps with the
// computers, Anahera is the treasurer, Farrukh films the shows, Siosaia
// hosts porch, Zuri produces a partner festival.
// Chapter 1: the members' documents published with the website (one bucket
// with website access), moved to a private bucket, a key per tool with
// least privilege; chapter 2: the nightly rclone backup to Garage fails (a
// clock three days behind, a wrong region, a key without write), made safe
// with --backup-dir, checked, and a file restored; chapter 3: a presigned
// URL for a week with a key of its own, and a failed node replaced in the
// layout.
// Why Garage: MinIO's community edition lost its admin console in 2025 and
// is now distributed as source only; Garage is a small, geo-distributed S3
// server made for self-hosting by a nonprofit (Deuxfleurs).
// Sources: https://garagehq.deuxfleurs.fr/documentation/,
// https://awscli.amazonaws.com/v2/documentation/api/latest/reference/s3/index.html,
// https://rclone.org/s3/, https://rclone.org/commands/rclone_sync/.

import { accountsFiles, d, f, type Accounts, type Directory, type File, type Node, type Rights } from '../world';
import type { Game, Shell } from '../shell';
import type { Translate } from '../../texts';
import { newSystemd, systemd, type DefinitionService, type Input } from '../systemd';
import { machineName } from '../machines';
import { loadUnits } from '../timers';
import { loadOverrides } from '../commands/systemd';
import { desync, displayUpdate, synchronise } from '../time';
import { hexOf, newBucketId, newKeyId, newSecret, object, typeOf, realNow, type AccessKey, type Bucket, type Garage, type GarageNode, type S3Object } from '../garage';

export const HOME = '/home/you';
export const PASSWORD = 'spring-gala-58';
export type ChapterNo = 1 | 2 | 3;
export const DOMAIN = 'kestrel.example';
export const WWW = `www.${DOMAIN}`;
export const S3_HOST = `s3.${DOMAIN}`;
export const ENDPOINT = `https://${S3_HOST}`;
export const IP = '192.0.2.160';
export const VAULT_IP = '198.51.100.162';
export const PORCH_IP = '203.0.113.171';
export const NEW_PORCH_IP = '203.0.113.172';
export const DAY = 86_400_000;
export const MIN = 60_000;
export const RCLONE_CONF = '/etc/rclone/office.conf';
export const BACKUP_SCRIPT = '/usr/local/bin/office-backup';
export const OFFICE = '/srv/office';
export const VIDEO = 'videos/spring-gala-2032-full.mp4';

// Paris time read as UTC (systemd's clock): Tuesday 9 March 2032, 9:20;
// Monday 12 April, 8:50; Thursday 13 May, 10:05.
export const NOW: Record<ChapterNo, number> = { 1: Date.UTC(2032, 2, 9, 9, 20, 0), 2: Date.UTC(2032, 3, 12, 8, 50, 0), 3: Date.UTC(2032, 4, 13, 10, 5, 0) };
const BOOT: Record<ChapterNo, number> = { 1: Date.UTC(2032, 1, 20, 7, 2, 0), 2: Date.UTC(2032, 3, 3, 18, 41, 0), 3: Date.UTC(2032, 3, 12, 9, 31, 0) };
// Chapter 2: since the power cut, wings' clock is three days and four hours behind.
export const SKEW = -(3 * DAY + 4 * 3_600_000 + 17 * MIN);
const utc = (local: number) => local - (new Date(local).getUTCMonth() >= 3 && new Date(local).getUTCMonth() <= 9 ? 2 : 1) * 3_600_000;

// ——— Helpers for the chapters ———

export const typed = (j: Game) => (j as Shell).last.line ?? '';
/** The last command's output contains this; reading the manual doesn't count. */
export const seen = (j: Game, text: string | RegExp) => {
  if (/^\s*(man|apropos|whatis|help)\b|--help\b/.test(typed(j))) return false;
  const last = (j as Shell).last;
  const all = `${last.output}\n${last.errors.join('\n')}`;
  return typeof text === 'string' ? all.includes(text) : text.test(all);
};
export const cluster = (j: Game): Garage => j.state.garage as Garage;
export const bucket = (j: Game, name: string) => cluster(j).buckets.find((b) => b.aliases.includes(name));
export const keyNamed = (j: Game, name: string) => cluster(j).keys.find((k) => k.name === name);

/** Identifiers that don't change between languages and runs. */
export const ADMIN = { id: newKeyId('troupe-admin'), secret: newSecret('troupe-admin') };
export const MEDIA_TEAM = { id: newKeyId('media-team'), secret: newSecret('media-team') };
export const SITE_DEPLOY = { id: newKeyId('site-deploy:2032'), secret: newSecret('site-deploy:2032') };
export const OFFICE_BACKUP = { id: newKeyId('office-backup:2032'), secret: newSecret('office-backup:2032') };
export const NODE = {
  wings: hexOf('node:wings', 64),
  vault: hexOf('node:vault', 64),
  porch: hexOf('node:porch', 64),
  newPorch: hexOf('node:porch:2032-05', 64),
};

// ——— What the buckets hold ———

export const MEMBER_DOCS = ['members/register-2032.csv', 'members/medical-contacts-2032.csv', 'members/board-minutes-2032-02.txt', 'members/photo-consent-2032.csv'];
const DOC_TEXT: Record<string, string> = {
  'members/register-2032.csv': 'troupe-doc-register',
  'members/medical-contacts-2032.csv': 'troupe-doc-medical',
  'members/board-minutes-2032-02.txt': 'troupe-doc-minutes',
  'members/photo-consent-2032.csv': 'troupe-doc-consent',
};
/** A member document's text (the same in every chapter, in the player's language). */
export const docText = (t: Translate, key: string) => t(DOC_TEXT[key]);

const CSS = `body { font-family: system-ui, sans-serif; margin: 0; color: #1d1d2b; }
header { background: #2b3a67; color: #fff; padding: 1rem; }
nav a { color: #ffd37a; margin-right: 1rem; }
main { max-width: 40rem; margin: auto; padding: 1rem; }`;

/** The website's files (in ~/site and in the www bucket). */
export function siteFiles(t: Translate): Record<string, string | number> {
  return {
    'index.html': t('troupe-site-index'),
    'agenda.html': t('troupe-site-agenda'),
    'classes.html': t('troupe-site-classes'),
    '404.html': t('troupe-site-404'),
    'css/style.css': CSS,
    'images/gala-2031.jpg': 418_262,
    'images/studio.jpg': 302_915,
  };
}

// The office share (/srv/office): what it holds at chapter 2's start, and what the backup of 2 April holds.
export const OFFICE_FILES: Record<string, string> = {
  'grants/arts-council-report-2031.txt': 'troupe-office-report',
  'accounts/budget-2032.csv': 'troupe-office-budget',
  'rehearsals/spring-schedule.txt': 'troupe-office-schedule',
  'letters/hall-booking.txt': 'troupe-office-hall',
};
// Written since the last backup that worked (they are only on wings).
export const NEW_FILES: Record<string, string> = {
  'rehearsals/gala-running-order.txt': 'troupe-office-running-order',
  'letters/thank-you-sponsors.txt': 'troupe-office-thanks',
  'admin/new-joiners-april.csv': 'troupe-office-joiners',
};
// Removed from the share since then (still in the backup).
export const REMOVED_FILES: Record<string, string> = { 'rehearsals/old-winter-plan.txt': 'troupe-office-old-plan' };
export const REPORT = 'grants/arts-council-report-2031.txt';

const site = (t: Translate, at: number): Record<string, S3Object> =>
  Object.fromEntries(Object.entries(siteFiles(t)).map(([k, v]) => [k, typeof v === 'number' ? object(null, at, typeOf(k), v, k) : object(v, at, typeOf(k))]));

const VIDEOS: Record<string, number> = {
  [VIDEO]: 3_814_296_412,
  'videos/rehearsal-2032-04-28.mp4': 1_207_553_904,
  'videos/workshop-teens-2032-03.mp4': 642_118_377,
  'photos/gala-2032/stage-01.jpg': 5_812_330,
  'photos/gala-2032/stage-02.jpg': 6_004_917,
};

function buckets(t: Translate, n: ChapterNo): Bucket[] {
  const created = utc(Date.UTC(2029, 4, 14, 20, 2, 11));
  const siteAt = utc(Date.UTC(2032, 1, 27, 22, 14, 3));
  const www: Bucket = { id: newBucketId('www'), aliases: [WWW], created, website: { index: 'index.html', error: '404.html' }, objects: site(t, siteAt) };
  const docsAt = utc(Date.UTC(2032, 1, 26, 21, 40, 0));
  const docs = Object.fromEntries(MEMBER_DOCS.map((k) => [k, object(docText(t, k), docsAt, typeOf(k))]));
  // Chapter 1: the documents are in the website's bucket; afterwards, in a private bucket.
  if (n === 1) Object.assign(www.objects, docs);
  const backups: Bucket = { id: newBucketId('backups'), aliases: ['backups'], created: utc(Date.UTC(2029, 4, 14, 20, 9, 40)), website: null, objects: {} };
  const backupAt = utc(n === 1 ? Date.UTC(2032, 2, 9, 2, 31, 12) : Date.UTC(2032, 3, 2, 2, 31, 12));
  for (const [k, id] of Object.entries(n === 3 ? { ...OFFICE_FILES, ...NEW_FILES } : { ...OFFICE_FILES, ...REMOVED_FILES })) backups.objects[`office/${k}`] = object(t(id), n === 3 ? utc(Date.UTC(2032, 4, 13, 2, 30, 41)) : backupAt, typeOf(k));
  if (n === 3) for (const [k, id] of Object.entries(REMOVED_FILES)) backups.objects[`office-old/2032-04-12/${k}`] = object(t(id), utc(Date.UTC(2032, 3, 12, 9, 40, 0)), typeOf(k));
  const media: Bucket = { id: newBucketId('media'), aliases: ['media'], created: utc(Date.UTC(2030, 8, 2, 19, 0, 0)), website: null, objects: {} };
  for (const [k, size] of Object.entries(VIDEOS)) if (n === 3 || !k.includes('2032-04') ) media.objects[k] = object(null, utc(Date.UTC(2032, n === 3 ? 4 : 2, n === 3 ? 11 : 1, 23, 12, 0)), typeOf(k), size, k);
  const list = [www, backups, media];
  if (n !== 1) list.push({ id: newBucketId('members'), aliases: ['members'], created: utc(Date.UTC(2032, 2, 9, 9, 41, 0)), website: null, objects: Object.fromEntries(MEMBER_DOCS.map((k) => [k.replace(/^members\//, ''), object(docText(t, k), docsAt, typeOf(k))])) });
  return list;
}

function keys(n: ChapterNo, list: Bucket[]): AccessKey[] {
  const id = (alias: string) => list.find((b) => b.aliases.includes(alias))!.id;
  const all = { read: true, write: true, owner: true };
  const rw = { read: true, write: true, owner: false };
  const admin: AccessKey = { ...ADMIN, name: 'troupe-admin', created: utc(Date.UTC(2029, 4, 14, 20, 1, 0)), createBucket: true, perms: Object.fromEntries(list.map((b) => [b.id, all])) };
  const media: AccessKey = { ...MEDIA_TEAM, name: 'media-team', created: utc(Date.UTC(2030, 8, 2, 19, 1, 0)), createBucket: false, perms: { [id('media')]: rw } };
  if (n === 1) return [admin, media];
  const deploy: AccessKey = { ...SITE_DEPLOY, name: 'site-deploy', created: utc(Date.UTC(2032, 2, 9, 9, 52, 0)), createBucket: false, perms: { [id(WWW)]: rw } };
  // Chapter 2: Linh took write away from the backup's key "so that nothing can erase the backups".
  const backup: AccessKey = { ...OFFICE_BACKUP, name: 'office-backup', created: utc(Date.UTC(2032, 2, 9, 9, 58, 0)), createBucket: false, perms: { [id('backups')]: n === 2 ? { read: true, write: false, owner: false } : rw } };
  return [admin, media, deploy, backup];
}

function nodes(n: ChapterNo, now: number): Record<string, GarageNode> {
  const TB = 1000 ** 4;
  const out: Record<string, GarageNode> = {
    [NODE.wings]: { id: NODE.wings, hostname: 'wings', address: `${IP}:3901`, up: true, avail: 1.41 * TB, disk: 2 * TB },
    [NODE.vault]: { id: NODE.vault, hostname: 'vault', address: `${VAULT_IP}:3901`, up: true, avail: 1.38 * TB, disk: 2 * TB },
    [NODE.porch]: { id: NODE.porch, hostname: 'porch', address: `${PORCH_IP}:3901`, up: n !== 3, avail: 1.43 * TB, disk: 2 * TB, ...(n === 3 ? { lastSeen: now - 2 * DAY - 7 * 3_600_000 } : {}) },
  };
  // Chapter 3: Siosaia's new machine, a new node (a new identity), connected, without a role yet.
  if (n === 3) out[NODE.newPorch] = { id: NODE.newPorch, hostname: 'porch', address: `${NEW_PORCH_IP}:3901`, up: true, avail: 3.94 * TB, disk: 4 * TB };
  return out;
}

export function newGarage(t: Translate, n: ChapterNo): Garage {
  const TB = 1000 ** 4;
  const list = buckets(t, n);
  return {
    region: 'garage',
    webRoot: `.web.${DOMAIN}`,
    replication: 3,
    nodes: nodes(n, utc(NOW[n])),
    layout: {
      version: 3,
      roles: { [NODE.wings]: { zone: 'studio', capacity: 2 * TB, tags: ['wings'] }, [NODE.vault]: { zone: 'mill', capacity: 2 * TB, tags: ['vault'] }, [NODE.porch]: { zone: 'home', capacity: 2 * TB, tags: ['porch'] } },
      staged: {},
    },
    buckets: list,
    keys: keys(n, list),
    log: [],
    counter: 2032 * 100 + n,
  };
}

// ——— The machine's files ———

const root: Rights = { owner: 'root' };
const dir = (children: Record<string, Node>, rights: Rights = root) => d(children, undefined, rights);
const file = (text: string, rights: Rights = root): File => f(text, { lines: true, ...rights });
const you: Rights = { owner: 'you', group: 'you' };
const proc = (pid: number, user: string, command: string) => ({ pid, user, cpu: 0, mem: 0.8, command });

export const GARAGE_TOML = `# Garage on wings (Teodora, 2029). Every node has the same rpc_secret and
# replication_factor; see https://garagehq.deuxfleurs.fr/documentation/reference-manual/configuration/
metadata_dir = "/var/lib/garage/meta"
data_dir = "/srv/garage/data"
db_engine = "lmdb"
metadata_auto_snapshot_interval = "6h"

replication_factor = 3
compression_level = 2

rpc_bind_addr = "[::]:3901"
rpc_public_addr = "${IP}:3901"
rpc_secret = "${hexOf('rpc-secret', 64)}"

[s3_api]
s3_region = "garage"
api_bind_addr = "[::]:3900"
root_domain = ".s3.${DOMAIN}"

[s3_web]
bind_addr = "[::]:3902"
root_domain = ".web.${DOMAIN}"
index = "index.html"

[admin]
api_bind_addr = "127.0.0.1:3903"
admin_token = "${hexOf('admin-token', 44)}"`;

const GARAGE_SERVICE = `[Unit]
Description=Garage Data Store
After=network-online.target
Wants=network-online.target

[Service]
Environment='RUST_LOG=garage=info' 'RUST_BACKTRACE=1'
ExecStart=/usr/local/bin/garage server
StateDirectory=garage
DynamicUser=true
ProtectHome=true
NoNewPrivileges=true
LimitNOFILE=42000

[Install]
WantedBy=multi-user.target`;

export const credentials = (deploy: { id: string; secret: string }) => `[default]
aws_access_key_id = ${ADMIN.id}
aws_secret_access_key = ${ADMIN.secret}

[deploy]
aws_access_key_id = ${deploy.id}
aws_secret_access_key = ${deploy.secret}`;

const AWS_CONFIG = `[default]
region = garage
endpoint_url = ${ENDPOINT}

[profile deploy]
region = garage
endpoint_url = ${ENDPOINT}`;

export const DEPLOY_SCRIPT = `#!/bin/sh
# Publishes ~/site to the website (Hiroshi, 2030). The members' folder lives
# in the same bucket: never delete it.
aws --profile deploy s3 sync ~/site/ s3://${WWW}/ --delete --exclude 'members/*'`;

export const rcloneConf = (key: { id: string; secret: string }, region: string) => `[garage]
type = s3
provider = Other
env_auth = false
access_key_id = ${key.id}
secret_access_key = ${key.secret}
region = ${region}
endpoint = ${ENDPOINT}
force_path_style = true
acl = private
bucket_acl = private`;

export const BACKUP_SCRIPT_TEXT = `#!/bin/sh
# Nightly copy of the office share to Garage (Teodora, 2029).
rclone --config ${RCLONE_CONF} sync ${OFFICE} garage:backups/office`;

const BACKUP_SERVICE = `[Unit]
Description=Copy the office share to Garage
After=network-online.target

[Service]
Type=oneshot
ExecStart=${BACKUP_SCRIPT}`;

const BACKUP_TIMER = `[Unit]
Description=Copy the office share to Garage every night

[Timer]
OnCalendar=*-*-* 02:30:00

[Install]
WantedBy=timers.target`;

const TIMESYNCD = `#  This file is part of systemd.
#
# See timesyncd.conf(5) for details.

[Time]
#NTP=
#FallbackNTP=0.debian.pool.ntp.org 1.debian.pool.ntp.org 2.debian.pool.ntp.org 3.debian.pool.ntp.org
#RootDistanceMaxSec=5
#PollIntervalMinSec=32
#PollIntervalMaxSec=2048`;

export const wingsAccounts = (): Accounts => ({
  users: {
    root: { uid: 0, group: 'root', home: '/root' },
    'systemd-timesync': { uid: 996, group: 'systemd-timesync', home: '/', shell: '/usr/sbin/nologin' },
    you: { uid: 1000, group: 'you' },
  },
  groups: {
    root: { gid: 0, members: [] },
    adm: { gid: 4, members: ['you'] },
    sudo: { gid: 27, members: ['you'] },
    office: { gid: 1100, members: ['you'] },
    'systemd-timesync': { gid: 996, members: [] },
    you: { gid: 1000, members: [] },
  },
});

export function wingsState(t: Translate, n: ChapterNo) {
  const services: Record<string, DefinitionService> = {
    ssh: { description: 'OpenBSD Secure Shell server', active: true, executable: 'sshd', process: [proc(588, 'root', 'sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups')] },
    garage: { description: 'Garage Data Store', active: true, executable: 'garage', process: [proc(1204, 'garage', '/usr/local/bin/garage server')], unitFile: '/etc/systemd/system/garage.service', modelled: true },
    'systemd-timesyncd': {
      description: 'Network Time Synchronization',
      active: n !== 2,
      ...(n === 2 ? { state: 'inactive' as const } : {}),
      executable: 'systemd-timesyncd',
      process: [proc(702, 'systemd-timesync', '/usr/lib/systemd/systemd-timesyncd')],
      load: synchronise,
      stop: desync,
    },
  };
  return {
    systemd: newSystemd(machineName(t, 'wings'), BOOT[n], NOW[n], services),
    garage: newGarage(t, n),
    s3net: { api: [S3_HOST], web: [WWW] },
    clockTime: {
      zone: 'Europe/Paris',
      offset: n === 2 ? SKEW : 0,
      synchronised: n !== 2,
      ...(n !== 2 ? { server: '0.debian.pool.ntp.org' } : {}),
      servers: { '0.debian.pool.ntp.org': '203.0.113.123', '1.debian.pool.ntp.org': '203.0.113.124', '2.debian.pool.ntp.org': '203.0.113.125', '3.debian.pool.ntp.org': '203.0.113.126' },
      muted: {},
    },
    listening: [
      { proto: 'tcp', address: '0.0.0.0', port: 22, process: 'sshd', pid: 588 },
      { proto: 'tcp', address: '[::]', port: 3900, process: 'garage', pid: 1204 },
      { proto: 'tcp', address: '[::]', port: 3901, process: 'garage', pid: 1204 },
      { proto: 'tcp', address: '[::]', port: 3902, process: 'garage', pid: 1204 },
      { proto: 'tcp', address: '127.0.0.1', port: 3903, process: 'garage', pid: 1204 },
    ],
    apt: { installed: { awscli: '2.23.6-1', rclone: '1.60.1+dfsg-4' } },
    mounts: [
      { path: '/', capacity: 64 * 1024 ** 3, name: '/dev/sda2', system: 'ext4' },
      { path: '/srv/garage', capacity: 2000 * 1000 ** 3, name: '/dev/sdb1', system: 'xfs' },
    ],
  };
}

export interface WorldOptions {
  home: Record<string, Node>;
}

/** The office share at the chapter's start (chapter 2: three new files, one removed, the report overwritten by a template). */
function officeShare(t: Translate, n: ChapterNo): Directory {
  const group: Rights = { owner: 'root', group: 'office', mode: 'rwxrwsr-x' };
  const tree: Record<string, Record<string, Node>> = {};
  const add = (rel: string, text: string, mtime: number) => {
    const [folder, name] = rel.split('/');
    (tree[folder] ??= {})[name] = f(text, { lines: true, owner: 'you', group: 'office', mode: 'rw-rw-r--', mtime });
  };
  const old = Date.UTC(2032, 2, 20, 18, 0, 0);
  for (const [rel, id] of Object.entries(OFFICE_FILES)) add(rel, rel === REPORT && n === 2 ? t('troupe-office-report-template') : t(id), rel === REPORT && n === 2 ? Date.UTC(2032, 3, 10, 16, 22, 0) + SKEW : old);
  if (n !== 1) for (const [rel, id] of Object.entries(NEW_FILES)) add(rel, t(id), Date.UTC(2032, 3, 8, 11, 0, 0) + SKEW);
  if (n === 1) for (const [rel, id] of Object.entries(REMOVED_FILES)) add(rel, t(id), old);
  return dir(Object.fromEntries(Object.entries(tree).map(([k, v]) => [k, dir(v, group)])), group);
}

function siteDir(t: Translate): Directory {
  const at = Date.UTC(2032, 1, 27, 20, 0, 0);
  const tree: Record<string, Node> = {};
  for (const [k, v] of Object.entries(siteFiles(t))) {
    const parts = k.split('/');
    let place = tree;
    for (const p of parts.slice(0, -1)) place = ((place[p] ??= d({}, undefined, you)) as Directory).children;
    place[parts.at(-1)!] = typeof v === 'number' ? f('', { size: v, charset: 'binary', mtime: at, ...you }) : f(v, { lines: true, mtime: at, ...you });
  }
  return d(tree, undefined, you);
}

export function wingsWorld(t: Translate, n: ChapterNo, o: WorldOptions): Directory {
  const host = machineName(t, 'wings');
  const deploy = n === 1 ? ADMIN : SITE_DEPLOY;
  return dir({
    etc: dir({
      ...accountsFiles(),
      hostname: file(host),
      hosts: file(`127.0.0.1\tlocalhost\n${IP}\twings.${DOMAIN} ${host}\n${VAULT_IP}\t${S3_HOST} ${WWW}\n\n::1\tlocalhost ip6-localhost ip6-loopback`),
      'garage.toml': file(GARAGE_TOML, { owner: 'root', mode: 'rw-------' }),
      rclone: dir({ 'office.conf': file(rcloneConf(n === 1 ? ADMIN : OFFICE_BACKUP, n === 2 ? 'us-east-1' : 'garage'), { owner: 'root', mode: 'rw-------' }) }, { owner: 'root', mode: 'rwx------' }),
      systemd: dir({
        'timesyncd.conf': file(TIMESYNCD),
        system: dir({ 'garage.service': file(GARAGE_SERVICE), 'office-backup.service': file(BACKUP_SERVICE), 'office-backup.timer': file(BACKUP_TIMER) }),
      }),
    }),
    home: dir({
      you: d(
        {
          ...o.home,
          '.aws': d({ credentials: f(credentials(deploy), { lines: true, ...you, mode: 'rw-------' }), config: f(AWS_CONFIG, { lines: true, ...you }) }, undefined, { ...you, mode: 'rwx------' }),
          bin: d({ 'deploy-site': f(DEPLOY_SCRIPT, { lines: true, ...you, mode: 'rwxr-xr-x' }) }, undefined, you),
          site: siteDir(t),
        },
        undefined,
        you,
      ),
    }),
    root: dir({}, { owner: 'root', mode: 'rwx------' }),
    tmp: dir({}, { owner: 'root', mode: 'rwxrwxrwt' }),
    srv: dir({ office: officeShare(t, n), garage: dir({ data: dir({}, { owner: 'root', mode: 'rwx------' }) }) }),
    usr: dir({ local: dir({ bin: dir({ garage: f('', { owner: 'root', mode: 'rwxr-xr-x', size: 38_912_104, charset: 'binary' }), 'office-backup': file(BACKUP_SCRIPT_TEXT, { owner: 'root', mode: 'rwxr-xr-x' }) }) }) }),
    var: dir({ lib: dir({ garage: dir({ meta: dir({}, { owner: 'root', mode: 'rwx------' }) }) }), log: dir({}) }),
  });
}

// ——— Starting a chapter ———

/** The nights the backup failed (chapter 2): the journal of office-backup.service. */
function failedNights(j: Game): Input[] {
  const sd = systemd(j)!;
  const out: Input[] = [];
  for (let night = 4; night <= 12; night++) {
    const real = Date.UTC(2032, 3, night, 2, 30, 0);
    const shown = real + SKEW;
    const stamp = new Date(shown).toISOString().slice(0, 19).replace('T', ' ').replace(/-/g, '/');
    const err = 'InvalidRequest: Bad request: Date is too old\n\tstatus code: 400, request id: , host id: ';
    const lines = [
      `${stamp} ERROR : S3 bucket backups path office: error reading destination root directory: ${err}`,
      ...[1, 2, 3].map((i) => `${stamp} ERROR : Attempt ${i}/3 failed with 1 errors and: ${err}`),
      `${stamp} Failed to sync: ${err}`,
    ];
    out.push({ time: real, boot: sd.boot, unit: 'office-backup.service', ident: 'systemd', pid: 1, message: 'Starting office-backup.service - Copy the office share to Garage...', priority: 6 });
    for (const l of lines) for (const part of l.split('\n')) out.push({ time: real + 1000, boot: sd.boot, unit: 'office-backup.service', ident: 'office-backup', pid: 5000 + night, message: part, priority: 6 });
    out.push(
      { time: real + 2000, boot: sd.boot, unit: 'office-backup.service', ident: 'systemd', pid: 1, message: 'office-backup.service: Main process exited, code=exited, status=1/FAILURE', priority: 4 },
      { time: real + 2000, boot: sd.boot, unit: 'office-backup.service', ident: 'systemd', pid: 1, message: "office-backup.service: Failed with result 'exit-code'.", priority: 4 },
      { time: real + 2000, boot: sd.boot, unit: 'office-backup.service', ident: 'systemd', pid: 1, message: 'Failed to start office-backup.service - Copy the office share to Garage.', priority: 3 },
    );
  }
  return out;
}

export interface Story {
  chapter: ChapterNo;
}

export function initialiseStory(j: Game, n: ChapterNo) {
  const p = j as Shell;
  p.state.troupe = { chapter: n } satisfies Story;
  const sd = systemd(p)!;
  loadUnits(p, sd);
  loadOverrides(p, sd);
  const backup = sd.services['office-backup'];
  const timer = sd.timers?.['office-backup'];
  // No [Install] section: started by its timer only.
  if (backup) backup.static = true;
  if (timer) Object.assign(timer, { active: true, state: 'active', last: Date.UTC(2032, 3, 12, 2, 30, 0) });
  if (n === 2 && backup) {
    Object.assign(backup, { state: 'failed', result: 'exit-code', since: Date.UTC(2032, 3, 12, 2, 30, 2) });
    sd.log.push(...failedNights(p).filter((e) => e.time <= sd.clock));
    sd.log.sort((a, b) => a.time - b.time);
  }
  // The journal and systemctl show the machine's own time.
  displayUpdate(p);
}

/** Each command: half a minute passes. */
export function passTime(j: Game) {
  systemd(j)!.clock += 30_000;
}

export { realNow };
