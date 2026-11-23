// Story "The Dance Troupe", chapter "The Public Bucket": a parent found the
// troupe's medical contacts list by searching the web. The website is
// served by Garage's web endpoint from the bucket www.kestrel.example, and
// the members' documents were put in the same bucket, under members/: with
// website access on, anyone can read every object of the bucket. And one
// key, troupe-admin (read, write and owner on every bucket), is used by the
// site's deploy script and by the office backup alike.
// The fix: a private bucket for the documents (no website access: Garage
// has no anonymous S3 access at all, so a bucket without website access is
// private), the documents moved there (aws s3 mv --recursive, or rclone,
// or copy then remove), anonymous access checked from the outside (curl:
// 404), and a key for each tool with only what it needs: the deploy key
// read and write on www.kestrel.example only, the backup key read and write
// on backups only, each one tried in its configuration (~/.aws/credentials'
// deploy profile, /etc/rclone/office.conf).
// Objective checked on the state: every member document (same ETag) in a
// bucket without website access, none in a website bucket; the website
// still served (index.html); a 404 seen on a document's old public address;
// the deploy profile's key and the backup configuration's key, least
// privilege, not the admin key, each used successfully.
// False leads: deleting the documents, switching the website off, a new key
// with owner rights or rights on every bucket.
// Sources: https://garagehq.deuxfleurs.fr/documentation/cookbook/exposing-websites/,
// https://garagehq.deuxfleurs.fr/documentation/quick-start/,
// https://awscli.amazonaws.com/v2/documentation/api/latest/reference/s3/mv.html.

import type { Chapter } from '../world';
import { f } from '../world';
import type { Game } from '../shell';
import { anyPerm, bucketByName, permOf, type AccessKey, type Bucket } from '../garage';
import { readIni } from '../objects-client';
import { ADMIN, HOME, MEMBER_DOCS, PASSWORD, RCLONE_CONF, WWW, bucket, cluster, docText, initialiseStory, passTime, seen, wingsAccounts, wingsState, wingsWorld } from './dance-troupe';
import { etagOf } from '../garage';

const docEtag = (j: Game, key: string) => etagOf(docText(j.t, key));
/** Where each document is now (the buckets holding an object with its ETag). */
const homesOf = (j: Game, key: string): Bucket[] => cluster(j).buckets.filter((b) => Object.values(b.objects).some((o) => o.etag === docEtag(j, key)));
const docsExposed = (j: Game) => MEMBER_DOCS.some((k) => homesOf(j, k).some((b) => !!b.website));
const docsLost = (j: Game) => MEMBER_DOCS.some((k) => homesOf(j, k).length === 0);
const docsPrivate = (j: Game) => !docsExposed(j) && !docsLost(j);
const www = (j: Game) => bucket(j, WWW);
const siteUp = (j: Game) => !!www(j)?.website && !!www(j)?.objects['index.html'];
const closed = (j: Game) => docsPrivate(j) && cluster(j).log.some((r) => r.via === 'web' && r.status === 404 && !!r.object && /(^|\/)(register|medical-contacts|board-minutes|photo-consent)/.test(r.object));

/** The key a configuration names, if it is a real one (its secret right). */
function keyIn(j: Game, keyId: string | undefined, secret: string | undefined): AccessKey | null {
  const k = cluster(j).keys.find((x) => x.id === keyId);
  return k && k.secret === secret ? k : null;
}
const deployKey = (j: Game) => {
  const c = readIni(j.read(`${j.home}/.aws/credentials`)).deploy;
  return keyIn(j, c?.aws_access_key_id, c?.aws_secret_access_key);
};
const backupKey = (j: Game) => {
  const c = readIni(j.read(RCLONE_CONF)).garage;
  return keyIn(j, c?.access_key_id, c?.secret_access_key);
};
/** Read and write on that bucket, and nothing else: no owner, no other bucket. */
function leastPrivilege(j: Game, k: AccessKey | null, alias: string): boolean {
  if (!k || k.id === ADMIN.id) return false;
  const b = bucket(j, alias);
  if (!b) return false;
  const p = permOf(k, b);
  return p.read && p.write && !p.owner && !k.createBucket && cluster(j).buckets.every((x) => x === b || !anyPerm(permOf(k, x)));
}
const tooWide = (j: Game) =>
  [deployKey(j), backupKey(j)].some((k) => !!k && k.id !== ADMIN.id && (k.createBucket || cluster(j).buckets.some((b) => permOf(k, b).owner) || cluster(j).buckets.filter((b) => anyPerm(permOf(k, b))).length > 1));
const used = (j: Game, k: AccessKey | null, alias: string) => {
  if (!k) return false;
  const b = bucket(j, alias);
  return cluster(j).log.some((r) => r.key === k.id && r.status === 200 && !!r.bucket && bucketByName(cluster(j), r.bucket) === b);
};
const deployOk = (j: Game) => leastPrivilege(j, deployKey(j), WWW) && used(j, deployKey(j), WWW);
const backupOk = (j: Game) => leastPrivilege(j, backupKey(j), 'backups') && used(j, backupKey(j), 'backups') && deployKey(j)?.id !== backupKey(j)?.id;

export const publicBucket: Chapter = {
  id: 'public-bucket',
  number: 1,
  commands: ['ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'nano', 'sudo', 'systemctl', 'journalctl', 'curl', 'md5sum', 'garage', 'aws', 'rclone', 'exit'],
  home: HOME,
  welcome: 'message_from_esperanza.txt',
  names: true,
  final: 'end',
  steps: ['exposed', 'website', 'moved', 'closed', 'deploy-key', 'backup-key', 'end'],
  password: PASSWORD,
  accounts: wingsAccounts,
  state: (t) => wingsState(t, 1),
  initialise: (j) => initialiseStory(j, 1),
  createWorld: (t) =>
    wingsWorld(t, 1, {
      home: { 'message_from_esperanza.txt': f(t('public-bucket-message-esperanza')), 'notes_from_teodora.txt': f(t('public-bucket-notes-teodora')) },
    }),
  afterCommand: (j) => passTime(j),
  events: [
    { id: 'exposed', condition: (j) => /\b(curl|wget)\b/.test(j.last.line ?? '') && MEMBER_DOCS.some((k) => seen(j, docText(j.t, k).split('\n')[0])), message: (j) => j.t('public-bucket-event-exposed') },
    { id: 'website', condition: (j) => seen(j, /Website access:\s+true/) && seen(j, WWW), message: (j) => j.t('public-bucket-event-website') },
    { id: 'deleted', condition: docsLost, message: (j) => j.t('public-bucket-event-deleted') },
    { id: 'site-down', condition: (j) => !siteUp(j), message: (j) => j.t('public-bucket-event-site-down') },
    { id: 'moved', condition: docsPrivate, message: (j) => j.t('public-bucket-event-moved') },
    { id: 'closed', condition: closed, message: (j) => j.t('public-bucket-event-closed') },
    { id: 'too-wide', condition: tooWide, message: (j) => j.t('public-bucket-event-too-wide') },
    { id: 'deploy-key', condition: deployOk, message: (j) => j.t('public-bucket-event-deploy-key') },
    { id: 'backup-key', condition: backupOk, message: (j) => j.t('public-bucket-event-backup-key') },
    {
      id: 'end',
      condition: (j) => docsPrivate(j) && siteUp(j) && closed(j) && deployOk(j) && backupOk(j),
      message: (j) => j.t('public-bucket-event-end'),
    },
  ],
};
