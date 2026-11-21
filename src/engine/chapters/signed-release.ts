// Story "The Tool Library", chapter "Signed and Sealed": release 2.4.0
// is due, and Aroha, who runs Lendshed for a tool library in Wellington,
// writes that a "lendshed-2.3.1.tar.gz" circulates on a forum, with a
// checksum next to it, and that nothing tells her which releases really
// come from the maintainers. You make the project's work verifiable: your
// commits signed with your SSH key (gpg.format ssh, user.signingKey,
// commit.gpgsign), an allowed_signers file in the repository with the
// maintainers' keys (gpg.ssh.allowedSignersFile to check), the forge
// requiring signed commits on main (require_signed_commits: Forgejo checks
// them against its accounts' keys), the release tag signed (git tag -s),
// the tarball made from it (git archive), its checksums signed
// (sha256sum, then ssh-keygen -Y sign -n file), and you check the release
// as Aroha will: sha256sum -c, then ssh-keygen -Y verify.
// Objective checked on the state: main's head on the forge is verified and
// holds an allowed_signers file with your key; protection requires signed
// commits; the tag v2.4.0 on the forge is annotated, signed with your key,
// on main; in /srv/www/downloads the tarball of v2.4.0, SHA256SUMS that
// matches it, and SHA256SUMS.sig, a valid "file" signature of it by your
// key; and the downstream check was run (its two good answers seen).
// False leads: signing with the old key from your previous laptop (not
// in allowed_signers, unknown to the forge: refused), an unsigned push once
// main requires signatures, a lightweight tag (nothing to verify), checksums
// without a signature (whoever replaces the tarball replaces its checksum).
// Sources: https://git-scm.com/docs/git-config#Documentation/git-config.txt-gpgformat,
// https://git-scm.com/book/en/v2/Git-Tools-Signing-Your-Work, https://man.openbsd.org/ssh-keygen#ALLOWED_SIGNERS,
// https://forgejo.org/docs/latest/user/protection/#protected-branches (require signed commits),
// https://slsa.dev/spec/v1.0/threats, https://openssf.org/.

import type { Chapter } from '../world';
import type { Game, Shell } from '../shell';
import { allCommits, configValue, lineage, type Repo } from '../commands/git';
import { readSignature, digestText, principalsFor } from '../sshsig';
import { unpack } from '../compression';
import { digestOf } from '../commands/checksums';
import { DOWNLOADS, HOME, KEYS, PASSWORD, TARBALL, VERSION, anvilAccounts, anvilState, anvilWorld, bare, bareKey, fs, initialiseAnvil, mainHead, myEmail, passTime, protectionFor, repo, seen, verified } from './tool-library';
import { path } from '../world';

const mine = bareKey(KEYS.you.isPublic);
const old = bareKey(KEYS.old.isPublic);
const work = (j: Game) => (j as Shell).state.git?.[path(j.t, `${HOME}/lendshed`)] as Repo | undefined;
const local = (j: Game) => work(j)?.commits.at(-1);
const signingSet = (j: Game) => {
  const p = path(j.t, `${HOME}/lendshed`);
  return (configValue(j as Shell, 'gpg.format', p) ?? '').toLowerCase() === 'ssh' && !!configValue(j as Shell, 'user.signingkey', p);
};
const allowedFile = (j: Game) => {
  const file = configValue(j as Shell, 'gpg.ssh.allowedsignersfile', path(j.t, `${HOME}/lendshed`));
  const text = file ? j.read(file.replace(/^~(?=\/)/, (j as Shell).resolve('~'))) : null;
  return !!text && principalsFor(text, mine, 'git').length > 0;
};
const headSignedWith = (j: Game, key: string) => bareKey(local(j)?.signature?.key ?? '') === key;
const inRepo = (j: Game) => {
  const h = mainHead(j);
  return !!h && Object.entries(h.files).some(([n, text]) => /(^|\/)allowed_signers$/.test(n) && principalsFor(text, mine, 'git').includes(myEmail(j)));
};
const requireSigned = (j: Game) => !!protectionFor(repo(j), 'main')?.requireSigned;
const pushedSigned = (j: Game) => {
  const h = mainHead(j);
  return !!h && h.id !== j.state.startHead && !!verified(fs(j), h) && inRepo(j);
};
const remoteTag = (j: Game) => bare(j).tags?.[`v${VERSION}`];
const tagOk = (j: Game) => {
  const t = remoteTag(j);
  const b = bare(j);
  return !!t && t.annotated && bareKey(t.signature?.key ?? '') === mine && lineage(b, b.commits.at(-1)!).some((c) => c.id === t.commit);
};
const tarball = (j: Game) => j.find(`${DOWNLOADS}/${TARBALL}`);
const tarballOk = (j: Game) => {
  const n = tarball(j);
  const t = remoteTag(j);
  if (n?.type !== 'file' || !t || !n.archive) return false;
  const u = unpack(typeof n.content === 'string' ? n.content : '');
  return !!u && u.text.includes(`commit ${t.commit}`) && u.text.startsWith(`lendshed-${VERSION}/`);
};
const sumsText = (j: Game) => j.read(`${DOWNLOADS}/SHA256SUMS`);
const sumsOk = (j: Game) => {
  const n = tarball(j);
  const text = sumsText(j);
  if (n?.type !== 'file' || !text) return false;
  const sum = digestOf(j as Shell, n);
  return text.split('\n').some((l) => l.trim() === `${sum}  ${TARBALL}` || l.trim() === `${sum} *${TARBALL}`);
};
const sigOk = (j: Game) => {
  const s = readSignature(j.read(`${DOWNLOADS}/SHA256SUMS.sig`));
  const text = sumsText(j);
  return !!s && text !== null && s.namespace === 'file' && bareKey(s.key) === mine && s.digest === digestText(text);
};
const released = (j: Game) => tagOk(j) && tarballOk(j) && sumsOk(j) && sigOk(j);
const checked = (j: Game) => !!j.flags.has('sum-checked') && !!j.flags.has('sig-checked');
const oldSigned = (j: Game) => !!work(j) && allCommits(work(j)!).some((c) => bareKey(c.signature?.key ?? '') === old);
const lightweight = (j: Game) => [work(j)?.tags?.[`v${VERSION}`], remoteTag(j)].some((t) => !!t && !t.annotated);

export const signedRelease: Chapter = {
  id: 'signed-release',
  number: 3,
  commands: ['ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'echo', 'nano', 'sudo', 'git', 'curl', 'jq', 'ssh-keygen', 'sha256sum', 'tar', 'cp', 'mv', 'rm', 'mkdir', 'tee', 'exit'],
  home: HOME,
  welcome: 'message_from_aroha.txt',
  names: true,
  final: 'end',
  steps: ['signing', 'signed-commit', 'allowed', 'verified', 'require', 'pushed', 'tag', 'tarball', 'sums', 'sig', 'sum-checked', 'sig-checked', 'end'],
  password: PASSWORD,
  accounts: anvilAccounts,
  state: (t) => anvilState(t, 3),
  initialise: initialiseAnvil,
  createWorld: (t) =>
    anvilWorld(t, 3, {
      'message_from_aroha.txt': t('signed-release-message-aroha'),
      'note_from_wanjiru.txt': t('signed-release-note-wanjiru'),
    }),
  afterCommand: passTime,
  events: [
    { id: 'signing', condition: signingSet, message: (j) => j.t('signed-release-event-signing') },
    { id: 'old-key', condition: oldSigned, message: (j) => j.t('signed-release-event-old-key') },
    { id: 'signed-commit', condition: (j) => headSignedWith(j, mine), message: (j) => j.t('signed-release-event-signed-commit') },
    { id: 'no-allowed', condition: (j) => seen(j, 'gpg.ssh.allowedSignersFile needs to be configured'), message: (j) => j.t('signed-release-event-no-allowed') },
    { id: 'allowed', condition: allowedFile, message: (j) => j.t('signed-release-event-allowed') },
    { id: 'verified', condition: (j) => seen(j, `Good "git" signature for ${myEmail(j)}`), message: (j) => j.t('signed-release-event-verified') },
    { id: 'require', condition: requireSigned, message: (j) => j.t('signed-release-event-require') },
    { id: 'unsigned-refused', condition: (j) => fs(j).rejections.some((r) => r.kind === 'unsigned'), message: (j) => j.t('signed-release-event-unsigned-refused') },
    { id: 'not-in-repo', condition: (j) => !!mainHead(j) && mainHead(j)!.id !== j.state.startHead && !!verified(fs(j), mainHead(j)!) && !inRepo(j), message: (j) => j.t('signed-release-event-not-in-repo') },
    { id: 'pushed', condition: pushedSigned, message: (j) => j.t('signed-release-event-pushed') },
    { id: 'lightweight', condition: lightweight, message: (j) => j.t('signed-release-event-lightweight') },
    { id: 'tag', condition: tagOk, message: (j) => j.t('signed-release-event-tag') },
    { id: 'tarball', condition: tarballOk, message: (j) => j.t('signed-release-event-tarball') },
    { id: 'sums', condition: sumsOk, message: (j) => j.t('signed-release-event-sums') },
    { id: 'sum-checked', condition: (j) => sumsOk(j) && seen(j, `${TARBALL}: OK`), message: (j) => j.t(sigOk(j) ? 'signed-release-event-sum-checked' : 'signed-release-event-sum-only') },
    { id: 'sig', condition: sigOk, message: (j) => j.t('signed-release-event-sig') },
    { id: 'sig-checked', condition: (j) => sigOk(j) && seen(j, `Good "file" signature for ${myEmail(j)}`), message: (j) => j.t('signed-release-event-sig-checked') },
    { id: 'end', condition: (j) => pushedSigned(j) && requireSigned(j) && released(j) && checked(j), message: (j) => j.t('signed-release-event-end') },
  ],
};
