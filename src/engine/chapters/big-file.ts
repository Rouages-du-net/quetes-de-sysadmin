// Story "The Dance Troupe", chapter "The Big File": Farrukh needs to send
// the full film of the spring gala (3.8 GB, in the private bucket media) to
// Zuri, who produces a partner festival, for her selection committee
// next week. And Garage's status shows a failed node: porch, at Siosaia's,
// whose disk died two days ago; Siosaia installed a new machine, a new
// Garage node that has no role yet.
// The fix: a presigned URL (aws s3 presign) for that object, valid for a
// week at most (SigV4 allows 604800 seconds; Garage refuses more: "X-Amz-
// Expires may not exceed a week"), signed with a key of its own that can
// only read media (a presigned URL can't be revoked, but its key can be
// deleted), on the public endpoint, written in ~/link_for_zuri.txt; the
// bucket stays private. Then the layout: the data is still readable and
// writable (two copies of three, a quorum), but a second failure would make
// it unavailable; the new node takes the failed node's role (garage layout
// assign --replace, or remove then assign) in the same zone, home, and the
// layout is applied with its next version.
// Objective checked on the state: in the link file, a URL for the video
// whose signature matches its key, expiring in more than three days and at
// most seven, signed less than a day ago, with a key that has read on media
// and nothing else, on s3.kestrel.example; media without website access;
// the layout applied, three nodes with a role, all up, in three zones, the
// failed node's role gone.
// False leads: --expires-in 2592000 (thirty days: the URL fails), the
// bucket opened as a website, the URL signed with the admin key or the
// media team's (read and write), a URL on localhost, the new node in the
// studio's zone (two copies in the same building).
// Sources: https://awscli.amazonaws.com/v2/documentation/api/latest/reference/s3/presign.html,
// https://docs.aws.amazon.com/AmazonS3/latest/API/sigv4-query-string-auth.html,
// https://garagehq.deuxfleurs.fr/documentation/operations/recovering/,
// https://garagehq.deuxfleurs.fr/documentation/operations/layout/.

import type { Chapter } from '../world';
import { f, name } from '../world';
import type { Game } from '../shell';
import { WEEK, anyPerm, keyById, permOf, readPresigned, realNow, roleNodes, zonesOf } from '../garage';
import { HOME, NODE, PASSWORD, S3_HOST, VIDEO, bucket, cluster, initialiseStory, passTime, seen, typed, wingsAccounts, wingsState, wingsWorld } from './dance-troupe';

const linkFile = (j: Game) => `${j.home}/${name(j.t, 'link_for_zuri.txt')}`;
interface Link {
  host: string;
  bucket: string;
  key: string;
  keyId: string;
  date: number;
  expires: number;
  valid: boolean;
}
/** The presigned URLs written in the link file. */
function links(j: Game): Link[] {
  const text = j.read(linkFile(j)) ?? '';
  const out: Link[] = [];
  for (const m of text.matchAll(/https?:\/\/([^/\s]+)(\/[^?\s]*)\?(\S+)/g)) {
    const p = readPresigned(cluster(j), m[2], m[3]);
    if (p) out.push({ host: m[1].toLowerCase().replace(/:\d+$/, ''), ...p });
  }
  return out;
}
const forVideo = (j: Game) => links(j).filter((l) => l.bucket === 'media' && l.key === VIDEO && l.valid);
const readOnly = (j: Game, keyId: string) => {
  const k = keyById(cluster(j), keyId);
  const media = bucket(j, 'media');
  if (!k || !media || k.name === 'troupe-admin') return false;
  const p = permOf(k, media);
  return p.read && !p.write && !p.owner && cluster(j).buckets.every((b) => b === media || !anyPerm(permOf(k, b)));
};
const fresh = (j: Game, l: Link) => realNow(j) - l.date < 86_400_000 && l.date - realNow(j) < 3_600_000;
const goodLink = (j: Game, l: Link) => l.host === S3_HOST && l.expires >= 3 * 86_400 && l.expires <= WEEK && fresh(j, l) && readOnly(j, l.keyId);
const shared = (j: Game) => forVideo(j).some((l) => goodLink(j, l));
const tooLong = (j: Game) => links(j).some((l) => l.expires > WEEK) || seen(j, 'X-Amz-Expires may not exceed a week');
const wideKey = (j: Game) => forVideo(j).some((l) => !readOnly(j, l.keyId));
const localUrl = (j: Game) => forVideo(j).some((l) => l.host !== S3_HOST);
const mediaPublic = (j: Game) => !!bucket(j, 'media')?.website;

const layoutOk = (j: Game) => {
  const g = cluster(j);
  const ids = roleNodes(g);
  return ids.length >= 3 && ids.every((id) => g.nodes[id]?.up) && zonesOf(g).size >= 3 && !g.layout.roles[NODE.porch] && Object.keys(g.layout.staged).length === 0;
};
const sameZone = (j: Game) => {
  const g = cluster(j);
  return !g.layout.roles[NODE.porch] && roleNodes(g).length >= 3 && zonesOf(g).size < 3;
};

export const bigFile: Chapter = {
  id: 'big-file',
  number: 3,
  commands: ['ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'nano', 'echo', 'sudo', 'systemctl', 'journalctl', 'curl', 'garage', 'aws', 'rclone', 'exit'],
  home: HOME,
  welcome: 'message_from_farrukh.txt',
  names: true,
  final: 'end',
  steps: ['failed-node', 'safe', 'read-key', 'shared', 'replaced', 'end'],
  password: PASSWORD,
  accounts: wingsAccounts,
  state: (t) => wingsState(t, 3),
  initialise: (j) => initialiseStory(j, 3),
  createWorld: (t) =>
    wingsWorld(t, 3, {
      home: { 'message_from_farrukh.txt': f(t('big-file-message-farrukh')), 'message_from_siosaia.txt': f(t('big-file-message-siosaia')), 'notes_from_teodora.txt': f(t('big-file-notes-teodora')) },
    }),
  afterCommand: (j) => passTime(j),
  events: [
    { id: 'failed-node', condition: (j) => seen(j, '==== FAILED NODES ===='), message: (j) => j.t('big-file-event-failed-node') },
    { id: 'safe', condition: (j) => /garage\b.*\blayout\s+show/.test(typed(j)) && seen(j, 'Current cluster layout version'), message: (j) => j.t('big-file-event-safe') },
    { id: 'too-long', condition: tooLong, message: (j) => j.t('big-file-event-too-long') },
    { id: 'public-media', condition: mediaPublic, message: (j) => j.t('big-file-event-public-media') },
    { id: 'wide-key', condition: wideKey, message: (j) => j.t('big-file-event-wide-key') },
    { id: 'local-url', condition: localUrl, message: (j) => j.t('big-file-event-local-url') },
    { id: 'read-key', condition: (j) => cluster(j).keys.some((k) => readOnly(j, k.id)), message: (j) => j.t('big-file-event-read-key') },
    { id: 'shared', condition: shared, message: (j) => j.t('big-file-event-shared') },
    { id: 'staged', condition: (j) => cluster(j).layout.staged[NODE.porch] === null && !!cluster(j).layout.staged[NODE.newPorch], message: (j) => j.t('big-file-event-staged') },
    { id: 'same-zone', condition: sameZone, message: (j) => j.t('big-file-event-same-zone') },
    { id: 'replaced', condition: layoutOk, message: (j) => j.t('big-file-event-replaced') },
    {
      id: 'end',
      condition: (j) => shared(j) && !mediaPublic(j) && layoutOk(j),
      message: (j) => j.t('big-file-event-end'),
    },
  ],
};
