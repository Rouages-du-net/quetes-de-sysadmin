// Story "The Airwaves", chapter "The Chain of Trust": a week ago Kwame set
// up an issuing CA under the root (the root's key can now stay offline)
// and signed the archive's certificate with it. Mateo's monitoring on mast
// has been red since he wrote it, and the new studio PC at Riverside,
// booth (an internal host), refuses both sites. Two causes, both in the
// trust: neither machine trusts the federation's root (Kwame installed it
// by hand on the stations' PCs, never on mast nor booth), and the archive
// sends its certificate alone, without the intermediate that links it to
// the root (Firefox at the studios remembers intermediates it has seen;
// curl and a fresh machine don't). You install the root's certificate in
// both trust stores (/usr/local/share/ca-certificates, *.crt,
// update-ca-certificates), and make nginx send the chain (leaf, then the
// issuing CA).
// Objective checked on the state: mast's and booth's stores hold the root;
// archive's chain leads to the root with what the server sends; both sites
// verify from both machines; the monitoring script without -k; no CA key
// on booth.
// False leads: copying the CA's key to booth, curl -k in the monitoring, a
// .pem file in /usr/local/share/ca-certificates (ignored), trusting the
// intermediate on clients instead of serving it, the root in the served
// chain (accepted: useless but harmless).
// Sources: https://manpages.debian.org/trixie/ca-certificates/update-ca-certificates.8.en.html,
// https://nginx.org/en/docs/http/configuring_https_servers.html#chains,
// https://docs.openssl.org/3.0/man1/openssl-verify/, https://docs.openssl.org/3.0/man1/openssl-s_client/

import type { Chapter } from '../world';
import type { Game, Shell } from '../shell';
import { f } from '../world';
import { servedOk } from '../commands/openssl';
import { ARCHIVE, HOME, INTRANET, ISSUING, LOCAL_CAS, PASSWORD, ROOT, booth, boothHost, caKeyFiles, chainComplete, mastAccounts, mastState, mastWorld, nowUtc, passTime, seen, servedChain, storeHas } from './airwaves';

export const BOOTH_COMMANDS = ['ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'cp', 'mv', 'rm', 'nano', 'sudo', 'curl', 'wget', 'openssl', 'update-ca-certificates', 'exit'];

const shell = (j: Game) => (j as Shell).principal;
const mastTrusts = (j: Game) => storeHas(shell(j), ROOT);
const boothTrusts = (j: Game) => storeHas(booth(j), ROOT);
const chain = (j: Game) => servedChain(j, ARCHIVE);
const complete = (j: Game) => chainComplete(chain(j), nowUtc(shell(j)));
const insecureScript = (j: Game) => /(^|\s)(-\w*k\w*|--insecure)(\s|$)/m.test((shell(j).read('/usr/local/bin/check-sites') ?? '').split('\n').filter((l) => /curl/.test(l) && !l.trim().startsWith('#')).join('\n'));
const allOk = (s: Shell | null) => !!s && servedOk(s, INTRANET).ok && servedOk(s, ARCHIVE).ok;
const leakedOnBooth = (j: Game) => caKeyFiles(booth(j)).length > 0;
const pemIgnored = (j: Game) => (j as Shell).principal && [shell(j), booth(j)].some((s) => !!s && Object.keys((s.find(LOCAL_CAS) as { children?: Record<string, unknown> } | null)?.children ?? {}).some((n) => n.endsWith('.pem')) && !storeHas(s, ROOT));

export const chainOfTrust: Chapter = {
  id: 'chain-of-trust',
  number: 2,
  commands: ['ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'echo', 'tee', 'nano', 'cp', 'mv', 'rm', 'chmod', 'sudo', 'systemctl', 'journalctl', 'crontab', 'sh', 'sed', 'date', 'nginx', 'curl', 'wget', 'openssl', 'update-ca-certificates', 'ssh', 'scp', 'exit'],
  home: HOME,
  welcome: 'message_from_adaeze.txt',
  names: true,
  final: 'end',
  steps: ['red', 'mast-trusts', 'still-red', 'chain', 'booth', 'end'],
  password: PASSWORD,
  accounts: mastAccounts,
  state: () => mastState(2),
  initialise: (j) => j.state.systemd.services.nginx.load?.(j),
  hosts: { booth: boothHost(BOOTH_COMMANDS) },
  createWorld: (t) => mastWorld(t, 2, { 'message_from_adaeze.txt': f(t('chain-of-trust-message-adaeze')) }),
  afterCommand: (j) => passTime(j, 2),
  events: [
    { id: 'red', condition: (j) => seen(j, `FAIL ${ARCHIVE}`) || seen(j, 'unable to get local issuer certificate'), message: (j) => j.t('chain-of-trust-event-red') },
    { id: 'insecure', condition: insecureScript, message: (j) => j.t('chain-of-trust-event-insecure') },
    { id: 'pem-ignored', condition: pemIgnored, message: (j) => j.t('chain-of-trust-event-pem-ignored') },
    { id: 'key-on-booth', condition: leakedOnBooth, message: (j) => j.t('chain-of-trust-event-key-on-booth') },
    { id: 'mast-trusts', condition: mastTrusts, message: (j) => j.t('chain-of-trust-event-mast-trusts') },
    { id: 'still-red', condition: (j) => mastTrusts(j) && (seen(j, 'unable to get local issuer certificate') || seen(j, 'unable to verify the first certificate') || seen(j, `FAIL ${ARCHIVE}`)), message: (j) => j.t('chain-of-trust-event-still-red') },
    { id: 'intermediate-trusted', condition: (j) => [shell(j), booth(j)].some((s) => storeHas(s, ISSUING)) && !complete(j), message: (j) => j.t('chain-of-trust-event-intermediate-trusted') },
    { id: 'root-served', condition: (j) => complete(j) && chain(j).some((c) => c.key?.id === ROOT.key!.id), message: (j) => j.t('chain-of-trust-event-root-served') },
    { id: 'chain', condition: complete, message: (j) => j.t('chain-of-trust-event-chain') },
    { id: 'booth', condition: (j) => boothTrusts(j) && !leakedOnBooth(j), message: (j) => j.t('chain-of-trust-event-booth') },
    {
      id: 'end',
      condition: (j) => mastTrusts(j) && boothTrusts(j) && complete(j) && allOk(shell(j)) && allOk(booth(j)) && !insecureScript(j) && !leakedOnBooth(j),
      message: (j) => j.t('chain-of-trust-event-end'),
    },
  ],
};
