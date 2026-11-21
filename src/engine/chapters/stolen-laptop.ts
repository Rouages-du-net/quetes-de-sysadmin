// Story "The Airwaves", chapter "The Stolen Laptop": Lindiwe's laptop was
// stolen from her car after a festival; on it, the client certificate
// (and its key) that lets the contribution portal accept her recordings.
// Someone has been connecting with it since the night. You find the
// connections in nginx's access log, revoke the certificate in the issuing
// CA's database (openssl ca -revoke, -crl_reason keyCompromise), write the
// revocation list (-gencrl), give nginx the CRLs (ssl_crl: with OpenSSL's
// CRL check of the whole chain, the root's CRL too) and reload it; the
// stolen certificate is refused, Amina's still accepted. Then a watch, so
// that no certificate expires by surprise again: a script that runs
// openssl x509 -checkend over every certificate the CA issued, from a
// timer or cron, which speaks only when one expires within 30 days.
// Objective checked on the state: certificate 1003 revoked in index.txt;
// nginx (loaded) refuses Lindiwe's certificate and accepts Amina's; a cron
// job or an active timer whose run reports the streaming certificate
// (expiring in 20 days) and not the healthy ones.
// False leads: deleting the certificate's file (it doesn't revoke it: the
// thief has a copy), revoking without writing the CRL, a CRL nginx hasn't
// loaded, a CRL of the issuing CA alone (every client refused: "unable to
// get certificate CRL"), creating a whole new CA.
// Sources: https://docs.openssl.org/3.0/man1/openssl-ca/ (-revoke, -gencrl),
// https://docs.openssl.org/3.0/man1/openssl-crl/, https://nginx.org/en/docs/http/ngx_http_ssl_module.html#ssl_crl,
// https://www.rfc-editor.org/rfc/rfc5280#section-5 (CRL),
// https://docs.openssl.org/3.0/man1/openssl-x509/ (-checkend).

import type { Chapter } from '../world';
import type { Game, Shell } from '../shell';
import { f } from '../world';
import { parse } from '../cron';
import type { Configuration } from '../nginx';
import { readCrls } from '../pki';
import { readAll } from '../tls';
import { CONTRIB, HOME, KEYS, PASSWORD, ROOT, THIEF, caIndex, crlsOn, filesOf, laptopAnswer, mastAccounts, mastState, mastWorld, passTime, sd, seen, selfSigned } from './airwaves';

const LINDIWE = '1003';
const revoked = (j: Game) => caIndex(j).some((e) => e.serial === LINDIWE && e.status === 'R');
const crlWritten = (j: Game) => crlsOn(j).some(({ crl }) => crl.signer === KEYS.issuing.id && crl.revoked.some((r) => r.serial === LINDIWE));
const loadedContrib = (j: Game) => ((j.state.nginx?.load ?? null) as Configuration | null)?.servers.find((s) => s.names.includes(CONTRIB) && s.ssl.length);
const loadedCrls = (j: Game) => readCrls(loadedContrib(j)?.crl ?? null);
const thiefRefused = (j: Game) => laptopAnswer(j, 'lindiwe', false, THIEF) === 400;
const aminaOk = (j: Game) => laptopAnswer(j, 'amina') === 200;
const deleted = (j: Game) => !j.find('/srv/ca/issuing/newcerts/1003.pem') && !revoked(j);
const newCa = (j: Game) =>
  filesOf(j, '/srv')
    .concat(filesOf(j, '/root'), filesOf(j, '/home'))
    .some(([, c]) => readAll(c).some((x) => x.ca && selfSigned(x) && x.key?.id !== ROOT.key!.id));

// ——— The expiry watch: the jobs that run on their own, and what a run of them says ———

interface Job {
  account: string;
  command: string;
}

function jobs(j: Game): Job[] {
  const out: Job[] = [];
  for (const [account, text] of Object.entries((j.state.crontabs ?? {}) as Record<string, string>)) for (const t of parse(text, '').tasks) out.push({ account, command: t.command });
  const s = sd(j);
  for (const m of Object.values(s.timers ?? {})) {
    if (m.state !== 'active') continue;
    const service = s.services[m.unit];
    const unit = service?.file ? (j.read(service.file) ?? '') : '';
    const exec = /^ExecStart=[-@+!:]*(.+)$/m.exec(unit)?.[1];
    const user = /^User=(\S+)/m.exec(unit)?.[1] ?? 'root';
    if (exec) out.push({ account: user, command: exec.trim() });
  }
  // Mateo's site check is not an expiry watch.
  return out.filter((x) => !/check-sites/.test(x.command));
}

// The healthy certificates (more than 30 days left), by the names a report would use.
const HEALTHY = /archive\.airwaves|contrib\.airwaves|laptop-amina|laptop-ravi|intranet-2030|issuing-ca-1|\b100[0124]\.pem/;
const NAMES = /\S*(stream|archive|contrib|laptop-\w+|intranet-\d+|issuing\S*|\d{4}\.pem)\S*/g;
const norm = (l: string) =>
  l
    .replace(NAMES, '')
    .replace(/[A-Z][a-z]{2}\s+\d+\s[\d:]+\s\d{4}\sGMT/g, '')
    .replace(/\d+/g, '')
    .replace(/\s+/g, ' ')
    .trim();

export type Watch = 'none' | 'quiet' | 'noisy' | 'ok';

/** Runs the jobs once (as cron or the timer would) and reads what they reported: their output, the journal, the files they wrote. */
export function expiryWatch(j: Game): Watch {
  const list = jobs(j);
  if (!list.length) return 'none';
  const shell = j as Shell;
  const referenced = list.flatMap((x) => x.command.match(/\/[\w./-]+/g) ?? []).map((p) => `${p}=${shell.read(p) ?? ''}`);
  const key = JSON.stringify([list, referenced]);
  const cache = j.state.expiryWatch as { key: string; result: Watch } | undefined;
  if (cache?.key === key) return cache.result;
  const before = new Map(filesOf(j));
  const s = sd(j);
  const logged = s.log.length;
  const clock = s.clock;
  let text = '';
  for (const job of list) {
    const who = shell.who;
    shell.who = job.account;
    try {
      text += `\n${shell.runTask(job.command)}`;
    } finally {
      shell.who = who;
    }
  }
  for (const [p, c] of filesOf(j)) {
    const old = before.get(p);
    if (old === c) continue;
    text += `\n${old !== undefined && c.startsWith(old) ? c.slice(old.length) : c}`;
  }
  text += `\n${s.log
    .slice(logged)
    .map((e) => e.message)
    .join('\n')}`;
  s.clock = clock;
  const lines = text.split('\n').filter((l) => l.trim());
  const streamLines = lines.filter((l) => /stream/.test(l));
  const healthy = lines.filter((l) => HEALTHY.test(l)).map(norm);
  const result: Watch = !streamLines.length ? 'quiet' : !healthy.length || streamLines.some((l) => !healthy.includes(norm(l))) ? 'ok' : 'noisy';
  j.state.expiryWatch = { key, result };
  return result;
}

export const stolenLaptop: Chapter = {
  id: 'stolen-laptop',
  number: 3,
  commands: ['ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'echo', 'tee', 'nano', 'cp', 'mv', 'rm', 'chmod', 'sudo', 'systemctl', 'journalctl', 'crontab', 'nginx', 'curl', 'openssl', 'logger', 'find', 'date', 'bash', 'sh', 'exit'],
  home: HOME,
  welcome: 'message_from_adaeze.txt',
  names: true,
  final: 'end',
  steps: ['thief', 'revoked', 'crl', 'refused', 'watch', 'end'],
  password: PASSWORD,
  accounts: mastAccounts,
  state: () => mastState(3),
  initialise: (j) => j.state.systemd.services.nginx.load?.(j),
  createWorld: (t) => mastWorld(t, 3, { 'message_from_adaeze.txt': f(t('stolen-laptop-message-adaeze')) }),
  afterCommand: (j) => passTime(j, 3),
  events: [
    { id: 'thief', condition: (j) => seen(j, THIEF), message: (j) => j.t('stolen-laptop-event-thief') },
    { id: 'deleted', condition: deleted, message: (j) => j.t('stolen-laptop-event-deleted') },
    { id: 'new-ca', condition: newCa, message: (j) => j.t('stolen-laptop-event-new-ca') },
    { id: 'revoked', condition: revoked, message: (j) => j.t('stolen-laptop-event-revoked') },
    { id: 'crl', condition: crlWritten, message: (j) => j.t('stolen-laptop-event-crl') },
    { id: 'stale-crl', condition: (j) => loadedCrls(j).some((c) => c.signer === KEYS.issuing.id) && !loadedCrls(j).some((c) => c.revoked.some((r) => r.serial === LINDIWE)), message: (j) => j.t('stolen-laptop-event-stale-crl') },
    { id: 'all-refused', condition: (j) => !!loadedContrib(j)?.crl && !aminaOk(j), message: (j) => j.t('stolen-laptop-event-all-refused') },
    { id: 'not-loaded', condition: (j) => crlWritten(j) && !loadedContrib(j)?.crl && /ssl_crl/.test(j.read('/etc/nginx/sites-enabled/contrib') ?? ''), message: (j) => j.t('stolen-laptop-event-not-loaded') },
    { id: 'refused', condition: (j) => revoked(j) && thiefRefused(j) && aminaOk(j), message: (j) => j.t('stolen-laptop-event-refused') },
    { id: 'watch-quiet', condition: (j) => expiryWatch(j) === 'quiet', message: (j) => j.t('stolen-laptop-event-watch-quiet') },
    { id: 'watch-noisy', condition: (j) => expiryWatch(j) === 'noisy', message: (j) => j.t('stolen-laptop-event-watch-noisy') },
    { id: 'watch', condition: (j) => expiryWatch(j) === 'ok', message: (j) => j.t('stolen-laptop-event-watch') },
    { id: 'end', condition: (j) => revoked(j) && thiefRefused(j) && aminaOk(j) && expiryWatch(j) === 'ok', message: (j) => j.t('stolen-laptop-event-end') },
  ],
};
