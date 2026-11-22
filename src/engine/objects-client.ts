// The tools of S3 object storage, loaded with the story that has a Garage
// cluster ("The Dance Troupe"): Garage's own CLI (status, layout, bucket,
// key, node id), the AWS CLI v2 (aws s3 ls/cp/mv/rm/sync/mb/rb/presign/
// website, aws s3api, aws configure), rclone (ls, lsl, lsd, cat, size,
// copy, copyto, sync, check, config, listremotes) and curl towards the
// cluster's endpoints (the S3 API, presigned URLs, the web endpoint). The
// model is garage.ts.
// After https://garagehq.deuxfleurs.fr/documentation/ (quick start, cookbook,
// operations: layout and recovering), https://awscli.amazonaws.com/v2/documentation/api/latest/reference/s3/index.html,
// https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-files.html,
// https://rclone.org/commands/ and https://rclone.org/s3/.
// Differences: Garage's CLI talks to the cluster without RPC; aws and rclone
// only reach the endpoints the story declares; rclone compares sizes and
// MD5s (not modification times); its retries print one summary per attempt.

import type { Shell } from './shell';
import type { Context } from './commands/index';
import { d, f, type File, type Node } from './world';
import { systemd } from './systemd';
import { nowOf } from './time';
import { fileBytes } from './commands/checksums';
import {
  VERSION, WEEK, anyPerm, authorize, bucketByName, bucketName, bucketSize, bytes, clientNow, etagOf, garage, keysMatching, listObjects, localShift, newBucketId, newKeyId, newSecret,
  object, parseCapacity, permOf, presign, presignedGet, realNow, roleNodes, typeOf, visibleBuckets, webGet, zonesOf,
  type AccessKey, type Auth, type Bucket, type Garage, type Role, type S3Error, type S3Object,
} from './garage';

// ——— INI files (~/.aws/credentials, ~/.aws/config, rclone.conf) ———

export type Ini = Record<string, Record<string, string>>;
export function readIni(text: string | null): Ini {
  const out: Ini = {};
  let section = '';
  for (const raw of (text ?? '').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || line.startsWith(';')) continue;
    const s = /^\[(.+)\]$/.exec(line);
    if (s) {
      section = s[1].trim();
      out[section] ??= {};
      continue;
    }
    const kv = /^([^=]+?)\s*=\s*(.*)$/.exec(line);
    if (kv && section) out[section][kv[1].trim()] = kv[2].trim();
  }
  return out;
}

/** Sets a value in an INI text, keeping the rest of the file. */
export function setIni(text: string, section: string, key: string, value: string): string {
  const lines = text ? text.split('\n') : [];
  let inside = false;
  let last = -1;
  for (let i = 0; i < lines.length; i++) {
    const s = /^\s*\[(.+)\]\s*$/.exec(lines[i]);
    if (s) {
      if (inside) break;
      inside = s[1].trim() === section;
      if (inside) last = i;
      continue;
    }
    if (!inside) continue;
    const kv = /^\s*([^=#;]+?)\s*=/.exec(lines[i]);
    if (kv && kv[1] === key) {
      lines[i] = `${key} = ${value}`;
      return lines.join('\n');
    }
    if (lines[i].trim()) last = i;
  }
  if (last < 0) return [...lines, ...(lines.length && lines.at(-1)!.trim() ? [''] : []), `[${section}]`, `${key} = ${value}`].join('\n');
  lines.splice(last + 1, 0, `${key} = ${value}`);
  return lines.join('\n');
}

// ——— The machine's files ———

const homeOf = (game: Shell) => game.environment?.HOME ?? (game.who === 'root' ? '/root' : game.home);
const env = (game: Shell, name: string): string | undefined => game.environment?.[name] || undefined;

/** Writes a file, creating the directories on the way (like aws and rclone do). */
function writeLocal(game: Shell, cmd: string, path: string, node: File): string | null {
  const abs = game.resolve(path);
  const parts = abs.split('/').filter(Boolean);
  for (let i = 1; i < parts.length; i++) {
    const p = '/' + parts.slice(0, i).join('/');
    const n = game.find(p);
    if (!n) {
      const e = game.place(cmd, p, d({}));
      if (e) return e;
    } else if (n.type !== 'directory') return `${p}: Not a directory`;
  }
  return game.place(cmd, abs, node);
}

const localFile = (content: string | undefined, size: number, mtime: number): File =>
  content === undefined ? f('', { size, charset: 'binary', mtime }) : f(content, { lines: true, mtime });

interface Item {
  size: number;
  etag: string;
  modified: number;
  content?: string;
}

/** The files under a local directory (relative paths), or the file itself. */
function localItems(game: Shell, abs: string): Map<string, Item> | null {
  const n = game.find(abs);
  if (!n) return null;
  const out = new Map<string, Item>();
  const shift = localShift(game);
  const item = (x: File): Item => {
    const binary = x.charset === 'binary' || x.size !== undefined;
    const text = binary ? undefined : (game.read(abs) ?? '');
    return { size: text === undefined ? game.size(x) : fileBytes(text).length, etag: '', modified: (x.mtime ?? nowOf(game)) - shift, content: text };
  };
  if (n.type === 'file') {
    const it = item(n);
    if (it.content !== undefined) it.etag = etagOf(it.content);
    out.set('', it);
    return out;
  }
  const walk = (dir: Node, rel: string) => {
    if (dir.type !== 'directory') return;
    for (const [name, c] of Object.entries(dir.children).sort(([a], [b]) => (a < b ? -1 : 1))) {
      const r = rel ? `${rel}/${name}` : name;
      if (c.type === 'directory') walk(c, r);
      else if (c.type === 'file') {
        const binary = c.charset === 'binary' || c.size !== undefined;
        const text = binary ? undefined : (game.read(`${abs}/${r}`) ?? '');
        out.set(r, { size: text === undefined ? game.size(c) : fileBytes(text).length, etag: text === undefined ? `size:${game.size(c)}` : etagOf(text), modified: (c.mtime ?? nowOf(game)) - shift, content: text });
      }
    }
  };
  walk(n, '');
  return out;
}

// ——— Where the cluster answers ———

export interface Endpoint {
  kind: 'api' | 'web';
  host: string;
  // The answering node's clock: the real time, or this machine's (its own node).
  local: boolean;
}

/** A URL's host, as this story's network knows it (the S3 gateway, the web endpoint, the local node). */
export function endpointOf(game: Shell, url: string): Endpoint | null {
  const g = garage(game);
  const m = /^(?:(https?):\/\/)?([^/:?#]+)(?::(\d+))?/.exec(url.trim());
  if (!g || !m) return null;
  const host = m[2].toLowerCase();
  const port = m[3] ?? (m[1] === 'https' ? '443' : m[1] === 'http' ? '80' : '');
  const names: string[] = game.state.s3net?.api ?? [];
  const webs: string[] = game.state.s3net?.web ?? [];
  const local = ['localhost', '127.0.0.1', '::1', game.hostName];
  if (local.includes(host) && port === '3900') return { kind: 'api', host, local: true };
  if (local.includes(host) && port === '3902') return { kind: 'web', host, local: true };
  if (names.includes(host)) return { kind: 'api', host, local: false };
  if (webs.includes(host) || host.endsWith(g.webRoot)) return { kind: 'web', host, local: false };
  return null;
}
const serverNow = (game: Shell, e: Endpoint) => (e.local ? clientNow(game) : realNow(game));

// ——— The AWS CLI v2 ———

const AWS_VERSION = 'aws-cli/2.23.6 Python/3.13.5 Linux/6.12.41+deb13-amd64 source/x86_64.debian.13';
const AWS_USAGE = `usage: aws [options] <command> <subcommand> [<subcommand> ...] [parameters]
To see help text, you can run:

  aws help
  aws <command> help
  aws <command> <subcommand> help`;

interface AwsCtx {
  game: Shell;
  profile: string;
  explicitProfile: boolean;
  auth: { keyId: string; secret: string; from: string } | null;
  region: string;
  regionFrom: string;
  endpoint: string | null;
  anonymous: boolean;
  insecure: boolean;
  output: string;
}

const awsFiles = (game: Shell) => {
  const home = homeOf(game);
  const cred = env(game, 'AWS_SHARED_CREDENTIALS_FILE') ?? `${home}/.aws/credentials`;
  const conf = env(game, 'AWS_CONFIG_FILE') ?? `${home}/.aws/config`;
  return { cred, conf, credText: game.read(cred), confText: game.read(conf) };
};

function awsContext(game: Shell, g: Record<string, string | boolean>): AwsCtx | string {
  const files = awsFiles(game);
  const creds = readIni(files.credText);
  const conf = readIni(files.confText);
  const explicit = typeof g.profile === 'string';
  const profile = (g.profile as string) ?? env(game, 'AWS_PROFILE') ?? 'default';
  const section = profile === 'default' ? (conf.default ?? {}) : (conf[`profile ${profile}`] ?? {});
  if (profile !== 'default' && !creds[profile] && !conf[`profile ${profile}`]) return `\nThe config profile (${profile}) could not be found`;
  let auth: AwsCtx['auth'] = null;
  const ek = env(game, 'AWS_ACCESS_KEY_ID');
  const es = env(game, 'AWS_SECRET_ACCESS_KEY');
  if (!explicit && ek && es) auth = { keyId: ek, secret: es, from: 'env' };
  else {
    const c = creds[profile] ?? {};
    const keyId = c.aws_access_key_id ?? section.aws_access_key_id;
    const secret = c.aws_secret_access_key ?? section.aws_secret_access_key;
    if (keyId && secret) auth = { keyId, secret, from: c.aws_access_key_id ? 'shared-credentials-file' : 'config-file' };
  }
  const region = (g.region as string) ?? env(game, 'AWS_REGION') ?? env(game, 'AWS_DEFAULT_REGION') ?? section.region;
  const regionFrom = g.region ? 'manual' : env(game, 'AWS_REGION') || env(game, 'AWS_DEFAULT_REGION') ? 'env' : section.region ? 'config-file' : '';
  return {
    game,
    profile,
    explicitProfile: explicit,
    auth,
    region: region ?? 'us-east-1',
    regionFrom,
    endpoint: (g['endpoint-url'] as string) ?? env(game, 'AWS_ENDPOINT_URL_S3') ?? env(game, 'AWS_ENDPOINT_URL') ?? section.endpoint_url ?? null,
    anonymous: !!g['no-sign-request'],
    insecure: !!g['no-verify-ssl'],
    output: (g.output as string) ?? section.output ?? 'json',
  };
}

class AwsFail {
  constructor(
    public text: string,
    public code: number,
  ) {}
}

const NO_CREDENTIALS = new AwsFail('Unable to locate credentials. You can configure credentials by running "aws configure".', 253);

/** Sends a request to the endpoint the context names; an S3 error, or what it may act on. */
function call(ctx: AwsCtx, op: string, bucket?: string, key?: string): { error: S3Error } | { bucket: Bucket | null; key: AccessKey } {
  const game = ctx.game;
  if (!ctx.anonymous && !ctx.auth) throw NO_CREDENTIALS;
  const host = bucket ? `${bucket}.s3.${ctx.region}.amazonaws.com` : `s3.${ctx.region}.amazonaws.com`;
  if (!ctx.endpoint) throw new AwsFail(`\nCould not connect to the endpoint URL: "https://${host}/${key ? encodeURI(key) : ''}"`, 255);
  const e = endpointOf(game, ctx.endpoint);
  if (!e || e.kind !== 'api') throw new AwsFail(`\nCould not connect to the endpoint URL: "${ctx.endpoint.replace(/\/$/, '')}/${bucket ?? ''}${key ? `/${encodeURI(key)}` : ''}"`, 255);
  const auth: Auth | null = ctx.anonymous ? null : { keyId: ctx.auth!.keyId, secret: ctx.auth!.secret, date: clientNow(game), region: ctx.region };
  return authorize(game, { op, bucket, key, auth, now: serverNow(game, e) });
}

const errorText = (op: string, e: S3Error) => `An error occurred (${e.code}) when calling the ${op} operation: ${e.message}`;
// HEAD answers have no body: botocore only knows the status.
const STATUS: Record<number, string> = { 400: 'Bad Request', 403: 'Forbidden', 404: 'Not Found', 409: 'Conflict', 503: 'Service Unavailable' };
const headText = (e: S3Error) => `An error occurred (${e.status}) when calling the HeadObject operation: ${STATUS[e.status] ?? 'Unknown'}`;

const S3URI = /^s3:\/\/([^/]+)\/?(.*)$/;
const pad = (n: number) => String(n).padStart(2, '0');
const stamp = (ms: number) => {
  const x = new Date(ms);
  return `${x.getUTCFullYear()}-${pad(x.getUTCMonth() + 1)}-${pad(x.getUTCDate())} ${pad(x.getUTCHours())}:${pad(x.getUTCMinutes())}:${pad(x.getUTCSeconds())}`;
};
const localStamp = (game: Shell, utc: number) => stamp(utc + localShift(game));
const human = (n: number) => {
  if (n < 1024) return `${n} Bytes`;
  const units = ['KiB', 'MiB', 'GiB', 'TiB'];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) (v /= 1024), i++;
  return `${v.toFixed(1)} ${units[i]}`;
};

// --exclude and --include, in order: the last one that matches decides (fnmatch, * crosses /).
function filtered(rel: string, filters: [string, string][]): boolean {
  let keep = true;
  for (const [kind, pattern] of filters) {
    const re = new RegExp(`^${pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.')}$`);
    if (re.test(rel)) keep = kind === 'include';
  }
  return keep;
}

interface Transfer {
  src: string;
  dst: string;
  verb: 'upload' | 'download' | 'copy' | 'move' | 'delete';
}

// Shown as aws writes a local path: relative ones as given (./ added for a bare name).
const shownLocal = (p: string) => (p.startsWith('/') || p.startsWith('./') || p.startsWith('../') || p.startsWith('~') ? p : `./${p}`);

function awsS3(ctx: AwsCtx, sub: string, args: string[], input: string | null): string {
  const game = ctx.game;
  const flags = new Set<string>();
  const values: Record<string, string> = {};
  const filters: [string, string][] = [];
  const paths: string[] = [];
  const VALUED = ['expires-in', 'content-type', 'index-document', 'error-document', 'storage-class', 'acl'];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--exclude' || a === '--include') filters.push([a.slice(2), args[++i] ?? '']);
    else if (a.startsWith('--') && VALUED.includes(a.slice(2))) values[a.slice(2)] = args[++i] ?? '';
    else if (a.startsWith('--')) flags.add(a.slice(2));
    else paths.push(a);
  }
  const KNOWN = ['recursive', 'dryrun', 'delete', 'human-readable', 'summarize', 'force', 'quiet', 'only-show-errors', 'size-only', 'exact-timestamps', 'no-progress'];
  const bad = [...flags].find((x) => !KNOWN.includes(x));
  if (bad) throw new AwsFail(`\n${AWS_USAGE}\n\nUnknown options: --${bad}`, 252);
  const dry = flags.has('dryrun') ? '(dryrun) ' : '';
  const lines: string[] = [];
  let failed = false;
  const report = (t: Transfer) => lines.push(`${dry}${t.verb}: ${t.src}${t.verb === 'delete' ? '' : ` to ${t.dst}`}`);
  const failure = (t: Transfer, op: string, e: S3Error) => {
    failed = true;
    game.error(`${t.verb} failed: ${t.src}${t.verb === 'delete' ? '' : ` to ${t.dst}`} ${errorText(op, e)}`);
  };
  const done = () => {
    if (failed) game.status = 1;
    return lines.join('\n');
  };

  if (sub === 'ls') {
    const target = paths[0];
    if (!target || target === 's3://') {
      const r = call(ctx, 'ListBuckets');
      if ('error' in r) throw new AwsFail(`\n${errorText('ListBuckets', r.error)}`, 254);
      return visibleBuckets(garage(game)!, r.key)
        .map((b) => `${localStamp(game, b.created)} ${bucketName(b)}`)
        .join('\n');
    }
    const m = S3URI.exec(target);
    if (!m) throw new AwsFail(`\n${AWS_USAGE}\n\naws: error: ls: s3 path must start with s3://`, 252);
    const r = call(ctx, 'ListObjectsV2', m[1]);
    if ('error' in r) throw new AwsFail(`\n${errorText('ListObjectsV2', r.error)}`, 254);
    const recursive = flags.has('recursive');
    const { objects, prefixes } = listObjects(r.bucket!, m[2], recursive ? null : '/');
    const base = recursive ? '' : m[2].slice(0, m[2].lastIndexOf('/') + 1);
    const size = (n: number) => (flags.has('human-readable') ? human(n) : String(n)).padStart(10);
    const out = [...prefixes.map((p) => `${' '.repeat(27)}PRE ${p.slice(base.length)}`), ...objects.map(([k, o]) => `${localStamp(game, o.modified)} ${size(o.size)} ${k.slice(base.length)}`)];
    if (flags.has('summarize')) out.push('', `Total Objects: ${objects.length}`, `   Total Size: ${flags.has('human-readable') ? human(objects.reduce((n, [, o]) => n + o.size, 0)) : objects.reduce((n, [, o]) => n + o.size, 0)}`);
    if (!objects.length && !prefixes.length) game.status = 1;
    return out.join('\n');
  }

  if (sub === 'mb' || sub === 'rb') {
    const m = S3URI.exec(paths[0] ?? '');
    if (!m) throw new AwsFail(`\n${AWS_USAGE}\n\naws: error: the following arguments are required: path`, 252);
    if (sub === 'mb') {
      const r = call(ctx, 'CreateBucket', m[1]);
      if ('error' in r) throw new AwsFail(`make_bucket failed: s3://${m[1]} ${errorText('CreateBucket', r.error)}`, 1);
      const g = garage(game)!;
      const b: Bucket = { id: newBucketId(`${m[1]}:${g.counter++}`), aliases: [m[1]], created: realNow(game), website: null, objects: {} };
      g.buckets.push(b);
      r.key.perms[b.id] = { read: true, write: true, owner: true };
      return `make_bucket: ${m[1]}`;
    }
    const r = call(ctx, 'DeleteBucket', m[1]);
    if ('error' in r) throw new AwsFail(`remove_bucket failed: s3://${m[1]} ${errorText('DeleteBucket', r.error)}`, 1);
    const b = r.bucket!;
    if (flags.has('force')) for (const k of Object.keys(b.objects)) lines.push(`delete: s3://${m[1]}/${k}`), delete b.objects[k];
    if (Object.keys(b.objects).length) throw new AwsFail(`remove_bucket failed: s3://${m[1]} An error occurred (BucketNotEmpty) when calling the DeleteBucket operation: Tried to delete a non-empty bucket`, 1);
    const g = garage(game)!;
    g.buckets = g.buckets.filter((x) => x !== b);
    for (const k of g.keys) delete k.perms[b.id];
    lines.push(`remove_bucket: ${m[1]}`);
    return lines.join('\n');
  }

  if (sub === 'presign') {
    const m = S3URI.exec(paths[0] ?? '');
    if (!m || !m[2]) throw new AwsFail(`\n${AWS_USAGE}\n\naws: error: the following arguments are required: path`, 252);
    if (!ctx.auth) throw NO_CREDENTIALS;
    const expires = values['expires-in'] === undefined ? 3600 : Number(values['expires-in']);
    if (!Number.isInteger(expires)) throw new AwsFail(`\nInvalid value for parameter expires-in: ${values['expires-in']}`, 252);
    const endpoint = ctx.endpoint ?? `https://s3.${ctx.region}.amazonaws.com`;
    return presign(endpoint, m[1], m[2], { keyId: ctx.auth.keyId, secret: ctx.auth.secret, date: clientNow(game), region: ctx.region }, expires);
  }

  if (sub === 'website') {
    const m = S3URI.exec(paths[0] ?? '');
    if (!m) throw new AwsFail(`\n${AWS_USAGE}\n\naws: error: the following arguments are required: paths`, 252);
    const r = call(ctx, 'PutBucketWebsite', m[1]);
    if ('error' in r) throw new AwsFail(`\n${errorText('PutBucketWebsite', r.error)}`, 254);
    r.bucket!.website = { index: values['index-document'] ?? 'index.html', ...(values['error-document'] ? { error: values['error-document'] } : {}) };
    return '';
  }

  if (sub === 'rm') {
    const m = S3URI.exec(paths[0] ?? '');
    if (!m) throw new AwsFail(`\n${AWS_USAGE}\n\naws: error: the following arguments are required: paths`, 252);
    const keys: string[] = [];
    if (flags.has('recursive')) {
      const r = call(ctx, 'ListObjectsV2', m[1]);
      if ('error' in r) throw new AwsFail(`fatal error: ${errorText('ListObjectsV2', r.error)}`, 1);
      const prefix = m[2] && !m[2].endsWith('/') ? `${m[2]}/` : m[2];
      for (const [k] of listObjects(r.bucket!, prefix, null).objects) if (filtered(k.slice(prefix.length), filters)) keys.push(k);
    } else keys.push(m[2]);
    for (const k of keys) {
      const t: Transfer = { src: `s3://${m[1]}/${k}`, dst: '', verb: 'delete' };
      const r = call(ctx, 'DeleteObject', m[1], k);
      if ('error' in r) failure(t, 'DeleteObject', r.error);
      else {
        if (!dry) delete r.bucket!.objects[k];
        report(t);
      }
    }
    return done();
  }

  if (sub === 'cp' || sub === 'mv' || sub === 'sync') {
    if (paths.length < 2) throw new AwsFail(`\n${AWS_USAGE}\n\naws: error: the following arguments are required: paths`, 252);
    const [src, dst] = paths;
    const sm = S3URI.exec(src);
    const dm = S3URI.exec(dst);
    if (!sm && !dm && sub !== 'sync') throw new AwsFail(`\n${AWS_USAGE}\n\naws: error: ${sub}: Error: Invalid argument type`, 252);
    if (!sm && !dm) throw new AwsFail(`\n${AWS_USAGE}\n\naws: error: sync: Error: Invalid argument type`, 252);
    const recursive = sub === 'sync' || flags.has('recursive');
    // The source's items.
    const items = new Map<string, Item>();
    if (sm) {
      if (recursive) {
        const r = call(ctx, 'ListObjectsV2', sm[1]);
        if ('error' in r) throw new AwsFail(`fatal error: ${errorText('ListObjectsV2', r.error)}`, 1);
        const prefix = sm[2] && !sm[2].endsWith('/') ? `${sm[2]}/` : sm[2];
        for (const [k, o] of listObjects(r.bucket!, prefix, null).objects) items.set(k.slice(prefix.length), { size: o.size, etag: o.etag, modified: o.modified, content: o.content });
      } else {
        const r = call(ctx, 'HeadObject', sm[1], sm[2]);
        if ('error' in r) throw new AwsFail(`fatal error: ${headText(r.error)}`, 1);
        const o = r.bucket!.objects[sm[2]];
        if (!o) throw new AwsFail(`fatal error: An error occurred (404) when calling the HeadObject operation: Key "${sm[2]}" does not exist`, 1);
        items.set('', { size: o.size, etag: o.etag, modified: o.modified, content: o.content });
      }
    } else if (src === '-') {
      const text = (input ?? '').replace(/\n$/, '');
      items.set('', { size: fileBytes(text).length, etag: etagOf(text), modified: realNow(game), content: text });
    } else {
      const abs = game.resolve(src);
      const local = localItems(game, abs);
      if (!local) throw new AwsFail(`\nThe user-provided path ${src} does not exist.`, 255);
      if (game.find(abs)?.type === 'directory' && !recursive) throw new AwsFail(`upload failed: ${src} to ${dst} [Errno 21] Is a directory: '${abs}'`, 1);
      for (const [k, v] of local) items.set(k, v);
    }
    // Where each item goes.
    const target = (rel: string): string => {
      if (dm) {
        let prefix = dm[2];
        if (recursive) return prefix && !prefix.endsWith('/') ? `${prefix}/${rel}` : prefix + rel;
        if (!prefix || prefix.endsWith('/')) prefix += (sm ? sm[2] : src).split('/').filter(Boolean).pop() ?? '';
        return prefix;
      }
      const abs = game.resolve(dst);
      if (recursive) return rel ? `${abs}/${rel}` : abs;
      const n = game.find(abs);
      return n?.type === 'directory' || dst.endsWith('/') ? `${abs}/${(sm ? sm[2] : src).split('/').pop()}` : abs;
    };
    const shownDst = (rel: string) => (dm ? `s3://${dm[1]}/${target(rel)}` : recursive ? `${shownLocal(dst).replace(/\/$/, '')}/${rel}` : shownLocal(dst === '.' || dst === './' || game.find(game.resolve(dst))?.type === 'directory' ? `${dst.replace(/\/$/, '')}/${(sm ? sm[2] : src).split('/').pop()}` : dst));
    const shownSrc = (rel: string) => (sm ? `s3://${sm[1]}/${recursive ? (sm[2] && !sm[2].endsWith('/') ? `${sm[2]}/` : sm[2]) + rel : sm[2]}` : recursive ? `${shownLocal(src).replace(/\/$/, '')}/${rel}` : shownLocal(src));
    // What is already at the destination (sync, and --delete).
    const there = new Map<string, Item>();
    if (sub === 'sync') {
      if (dm) {
        const r = call(ctx, 'ListObjectsV2', dm[1]);
        if ('error' in r) throw new AwsFail(`fatal error: ${errorText('ListObjectsV2', r.error)}`, 1);
        const prefix = dm[2] && !dm[2].endsWith('/') ? `${dm[2]}/` : dm[2];
        for (const [k, o] of listObjects(r.bucket!, prefix, null).objects) there.set(k.slice(prefix.length), { size: o.size, etag: o.etag, modified: o.modified, content: o.content });
      } else for (const [k, v] of localItems(game, game.resolve(dst)) ?? []) there.set(k, v);
    }
    const verb: Transfer['verb'] = sub === 'mv' ? 'move' : sm && dm ? 'copy' : sm ? 'download' : 'upload';
    for (const [rel, it] of items) {
      if (recursive && !filtered(rel, filters)) continue;
      if (sub === 'sync') {
        const old = there.get(rel);
        if (old && old.size === it.size && (flags.has('size-only') || it.modified <= old.modified)) continue;
      }
      const t: Transfer = { src: shownSrc(rel), dst: shownDst(rel), verb };
      const srcKey = sm ? (recursive ? (sm[2] && !sm[2].endsWith('/') ? `${sm[2]}/` : sm[2]) + rel : sm[2]) : '';
      if (dm) {
        const op = sm ? 'CopyObject' : 'PutObject';
        if (sm) {
          const r0 = call(ctx, 'GetObject', sm[1], srcKey);
          if ('error' in r0) {
            failure(t, op, r0.error);
            continue;
          }
        }
        const r = call(ctx, op, dm[1], target(rel));
        if ('error' in r) {
          failure(t, op, r.error);
          continue;
        }
        if (sm && sub === 'mv') {
          const r2 = call(ctx, 'DeleteObject', sm[1], srcKey);
          if ('error' in r2) {
            failure(t, 'DeleteObject', r2.error);
            continue;
          }
        }
        if (!dry) {
          const key = target(rel);
          r.bucket!.objects[key] = it.content === undefined ? { size: it.size, etag: sm ? it.etag : etagOf(`${key}:${it.size}`), modified: realNow(game), type: typeOf(key) } : { ...object(it.content, realNow(game), values['content-type'] ?? typeOf(key)) };
          if (sm && sub === 'mv') delete bucketByName(garage(game)!, sm[1])!.objects[srcKey];
        }
        report(t);
      } else {
        // Downloading.
        if (!sm) continue;
        if (dst === '-') {
          if (!dry) lines.push(it.content ?? '');
          continue;
        }
        const r = call(ctx, 'GetObject', sm[1], srcKey);
        if ('error' in r) {
          failure(t, 'GetObject', r.error);
          continue;
        }
        if (!dry) {
          const e = writeLocal(game, 'aws', target(rel), localFile(it.content, it.size, nowOf(game)));
          if (e) {
            failed = true;
            game.error(`download failed: ${t.src} to ${t.dst} [Errno 13] Permission denied: '${target(rel)}'`);
            continue;
          }
          if (sub === 'mv') {
            const r2 = call(ctx, 'DeleteObject', sm[1], srcKey);
            if (!('error' in r2)) delete r2.bucket!.objects[srcKey];
          }
        }
        report(t);
      }
      if (sub === 'mv' && !sm && !dry) game.erase(recursive ? `${game.resolve(src)}/${rel}` : game.resolve(src));
    }
    if (sub === 'sync' && flags.has('delete'))
      for (const [rel] of there) {
        if (items.has(rel) || !filtered(rel, filters)) continue;
        if (dm) {
          const key = target(rel);
          const t: Transfer = { src: `s3://${dm[1]}/${key}`, dst: '', verb: 'delete' };
          const r = call(ctx, 'DeleteObject', dm[1], key);
          if ('error' in r) failure(t, 'DeleteObject', r.error);
          else {
            if (!dry) delete r.bucket!.objects[key];
            report(t);
          }
        } else {
          report({ src: `${shownLocal(dst).replace(/\/$/, '')}/${rel}`, dst: '', verb: 'delete' });
          if (!dry) game.erase(`${game.resolve(dst)}/${rel}`);
        }
      }
    return done();
  }
  throw new AwsFail(`\n${AWS_USAGE}\n\naws: error: argument subcommand: Invalid choice, valid choices are:\n\nls                                       | website\ncp                                       | mv\nrm                                       | sync\nmb                                       | rb\npresign`, 252);
}

const json = (v: unknown) => JSON.stringify(v, null, 4);
const iso = (ms: number) => new Date(ms).toISOString().replace(/\.\d+Z$/, '+00:00');
const httpDate = (ms: number) => new Date(ms).toUTCString();

function awsS3api(ctx: AwsCtx, sub: string, args: string[]): string {
  const game = ctx.game;
  const o: Record<string, string> = {};
  const rest: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const name = args[i].slice(2);
      o[name] = args[i + 1] !== undefined && !args[i + 1].startsWith('--') ? args[++i] : 'true';
    } else rest.push(args[i]);
  }
  const need = (...names: string[]) => {
    const missing = names.filter((n) => o[n] === undefined);
    if (missing.length) throw new AwsFail(`\n${AWS_USAGE}\n\naws: error: the following arguments are required: ${missing.map((m) => `--${m}`).join(', ')}`, 252);
  };
  const run = (op: string, bucket?: string, key?: string) => {
    const r = call(ctx, op, bucket, key);
    if ('error' in r) throw new AwsFail(`\n${op === 'HeadObject' ? headText(r.error) : errorText(op, r.error)}`, 254);
    return r;
  };
  switch (sub) {
    case 'list-buckets': {
      const r = run('ListBuckets');
      return json({ Buckets: visibleBuckets(garage(game)!, r.key).map((b) => ({ Name: bucketName(b), CreationDate: iso(b.created) })), Owner: { DisplayName: r.key.name, ID: r.key.id } });
    }
    case 'list-objects-v2':
    case 'list-objects': {
      need('bucket');
      const r = run(sub === 'list-objects' ? 'ListObjects' : 'ListObjectsV2', o.bucket);
      const { objects, prefixes } = listObjects(r.bucket!, o.prefix ?? '', o.delimiter ?? null);
      const out: Record<string, unknown> = {};
      if (objects.length) out.Contents = objects.map(([k, x]) => ({ Key: k, LastModified: iso(x.modified), ETag: `"${x.etag}"`, Size: x.size, StorageClass: 'STANDARD' }));
      if (prefixes.length) out.CommonPrefixes = prefixes.map((p) => ({ Prefix: p }));
      if (!objects.length && !prefixes.length) out.RequestCharged = null;
      if (sub === 'list-objects-v2') out.KeyCount = objects.length + prefixes.length;
      return json(out);
    }
    case 'head-object': {
      need('bucket', 'key');
      const r = run('HeadObject', o.bucket, o.key);
      const x = r.bucket!.objects[o.key];
      if (!x) throw new AwsFail('\nAn error occurred (404) when calling the HeadObject operation: Not Found', 254);
      return json({ AcceptRanges: 'bytes', LastModified: httpDate(x.modified), ContentLength: x.size, ETag: `"${x.etag}"`, ContentType: x.type, Metadata: {} });
    }
    case 'get-object': {
      need('bucket', 'key');
      const r = run('GetObject', o.bucket, o.key);
      const x = r.bucket!.objects[o.key];
      if (!x) throw new AwsFail('\nAn error occurred (NoSuchKey) when calling the GetObject operation: Key not found', 254);
      const outfile = rest[0];
      if (!outfile) throw new AwsFail(`\n${AWS_USAGE}\n\naws: error: the following arguments are required: outfile`, 252);
      const e = writeLocal(game, 'aws', outfile, localFile(x.content, x.size, nowOf(game)));
      if (e) throw new AwsFail(`\n[Errno 13] Permission denied: '${outfile}'`, 255);
      return json({ AcceptRanges: 'bytes', LastModified: httpDate(x.modified), ContentLength: x.size, ETag: `"${x.etag}"`, ContentType: x.type, Metadata: {} });
    }
    case 'delete-object': {
      need('bucket', 'key');
      const r = run('DeleteObject', o.bucket, o.key);
      delete r.bucket!.objects[o.key];
      return '';
    }
    case 'get-bucket-versioning':
      need('bucket');
      run('GetBucketVersioning', o.bucket);
      return '';
    case 'get-bucket-website': {
      need('bucket');
      const r = run('GetBucketWebsite', o.bucket);
      const w = r.bucket!.website;
      if (!w) throw new AwsFail('\nAn error occurred (NoSuchWebsiteConfiguration) when calling the GetBucketWebsite operation: The specified bucket does not have a website configuration', 254);
      return json({ IndexDocument: { Suffix: w.index }, ...(w.error ? { ErrorDocument: { Key: w.error } } : {}) });
    }
    case 'delete-bucket-website':
      need('bucket');
      run('DeleteBucketWebsite', o.bucket).bucket!.website = null;
      return '';
    case 'put-bucket-lifecycle-configuration': {
      need('bucket', 'lifecycle-configuration');
      let text = o['lifecycle-configuration'];
      if (text.startsWith('file://')) {
        const t = game.read(game.resolve(text.slice(7)));
        if (t === null) throw new AwsFail(`\nError parsing parameter '--lifecycle-configuration': Unable to load paramfile ${text}: [Errno 2] No such file or directory: '${text.slice(7)}'`, 252);
        text = t;
      }
      let parsed: { Rules?: Record<string, unknown>[] };
      try {
        parsed = JSON.parse(text);
      } catch (e) {
        throw new AwsFail(`\nError parsing parameter '--lifecycle-configuration': Invalid JSON: ${(e as Error).message}\nJSON received: ${text}`, 252);
      }
      const r = run('PutBucketLifecycleConfiguration', o.bucket);
      const rules = (parsed.Rules ?? []).map((x, i) => {
        const unsupported = Object.keys(x).find((k) => !['ID', 'Status', 'Filter', 'Prefix', 'Expiration', 'AbortIncompleteMultipartUpload'].includes(k));
        if (unsupported) throw new AwsFail(`\nAn error occurred (NotImplemented) when calling the PutBucketLifecycleConfiguration operation: Unimplemented action: ${unsupported}`, 254);
        const filter = (x.Filter as { Prefix?: string } | undefined)?.Prefix ?? (x.Prefix as string | undefined) ?? '';
        return {
          id: (x.ID as string) ?? `rule-${i + 1}`,
          prefix: filter,
          enabled: x.Status === 'Enabled',
          days: (x.Expiration as { Days?: number } | undefined)?.Days,
          abortDays: (x.AbortIncompleteMultipartUpload as { DaysAfterInitiation?: number } | undefined)?.DaysAfterInitiation,
        };
      });
      r.bucket!.lifecycle = rules;
      return '';
    }
    case 'get-bucket-lifecycle-configuration': {
      need('bucket');
      const r = run('GetBucketLifecycleConfiguration', o.bucket);
      const rules = r.bucket!.lifecycle;
      if (!rules?.length) throw new AwsFail('\nAn error occurred (NoSuchLifecycleConfiguration) when calling the GetBucketLifecycleConfiguration operation: The lifecycle configuration does not exist', 254);
      return json({
        Rules: rules.map((x) => ({
          ID: x.id,
          Filter: { Prefix: x.prefix },
          Status: x.enabled ? 'Enabled' : 'Disabled',
          ...(x.days !== undefined ? { Expiration: { Days: x.days } } : {}),
          ...(x.abortDays !== undefined ? { AbortIncompleteMultipartUpload: { DaysAfterInitiation: x.abortDays } } : {}),
        })),
      });
    }
    case 'delete-bucket-lifecycle':
      need('bucket');
      delete run('DeleteBucketLifecycle', o.bucket).bucket!.lifecycle;
      return '';
  }
  throw new AwsFail(`\n${AWS_USAGE}\n\naws: error: argument operation: Invalid choice, valid choices are:\n\nlist-buckets                             | list-objects-v2\nhead-object                              | get-object\ndelete-object                            | get-bucket-website\ndelete-bucket-website                    | get-bucket-versioning\nput-bucket-lifecycle-configuration       | get-bucket-lifecycle-configuration\ndelete-bucket-lifecycle`, 252);
}

const mask = (v: string | undefined) => (v ? `****************${v.slice(-4)}` : '<not set>');

function awsConfigure(game: Shell, sub: string | undefined, args: string[], profileFlag: string | undefined): string {
  const files = awsFiles(game);
  const profile = profileFlag ?? env(game, 'AWS_PROFILE') ?? 'default';
  const confSection = profile === 'default' ? 'default' : `profile ${profile}`;
  const write = (path: string, text: string) => {
    const e = writeLocal(game, 'aws', path, f(text.replace(/^\n+/, ''), { lines: true, mode: 'rw-------', owner: game.who }));
    if (e) throw new AwsFail(`\n[Errno 13] Permission denied: '${path}'`, 255);
  };
  const set = (name: string, value: string) => {
    if (name === 'aws_access_key_id' || name === 'aws_secret_access_key') write(files.cred, setIni(game.read(files.cred) ?? '', profile, name, value));
    else write(files.conf, setIni(game.read(files.conf) ?? '', confSection, name, value));
  };
  if (sub === 'set') {
    const [name, value] = args;
    if (!name || value === undefined) throw new AwsFail(`\n${AWS_USAGE}\n\naws: error: the following arguments are required: varname, value`, 252);
    set(name.replace(/^default\./, ''), value);
    return '';
  }
  if (sub === 'get') {
    const [name] = args;
    const v = readIni(game.read(files.cred))[profile]?.[name] ?? readIni(game.read(files.conf))[confSection]?.[name];
    if (v === undefined) {
      game.status = 1;
      return '';
    }
    return v;
  }
  if (sub === 'list-profiles') return [...new Set([...Object.keys(readIni(game.read(files.cred))), ...Object.keys(readIni(game.read(files.conf))).map((s) => s.replace(/^profile /, ''))])].join('\n');
  if (sub === 'list') {
    const g: Record<string, string> = profileFlag ? { profile: profileFlag } : {};
    const c = awsContext(game, g);
    if (typeof c === 'string') throw new AwsFail(c, 255);
    const row = (a: string, b: string, cc: string, dd: string) => `${a.padStart(10)} ${b.padStart(24)} ${cc.padStart(16)}    ${dd}`;
    const where = c.auth?.from === 'env' ? 'env' : c.auth?.from ?? 'None';
    return [
      row('Name', 'Value', 'Type', 'Location'),
      row('----', '-----', '----', '--------'),
      row('profile', profileFlag ?? env(game, 'AWS_PROFILE') ?? '<not set>', profileFlag ? 'manual' : env(game, 'AWS_PROFILE') ? 'env' : 'None', profileFlag ? '--profile' : env(game, 'AWS_PROFILE') ? 'AWS_PROFILE' : 'None'),
      row('access_key', mask(c.auth?.keyId), where, where === 'shared-credentials-file' ? '' : ''),
      row('secret_key', mask(c.auth?.secret), where, ''),
      row('region', c.regionFrom ? c.region : '<not set>', c.regionFrom || 'None', c.regionFrom === 'config-file' ? files.conf.replace(homeOf(game), '~') : c.regionFrom === 'env' ? 'AWS_DEFAULT_REGION' : 'None'),
    ].join('\n');
  }
  if (sub) throw new AwsFail(`\n${AWS_USAGE}\n\naws: error: argument operation: Invalid choice, valid choices are:\n\nlist                                     | get\nset                                      | list-profiles`, 252);
  // Interactive: four questions, the current values masked.
  const creds = readIni(game.read(files.cred))[profile] ?? {};
  const conf = readIni(game.read(files.conf))[confSection] ?? {};
  const shown = (v: string | undefined, secret: boolean) => (v ? (secret ? mask(v) : v) : 'None');
  const steps: [string, string, string | undefined, boolean][] = [
    ['AWS Access Key ID', 'aws_access_key_id', creds.aws_access_key_id, true],
    ['AWS Secret Access Key', 'aws_secret_access_key', creds.aws_secret_access_key, true],
    ['Default region name', 'region', conf.region, false],
    ['Default output format', 'output', conf.output, false],
  ];
  const ask = (i: number): void => {
    if (i >= steps.length) return;
    const [label, name, value, secret] = steps[i];
    game.ask(`${label} [${shown(value, secret)}]: `, (answer) => {
      if (answer.trim()) {
        try {
          set(name, answer.trim());
        } catch (e) {
          if (e instanceof AwsFail) return game.error(e.text.trim(), e.code);
          throw e;
        }
      }
      ask(i + 1);
      return '';
    });
  };
  ask(0);
  return '';
}

export function aws(c: Context): string {
  const game = c.game;
  const g: Record<string, string | boolean> = {};
  const rest: string[] = [];
  const GLOBAL_VALUED = ['profile', 'region', 'endpoint-url', 'output', 'query', 'cli-read-timeout', 'cli-connect-timeout', 'ca-bundle'];
  const GLOBAL_FLAGS = ['no-sign-request', 'no-verify-ssl', 'debug', 'no-paginate', 'no-cli-pager', 'version'];
  for (let i = 0; i < c.args.length; i++) {
    const a = c.args[i];
    const name = a.startsWith('--') ? a.slice(2).split('=')[0] : '';
    if (GLOBAL_VALUED.includes(name)) g[name] = a.includes('=') ? a.slice(a.indexOf('=') + 1) : (c.args[++i] ?? '');
    else if (GLOBAL_FLAGS.includes(name)) g[name] = true;
    else rest.push(a);
  }
  if (g.version) return AWS_VERSION;
  const [service, sub, ...args] = rest;
  try {
    if (!service) throw new AwsFail(`\n${AWS_USAGE}\n\naws: error: the following arguments are required: command`, 252);
    if (service === 'help' || sub === 'help') return `${AWS_USAGE}\n\n(man aws: the commands the game knows.)`;
    if (service === 'configure') return awsConfigure(game, sub, args, g.profile as string | undefined);
    if (service !== 's3' && service !== 's3api') throw new AwsFail(`\n${AWS_USAGE}\n\naws: error: argument command: Invalid choice, valid choices are:\n\nconfigure                                | s3\ns3api`, 252);
    if (!sub) throw new AwsFail(`\n${AWS_USAGE}\n\naws: error: the following arguments are required: subcommand`, 252);
    const ctx = awsContext(game, g);
    if (typeof ctx === 'string') throw new AwsFail(ctx, 255);
    let warn = '';
    if (ctx.insecure && ctx.endpoint?.startsWith('https'))
      warn = `urllib3/connectionpool.py:1097: InsecureRequestWarning: Unverified HTTPS request is being made to host '${endpointOf(game, ctx.endpoint)?.host ?? ctx.endpoint}'. Adding certificate verification is strongly advised. See: https://urllib3.readthedocs.io/en/latest/advanced-usage.html#tls-warnings`;
    if (warn && sub !== 'presign') game.error(warn);
    return service === 's3' ? awsS3(ctx, sub, args, c.input) : awsS3api(ctx, sub, args);
  } catch (e) {
    if (e instanceof AwsFail) return game.error(e.text.replace(/^\n/, '\n'), e.code);
    throw e;
  }
}

// ——— rclone (Debian 13's v1.60, AWS SDK v1's error format) ———

const RCLONE_VERSION = `rclone v1.60.1-DEV
- os/version: debian 13.0 (64 bit)
- os/kernel: 6.12.41+deb13-amd64 (x86_64)
- os/type: linux
- os/arch: amd64
- go/version: go1.24.4
- go/linking: dynamic
- go/tags: none`;

const RCLONE_USAGE = `Rclone syncs files to and from cloud storage providers as well as
mounting them, listing them in lots of different ways.

Usage:
  rclone [flags]
  rclone [command]

Available Commands:
  cat         Concatenates any files and sends them to stdout.
  check       Checks the files in the source and destination match.
  config      Enter an interactive configuration session.
  copy        Copy files from source to dest, skipping identical files.
  copyto      Copy files from source to dest, skipping identical files.
  listremotes List all the remotes in the config file.
  ls          List the objects in the path with size and path.
  lsd         List all directories/containers/buckets in the path.
  lsl         List the objects in path with modification time, size and path.
  size        Prints the total size and number of objects in remote:path.
  sync        Make source and dest identical, modifying destination only.
  version     Show the version number.

Use "rclone [command] --help" for more information about a command.`;

interface Fs {
  kind: 'local' | 's3';
  spec: string;
  describe: string;
  // local: the absolute path; s3: bucket and prefix.
  path: string;
  bucket?: string;
  prefix?: string;
  remote?: string;
  conf?: Record<string, string>;
}

class RcloneFail {
  constructor(public text: string) {}
}

const rcloneTime = (game: Shell) => stamp(nowOf(game)).replace(/-/g, '/');

function openFs(game: Shell, spec: string, conf: Ini): Fs {
  const m = /^([\w.-]+):(.*)$/.exec(spec);
  if (!m || spec.startsWith('/')) {
    const abs = game.resolve(spec);
    return { kind: 'local', spec, describe: `Local file system at ${abs}`, path: abs };
  }
  const section = conf[m[1]];
  if (!section) throw new RcloneFail(`Failed to create file system for "${spec}": didn't find section in config file`);
  if (section.type !== 's3') throw new RcloneFail(`Failed to create file system for "${spec}": the game only knows rclone's s3 backend`);
  const [bucket, ...rest] = m[2].replace(/^\/+|\/+$/g, '').split('/');
  const prefix = rest.join('/');
  return {
    kind: 's3', spec, remote: m[1], conf: section, path: m[2], bucket, prefix,
    describe: bucket ? `S3 bucket ${bucket}${prefix ? ` path ${prefix}` : ''}` : `S3 root`,
  };
}

const sdkError = (e: S3Error) => `${e.code}: ${e.message}\n\tstatus code: ${e.status}, request id: , host id: `;

function s3Call(game: Shell, fs: Fs, op: string, key?: string): { error: string; s3?: S3Error } | { bucket: Bucket | null; key: AccessKey } {
  const c = fs.conf!;
  const region = c.region || 'us-east-1';
  const endpoint = c.endpoint || `https://s3.${region}.amazonaws.com`;
  const e = endpointOf(game, endpoint);
  if (!e || e.kind !== 'api') {
    const host = endpoint.replace(/^https?:\/\//, '').replace(/[/:].*$/, '');
    return { error: `RequestError: send request failed\ncaused by: Get "${endpoint.replace(/\/$/, '')}/${fs.bucket ?? ''}": dial tcp: lookup ${host}: no such host` };
  }
  if (!c.access_key_id || !c.secret_access_key) return { error: 'NoCredentialProviders: no valid providers in chain. Deprecated.\n\tFor verbose messaging see aws.Config.CredentialsChainVerboseErrors' };
  const r = authorize(game, { op, bucket: fs.bucket, key, auth: { keyId: c.access_key_id, secret: c.secret_access_key, date: clientNow(game), region }, now: serverNow(game, e) });
  return 'error' in r ? { error: sdkError(r.error), s3: r.error } : r;
}

/** The items of an Fs (relative paths); an error (the listing failed) or null (it doesn't exist). */
function listFs(game: Shell, fs: Fs): Map<string, Item> | { error: string } | null {
  if (fs.kind === 'local') {
    const n = game.find(fs.path);
    if (n && !game.can(n, 'r')) return { error: `failed to open directory "${fs.path}": open ${fs.path}: permission denied` };
    return localItems(game, fs.path);
  }
  const r = s3Call(game, fs, 'ListObjectsV2');
  if ('error' in r) return { error: r.error };
  const prefix = fs.prefix ? `${fs.prefix}/` : '';
  const out = new Map<string, Item>();
  for (const [k, o] of listObjects(r.bucket!, prefix, null).objects) out.set(k.slice(prefix.length), { size: o.size, etag: o.etag, modified: o.modified, content: o.content });
  return out;
}

function putFs(game: Shell, fs: Fs, rel: string, it: Item): string | null {
  if (fs.kind === 'local') {
    const e = writeLocal(game, 'rclone', rel ? `${fs.path}/${rel}` : fs.path, localFile(it.content, it.size, nowOf(game)));
    return e ? `open ${fs.path}/${rel}: permission denied` : null;
  }
  const key = fs.prefix ? `${fs.prefix}/${rel}` : rel;
  const r = s3Call(game, fs, 'PutObject', key);
  if ('error' in r) return r.error;
  r.bucket!.objects[key] = it.content === undefined ? { size: it.size, etag: it.etag.startsWith('size:') ? etagOf(`${key}:${it.size}`) : it.etag, modified: realNow(game), type: typeOf(key) } : object(it.content, realNow(game), typeOf(key));
  return null;
}

function deleteFs(game: Shell, fs: Fs, rel: string): string | null {
  if (fs.kind === 'local') {
    game.erase(`${fs.path}/${rel}`);
    return null;
  }
  const key = fs.prefix ? `${fs.prefix}/${rel}` : rel;
  const r = s3Call(game, fs, 'DeleteObject', key);
  if ('error' in r) return r.error;
  delete r.bucket!.objects[key];
  return null;
}

const shortSize = (n: number) => (n < 1024 ? `${n}` : n < 1024 ** 2 ? `${(n / 1024).toFixed(3)}Ki` : n < 1024 ** 3 ? `${(n / 1024 ** 2).toFixed(3)}Mi` : `${(n / 1024 ** 3).toFixed(3)}Gi`);
const statSize = (n: number) => (n < 1024 ? `${n} B` : n < 1024 ** 2 ? `${(n / 1024).toFixed(3)} KiB` : n < 1024 ** 3 ? `${(n / 1024 ** 2).toFixed(3)} MiB` : `${(n / 1024 ** 3).toFixed(3)} GiB`);

export interface RcloneRun {
  command: string;
  src: string;
  dst: string;
  dry: boolean;
  backupDir?: string;
  ok: boolean;
  at: number;
  differences?: number;
  insecure: boolean;
}

export function rclone(c: Context): string {
  const game = c.game;
  const flags = new Set<string>();
  const values: Record<string, string> = {};
  const pos: string[] = [];
  const VALUED = ['config', 'backup-dir', 'suffix', 'max-delete', 'transfers', 'log-file', 'bwlimit', 'exclude', 'include'];
  const SHORT: Record<string, string> = { n: 'dry-run', v: 'verbose', P: 'progress', q: 'quiet', h: 'help' };
  for (let i = 0; i < c.args.length; i++) {
    const a = c.args[i];
    if (a.startsWith('--')) {
      const [name, inline] = a.slice(2).split(/=(.*)/s);
      if (VALUED.includes(name)) values[name] = inline ?? c.args[++i] ?? '';
      else flags.add(name);
    } else if (/^-[nvPqh]+$/.test(a)) {
      for (const ch of a.slice(1)) flags.add(SHORT[ch]);
      if (a === '-vv') flags.add('debug');
    } else pos.push(a);
  }
  if (flags.has('version')) return RCLONE_VERSION;
  const KNOWN = ['dry-run', 'verbose', 'progress', 'quiet', 'help', 'no-check-certificate', 'checksum', 'size-only', 'one-way', 'debug', 'stats-one-line', 'delete-after', 'delete-before', 'delete-during', 'create-empty-src-dirs', 's3-no-check-bucket'];
  const unknown = [...flags].find((x) => !KNOWN.includes(x));
  if (unknown) return game.error(`Error: unknown flag: --${unknown}\nUsage:\n  rclone [flags]\n  rclone [command]\n\nUse "rclone [command] --help" for more information about a command.\nUse "rclone help flags" for to see the global flags.\nUse "rclone help backends" for a list of supported services.`, 1);
  const [cmd, ...args] = pos;
  const configPath = values.config ?? env(game, 'RCLONE_CONFIG') ?? `${homeOf(game)}/.config/rclone/rclone.conf`;
  const t = rcloneTime(game);
  const log = (level: string, text: string) => `${t} ${level.padEnd(6)}: ${text}`;
  const notices: string[] = [];
  const configText = game.read(game.resolve(configPath));
  const configNode = game.find(game.resolve(configPath));
  if (configNode && !game.can(configNode, 'r')) return game.error(log('CRITICAL', `Failed to load config file "${configPath}": open ${configPath}: permission denied`), 1);
  if (configText === null && cmd && !['version', 'help'].includes(cmd)) notices.push(log('NOTICE', `Config file "${configPath}" not found - using defaults`));
  const conf = readIni(configText);
  const say = (lines: string[], code = 0) => {
    for (const l of [...notices, ...lines]) game.error(l);
    game.status = code;
  };
  const RUNS: RcloneRun[] = (game.state.rcloneRuns ??= []);
  const insecure = flags.has('no-check-certificate') || Object.values(conf).some((s) => s.no_check_certificate === 'true');
  if (!cmd || cmd === 'help') return RCLONE_USAGE;
  try {
    switch (cmd) {
      case 'version':
        return RCLONE_VERSION;
      case 'listremotes':
        say([]);
        return Object.keys(conf).map((k) => `${k}:`).join('\n');
      case 'config': {
        const [sub, name] = args;
        if (sub === 'file') return `Configuration file is stored at:\n${game.resolve(configPath)}`;
        if (sub === 'show' || sub === 'dump' || !sub) {
          if (configText === null) {
            say([]);
            return sub === 'dump' ? '{}' : '';
          }
          const sections = name ? [name.replace(/:$/, '')] : Object.keys(conf);
          if (name && !conf[name.replace(/:$/, '')]) throw new RcloneFail(`Failed to config: couldn't find remote "${name.replace(/:$/, '')}"`);
          if (sub === 'dump') return json(Object.fromEntries(sections.map((s) => [s, conf[s]])));
          return sections.map((s) => `[${s}]\n${Object.entries(conf[s]).map(([k, v]) => `${k} = ${v}`).join('\n')}\n`).join('\n');
        }
        throw new RcloneFail(`Error: unknown command "${sub}" for "rclone config"`);
      }
      case 'ls':
      case 'lsl':
      case 'size':
      case 'cat': {
        if (!args[0]) throw new RcloneFail(`Command ${cmd} needs 1 arguments minimum: you provided 0 non flag arguments: []`);
        const fs = openFs(game, args[0], conf);
        if (fs.kind === 's3' && !fs.bucket) {
          const r = s3Call(game, fs, 'ListBuckets');
          if ('error' in r) throw new RcloneFail(`Failed to ${cmd}: ${r.error}`);
          const all = visibleBuckets(garage(game)!, r.key).flatMap((b) => Object.entries(b.objects).map(([k, o]) => [`${bucketName(b)}/${k}`, o] as const));
          if (cmd === 'size') return `Total objects: ${all.length} (${all.length})\nTotal size: ${statSize(all.reduce((n, [, o]) => n + o.size, 0))} (${all.reduce((n, [, o]) => n + o.size, 0)} Byte)`;
          return all.map(([k, o]) => `${String(o.size).padStart(9)} ${k}`).join('\n');
        }
        const items = listFs(game, fs);
        if (items && 'error' in items) throw new RcloneFail(`Failed to ${cmd}: ${items.error}`);
        if (!items) throw new RcloneFail(`Failed to ${cmd}: directory not found`);
        say([]);
        if (cmd === 'cat') return [...items.values()].map((x) => x.content ?? '').join('\n');
        if (cmd === 'size') {
          const total = [...items.values()].reduce((n, x) => n + x.size, 0);
          return `Total objects: ${items.size} (${items.size})\nTotal size: ${statSize(total)} (${total} Byte)`;
        }
        return [...items].map(([k, x]) => (cmd === 'lsl' ? `${String(x.size).padStart(9)} ${stamp(x.modified + localShift(game))}.000000000 ${k}` : `${String(x.size).padStart(9)} ${k}`)).join('\n');
      }
      case 'lsd': {
        if (!args[0]) throw new RcloneFail('Command lsd needs 1 arguments minimum: you provided 0 non flag arguments: []');
        const fs = openFs(game, args[0], conf);
        if (fs.kind !== 's3') return '';
        if (!fs.bucket) {
          const r = s3Call(game, fs, 'ListBuckets');
          if ('error' in r) throw new RcloneFail(`Failed to lsd: ${r.error}`);
          say([]);
          return visibleBuckets(garage(game)!, r.key)
            .map((b) => `${'-1'.padStart(12)} ${stamp(b.created + localShift(game))}        -1 ${bucketName(b)}`)
            .join('\n');
        }
        const r = s3Call(game, fs, 'ListObjectsV2');
        if ('error' in r) throw new RcloneFail(`Failed to lsd: ${r.error}`);
        say([]);
        return listObjects(r.bucket!, fs.prefix ? `${fs.prefix}/` : '', '/')
          .prefixes.map((p) => `${'0'.padStart(12)} 2000-01-01 00:00:00        -1 ${p.replace(/\/$/, '').split('/').pop()}`)
          .join('\n');
      }
      case 'mkdir':
        return '';
      case 'copy':
      case 'sync':
      case 'copyto':
      case 'check':
        return transfer(game, cmd, args, conf, flags, values, notices, RUNS, insecure);
    }
    return game.error(`Error: unknown command "${cmd}" for "rclone"\nRun 'rclone --help' for usage.`, 1);
  } catch (e) {
    if (e instanceof RcloneFail) {
      say([log('CRITICAL', e.text)], 1);
      return '';
    }
    throw e;
  }
}

function transfer(game: Shell, cmd: string, args: string[], conf: Ini, flags: Set<string>, values: Record<string, string>, notices: string[], runs: RcloneRun[], insecure: boolean): string {
  const t = rcloneTime(game);
  const log = (level: string, text: string) => `${t} ${level.padEnd(6)}: ${text}`;
  const lines: string[] = [...notices];
  const finish = (code: number) => {
    for (const l of lines) game.error(l);
    game.status = code;
    return '';
  };
  if (args.length < 2) throw new RcloneFail(`Command ${cmd} needs 2 arguments minimum: you provided ${args.length} non flag arguments: ${JSON.stringify(args)}`);
  const dry = flags.has('dry-run');
  const verbose = flags.has('verbose') || flags.has('debug');
  let src = openFs(game, args[0], conf);
  let dst = openFs(game, args[1], conf);
  const run: RcloneRun = { command: cmd, src: args[0], dst: args[1], dry, ok: false, at: realNow(game), insecure };
  runs.push(run);
  // copyto: one file to one name.
  let single: [string, string] | null = null;
  if (cmd === 'copyto') {
    const a = src.kind === 'local' ? src.path.split('/') : (src.prefix ?? '').split('/');
    const b = dst.kind === 'local' ? dst.path.split('/') : (dst.prefix ?? '').split('/');
    single = [a.pop() ?? '', b.pop() ?? ''];
    src = src.kind === 'local' ? { ...src, path: a.join('/') || '/' } : { ...src, prefix: a.join('/') };
    dst = dst.kind === 'local' ? { ...dst, path: b.join('/') || '/' } : { ...dst, prefix: b.join('/') };
  }
  // --backup-dir: on the destination's remote, not overlapping it.
  let backup: Fs | null = null;
  if (values['backup-dir'] !== undefined) {
    backup = openFs(game, values['backup-dir'], conf);
    if (cmd === 'check') backup = null;
    else if (backup.kind !== dst.kind || backup.remote !== dst.remote || backup.bucket !== dst.bucket) throw new RcloneFail("Failed to sync: can't use --backup-dir on a remote which doesn't support server-side move or copy");
    else {
      const a = backup.kind === 'local' ? backup.path : `${backup.prefix}/`;
      const b = dst.kind === 'local' ? dst.path : `${dst.prefix}/`;
      if (a.startsWith(b) || b.startsWith(a)) throw new RcloneFail(`Fatal error: destination and parameter to --backup-dir mustn't overlap`);
      run.backupDir = values['backup-dir'];
    }
  }
  const suffix = values.suffix ?? '';
  const srcItems = listFs(game, src);
  if (srcItems === null) throw new RcloneFail(`Failed to ${cmd}: directory not found`);
  if ('error' in srcItems) {
    lines.push(log('ERROR', `${src.describe}: error reading source root directory: ${srcItems.error}`));
    for (let i = 1; i <= 3; i++) lines.push(log('ERROR', `Attempt ${i}/3 failed with 1 errors and: ${srcItems.error}`));
    lines.push(`${t} Failed to ${cmd}: ${srcItems.error}`);
    return finish(1);
  }
  let dstItems = listFs(game, dst);
  if (dstItems && 'error' in dstItems) {
    const e = dstItems.error;
    if (cmd === 'check') {
      lines.push(log('ERROR', `${dst.describe}: error reading destination root directory: ${e}`), `${t} Failed to check: ${e}`);
      return finish(1);
    }
    lines.push(log('ERROR', `${dst.describe}: error reading destination root directory: ${e}`));
    for (let i = 1; i <= 3; i++) lines.push(log('ERROR', `Attempt ${i}/3 failed with 1 errors and: ${e}`));
    lines.push(`${t} Failed to ${cmd}: ${e}`);
    return finish(1);
  }
  dstItems ??= new Map();
  const one = single ? srcItems.get(single[0]) : undefined;
  const from: Map<string, Item> = single ? new Map(one ? [[single[1], one] as [string, Item]] : []) : srcItems;
  if (single && !from.size) throw new RcloneFail(`Failed to copyto: object not found`);
  const same = (a: Item, b: Item) => a.size === b.size && (a.etag === b.etag || a.etag.startsWith('size:') || b.etag.startsWith('size:'));

  if (cmd === 'check') {
    let missing = 0;
    let differ = 0;
    let match = 0;
    for (const [rel, it] of from) {
      const o = dstItems.get(rel);
      if (!o) {
        missing++;
        lines.push(log('ERROR', `${rel}: file not in ${dst.describe}`));
      } else if (o.size !== it.size) {
        differ++;
        lines.push(log('ERROR', `${rel}: sizes differ`));
      } else if (!same(it, o)) {
        differ++;
        lines.push(log('ERROR', `${rel}: md5 differ`));
      } else match++;
    }
    let extra = 0;
    for (const rel of dstItems.keys())
      if (!from.has(rel)) {
        extra++;
        lines.push(log('ERROR', `${rel}: file not in ${src.describe}`));
      }
    const diffs = missing + differ + extra;
    if (extra) lines.push(log('NOTICE', `${src.describe}: ${extra} files missing`));
    if (missing) lines.push(log('NOTICE', `${dst.describe}: ${missing} files missing`));
    lines.push(log('NOTICE', `${dst.describe}: ${diffs} differences found`));
    if (diffs) lines.push(log('NOTICE', `${dst.describe}: ${diffs} errors while checking`));
    lines.push(log('NOTICE', `${dst.describe}: ${match} matching files`));
    run.differences = diffs;
    run.ok = diffs === 0;
    if (diffs) lines.push(`${t} Failed to check: ${diffs} differences found`);
    return finish(diffs ? 1 : 0);
  }

  // What to do: copies (new or replacing), then deletions (sync).
  const plan: { rel: string; it: Item; replace: boolean }[] = [];
  for (const [rel, it] of from) {
    const o = dstItems.get(rel);
    if (o && same(it, o)) continue;
    plan.push({ rel, it, replace: !!o });
  }
  const deletions = cmd === 'sync' ? [...dstItems.keys()].filter((r) => !from.has(r)) : [];
  const errors: string[] = [];
  let transferred = 0;
  let size = 0;
  let deleted = 0;
  let freed = 0;
  const toBackup = (rel: string, it: Item): string | null => {
    if (!backup) return null;
    const target = `${rel}${suffix}`;
    if (dry) {
      lines.push(log('NOTICE', `${rel}: Skipped move as --dry-run is set (size ${shortSize(it.size)})`));
      return null;
    }
    const e = putFs(game, backup, target, it) ?? deleteFs(game, dst, rel);
    if (!e && verbose) lines.push(log('INFO', `${rel}: Moved (server-side) to: ${backup.prefix ? `${backup.prefix}/` : ''}${target}`));
    return e;
  };
  for (const p of plan) {
    if (dry) {
      if (p.replace && backup) toBackup(p.rel, dstItems.get(p.rel)!);
      lines.push(log('NOTICE', `${p.rel}: Skipped ${p.replace ? 'update modification time' : 'copy'} as --dry-run is set (size ${shortSize(p.it.size)})`.replace('update modification time', 'copy')));
      transferred++;
      size += p.it.size;
      continue;
    }
    if (p.replace && backup) {
      const e = toBackup(p.rel, dstItems.get(p.rel)!);
      if (e) {
        errors.push(e);
        lines.push(log('ERROR', `${p.rel}: Failed to move to backup dir: ${e}`));
        continue;
      }
    }
    const e = putFs(game, dst, p.rel, p.it);
    if (e) {
      errors.push(e);
      lines.push(log('ERROR', `${p.rel}: Failed to copy: ${e}`));
      continue;
    }
    transferred++;
    size += p.it.size;
    if (verbose) lines.push(log('INFO', `${p.rel}: Copied (${p.replace ? 'replaced existing' : 'new'})`));
  }
  // rclone doesn't delete anything when there were errors.
  if (errors.length && deletions.length) lines.push(log('ERROR', `${dst.describe}: not deleting files as there were IO errors`));
  else
    for (const rel of deletions) {
      const it = dstItems.get(rel)!;
      if (backup) {
        const e = toBackup(rel, it);
        if (e) {
          errors.push(e);
          lines.push(log('ERROR', `${rel}: Failed to move to backup dir: ${e}`));
        } else if (!dry) (deleted++, (freed += it.size));
        continue;
      }
      if (dry) {
        lines.push(log('NOTICE', `${rel}: Skipped delete as --dry-run is set (size ${shortSize(it.size)})`));
        deleted++;
        freed += it.size;
        continue;
      }
      const e = deleteFs(game, dst, rel);
      if (e) {
        errors.push(e);
        lines.push(log('ERROR', `${rel}: Failed to delete: ${e}`));
      } else {
        deleted++;
        freed += it.size;
        if (verbose) lines.push(log('INFO', `${rel}: Deleted`));
      }
    }
  if (errors.length) {
    const last = errors.at(-1)!;
    for (let i = 1; i <= 3; i++) lines.push(log('ERROR', `Attempt ${i}/3 failed with ${errors.length} errors and: ${last}`));
    lines.push(`${t} Failed to ${cmd === 'copyto' ? 'copy' : cmd} with ${errors.length} errors: last error was: ${last}`);
    return finish(1);
  }
  run.ok = true;
  if (dry || verbose || flags.has('progress')) {
    const checks = from.size;
    lines.push(
      `${dry ? `${t} NOTICE: \n` : ''}Transferred:   \t${statSize(size).padStart(12)} / ${statSize(size)}, 100%, 0 B/s, ETA -`,
      `Checks:         ${String(checks).padStart(9)} / ${checks}, 100%`,
      ...(deleted ? [`Deleted:        ${String(deleted).padStart(9)} (files), 0 (dirs), ${statSize(freed)} (freed)`] : []),
      `Transferred:    ${String(transferred).padStart(9)} / ${transferred}, 100%`,
      'Elapsed time:         0.4s',
    );
  }
  return finish(0);
}

// ——— Garage's own CLI ———

const GARAGE_HELP = `Garage ${VERSION} [features: k2v, lmdb, sqlite, metrics, bundled-libs]
S3-compatible object store for self-hosted geo-distributed deployments

Usage: garage [OPTIONS] <COMMAND>

Commands:
  server     Run Garage server
  status     Get network status
  node       Operations on individual Garage nodes
  layout     Operations on the assignment of node roles in the cluster layout
  bucket     Operations on buckets
  key        Operations on S3 access keys
  repair     Start repair of node data on remote node
  stats      Gather node statistics
  help       Print this message or the help of the given subcommand(s)

Options:
  -h, --rpc-host <RPC_HOST>      Host to connect to for admin operations, in the format: <full-node-id>@<ip>:<port>
  -s, --rpc-secret <RPC_SECRET>  RPC secret network key, used to replace rpc_secret in config.toml when running the daemon or doing admin operations
  -c, --config <CONFIG_FILE>     Path to configuration file [default: /etc/garage.toml]
      --help                     Print help
  -V, --version                  Print version`;

class GarageFail {
  constructor(public text: string) {}
}

/** Columns aligned like Garage's format_table (two spaces between). */
const table = (rows: string[][]) => {
  const widths = rows[0].map((_, c) => Math.max(...rows.map((r) => (r[c] ?? '').length)));
  return rows.map((r) => r.map((v, c) => (c === r.length - 1 ? v : v.padEnd(widths[c]))).join('  ').trimEnd()).join('\n');
};
const garageDate = (ms: number) => `${new Date(ms).toISOString().slice(0, 23).replace('T', ' ')} +00:00`;
const ago = (ms: number) => {
  const m = Math.round(ms / 60_000);
  if (m < 60) return `${m} minutes ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h} hours ago`;
  return `${Math.round(h / 24)} days ago`;
};
const permText = (p: { read: boolean; write: boolean; owner: boolean }) => `${p.read ? 'R' : ' '}${p.write ? 'W' : ' '}${p.owner ? 'O' : ' '}`;

function bucketOrFail(g: Garage, name: string): Bucket {
  if (!name) throw new GarageFail('error: the following required arguments were not provided:\n  <NAME>');
  const b = bucketByName(g, name);
  if (!b) throw new GarageFail(`Error: Bucket not found: ${name}`);
  return b;
}
function keyOrFail(g: Garage, pattern: string): AccessKey {
  if (!pattern) throw new GarageFail('error: the following required arguments were not provided:\n  <KEY_PATTERN>');
  const found = keysMatching(g, pattern);
  if (found.length !== 1) throw new GarageFail(`Error: ${found.length} matching keys`);
  return found[0];
}

function keyInfo(g: Garage, k: AccessKey, secret: boolean): string {
  const buckets = g.buckets.filter((b) => anyPerm(permOf(k, b)));
  return [
    '==== ACCESS KEY INFORMATION ====',
    `Key ID:              ${k.id}`,
    `Key name:            ${k.name}`,
    `Secret key:          ${secret ? k.secret : '(redacted)'}`,
    `Created:             ${garageDate(k.created)}`,
    'Validity:            valid',
    'Expiration:          never',
    '',
    `Can create buckets:  ${k.createBucket}`,
    '',
    '==== BUCKETS FOR THIS KEY ====',
    table([['Permissions', 'ID', 'Global aliases', 'Local aliases'], ...buckets.map((b) => [permText(permOf(k, b)), b.id.slice(0, 16), b.aliases.join(', '), ''])]),
  ].join('\n');
}

function bucketInfo(g: Garage, b: Bucket): string {
  const keys = g.keys.filter((k) => anyPerm(permOf(k, b)));
  const size = bucketSize(b);
  return [
    '==== BUCKET INFORMATION ====',
    `Bucket:          ${b.id}`,
    `Created:         ${garageDate(b.created)}`,
    '',
    `Size:            ${bytes(size, true)} (${bytes(size)})`,
    `Objects:         ${Object.keys(b.objects).length}`,
    '',
    `Website access:  ${!!b.website}`,
    ...(b.website ? [`  index document:  ${b.website.index}`, `  error document:  ${b.website.error ?? '(not defined)'}`] : []),
    '',
    `Global alias:    ${b.aliases.join(', ')}`,
    '',
    '==== KEYS FOR THIS BUCKET ====',
    table([['Permissions', 'Access key', 'Name', 'Local aliases'], ...keys.map((k) => [permText(permOf(k, b)), k.id, k.name, ''])]),
  ].join('\n');
}

function status(game: Shell, g: Garage): string {
  const now = realNow(game);
  const roles = g.layout.roles;
  const healthy = Object.values(g.nodes).filter((n) => n.up);
  const failed = Object.values(g.nodes).filter((n) => !n.up && roles[n.id]);
  const capacity = (id: string) => (roles[id] ? bytes(roles[id].capacity) : '');
  const out = [
    '==== HEALTHY NODES ====',
    table([
      ['ID', 'Hostname', 'Address', 'Tags', 'Zone', 'Capacity', 'DataAvail', 'Version'],
      ...healthy.map((n) =>
        roles[n.id]
          ? [n.id.slice(0, 16), n.hostname, n.address, `[${roles[n.id].tags.join(',')}]`, roles[n.id].zone, capacity(n.id), `${bytes(n.avail)} (${((n.avail * 100) / n.disk).toFixed(1)}%)`, VERSION]
          : [n.id.slice(0, 16), n.hostname, n.address, '', 'NO ROLE ASSIGNED', '', '', VERSION],
      ),
    ]),
  ];
  if (failed.length)
    out.push(
      '',
      '==== FAILED NODES ====',
      table([['ID', 'Hostname', 'Address', 'Tags', 'Zone', 'Capacity', 'Last seen'], ...failed.map((n) => [n.id.slice(0, 16), n.hostname, n.address, `[${roles[n.id].tags.join(',')}]`, roles[n.id].zone, capacity(n.id), n.lastSeen ? ago(now - n.lastSeen) : 'never seen'])]),
    );
  return out.join('\n');
}

const roleRows = (ids: string[], roles: Record<string, Role>) => ids.map((id) => [id.slice(0, 16), `[${roles[id].tags.join(',')}]`, roles[id].zone, bytes(roles[id].capacity)]);

function layoutShow(g: Garage): string {
  const cur = g.layout.roles;
  const out = ['==== CURRENT CLUSTER LAYOUT ====', table([['ID', 'Tags', 'Zone', 'Capacity', 'Usable capacity'], ...roleRows(Object.keys(cur), cur).map((r) => [...r, `${r[3]} (100.0%)`])]), '', `Zone redundancy: maximum`, '', `Current cluster layout version: ${g.layout.version}`];
  const staged = Object.entries(g.layout.staged);
  if (!staged.length) {
    out.push('', 'No staged role changes.');
    return out.join('\n');
  }
  out.push('', '==== STAGED ROLE CHANGES ====', table([['ID', 'Tags', 'Zone', 'Capacity'], ...staged.map(([id, r]) => (r ? [id.slice(0, 16), `[${r.tags.join(',')}]`, r.zone, bytes(r.capacity)] : [id.slice(0, 16), 'REMOVED', '', '']))]));
  const next = nextRoles(g);
  const problem = layoutProblem(g, next);
  out.push('', '==== NEW CLUSTER LAYOUT AFTER APPLYING CHANGES ====');
  if (problem) out.push(`Error while trying to compute the assignment: ${problem}`, '', 'This new layout cannot yet be applied.', 'You can also revert all proposed changes with: garage layout revert');
  else {
    const zones = zonesOf(g, next);
    out.push(
      table([['ID', 'Tags', 'Zone', 'Capacity', 'Usable capacity'], ...roleRows(Object.keys(next), next).map((r) => [...r, `${r[3]} (100.0%)`])]),
      '',
      `Zone redundancy: maximum (${Math.min(zones.size, g.replication)} zones)`,
      '',
      'To enact the staged role changes, type:',
      '',
      `    garage layout apply --version ${g.layout.version + 1}`,
      '',
      'You can also revert all proposed changes with: garage layout revert',
    );
  }
  return out.join('\n');
}

const nextRoles = (g: Garage): Record<string, Role> => {
  const next = { ...g.layout.roles };
  for (const [id, r] of Object.entries(g.layout.staged)) {
    if (r) next[id] = r;
    else delete next[id];
  }
  return next;
};
function layoutProblem(g: Garage, roles: Record<string, Role>): string | null {
  const n = Object.values(roles).filter((r) => r.capacity > 0).length;
  if (n < g.replication) return `The number of nodes with positive capacity (${n}) is smaller than the replication factor (${g.replication}).`;
  return null;
}

function findNode(g: Garage, prefix: string): string {
  if (!prefix) throw new GarageFail('error: the following required arguments were not provided:\n  <NODE_IDS>...');
  const ids = [...new Set([...Object.keys(g.nodes), ...Object.keys(g.layout.roles)])].filter((id) => id.startsWith(prefix.toLowerCase()));
  if (ids.length === 0) throw new GarageFail(`Error: No node matching ${prefix}`);
  if (ids.length > 1) throw new GarageFail(`Error: Several nodes match ${prefix}: ${ids.map((x) => x.slice(0, 16)).join(', ')}`);
  return ids[0];
}

const STAGED = 'Role changes are staged but not yet committed.\nUse `garage layout show` to view staged role changes,\nand `garage layout apply` to enact staged changes.';

function layout(game: Shell, g: Garage, args: string[]): string {
  const [sub, ...rest] = args;
  const opt = (names: string[]) => {
    const i = rest.findIndex((a) => names.includes(a));
    if (i < 0) return undefined;
    const v = rest[i + 1];
    rest.splice(i, 2);
    return v ?? '';
  };
  switch (sub) {
    case 'show':
      return layoutShow(g);
    case 'assign': {
      const zone = opt(['-z', '--zone']);
      const cap = opt(['-c', '--capacity']);
      const tag = opt(['-t', '--tag']);
      const replace = opt(['--replace']);
      const gateway = rest.includes('-g') || rest.includes('--gateway');
      const ids = rest.filter((a) => !a.startsWith('-'));
      if (!ids.length) throw new GarageFail('error: the following required arguments were not provided:\n  <NODE_IDS>...');
      for (const raw of ids) {
        const id = findNode(g, raw);
        const old = g.layout.staged[id] ?? g.layout.roles[id];
        if (!zone && !old) throw new GarageFail('Error: Please specify a zone with the -z flag');
        let capacity = old?.capacity ?? 0;
        if (cap !== undefined) {
          const c = parseCapacity(cap);
          if (c === null) throw new GarageFail(`error: invalid value '${cap}' for '--capacity <CAPACITY>': invalid capacity`);
          capacity = c;
        } else if (!old && !gateway) throw new GarageFail('Error: Please specify a capacity with the -c flag, or set node explicitly as gateway with -g');
        g.layout.staged[id] = { zone: zone ?? old!.zone, capacity: gateway ? 0 : capacity, tags: tag !== undefined ? [tag] : (old?.tags ?? []) };
      }
      if (replace !== undefined) {
        const r = findNode(g, replace);
        g.layout.staged[r] = null;
      }
      return STAGED;
    }
    case 'remove': {
      const id = findNode(g, rest.find((a) => !a.startsWith('-')) ?? '');
      g.layout.staged[id] = null;
      return STAGED;
    }
    case 'revert': {
      if (!rest.includes('--yes')) throw new GarageFail('Error: Add `--yes` to really revert the staged changes.');
      g.layout.staged = {};
      return 'All proposed role changes in cluster layout have been canceled.';
    }
    case 'apply': {
      const v = opt(['--version']);
      if (v === undefined)
        throw new GarageFail('Error: Please pass the new layout version number to ensure that you are writing the correct version of the cluster layout.\nTo know the correct value of the new layout version, invoke `garage layout show` and review the proposed changes.');
      if (Number(v) !== g.layout.version + 1) throw new GarageFail(`Error: Invalid new layout version: expected ${g.layout.version + 1}, got ${v}`);
      if (!Object.keys(g.layout.staged).length) throw new GarageFail('Error: No changes to apply: the staged layout is the same as the current one.');
      const next = nextRoles(g);
      const problem = layoutProblem(g, next);
      if (problem) throw new GarageFail(`Error: ${problem}`);
      g.layout = { version: g.layout.version + 1, roles: next, staged: {} };
      const zones = zonesOf(g);
      return [
        '==== COMPUTATION OF A NEW PARTITION ASSIGNATION ====',
        '',
        `Partitions are replicated ${g.replication} times on at least ${Math.min(zones.size, g.replication)} distinct zones.`,
        '',
        'Optimal partition size:                     3.9 GB',
        '',
        table([['Zone', 'Nodes', 'Capacity'], ...[...zones].map((z) => [z, String(Object.values(next).filter((r) => r.zone === z).length), bytes(Object.values(next).filter((r) => r.zone === z).reduce((n, r) => n + r.capacity, 0))])]),
        '',
        'New cluster layout with updated role assignment has been applied in cluster.',
        'Data will now be moved around between nodes accordingly.',
      ].join('\n');
    }
  }
  throw new GarageFail(`error: unrecognized subcommand '${sub ?? ''}'\n\nUsage: garage layout <COMMAND>\n\nFor more information, try '--help'.`);
}

function bucketCmd(game: Shell, g: Garage, args: string[]): string {
  const [sub, ...rest] = args;
  const has = (...n: string[]) => n.some((x) => rest.includes(x));
  const value = (n: string[]) => {
    const i = rest.findIndex((a) => n.includes(a));
    return i < 0 ? undefined : rest[i + 1];
  };
  const keyArg = value(['--key']);
  const names = rest.filter((a, i) => !a.startsWith('-') && !['--key', '--index-document', '--error-document'].includes(rest[i - 1]));
  switch (sub) {
    case 'list':
      return table([['ID', 'Created', 'Global aliases', 'Local aliases'], ...g.buckets.map((b) => [b.id.slice(0, 16), new Date(b.created).toISOString().slice(0, 10), b.aliases.join(', '), ''])]);
    case 'info':
      return bucketInfo(g, bucketOrFail(g, names[0] ?? ''));
    case 'create': {
      const name = names[0];
      if (!name) throw new GarageFail('error: the following required arguments were not provided:\n  <NAME>');
      if (!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(name)) throw new GarageFail(`Error: Invalid bucket name: ${name}`);
      if (bucketByName(g, name)) throw new GarageFail(`Error: Bucket ${name} already exists`);
      g.buckets.push({ id: newBucketId(`${name}:${g.counter++}`), aliases: [name], created: realNow(game), website: null, objects: {} });
      return `==== BUCKET INFORMATION ====\nBucket:          ${g.buckets.at(-1)!.id}\nCreated:         ${garageDate(realNow(game))}\n\nSize:            0 B (0 B)\nObjects:         0\n\nWebsite access:  false\n\nGlobal alias:    ${name}\n\n==== KEYS FOR THIS BUCKET ====\nPermissions  Access key  Local aliases`;
    }
    case 'delete': {
      const b = bucketOrFail(g, names[0] ?? '');
      if (!has('--yes')) throw new GarageFail('Error: Add --yes flag to really perform this operation');
      if (Object.keys(b.objects).length) throw new GarageFail('Error: Bucket is not empty');
      g.buckets = g.buckets.filter((x) => x !== b);
      for (const k of g.keys) delete k.perms[b.id];
      return `Bucket ${names[0]} has been deleted.`;
    }
    case 'allow':
    case 'deny': {
      const b = bucketOrFail(g, names[0] ?? '');
      if (keyArg === undefined) throw new GarageFail('error: the following required arguments were not provided:\n  --key <KEY_PATTERN>');
      const k = keyOrFail(g, keyArg);
      const p = { ...permOf(k, b) };
      const r = has('--read');
      const w = has('--write');
      const o = has('--owner');
      if (!r && !w && !o) throw new GarageFail('Error: Please specify --read, --write and/or --owner');
      const v = sub === 'allow';
      if (r) p.read = v;
      if (w) p.write = v;
      if (o) p.owner = v;
      if (anyPerm(p)) k.perms[b.id] = p;
      else delete k.perms[b.id];
      return `New permissions for ${k.id} on ${bucketName(b)}: read ${p.read}, write ${p.write}, owner ${p.owner}.`;
    }
    case 'website': {
      const b = bucketOrFail(g, names[0] ?? '');
      if (has('--allow')) {
        b.website = { index: value(['--index-document']) ?? b.website?.index ?? 'index.html', ...((value(['--error-document']) ?? b.website?.error) ? { error: value(['--error-document']) ?? b.website?.error } : {}) };
        return `Website access allowed for ${names[0]}`;
      }
      if (has('--deny')) {
        b.website = null;
        return `Website access denied for ${names[0]}`;
      }
      throw new GarageFail('Error: You must specify exactly one flag, either --allow or --deny');
    }
  }
  throw new GarageFail(`error: unrecognized subcommand '${sub ?? ''}'\n\nUsage: garage bucket <COMMAND>\n\nFor more information, try '--help'.`);
}

function keyCmd(game: Shell, g: Garage, args: string[]): string {
  const [sub, ...rest] = args;
  const names = rest.filter((a) => !a.startsWith('-'));
  switch (sub) {
    case 'list':
      return table([['ID', 'Created', 'Name', 'Expiration'], ...g.keys.map((k) => [k.id, new Date(k.created).toISOString().slice(0, 10), k.name, 'never'])]);
    case 'info':
      return keyInfo(g, keyOrFail(g, names[0] ?? ''), rest.includes('--show-secret'));
    case 'create': {
      const name = names[0] ?? 'Unnamed key';
      const seed = `${name}:${g.counter++}`;
      const k: AccessKey = { id: newKeyId(seed), name, secret: newSecret(seed), created: realNow(game), createBucket: false, perms: {} };
      g.keys.push(k);
      return keyInfo(g, k, true);
    }
    case 'delete': {
      const k = keyOrFail(g, names[0] ?? '');
      if (!rest.includes('--yes')) throw new GarageFail('Error: Add --yes flag to really perform this operation');
      g.keys = g.keys.filter((x) => x !== k);
      return `Access key ${k.id} has been deleted.`;
    }
    case 'rename': {
      const k = keyOrFail(g, names[0] ?? '');
      if (!names[1]) throw new GarageFail('error: the following required arguments were not provided:\n  <NEW_NAME>');
      k.name = names[1];
      return keyInfo(g, k, false);
    }
    case 'allow':
    case 'deny': {
      const k = keyOrFail(g, names[0] ?? '');
      if (!rest.includes('--create-bucket')) throw new GarageFail('Error: Please specify --create-bucket');
      k.createBucket = sub === 'allow';
      return keyInfo(g, k, false);
    }
  }
  throw new GarageFail(`error: unrecognized subcommand '${sub ?? ''}'\n\nUsage: garage key <COMMAND>\n\nFor more information, try '--help'.`);
}

export function garageCli(c: Context): string {
  const game = c.game;
  let args = [...c.args];
  while (['-c', '--config', '-h', '--rpc-host', '-s', '--rpc-secret'].includes(args[0] ?? '')) args = args.slice(2);
  const [cmd, ...rest] = args;
  if (cmd === '-V' || cmd === '--version') return `garage ${VERSION}`;
  if (!cmd || cmd === 'help') return cmd ? GARAGE_HELP : game.error(GARAGE_HELP, 2);
  const g = garage(game);
  if (!g) return game.error('Error: Unable to read configuration file /etc/garage.toml: No such file or directory (os error 2)', 1);
  if (game.who !== 'root') return game.error('Error: Unable to read configuration file /etc/garage.toml: Permission denied (os error 13)', 1);
  if (systemd(game)?.services.garage && systemd(game)!.services.garage.state !== 'active') return game.error('Error: Internal error: Remote error: Could not connect to 127.0.0.1:3901: Connection refused (os error 111)', 1);
  try {
    switch (cmd) {
      case 'status':
        return status(game, g);
      case 'node':
        if (rest[0] === 'id') {
          const self = Object.values(g.nodes).find((n) => n.hostname === game.hostName) ?? Object.values(g.nodes)[0];
          return `${self.id}@${self.address}\n\nTo instruct a node to connect to this node, run the following command on that node:\n    garage [-c <config file path>] node connect ${self.id}@${self.address}\n\nOr instruct them to connect from here by running:\n    garage [-c <config file path>] -h <remote node> node connect ${self.id}@${self.address}\n\nIf you are connecting to a remote node, you must use the remote node's public IP address.`;
        }
        throw new GarageFail(`error: unrecognized subcommand '${rest[0] ?? ''}'`);
      case 'layout':
        return layout(game, g, rest);
      case 'bucket':
        return bucketCmd(game, g, rest);
      case 'key':
        return keyCmd(game, g, rest);
      case 'stats':
        return `Garage version: ${VERSION} [features: k2v, lmdb, sqlite, metrics, bundled-libs]\nRust compiler version: 1.86.0\n\nDatabase engine: LMDB (using Heed crate)\n\nTable stats:\n${table([['  Table', 'Items', 'MklItems', 'MklTodo', 'GcTodo'], ['  bucket_v2', String(g.buckets.length), String(g.buckets.length * 2), '0', '0'], ['  key', String(g.keys.length), String(g.keys.length * 2), '0', '0'], ['  object', String(g.buckets.reduce((n, b) => n + Object.keys(b.objects).length, 0)), '-', '0', '0']])}\n\nBlock manager stats:\n  number of RC entries: ${g.buckets.reduce((n, b) => n + Object.keys(b.objects).length, 0) * 3}\n  resync queue length: 0\n  blocks with resync errors: 0`;
      case 'repair':
        if (!rest.includes('--yes')) throw new GarageFail('Error: Add --yes flag to launch repair');
        return 'Repair launched on all nodes';
      case 'server':
        throw new GarageFail('Error: Garage is already running on this node (garage.service): stop it before starting a server by hand.');
    }
    throw new GarageFail(`error: unrecognized subcommand '${cmd}'\n\nUsage: garage [OPTIONS] <COMMAND>\n\nFor more information, try '--help'.`);
  } catch (e) {
    if (e instanceof GarageFail) return game.error(e.text, e.text.startsWith('error:') ? 2 : 1);
    throw e;
  }
}

// ——— curl towards the cluster ———

export function s3Curl(game: Shell, args: string[]): string {
  const headers: Record<string, string> = {};
  let output: string | null = null;
  let writeOut: string | null = null;
  let method = 'GET';
  const urls: string[] = [];
  const flags = new Set<string>();
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    const next = () => args[++i] ?? '';
    if (a === '-H' || a === '--header') {
      const h = /^([\w-]+):\s*(.*)$/.exec(next());
      if (h) headers[h[1].toLowerCase()] = h[2];
    } else if (a === '-o' || a === '--output') output = next();
    else if (a === '-w' || a === '--write-out') writeOut = next();
    else if (a === '-X' || a === '--request') method = next().toUpperCase();
    else if (['-A', '--user-agent', '-e', '--referer', '-m', '--max-time', '--connect-timeout', '--cacert', '-u', '--user'].includes(a)) next();
    else if (a === '-I' || a === '--head') flags.add('I');
    else if (a.startsWith('--')) flags.add(a.slice(2));
    else if (/^-[a-zA-Z]+$/.test(a)) for (const ch of a.slice(1)) flags.add(ch);
    else urls.push(a);
  }
  if (flags.has('O') && urls[0]) output = urls[0].replace(/\?.*$/, '').split('/').pop() || 'index.html';
  const head = flags.has('I') || method === 'HEAD';
  const url = urls[0];
  if (!url) return game.error("curl: no URL specified\ncurl: try 'curl --help' or 'curl --manual' for more information", 2);
  const m = /^(?:(https?):\/\/)?([^/?#]+)([^?#]*)(?:\?([^#]*))?/.exec(url);
  const scheme = m?.[1] ?? 'http';
  const hostPort = m?.[2] ?? '';
  const path = m?.[3] || '/';
  const query = m?.[4] ?? '';
  const e = endpointOf(game, `${scheme}://${hostPort}`);
  if (!e) return game.error(`curl: (6) Could not resolve host: ${hostPort.replace(/:\d+$/, '')}`, 6);
  let status = 200;
  let type = 'application/xml';
  let body = '';
  let obj: S3Object | undefined;
  if (e.kind === 'web') {
    const a = webGet(game, headers.host ?? e.host, path);
    status = a.status;
    type = a.type;
    body = a.body;
    obj = a.object;
  } else {
    const xml = (x: S3Error, resource: string) => `<?xml version="1.0" encoding="UTF-8"?><Error><Code>${x.code}</Code><Message>${x.message}</Message><Resource>${resource}</Resource><Region>${garage(game)!.region}</Region></Error>`;
    if (/X-Amz-Signature=/.test(query)) {
      const r = presignedGet(game, path, query, serverNow(game, e));
      if ('error' in r) {
        status = r.error.status;
        body = xml(r.error, path);
      } else {
        obj = r.object;
        type = obj.type;
        body = obj.content ?? '';
      }
    } else {
      const r = authorize(game, { op: 'GetObject', bucket: path.split('/')[1], key: path.split('/').slice(2).join('/'), auth: null, now: serverNow(game, e) });
      if ('error' in r) {
        status = r.error.status;
        body = xml(r.error, path);
      }
    }
  }
  const reason: Record<number, string> = { 200: 'OK', 400: 'Bad Request', 403: 'Forbidden', 404: 'Not Found', 503: 'Service Unavailable' };
  const httpLine = `HTTP/${scheme === 'https' ? '2' : '1.1'} ${status}${scheme === 'https' ? '' : ` ${reason[status] ?? ''}`}`;
  const size = obj ? obj.size : fileBytes(body).length;
  const headerLines = [
    httpLine,
    ...(obj && status === 200 ? ['accept-ranges: bytes'] : []),
    `content-length: ${size}`,
    `content-type: ${type}`,
    ...(obj ? [`etag: "${obj.etag}"`, `last-modified: ${httpDate(obj.modified)}`] : []),
    `date: ${httpDate(realNow(game))}`,
    '',
  ].join('\n');
  const written = (writeOut ?? '').replace(/%\{http_code\}/g, String(status)).replace(/%\{size_download\}/g, String(head ? 0 : size)).replace(/%\{content_type\}/g, type).replace(/\\n/g, '\n');
  if (flags.has('f') && status >= 400) {
    game.error(`curl: (22) The requested URL returned error: ${status}`, 22);
    return written;
  }
  if (head) return headerLines + written;
  const showHeaders = flags.has('i') ? headerLines + '\n' : '';
  if (output && output !== '-') {
    const n = obj && obj.content === undefined && status === 200 ? f('', { size: obj.size, charset: 'binary', mtime: nowOf(game) }) : f(body, { lines: true, mtime: nowOf(game) });
    const err = output === '/dev/null' ? null : writeLocal(game, 'curl', output, n);
    if (err) return game.error(`curl: (23) Failure writing output to destination`, 23);
    if (!flags.has('s')) game.error(`  % Total    % Received % Xferd  Average Speed   Time    Time     Time  Current\n                                 Dload  Upload   Total   Spent    Left  Speed\n100 ${String(size).padStart(5)}  100 ${String(size).padStart(5)}    0     0   ${String(size).padStart(5)}      0 --:--:-- --:--:-- --:--:--  ${size}`);
    game.status = 0;
    return written;
  }
  if (obj && obj.content === undefined && status === 200 && output !== '-')
    return game.error('Warning: Binary output can mess up your terminal. Use "--output -" to tell \nWarning: curl to output it to your terminal anyway, or consider "--output \nWarning: <FILE>" to save to a file.', 23);
  return showHeaders + body + written;
}

export const OBJECTS_PROGRAMS: Record<string, (c: Context) => string> = {
  garage: garageCli,
  aws,
  rclone,
};

export { WEEK, roleNodes };
