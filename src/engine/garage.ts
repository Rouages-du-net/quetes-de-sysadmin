// Garage, a small geo-distributed object store with an S3 API, written for
// self-hosting (https://garagehq.deuxfleurs.fr/): a cluster of nodes, each
// with a role in the layout (zone, capacity), the data replicated three
// times across zones; buckets (an ID and global aliases), access keys and
// their per-bucket permissions (read, write, owner); website access on a
// bucket (the web endpoint serves it to anyone, without a key); lifecycle
// rules (Expiration, AbortIncompleteMultipartUpload only).
//
//   state.garage = { region, webRoot, replication, nodes, layout, buckets, keys, log }
//
// The S3 API (`s3()`) checks a request as Garage does, in this order
// (src/api/common/signature/payload.rs and src/api/s3/api_server.rs, v2):
// anonymous requests refused ("Garage does not support anonymous access
// yet"); a request dated more than 24 hours before the server's clock
// ("Date is too old"; nothing is checked for a date in the future); the
// scope's region against s3_region (AuthorizationHeaderMalformed); the key
// ("No such key"), the signature ("Invalid signature"); the bucket
// ("Bucket not found"); the key's permission on it ("Operation is not
// allowed for this key."). Errors carry Garage's aws_code (AccessDenied,
// InvalidRequest, NoSuchBucket…) and its message (common_error.rs).
// Presigned URLs: X-Amz-Expires may not exceed a week (604800 s).
// Sources: https://garagehq.deuxfleurs.fr/documentation/reference-manual/s3-compatibility/,
// https://garagehq.deuxfleurs.fr/documentation/cookbook/exposing-websites/,
// https://garagehq.deuxfleurs.fr/documentation/operations/layout/,
// https://garagehq.deuxfleurs.fr/documentation/operations/recovering/.
// Differences: the signature is a digest of the secret and the request, not
// SigV4's HMAC chain; the data's placement is computed per zone, not per
// partition; a layout change's data transfer is immediate; no multipart
// uploads (a big object is stored whole, with a multipart-looking ETag).

import type { Game } from './shell';
import { systemd, toUtc } from './systemd';
import { machineTime } from './time';
import { md5, sha256, fileBytes } from './commands/checksums';

export const VERSION = 'v2.1.0';
export const WEEK = 604_800;

export interface S3Object {
  size: number;
  etag: string;
  // Real UTC time (ms).
  modified: number;
  // The text of a small object; undefined for a binary one (a video, a photo).
  content?: string;
  type: string;
}

export interface Website {
  index: string;
  error?: string;
}

export interface LifecycleRule {
  id: string;
  prefix: string;
  days?: number;
  abortDays?: number;
  enabled: boolean;
}

export interface Bucket {
  id: string;
  aliases: string[];
  created: number;
  website: Website | null;
  objects: Record<string, S3Object>;
  lifecycle?: LifecycleRule[];
}

export interface Permission {
  read: boolean;
  write: boolean;
  owner: boolean;
}

export interface AccessKey {
  id: string;
  name: string;
  secret: string;
  created: number;
  createBucket: boolean;
  // Bucket ID → permission.
  perms: Record<string, Permission>;
}

export interface GarageNode {
  id: string;
  hostname: string;
  address: string;
  up: boolean;
  // Real time it was last seen (failed nodes).
  lastSeen?: number;
  // What its disk has free (bytes) and its size.
  avail: number;
  disk: number;
}

export interface Role {
  zone: string;
  capacity: number;
  tags: string[];
}

export interface Layout {
  version: number;
  roles: Record<string, Role>;
  // Staged changes: a role, or null to remove the node's role.
  staged: Record<string, Role | null>;
}

export interface Request {
  at: number;
  key: string | null;
  op: string;
  bucket?: string;
  object?: string;
  status: number;
  code?: string;
  via?: 'presigned' | 'web';
}

export interface Garage {
  region: string;
  // The web endpoint's root domain (.web.kestrel.example): bucket.root_domain.
  webRoot: string;
  replication: number;
  nodes: Record<string, GarageNode>;
  layout: Layout;
  buckets: Bucket[];
  keys: AccessKey[];
  log: Request[];
  // To make new identifiers (keys, buckets) deterministic.
  counter: number;
}

export const garage = (j: Game): Garage | undefined => j.state.garage;

// ——— Identifiers and digests ———

export const hexOf = (seed: string, length: number) => {
  let out = '';
  for (let i = 0; out.length < length; i++) out += sha256(new TextEncoder().encode(`${seed}#${i}`));
  return out.slice(0, length);
};
export const etagOf = (text: string) => md5(fileBytes(text));
/** A big object's ETag: it was uploaded in parts (the md5 of the parts' md5s, then the number of parts). */
export const multipartEtag = (seed: string, size: number) => `${hexOf(`etag:${seed}`, 32)}-${Math.max(2, Math.ceil(size / (16 * 1024 * 1024)))}`;
export const newKeyId = (seed: string) => `GK${hexOf(`key:${seed}`, 24)}`;
export const newSecret = (seed: string) => hexOf(`secret:${seed}`, 64);
export const newBucketId = (seed: string) => hexOf(`bucket:${seed}`, 64);

/** A new object, from a text or a size (a binary file). */
export function object(content: string | null, modified: number, type = 'binary/octet-stream', size?: number, seed = ''): S3Object {
  if (content === null) return { size: size ?? 0, etag: multipartEtag(seed, size ?? 0), modified, type };
  return { size: size ?? fileBytes(content).length, etag: etagOf(content), modified, type, content };
}

export const MIME: Record<string, string> = {
  html: 'text/html', css: 'text/css', js: 'application/javascript', txt: 'text/plain', csv: 'text/csv', md: 'text/markdown',
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', mp4: 'video/mp4', pdf: 'application/pdf', json: 'application/json',
};
export const typeOf = (key: string) => MIME[key.split('.').pop()?.toLowerCase() ?? ''] ?? 'binary/octet-stream';

// ——— Looking things up ———

export const bucketByName = (g: Garage, name: string) => g.buckets.find((b) => b.aliases.includes(name) || (name.length >= 16 && /^[0-9a-f]+$/.test(name) && b.id.startsWith(name)));
export const bucketName = (b: Bucket) => b.aliases[0] ?? b.id.slice(0, 16);

/** A key by its name or by its ID (or a prefix of it): the matching keys. */
export function keysMatching(g: Garage, pattern: string): AccessKey[] {
  const exact = g.keys.filter((k) => k.id === pattern || k.name === pattern);
  if (exact.length) return exact;
  return g.keys.filter((k) => pattern.length >= 4 && k.id.startsWith(pattern));
}
export const keyById = (g: Garage, id: string) => g.keys.find((k) => k.id === id);
export const permOf = (k: AccessKey, b: Bucket): Permission => k.perms[b.id] ?? { read: false, write: false, owner: false };
export const anyPerm = (p: Permission) => p.read || p.write || p.owner;

export const bucketSize = (b: Bucket) => Object.values(b.objects).reduce((n, o) => n + o.size, 0);

/** The real time (UTC ms): systemd's clock, Paris time read as UTC. */
export const realNow = (j: Game) => toUtc(systemd(j)!.clock);
/** The machine's own clock, UTC (it may drift: time.ts). */
export const clientNow = (j: Game) => (j.state.clockTime ? machineTime(j).utc : realNow(j));
/** The machine's local time minus UTC (to show dates as its clients do). */
export const localShift = (j: Game) => (j.state.clockTime ? machineTime(j).wall - machineTime(j).utc : systemd(j)!.clock - realNow(j));

// ——— The cluster: who is up, is the data safe ———

export const roleNodes = (g: Garage) => Object.keys(g.layout.roles).filter((id) => g.layout.roles[id].capacity > 0);
export const zonesOf = (g: Garage, roles: Record<string, Role> = g.layout.roles) => new Set(Object.values(roles).filter((r) => r.capacity > 0).map((r) => r.zone));
/** How many copies of each piece of data are reachable now (the nodes with a role that are up, at most one copy per zone when zones allow). */
export function liveCopies(g: Garage): number {
  const ids = roleNodes(g);
  const copies = Math.min(g.replication, ids.length);
  return Math.max(0, copies - ids.filter((id) => !g.nodes[id]?.up).length);
}
/** Writes and reads need a quorum: 2 of 3 copies. */
export const quorum = (g: Garage) => liveCopies(g) >= Math.floor(g.replication / 2) + 1;

// ——— The S3 API ———

export interface Auth {
  keyId: string;
  secret: string;
  // The request's date, from the client's clock (UTC ms).
  date: number;
  region: string;
}

export interface S3Error {
  code: string;
  message: string;
  status: number;
}

export interface S3Request {
  op: string;
  bucket?: string;
  key?: string;
  auth: Auth | null;
  // The server's clock (the node that answers): real time, or the machine's for a local node.
  now: number;
  via?: 'presigned';
}

export type Need = 'read' | 'write' | 'owner' | 'none';
// Each operation's permission (Garage's endpoint.authorization_type()).
export const NEEDS: Record<string, Need> = {
  ListBuckets: 'none', CreateBucket: 'none',
  ListObjectsV2: 'read', ListObjects: 'read', HeadObject: 'read', GetObject: 'read', HeadBucket: 'read', GetBucketLocation: 'read', GetBucketVersioning: 'read',
  PutObject: 'write', CopyObject: 'write', DeleteObject: 'write', DeleteObjects: 'write',
  DeleteBucket: 'owner', GetBucketWebsite: 'owner', PutBucketWebsite: 'owner', DeleteBucketWebsite: 'owner',
  GetBucketLifecycleConfiguration: 'owner', PutBucketLifecycleConfiguration: 'owner', DeleteBucketLifecycle: 'owner',
};

export const scope = (date: number, region: string) => `${new Date(date).toISOString().slice(0, 10).replace(/-/g, '')}/${region}/s3/aws4_request`;

const fail = (code: string, message: string, status: number): { error: S3Error } => ({ error: { code, message, status } });
export const forbidden = (why: string) => fail('AccessDenied', `Forbidden: ${why}`, 403);
export const badRequest = (why: string) => fail('InvalidRequest', `Bad request: ${why}`, 400);

/**
 * Checks a request like Garage's API server; returns the bucket (and the
 * key) it may act on, or the error. Logged in g.log.
 */
export function authorize(j: Game, r: S3Request): { error: S3Error } | { bucket: Bucket | null; key: AccessKey } {
  const g = garage(j)!;
  const out = check(g, r);
  g.log.push({ at: realNow(j), key: r.auth?.keyId ?? null, op: r.op, bucket: r.bucket, object: r.key, status: 'error' in out ? out.error.status : 200, ...('error' in out ? { code: out.error.code } : {}), ...(r.via ? { via: r.via } : {}) });
  if (g.log.length > 500) g.log.splice(0, g.log.length - 500);
  return out;
}

function check(g: Garage, r: S3Request): { error: S3Error } | { bucket: Bucket | null; key: AccessKey } {
  if (!r.auth) return forbidden('Garage does not support anonymous access yet');
  if (r.now - r.auth.date > 24 * 3600_000) return badRequest('Date is too old');
  const expected = scope(r.auth.date, g.region);
  const unexpected = scope(r.auth.date, r.auth.region);
  if (expected !== unexpected) return fail('AuthorizationHeaderMalformed', `Authorization header malformed, unexpected scope: '${unexpected}', expected: '${expected}'`, 400);
  const key = keyById(g, r.auth.keyId);
  if (!key) return forbidden(`No such key: ${r.auth.keyId}`);
  if (key.secret !== r.auth.secret) return forbidden('Invalid signature');
  if (!quorum(g)) return fail('ServiceUnavailable', 'Internal error: Could not reach quorum of 2. 1 of 3 request succeeded, others returned errors', 503);
  const need = NEEDS[r.op] ?? 'read';
  if (!r.bucket) return { bucket: null, key };
  const bucket = bucketByName(g, r.bucket);
  if (r.op === 'CreateBucket') {
    if (bucket) return anyPerm(permOf(key, bucket)) ? fail('BucketAlreadyOwnedByYou', 'Bucket already owned by you', 409) : fail('BucketAlreadyExists', 'Bucket already exists', 409);
    if (!key.createBucket) return forbidden('Access key not allowed to create buckets');
    return { bucket: null, key };
  }
  if (!bucket) return fail('NoSuchBucket', `Bucket not found: ${r.bucket}`, 404);
  const p = permOf(key, bucket);
  const allowed = need === 'none' || (need === 'read' && p.read) || (need === 'write' && p.write) || (need === 'owner' && p.owner);
  if (!allowed) return forbidden('Operation is not allowed for this key.');
  return { bucket, key };
}

/** The buckets a key sees in ListBuckets: those it has any permission on. */
export const visibleBuckets = (g: Garage, k: AccessKey) => g.buckets.filter((b) => anyPerm(permOf(k, b)));

/** The objects under a prefix; with a delimiter, the common prefixes ("folders") apart. */
export function listObjects(b: Bucket, prefix: string, delimiter: string | null): { objects: [string, S3Object][]; prefixes: string[] } {
  const objects: [string, S3Object][] = [];
  const prefixes = new Set<string>();
  for (const k of Object.keys(b.objects).sort()) {
    if (!k.startsWith(prefix)) continue;
    const rest = k.slice(prefix.length);
    const cut = delimiter ? rest.indexOf(delimiter) : -1;
    if (delimiter && cut >= 0) prefixes.add(prefix + rest.slice(0, cut + delimiter.length));
    else objects.push([k, b.objects[k]]);
  }
  return { objects, prefixes: [...prefixes].sort() };
}

// ——— Presigned URLs ———

export const amzDate = (ms: number) => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
const fromAmzDate = (s: string) => {
  const m = /^(\d{4})(\d\d)(\d\d)T(\d\d)(\d\d)(\d\d)Z$/.exec(s);
  return m ? Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) : NaN;
};
const encodeKey = (k: string) => k.split('/').map(encodeURIComponent).join('/');
export const signature = (secret: string, canonical: string) => sha256(new TextEncoder().encode(`AWS4-HMAC-SHA256\n${secret}\n${canonical}`));

/** A presigned GET URL, path-style, as aws s3 presign writes it. */
export function presign(endpoint: string, bucket: string, key: string, a: Auth, expires: number): string {
  const credential = encodeURIComponent(`${a.keyId}/${scope(a.date, a.region)}`);
  const query = `X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=${credential}&X-Amz-Date=${amzDate(a.date)}&X-Amz-Expires=${expires}&X-Amz-SignedHeaders=host`;
  const path = `/${bucket}/${encodeKey(key)}`;
  return `${endpoint.replace(/\/$/, '')}${path}?${query}&X-Amz-Signature=${signature(a.secret, `GET\n${path}\n${query}`)}`;
}

export interface Presigned {
  bucket: string;
  key: string;
  keyId: string;
  date: number;
  region: string;
  expires: number;
  valid: boolean;
}

/** What a presigned URL's query says, and whether its signature matches the key's current secret. */
export function readPresigned(g: Garage, path: string, query: string): Presigned | null {
  const q = new URLSearchParams(query);
  const cred = q.get('X-Amz-Credential');
  if (!cred || q.get('X-Amz-Algorithm') !== 'AWS4-HMAC-SHA256') return null;
  const [keyId, , region] = cred.split('/');
  const parts = path.replace(/^\//, '').split('/');
  const bucket = parts.shift() ?? '';
  const key = parts.map(decodeURIComponent).join('/');
  const signed = query.replace(/&X-Amz-Signature=[^&]*/, '');
  const k = keyById(g, keyId);
  const valid = !!k && q.get('X-Amz-Signature') === signature(k.secret, `GET\n/${bucket}/${encodeKey(key)}\n${signed}`);
  return { bucket, key, keyId, date: fromAmzDate(q.get('X-Amz-Date') ?? ''), region: region ?? '', expires: Number(q.get('X-Amz-Expires') ?? '0'), valid };
}

/** A GET of a presigned URL, as Garage checks it (parse_presigned, then verify_v4). */
export function presignedGet(j: Game, path: string, query: string, now: number): { error: S3Error } | { bucket: Bucket; object: S3Object; key: string } {
  const g = garage(j)!;
  const p = readPresigned(g, path, query);
  const log = (status: number, code?: string) => g.log.push({ at: realNow(j), key: p?.keyId ?? null, op: 'GetObject', bucket: p?.bucket, object: p?.key, status, ...(code ? { code } : {}), via: 'presigned' });
  const done = (e: { error: S3Error }) => (log(e.error.status, e.error.code), e);
  if (!p) return done(forbidden('Garage does not support anonymous access yet'));
  if (!Number.isFinite(p.expires) || p.expires > WEEK) return done(badRequest('X-Amz-Expires may not exceed a week'));
  if (now - p.date > p.expires * 1000) return done(badRequest('Date is too old'));
  const expected = scope(p.date, g.region);
  if (scope(p.date, p.region) !== expected) return done(fail('AuthorizationHeaderMalformed', `Authorization header malformed, unexpected scope: '${scope(p.date, p.region)}', expected: '${expected}'`, 400));
  const k = keyById(g, p.keyId);
  if (!k) return done(forbidden(`No such key: ${p.keyId}`));
  if (!p.valid) return done(forbidden('Invalid signature'));
  const b = bucketByName(g, p.bucket);
  if (!b) return done(fail('NoSuchBucket', `Bucket not found: ${p.bucket}`, 404));
  if (!permOf(k, b).read) return done(forbidden('Operation is not allowed for this key.'));
  const o = b.objects[p.key];
  if (!o) return done(fail('NoSuchKey', 'Key not found', 404));
  log(200);
  return { bucket: b, object: o, key: p.key };
}

// ——— The web endpoint: website access, no key ———

export interface WebAnswer {
  status: number;
  type: string;
  body: string;
  object?: S3Object;
}

const xmlError = (code: string, message: string, resource: string) => `<?xml version="1.0" encoding="UTF-8"?><Error><Code>${code}</Code><Message>${message}</Message><Resource>${resource}</Resource><Region>garage</Region></Error>`;

/** What the web endpoint answers for this Host and path (anyone, without a key). */
export function webGet(j: Game, host: string, path: string): WebAnswer {
  const g = garage(j)!;
  const name = host.endsWith(g.webRoot) ? host.slice(0, -g.webRoot.length) : host;
  const b = g.buckets.find((x) => x.aliases.includes(name));
  const log = (status: number, object?: string) => g.log.push({ at: realNow(j), key: null, op: 'GetObject', bucket: name, object, status, via: 'web' });
  if (!b || !b.website) {
    log(404);
    return { status: 404, type: 'application/xml', body: xmlError('NoSuchBucket', `Bucket not found: ${name}`, path) };
  }
  let key = decodeURIComponent(path.replace(/^\//, '').replace(/\?.*$/, ''));
  if (key === '' || key.endsWith('/')) key += b.website.index;
  const o = b.objects[key];
  if (o) {
    log(200, key);
    return { status: 200, type: o.type, body: o.content ?? '', object: o };
  }
  log(404, key);
  const e = b.website.error ? b.objects[b.website.error] : undefined;
  if (e) return { status: 404, type: e.type, body: e.content ?? '', object: e };
  return { status: 404, type: 'application/xml', body: xmlError('NoSuchKey', 'Key not found', `/${key}`) };
}

// ——— Sizes, as Garage's CLI writes them ———

export function bytes(n: number, binary = false): string {
  const units = binary ? ['B', 'KiB', 'MiB', 'GiB', 'TiB'] : ['B', 'KB', 'MB', 'GB', 'TB'];
  const step = binary ? 1024 : 1000;
  let i = 0;
  let v = n;
  while (v >= step && i < units.length - 1) (v /= step), i++;
  return i === 0 ? `${n} B` : `${v.toFixed(1)} ${units[i]}`;
}

/** A capacity as `garage layout assign -c` reads it: 2T, 500G, 1.5TB, bytes. */
export function parseCapacity(s: string): number | null {
  const m = /^(\d+(?:\.\d+)?)\s*([KMGT]?)(i?B?)?$/i.exec(s.trim());
  if (!m) return null;
  const power = ' KMGT'.indexOf(m[2].toUpperCase() || ' ');
  const base = m[3]?.toLowerCase().startsWith('i') ? 1024 : 1000;
  return Math.round(Number(m[1]) * base ** Math.max(0, power));
}
