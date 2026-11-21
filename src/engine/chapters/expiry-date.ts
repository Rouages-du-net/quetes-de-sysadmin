// Story "The Airwaves", chapter "The Expiry Date": Monday morning, the
// intranet greets every station with a browser warning. Its certificate,
// signed in 2028 by the federation's own authority, expired last night: 825
// days, the CN only. You look at what the server presents (openssl
// s_client, x509 -dates, -checkend), read Kwame's notes and the federation's
// policy, and renew it from the internal CA: a key (the old one or a new
// one), a request, a certificate signed with the root (x509 -req -CA
// -CAkey) with the two names in subjectAltName and a year's validity;
// nginx reloaded, curl --cacert checks it. On the way: the CA's private key
// was readable by every account on the server.
// Objective checked on the state: nginx serves for both names a
// certificate issued by Airwaves Root CA, valid now, whose subjectAltName
// covers intranet and board, not a CA, valid at most 398 days; the CA key
// still there, readable by root only.
// Several ways: a new key or the old one; -extfile or -copy_extensions
// copy with req -addext; any file name, as long as nginx points to it.
// False leads: curl -k (hides the problem), a self-signed certificate (req
// -x509), a certificate without subjectAltName (x509 -req drops the
// request's extensions by default), -days 825 or more (the policy), the
// 30 days of x509's default, a new certificate on disk but nginx not
// reloaded, a key that doesn't match (nginx refuses to load).
// Sources: https://docs.openssl.org/3.0/man1/openssl-x509/, https://docs.openssl.org/3.0/man1/openssl-req/,
// https://www.rfc-editor.org/rfc/rfc5280#section-4.2.1.6 (subjectAltName),
// https://chromestatus.com/feature/4981025180483584 (Chrome ignores the CN since version 58),
// https://cabforum.org/working-groups/server/baseline-requirements/ (398 days, for public certificates).

import type { Chapter } from '../world';
import type { Game } from '../shell';
import { f } from '../world';
import { readKey } from '../pki';
import { read } from '../tls';
import { BOARD, DAY, HOME, INTRANET, INTRANET_OLD, KEYS, PASSWORD, ROOT, issuedBy, mastAccounts, mastState, mastWorld, nginxRunning, nowUtc, passTime, readableBy, seen, selfSigned, servedChain, typed } from './airwaves';

const CA_KEY = '/srv/ca/private/ca.key';
const leaf = (j: Game, name = INTRANET) => servedChain(j, name)[0];
const fresh = (j: Game) => {
  const c = leaf(j);
  return !!c && c.serial !== INTRANET_OLD.serial;
};
// What the policy asks of a server certificate.
const signedByRoot = (j: Game) => {
  const c = leaf(j);
  return !!c && issuedBy(c, ROOT);
};
const valid = (j: Game) => {
  const c = leaf(j);
  const now = nowUtc(j as never);
  return !!c && c.start <= now && now <= c.end;
};
const sanOk = (j: Game) => {
  const c = leaf(j);
  return !!c && !!c.san && c.names.includes(INTRANET) && c.names.includes(BOARD);
};
const lifetime = (j: Game) => {
  const c = leaf(j);
  return c ? (c.end - c.start) / DAY : 0;
};
const notCa = (j: Game) => !leaf(j)?.ca;
const renewed = (j: Game) => fresh(j) && signedByRoot(j) && valid(j) && sanOk(j) && notCa(j) && lifetime(j) <= 398;
const keyThere = (j: Game) => readKey(j.read(CA_KEY))?.id === KEYS.root.id;
const keyProtected = (j: Game) => keyThere(j) && !readableBy(j, CA_KEY, 'you');
// A good certificate on disk, where nginx's configuration points, not served yet.
const onDiskNotServed = (j: Game) => {
  const c = read(j.read('/etc/nginx/ssl/intranet.crt'));
  return !!c && c.serial !== INTRANET_OLD.serial && c.serial !== leaf(j)?.serial;
};

export const expiryDate: Chapter = {
  id: 'expiry-date',
  number: 1,
  commands: ['ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'echo', 'tee', 'nano', 'cp', 'mv', 'rm', 'mkdir', 'chmod', 'chown', 'sudo', 'systemctl', 'journalctl', 'nginx', 'curl', 'openssl', 'sha256sum', 'exit'],
  home: HOME,
  welcome: 'message_from_adaeze.txt',
  names: true,
  final: 'end',
  steps: ['expired', 'cn-only', 'readme', 'key-open', 'key-closed', 'renewed', 'end'],
  password: PASSWORD,
  accounts: mastAccounts,
  state: () => mastState(1),
  initialise: (j) => {
    const s = j.state.systemd;
    s.services.nginx.load?.(j);
  },
  createWorld: (t) => mastWorld(t, 1, { 'message_from_adaeze.txt': f(t('expiry-date-message-adaeze')) }),
  afterCommand: (j) => passTime(j, 1),
  events: [
    {
      id: 'expired',
      condition: (j) => seen(j, 'certificate has expired') || seen(j, 'Certificate will expire') || seen(j, 'notAfter=Mar  3 22:59:59 2030 GMT'),
      message: (j) => j.t('expiry-date-event-expired'),
    },
    { id: 'cn-only', condition: (j) => seen(j, `Subject: CN=${INTRANET}`) && !seen(j, 'Subject Alternative Name') && seen(j, 'Not After : Mar  3'), message: (j) => j.t('expiry-date-event-cn-only') },
    { id: 'readme', condition: (j) => seen(j, 'openssl x509 -req -in intranet.csr'), message: (j) => j.t('expiry-date-event-readme') },
    { id: 'key-open', condition: (j) => seen(j, /-rw-r--r-- +\d+ root +root +\d+ .* ca\.key/), message: (j) => j.t('expiry-date-event-key-open') },
    { id: 'key-gone', condition: (j) => !keyThere(j), message: (j) => j.t('expiry-date-event-key-gone') },
    { id: 'key-closed', condition: keyProtected, message: (j) => j.t('expiry-date-event-key-closed') },
    { id: 'insecure', condition: (j) => /\bcurl\b.*(\s-k\b|\s-\w*k\w*\b|--insecure)/.test(typed(j)) && /intranet|board/.test(typed(j)), message: (j) => j.t('expiry-date-event-insecure') },
    { id: 'mismatch', condition: (j) => seen(j, 'key values mismatch'), message: (j) => j.t('expiry-date-event-mismatch') },
    { id: 'self-signed', condition: (j) => fresh(j) && selfSigned(leaf(j)!), message: (j) => j.t('expiry-date-event-self-signed') },
    { id: 'no-san', condition: (j) => fresh(j) && signedByRoot(j) && !leaf(j)!.san, message: (j) => j.t('expiry-date-event-no-san') },
    { id: 'one-name', condition: (j) => fresh(j) && signedByRoot(j) && !!leaf(j)!.san && !sanOk(j), message: (j) => j.t('expiry-date-event-one-name') },
    { id: 'too-long', condition: (j) => fresh(j) && signedByRoot(j) && lifetime(j) > 398, message: (j) => j.t('expiry-date-event-too-long', { days: String(Math.round(lifetime(j))) }) },
    { id: 'short', condition: (j) => fresh(j) && signedByRoot(j) && lifetime(j) <= 31, message: (j) => j.t('expiry-date-event-short') },
    { id: 'ca-leaf', condition: (j) => fresh(j) && signedByRoot(j) && !notCa(j), message: (j) => j.t('expiry-date-event-ca-leaf') },
    { id: 'not-reloaded', condition: onDiskNotServed, message: (j) => j.t('expiry-date-event-not-reloaded') },
    { id: 'renewed', condition: renewed, message: (j) => j.t('expiry-date-event-renewed') },
    { id: 'end', condition: (j) => nginxRunning(j) && renewed(j) && keyProtected(j), message: (j) => j.t('expiry-date-event-end') },
  ],
};
