// A machine's Forgejo (a self-hosted git forge) and its Actions runner:
// accounts and access tokens, repositories (bare repositories on the
// machine), collaborators, protected branches checked when a push is
// received, Actions secrets, workflows (.forgejo/workflows/*.yml) run by the
// runner on push and pull-request events, commit statuses, pull requests
// from forks; reached through its HTTP API (curl) and its CLI (forgejo
// admin user …, commands/forge.ts).
//
//   state.forge = ForgeState
//
// Sources: https://forgejo.org/docs/latest/user/protection/ (protected
// branches, signed commits), https://forgejo.org/docs/latest/user/actions/
// (workflows, secrets, events, pull_request vs pull_request_target),
// https://forgejo.org/docs/latest/admin/command-line/ (forgejo admin user),
// https://forgejo.org/docs/latest/user/api-usage/ (tokens, Sudo, scopes),
// the API's swagger (https://code.forgejo.org/api/swagger): the JSON shapes
// of User, AccessToken, Repository, BranchProtection, Secret, CommitStatus,
// PullRequest, ActionRun; the pre-receive hook's messages
// (routers/private/hook_pre_receive.go).
// Differences: the API answers what the game's stories need (see the
// table of differences in docs/SCENARIOS.md); a workflow's `run:` lines are
// read by a small interpreter (echo, printf, base64, pip, pytest, mkdocs,
// rsync/ssh to deploy), not run by a shell in a container.

import type { Shell } from './shell';
import type { Commit, GitSignature, Repo, Tag } from './commands/git';
import { readYaml, YamlError, type Value } from './ansible';
import { base64Encode } from './k8s';
import { publicFor } from './access';
import { writeLog } from './systemd';
import { keyFingerprint } from './machines';

export const FORGEJO_VERSION = '11.0.7+gitea-1.22.0';
export const RUNNER_VERSION = 'v11.1.2';

export interface ForgeUser {
  id: number;
  login: string;
  fullName: string;
  email: string;
  admin: boolean;
  active: boolean;
  prohibitLogin: boolean;
  password: string;
  created: number;
  lastLogin: number;
  // SSH public keys (authentication, and checking SSH signatures: verified).
  keys: string[];
  mustChangePassword?: boolean;
}

export interface Token {
  id: number;
  name: string;
  owner: string;
  value: string;
  scopes: string[];
  created: number;
}

export interface Protection {
  rule: string;
  enablePush: boolean;
  enablePushWhitelist: boolean;
  pushWhitelist: string[];
  requiredApprovals: number;
  enableStatusCheck: boolean;
  statusCheckContexts: string[];
  requireSigned: boolean;
  blockOnRejected: boolean;
  dismissStale: boolean;
  applyToAdmins: boolean;
  created: number;
  updated: number;
}

export interface StepLog {
  name: string;
  status: 'success' | 'failure' | 'skipped';
}

export interface Job {
  id: number;
  name: string;
  status: 'success' | 'failure' | 'skipped' | 'waiting';
  log: string[];
  steps: StepLog[];
  // The job received the repository's secrets; it ran the fork's code.
  secrets: boolean;
  forkCode: boolean;
  // What its steps did: deployed (with the key that worked), printed a secret.
  deployed?: string;
  deployFailed?: boolean;
  printed?: boolean;
  tested?: boolean;
}

export interface Run {
  id: number;
  index: number;
  workflow: string;
  name: string;
  title: string;
  event: string;
  ref: string;
  sha: string;
  actor: string;
  status: 'success' | 'failure' | 'waiting';
  created: number;
  jobs: Job[];
  pull?: number;
  invalid?: string;
}

export interface Pull {
  number: number;
  title: string;
  user: string;
  headRepo: string;
  headRef: string;
  head: Commit;
  base: string;
  state: 'open' | 'closed';
  created: number;
}

export interface Status {
  context: string;
  state: 'success' | 'failure' | 'pending';
  description: string;
  targetUrl: string;
  created: number;
}

export interface ForgeRepo {
  id: number;
  owner: string;
  name: string;
  path: string;
  private: boolean;
  description: string;
  fork?: string;
  // Direct collaborators (outside the owning organisation's teams).
  collaborators: Record<string, 'read' | 'write' | 'admin'>;
  // The organisation's team members with write access (maintainers).
  team: string[];
  protections: Protection[];
  secrets: Record<string, { value: string; created: number }>;
  runs: Run[];
  pulls: Pull[];
  statuses: Record<string, Status[]>;
}

export interface Rejection {
  kind: 'force' | 'push' | 'unsigned' | 'permission';
  user: string;
  at: number;
}

export interface ForgeState {
  domain: string;
  users: Record<string, ForgeUser>;
  orgs: string[];
  tokens: Token[];
  repos: Record<string, ForgeRepo>;
  // Who pushes over ssh from this machine (the key in ~/.ssh is theirs).
  pusher: string;
  nextId: number;
  rejections: Rejection[];
  // Users deleted with --purge: their comments now show as Ghost.
  purged: string[];
  // The runner (the forgejo-runner service) takes jobs only while it runs.
  runnerService: string;
  // The deploy target: where `rsync … deploy@HOST:` lands, and its authorized_keys.
  deploy?: { hosts: string[]; user: string; authorizedKeys: string; dir: string; from: string };
}

export const forge = (game: Shell): ForgeState | undefined => game.state.forge;
const clock = (game: Shell): number => game.state.systemd?.clock ?? 0;
const iso = (ms: number) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');
const glob = (pattern: string, value: string) =>
  new RegExp(`^${pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*\*/g, '\u0000').replace(/\*/g, '[^/]*').replace(/\u0000/g, '.*').replace(/\?/g, '.')}$`).test(value);

// ——— Remotes: the forge's URLs lead to its bare repositories ———

/** git@DOMAIN:owner/repo.git, ssh://git@DOMAIN[:22]/owner/repo.git, https://DOMAIN/owner/repo(.git). */
export function forgeRemote(game: Shell, url: string): { path: string; key: string } | null {
  const f = forge(game);
  if (!f) return null;
  const d = f.domain.replace(/\./g, '\\.');
  const m =
    new RegExp(`^(?:[\\w.-]+@)?${d}:/?([\\w.-]+)/([\\w.-]+?)(?:\\.git)?/?$`).exec(url) ??
    new RegExp(`^(?:ssh|https?)://(?:[^@/]+@)?${d}(?::\\d+)?/([\\w.-]+)/([\\w.-]+?)(?:\\.git)?/?$`).exec(url);
  if (!m) return null;
  const key = `${m[1]}/${m[2]}`.toLowerCase();
  const r = f.repos[key];
  return r ? { path: r.path, key } : null;
}

// ——— Access ———

export function permission(f: ForgeState, r: ForgeRepo, login: string | null): 'none' | 'read' | 'write' | 'admin' | 'owner' {
  if (!login) return r.private ? 'none' : 'read';
  const u = f.users[login];
  if (!u || u.prohibitLogin || !u.active) return r.private ? 'none' : 'read';
  if (u.admin) return 'admin';
  if (r.owner === login) return 'owner';
  if (r.team.includes(login)) return 'write';
  return r.collaborators[login] ?? (r.private ? 'none' : 'read');
}
const canWrite = (p: string) => ['write', 'admin', 'owner'].includes(p);

/** The protection rule for a branch: an exact name first, then the first matching pattern. */
export function protectionFor(r: ForgeRepo, branch: string): Protection | null {
  return r.protections.find((p) => p.rule === branch) ?? r.protections.find((p) => glob(p.rule, branch)) ?? null;
}

/** Is a commit verified: signed by a key of a forge account whose address is the committer's? */
export function verified(f: ForgeState, c: Commit): ForgeUser | null {
  const email = /<([^>]*)>/.exec(c.author)?.[1]?.toLowerCase();
  if (!c.signature || !email) return null;
  return Object.values(f.users).find((u) => u.email.toLowerCase() === email && u.keys.some((k) => bareKey(k) === bareKey(c.signature!.key))) ?? null;
}
const bareKey = (k: string) => k.trim().split(/\s+/).slice(0, 2).join(' ');

export interface RefUpdate {
  ref: string;
  before: Commit | null;
  after: Commit;
  forced: boolean;
  tag?: Tag;
  commits: Commit[];
}

/** Forgejo's pre-receive hook: who may push, protected branches. Returns the refusal (lines after "remote: "), or null. */
export function forgeReceive(game: Shell, key: string, updates: RefUpdate[], pusher = forge(game)?.pusher ?? 'you'): string[] | null {
  const f = forge(game)!;
  const r = f.repos[key];
  const u = f.users[pusher];
  const refuse = (kind: Rejection['kind'], message: string) => {
    f.rejections.push({ kind, user: pusher, at: clock(game) });
    return [`Forgejo: ${message}`];
  };
  if (!u || u.prohibitLogin || !u.active) return refuse('permission', 'Your account is disabled.');
  if (!canWrite(permission(f, r, pusher))) return refuse('permission', 'User permission denied for writing.');
  for (const up of updates) {
    if (!up.ref.startsWith('refs/heads/')) continue;
    const branch = up.ref.slice(11);
    const p = protectionFor(r, branch);
    if (!p) continue;
    if (up.forced) return refuse('force', `branch ${branch} is protected from force push`);
    const mayPush = p.enablePush && (!p.enablePushWhitelist || p.pushWhitelist.includes(pusher));
    if (!mayPush) return refuse('push', `Not allowed to push to protected branch ${branch}`);
    if (p.requireSigned) {
      const bad = up.commits.find((c) => !verified(f, c));
      if (bad) return refuse('unsigned', `branch ${branch} is protected from unverified commit ${bad.id}`);
    }
  }
  return null;
}

/** After a push the forge accepted: the workflows of a push to a branch run. */
export function forgeReceived(game: Shell, key: string, updates: RefUpdate[], pusher = forge(game)?.pusher ?? 'you'): string[] {
  for (const up of updates)
    if (up.ref.startsWith('refs/heads/')) runWorkflows(game, key, { name: 'push', ref: up.ref, sha: up.after.id, actor: pusher, commit: up.after });
    else if (up.ref.startsWith('refs/tags/')) runWorkflows(game, key, { name: 'push', ref: up.ref, sha: up.after.id, actor: pusher, commit: up.after });
  return [];
}

// ——— Workflows ———

export interface WorkflowEvent {
  name: 'push' | 'pull_request' | 'pull_request_target' | 'workflow_dispatch';
  ref: string;
  sha: string;
  actor: string;
  // The commit whose workflows are read (pull_request_target: the base branch's).
  commit: Commit;
  pull?: Pull;
}

const asList = (v: Value | undefined): string[] => (v === undefined || v === '' ? [] : Array.isArray(v) ? v.map(String) : [String(v)]);
const asMap = (v: Value | undefined): Record<string, Value> => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});

/** Does a workflow's `on:` take this event? */
function triggered(on: Value, ev: WorkflowEvent, branch: string): boolean {
  if (typeof on === 'string') return on === ev.name;
  if (Array.isArray(on)) return on.map(String).includes(ev.name);
  const m = asMap(on);
  if (!(ev.name in m)) return false;
  const filter = asMap(m[ev.name]);
  const isTag = ev.ref.startsWith('refs/tags/');
  if (ev.name === 'push') {
    const name = isTag ? ev.ref.slice(10) : branch;
    const wanted = asList(filter[isTag ? 'tags' : 'branches']);
    const other = asList(filter[isTag ? 'branches' : 'tags']);
    if (!wanted.length && other.length) return false;
    return !wanted.length || wanted.some((p) => glob(p, name));
  }
  const wanted = asList(filter.branches);
  return !wanted.length || wanted.some((p) => glob(p, ev.pull?.base ?? branch));
}

// ${{ … }} expressions (https://forgejo.org/docs/latest/user/actions/reference/#expressions):
// contexts github, secrets, env; ==, !=, &&, ||, !, (), strings, true/false;
// startsWith(), contains(); success(), always().
type Ctx = { github: Record<string, unknown>; secrets: Record<string, string>; env: Record<string, string> };
function lookup(ctx: Ctx, path: string): unknown {
  let v: unknown = ctx as unknown;
  for (const part of path.split('.')) v = v && typeof v === 'object' ? (v as Record<string, unknown>)[part] : undefined;
  return v;
}
export function evaluate(expr: string, ctx: Ctx): unknown {
  const tokens = expr.match(/'(?:[^']|'')*'|==|!=|&&|\|\||[()!,]|[\w.-]+/g) ?? [];
  let i = 0;
  const primary = (): unknown => {
    const t = tokens[i++];
    if (t === undefined) return '';
    if (t === '(') {
      const v = or();
      i++;
      return v;
    }
    if (t === '!') return !truthy(primary());
    if (t.startsWith("'")) return t.slice(1, -1).replace(/''/g, "'");
    if (t === 'true') return true;
    if (t === 'false') return false;
    if (t === 'null') return null;
    if (/^\d+$/.test(t)) return Number(t);
    if (tokens[i] === '(') {
      i++;
      const a: unknown[] = [];
      while (tokens[i] !== ')' && i < tokens.length) {
        a.push(or());
        if (tokens[i] === ',') i++;
      }
      i++;
      const fn = t.toLowerCase();
      if (fn === 'startswith') return String(a[0] ?? '').toLowerCase().startsWith(String(a[1] ?? '').toLowerCase());
      if (fn === 'contains') return String(a[0] ?? '').toLowerCase().includes(String(a[1] ?? '').toLowerCase());
      if (fn === 'success' || fn === 'always') return true;
      if (fn === 'failure' || fn === 'cancelled') return false;
      return '';
    }
    return lookup(ctx, t) ?? '';
  };
  const equality = (): unknown => {
    let v = primary();
    while (tokens[i] === '==' || tokens[i] === '!=') {
      const op = tokens[i++];
      const w = primary();
      const same = String(v ?? '').toLowerCase() === String(w ?? '').toLowerCase();
      v = op === '==' ? same : !same;
    }
    return v;
  };
  const and = (): unknown => {
    let v = equality();
    while (tokens[i] === '&&') {
      i++;
      const w = equality();
      v = truthy(v) ? w : v;
    }
    return v;
  };
  const or = (): unknown => {
    let v = and();
    while (tokens[i] === '||') {
      i++;
      const w = and();
      v = truthy(v) ? v : w;
    }
    return v;
  };
  return or();
}
const truthy = (v: unknown) => v !== '' && v !== false && v !== null && v !== undefined && v !== 0;
const substitute = (text: string, ctx: Ctx) => text.replace(/\$\{\{\s*([\s\S]*?)\s*\}\}/g, (_, e: string) => String(evaluate(e, ctx) ?? ''));

/** The workflow files of a commit: .forgejo/workflows/*.yml. */
export const workflowFiles = (c: Commit) => Object.keys(c.files).filter((n) => /^\.forgejo\/workflows\/[^/]+\.ya?ml$/.test(n)).sort();

/** Runs the workflows an event triggers; returns the new runs. */
export function runWorkflows(game: Shell, key: string, ev: WorkflowEvent): Run[] {
  const f = forge(game)!;
  const r = f.repos[key];
  const branch = ev.ref.replace(/^refs\/heads\//, '');
  const out: Run[] = [];
  const fork = !!ev.pull && ev.pull.headRepo.toLowerCase() !== key;
  const runner = game.state.systemd?.services?.[f.runnerService];
  const online = !runner || runner.state === 'active';
  for (const file of workflowFiles(ev.commit)) {
    let doc: Value;
    const index = (r.runs.at(-1)?.index ?? 0) + 1;
    const base = { id: f.nextId++, index, workflow: file.split('/').at(-1)!, event: ev.name, ref: ev.ref, sha: ev.sha, actor: ev.actor, created: clock(game), jobs: [] as Job[], ...(ev.pull ? { pull: ev.pull.number } : {}) };
    const title = ev.pull ? ev.pull.title : ev.commit.message.split('\n')[0];
    try {
      doc = readYaml(ev.commit.files[file]);
    } catch (e) {
      const where = e instanceof YamlError ? ` (line ${e.line})` : '';
      if (triggeredByText(ev.commit.files[file], ev.name)) {
        const run: Run = { ...base, name: file, title, status: 'failure', invalid: `${(e as Error).message}${where}` };
        r.runs.push(run);
        out.push(run);
      }
      continue;
    }
    const w = asMap(doc);
    const on = w.on ?? w.true;
    if (on === undefined || !triggered(on, ev, branch)) continue;
    const name = String(w.name ?? file.split('/').at(-1));
    // Secrets: for a push, a dispatch, pull_request_target, or a pull request from the repository itself; never a fork's pull_request.
    const withSecrets = ev.name !== 'pull_request' || !fork;
    const secrets = withSecrets ? Object.fromEntries(Object.entries(r.secrets).map(([k, v]) => [k, v.value])) : {};
    const github: Record<string, unknown> = {
      event_name: ev.name,
      ref: ev.name === 'pull_request' ? `refs/pull/${ev.pull!.number}/head` : ev.ref,
      ref_name: ev.name === 'pull_request' ? `${ev.pull!.number}/merge` : branch,
      sha: ev.sha,
      repository: key,
      actor: ev.actor,
      base_ref: ev.pull?.base ?? '',
      head_ref: ev.pull?.headRef ?? '',
      event: ev.pull
        ? { pull_request: { number: ev.pull.number, title: ev.pull.title, head: { sha: ev.pull.head.id, ref: ev.pull.headRef, repo: { full_name: ev.pull.headRepo, fork } }, base: { ref: ev.pull.base, repo: { full_name: key } } } }
        : { head_commit: { id: ev.sha, message: ev.commit.message } },
    };
    const run: Run = { ...base, name, title, status: 'success' };
    const jobs = asMap(w.jobs);
    const done: Record<string, Job> = {};
    let ts = clock(game);
    for (const [jobName, rawJob] of Object.entries(jobs)) {
      const job = asMap(rawJob);
      const j: Job = { id: f.nextId++, name: jobName, status: 'success', log: [], steps: [], secrets: false, forkCode: false };
      done[jobName] = j;
      run.jobs.push(j);
      const env: Record<string, string> = {};
      const ctx: Ctx = { github, secrets, env };
      for (const [k, v] of Object.entries(asMap(w.env))) env[k] = substitute(String(v), ctx);
      const needs = asList(job.needs);
      if (needs.some((n) => done[n] && done[n].status !== 'success')) {
        j.status = 'skipped';
        continue;
      }
      const cond = job.if !== undefined ? String(job.if).replace(/^\$\{\{\s*|\s*\}\}$/g, '') : null;
      if (cond !== null && !truthy(evaluate(cond, ctx))) {
        j.status = 'skipped';
        continue;
      }
      if (!online) {
        j.status = 'waiting';
        run.status = 'waiting';
        continue;
      }
      for (const [k, v] of Object.entries(asMap(job.env))) env[k] = substitute(String(v), ctx);
      const stamp = () => `${iso((ts += 1000)).replace('Z', '.0000000Z')}`;
      const line = (text: string) => j.log.push(`${stamp()} ${text}`);
      line(`forgejo-runner ${RUNNER_VERSION} received task ${j.id} of job ${jobName}, triggered by event: ${ev.name}`);
      line('workflow prepared');
      // What the job's workspace holds: the files checked out, the files written.
      let code: Record<string, string> = {};
      const written: Record<string, string> = {};
      const masks = Object.values(secrets)
        .flatMap((v) => v.split('\n'))
        .map((l) => l.trim())
        .filter((l) => l.length >= 4);
      const mask = (text: string) => masks.reduce((t, m) => t.split(m).join('***'), text);
      const secretValues = Object.values(secrets).filter(Boolean);
      // A job "has" the secrets when its environment or a step's holds one.
      const holds = (e: Record<string, string>) => secretValues.some((s) => Object.values(e).some((v) => v && v.includes(s.trim().split('\n')[0])));
      let failed = false;
      for (const rawStep of Array.isArray(job.steps) ? job.steps : []) {
        const step = asMap(rawStep);
        const stepEnv = { ...env };
        const sctx: Ctx = { github, secrets, env: stepEnv };
        for (const [k, v] of Object.entries(asMap(step.env))) stepEnv[k] = substitute(String(v), sctx);
        const uses = step.uses !== undefined ? String(step.uses) : null;
        const run_ = step.run !== undefined ? String(step.run) : null;
        const label = String(step.name ?? (uses ?? (run_ ?? '').split('\n')[0]));
        if (failed) {
          j.steps.push({ name: label, status: 'skipped' });
          continue;
        }
        if (holds(stepEnv)) j.secrets = true;
        line(`⭐ Run Main ${label}`);
        let ok = true;
        if (uses) {
          if (/^(https:\/\/[\w./-]+\/)?actions\/checkout@/.test(uses)) {
            const ref = substitute(String(asMap(step.with).ref ?? ''), sctx);
            const head = ev.pull && (ev.name === 'pull_request' || (ref && (ref === ev.pull.head.id || ref === ev.pull.headRef || ref === `refs/pull/${ev.pull.number}/head`)));
            code = head ? ev.pull!.head.files : ev.commit.files;
            if (head && fork) j.forkCode = true;
            line(`  ☁  git clone '${head ? `https://${f.domain}/${ev.pull!.headRepo}` : `https://${f.domain}/${key}`}' # ref=${head ? ev.pull!.head.id.slice(0, 12) : ev.sha.slice(0, 12)}`);
          } else line(`  ☁  git clone 'https://data.forgejo.org/${uses.replace(/@.*/, '')}' # ref=${uses.replace(/^.*@/, '')}`);
        } else if (run_ !== null) {
          const script = substitute(run_, sctx);
          const r_ = runScriptLines(game, f, script, stepEnv, written, code);
          for (const l of r_.lines) line(mask(l));
          // A secret is out when the log, once masked, still shows it (base64 escapes the masking).
          if (r_.printed && holds(stepEnv)) {
            const shown = r_.lines.map(mask).join('\n');
            if (secretValues.some((s) => shown.includes(base64Encode(s)) || shown.includes(base64Encode(`${s}\n`)) || shown.includes(base64Encode(s.trim())) || shown.includes(base64Encode(`${s.trim()}\n`)))) j.printed = true;
          }
          if (r_.tested) j.tested = true;
          if (r_.deployed) j.deployed = r_.deployed;
          if (r_.deployFailed) j.deployFailed = true;
          ok = r_.code === 0;
        }
        if (ok) line(`  ✅  Success - Main ${label}`);
        else {
          line(`  ❌  Failure - Main ${label}`);
          failed = true;
        }
        j.steps.push({ name: label, status: ok ? 'success' : 'failure' });
      }
      if (holds(env)) j.secrets = true;
      j.status = failed ? 'failure' : 'success';
      line(failed ? '🏁  Job failed' : '🏁  Job succeeded');
      if (failed) run.status = 'failure';
      const context = `${name} / ${jobName} (${ev.name})`;
      (r.statuses[ev.pull ? ev.pull.head.id : ev.sha] ??= []).push({ context, state: failed ? 'failure' : 'success', description: failed ? 'Failing after 14s' : 'Successful in 14s', targetUrl: `/${key}/actions/runs/${index}/jobs/${run.jobs.length - 1}`, created: clock(game) });
    }
    if (game.state.systemd)
      writeLog(game.state.systemd, `${f.runnerService}.service`, 'forgejo-runner', 902, `time="${iso(clock(game))}" level=info msg="task ${run.jobs[0]?.id ?? run.id} repo is ${key} https://data.forgejo.org ${RUNNER_VERSION}"`);
    r.runs.push(run);
    out.push(run);
  }
  return out;
}
const triggeredByText = (text: string, event: string) => new RegExp(`\\b${event}\\b`).test(text);

/** A workflow step's `run:`, line by line: what the game's runner understands. */
function runScriptLines(game: Shell, f: ForgeState, script: string, env: Record<string, string>, written: Record<string, string>, code: Record<string, string>) {
  const lines: string[] = [];
  let printed = false;
  let tested = false;
  let deployed: string | undefined;
  let deployFailed = false;
  const expand = (s: string) =>
    s
      .replace(/\$\{(\w+)\}|\$(\w+)/g, (_, a: string, b: string) => env[a ?? b] ?? '')
      .replace(/^(["'])(.*)\1$/s, '$2');
  const home = '/root';
  const path = (p: string) => expand(p).replace(/^~(?=\/|$)/, home);
  for (const raw of script.split('\n')) {
    const l = raw.trim();
    if (!l || l.startsWith('#')) continue;
    // echo … | base64 [-w0]   echo … > file   printf '%s' "$X" > file
    const echo = /^(echo|printf)\s+(?:(-[ne]+)\s+)?(?:'%s(?:\\n)?'\s+)?(.*?)(?:\s*\|\s*(base64)(?:\s+-w\s*0|\s+--wrap=0)?)?(?:\s*(>>?)\s*(\S+))?$/.exec(l);
    if (echo) {
      const text = expand(echo[3].trim());
      const value = echo[4] ? base64Encode(`${text}\n`) : text;
      if (echo[6]) written[path(echo[6])] = echo[5] === '>>' ? `${written[path(echo[6])] ?? ''}\n${value}` : value;
      else {
        lines.push(...value.split('\n'));
        printed = true;
      }
      continue;
    }
    if (/^(mkdir|chmod|cd|cp|ls|export|set|true)\b/.test(l)) continue;
    if (/^(pip3?|python3? -m pip) install\b/.test(l)) {
      lines.push('Collecting flask==3.1.0', 'Collecting pytest==8.3.4', 'Collecting mkdocs==1.6.1', 'Successfully installed flask-3.1.0 mkdocs-1.6.1 pytest-8.3.4');
      continue;
    }
    if (/^(python3? -m )?pytest\b/.test(l)) {
      const tests = Object.keys(code).filter((n) => /^tests\/test_.*\.py$/.test(n)).length;
      if (!tests) {
        lines.push('============================= test session starts ==============================', 'collected 0 items', '', '============================ no tests ran in 0.02s =============================');
        return { code: 5, lines, printed, tested, deployed, deployFailed };
      }
      tested = true;
      lines.push('============================= test session starts ==============================', `collected ${tests * 23} items`, '', ...Object.keys(code).filter((n) => /^tests\/test_.*\.py$/.test(n)).map((n) => `${n} ....................... [100%]`), '', `============================= ${tests * 23} passed in 4.12s ==============================`);
      continue;
    }
    if (/^mkdocs build\b/.test(l)) {
      lines.push('INFO    -  Cleaning site directory', 'INFO    -  Building documentation to directory: /workspace/lendshed/lendshed/site', 'INFO    -  Documentation built in 1.83 seconds');
      continue;
    }
    // Deploying: rsync -e "ssh -i KEY …" … USER@HOST:DIR, or ssh -i KEY USER@HOST …
    const target = /\b([\w.-]+)@([\w.-]+):?(\S*)/.exec(l);
    if (/^(rsync|ssh|scp)\b/.test(l) && target && f.deploy) {
      const keyFile = /-i\s+("?)([^\s"]+)\1/.exec(l)?.[2];
      const key = keyFile ? written[path(keyFile)] : undefined;
      const host = target[2];
      const verdict = deployVerdict(game, f, target[1], host, key);
      if (verdict.ok) {
        deployed = verdict.key;
        if (/^rsync\b/.test(l)) lines.push('sending incremental file list', './', 'index.html', 'catalogue/index.html', 'search/search_index.json', '', 'sent 48,213 bytes  received 412 bytes  97,250.00 bytes/sec', 'total size is 1,204,551  speedup is 24.77');
        continue;
      }
      deployFailed = true;
      lines.push(...verdict.lines);
      return { code: 255, lines, printed, tested, deployed, deployFailed };
    }
  }
  return { code: 0, lines, printed, tested, deployed, deployFailed };
}

/** Would sshd let this key in as the deploy account (authorized_keys, its options)? */
export function deployVerdict(game: Shell, f: ForgeState, user: string, host: string, key: string | undefined): { ok: true; key: string } | { ok: false; lines: string[] } {
  const d = f.deploy!;
  const denied = { ok: false as const, lines: [`${user}@${host}: Permission denied (publickey).`, 'rsync: connection unexpectedly closed (0 bytes received so far) [sender]', 'rsync error: unexplained error (code 255) at io.c(232) [sender=3.4.1]'] };
  if (!d.hosts.includes(host) || user !== d.user) return { ok: false, lines: [`ssh: Could not resolve hostname ${host}: Name or service not known`, 'rsync: connection unexpectedly closed (0 bytes received so far) [sender]'] };
  if (!key || !key.includes('-----BEGIN OPENSSH PRIVATE KEY-----')) return { ok: false, lines: [`Load key "${'/root/.ssh/deploy_key'}": invalid format`, ...denied.lines] };
  const pub = publicFor(key.trim());
  const entry = authorizedEntries(game.read(d.authorizedKeys) ?? '').find((e) => e.key === pub);
  if (!entry) return denied;
  if (entry.from && !entry.from.split(',').some((p) => glob(p.replace(/^!/, ''), d.from) && !p.startsWith('!'))) return denied;
  if (entry.command && !/rrsync\b/.test(entry.command)) return { ok: false, lines: ['protocol version mismatch -- is your shell clean?', '(see the rsync manpage for an explanation)', 'rsync error: protocol incompatibility (code 2) at compat.c(626) [sender=3.4.1]'] };
  if (entry.command && !entry.command.includes(d.dir.replace(/\/$/, ''))) return { ok: false, lines: [`rrsync error: option or path outside the allowed directory`, 'rsync: connection unexpectedly closed (0 bytes received so far) [sender]'] };
  return { ok: true, key: pub };
}

/** authorized_keys lines (sshd(8), AUTHORIZED_KEYS FILE FORMAT): options, key, comment. */
export function authorizedEntries(text: string): { key: string; options: string; command?: string; from?: string; restrict: boolean }[] {
  const out: { key: string; options: string; command?: string; from?: string; restrict: boolean }[] = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const m = /^(?:((?:[^\s"]|"[^"]*")+)\s+)?(ssh-[\w-]+\s+\S+)/.exec(line);
    if (!m) continue;
    const options = m[1] && !m[1].startsWith('ssh-') ? m[1] : '';
    out.push({
      key: m[2],
      options,
      command: /(?:^|,)command="([^"]*)"/.exec(options)?.[1],
      from: /(?:^|,)from="([^"]*)"/.exec(options)?.[1],
      restrict: /(?:^|,)(restrict|no-pty|no-port-forwarding)(?:,|$)/.test(options),
    });
  }
  return out;
}

// ——— The HTTP API ———

export interface Answer {
  status: number;
  body: string;
  type: string;
}

const REASONS: Record<number, string> = { 200: 'OK', 201: 'Created', 204: 'No Content', 400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden', 404: 'Not Found', 405: 'Method Not Allowed', 409: 'Conflict', 422: 'Unprocessable Entity' };
export const reason = (status: number) => REASONS[status] ?? '';

/** A request to the forge (from curl): the API under /api/v1, and the few web pages the stories need. */
export function forgeHttp(game: Shell, method: string, url: string, headers: Record<string, string>, body: string | null, basic: string | null): Answer {
  const f = forge(game)!;
  const [pathPart, query = ''] = url.split('?');
  const params = new URLSearchParams(query);
  const swagger = `https://${f.domain}/api/swagger`;
  const json = (status: number, value: unknown): Answer => ({ status, body: value === undefined ? '' : JSON.stringify(value), type: 'application/json;charset=utf-8' });
  const message = (status: number, text: string) => json(status, { message: text, url: swagger });
  const notFound = () => json(404, { errors: [], message: 'The target couldn\'t be found.', url: swagger });
  const path = pathPart.replace(/\/+$/, '') || '/';

  // Who asks: a token (Authorization: token|Bearer), or basic authentication (user:password, or user:token).
  let doer: ForgeUser | null = null;
  let token: Token | null = null;
  let basicAuth = false;
  const auth = headers.authorization ?? '';
  const t = /^(?:token|bearer)\s+(\S+)$/i.exec(auth)?.[1];
  if (t) {
    token = f.tokens.find((x) => x.value === t) ?? null;
    if (!token) return message(401, 'user does not exist [uid: 0, name: ]');
    doer = f.users[token.owner] ?? null;
  } else if (basic) {
    const [login, ...rest] = basic.split(':');
    const secret = rest.join(':');
    const u = f.users[login];
    const tk = f.tokens.find((x) => x.value === secret && x.owner === login);
    if (!u || (u.password !== secret && !tk)) return message(401, 'user does not exist [uid: 0, name: ]');
    doer = u;
    token = tk ?? null;
    basicAuth = !tk;
  }
  if (doer && (doer.prohibitLogin || !doer.active)) return message(403, 'This account is prohibited from signing in, please contact your site administrator.');
  // Sudo (header or ?sudo=): an administrator acts as another account.
  const sudo = headers.sudo ?? params.get('sudo');
  if (sudo && doer) {
    if (!doer.admin) return message(403, 'Only administrators allowed to sudo.');
    const other = f.users[sudo];
    if (!other) return notFound();
    doer = other;
  }
  const need = (scope: string): Answer | null => {
    if (!token || token.scopes.includes('all')) return null;
    const [mode, area] = scope.split(':');
    if (token.scopes.includes(`write:${area}`) || (mode === 'read' && token.scopes.includes(`read:${area}`))) return null;
    return message(403, `token does not have at least one of required scope(s): [${scope}]`);
  };
  const write = method !== 'GET' && method !== 'HEAD';
  let input: Record<string, unknown> = {};
  if (body !== null && body.trim() !== '' && write) {
    try {
      const v = JSON.parse(body);
      if (v && typeof v === 'object' && !Array.isArray(v)) input = v;
    } catch (e) {
      const what = (e as Error).message;
      const bad = /control character|Bad control|newline/i.test(what) || /[\n\r\t]/.test(body.replace(/\\[nrt]/g, ''));
      return json(422, [{ fieldNames: [''], classification: 'DeserializationError', message: bad ? "invalid character '\\n' in string literal" : 'invalid character looking for beginning of value' }]);
    }
  }

  // ——— Web routes ———
  const keys = /^\/([\w.-]+)\.keys$/.exec(path);
  if (keys && method === 'GET') {
    const u = f.users[keys[1]];
    return u ? { status: 200, body: u.keys.join('\n'), type: 'text/plain;charset=utf-8' } : { status: 404, body: 'Not found.', type: 'text/plain;charset=utf-8' };
  }
  const logs = /^\/([\w.-]+)\/([\w.-]+)\/actions\/runs\/(\d+)\/jobs\/(\d+)(?:\/attempt\/1)?\/logs$/.exec(path);
  if (logs && method === 'GET') {
    const r = f.repos[`${logs[1]}/${logs[2]}`.toLowerCase()];
    if (!r || permission(f, r, doer?.login ?? null) === 'none') return { status: 404, body: 'Not found.', type: 'text/plain;charset=utf-8' };
    const run = r.runs.find((x) => x.index === Number(logs[3]));
    const job = run?.jobs[Number(logs[4])];
    if (!job) return { status: 404, body: 'Not found.', type: 'text/plain;charset=utf-8' };
    return { status: 200, body: job.log.join('\n'), type: 'text/plain;charset=utf-8' };
  }
  if (!path.startsWith('/api/v1')) return { status: 404, body: 'Not found.', type: 'text/plain;charset=utf-8' };
  const p = path.slice(7) || '/';
  if (p === '/version') return json(200, { version: FORGEJO_VERSION });
  if (p === '/swagger') return { status: 200, body: '<!DOCTYPE html><title>Forgejo API</title>', type: 'text/html' };

  // ——— Users ———
  const userJson = (u: ForgeUser) => ({
    id: u.id,
    login: u.login,
    login_name: '',
    source_id: 0,
    full_name: u.fullName,
    email: u.email,
    avatar_url: `https://${f.domain}/avatars/${u.login}`,
    html_url: `https://${f.domain}/${u.login}`,
    language: '',
    is_admin: u.admin,
    last_login: iso(u.lastLogin),
    created: iso(u.created),
    restricted: false,
    active: u.active,
    prohibit_login: u.prohibitLogin,
    location: '',
    pronouns: '',
    website: '',
    description: '',
    visibility: 'public',
    followers_count: 0,
    following_count: 0,
    starred_repos_count: 0,
    username: u.login,
  });
  if (p === '/user') {
    if (!doer) return message(401, 'token is required');
    return json(200, userJson(doer));
  }
  if (p === '/user/keys' || /^\/users\/[\w.-]+\/keys$/.test(p)) {
    const u = p === '/user/keys' ? doer : f.users[p.split('/')[2]];
    if (!u) return p === '/user/keys' ? message(401, 'token is required') : notFound();
    return json(200, u.keys.map((k, i) => ({ id: u.id * 10 + i, key: k, url: `https://${f.domain}/api/v1/user/keys/${u.id * 10 + i}`, title: k.split(' ')[2] ?? '', fingerprint: keyFingerprint(k), created_at: iso(u.created), read_only: false, key_type: 'user', verified: true })));
  }
  const userPath = /^\/users\/([\w.-]+)$/.exec(p);
  if (userPath && method === 'GET') {
    const u = f.users[userPath[1]];
    return u ? json(200, userJson(u)) : notFound();
  }
  const tokens = /^\/users\/([\w.-]+)\/tokens(?:\/([\w.-]+))?$/.exec(p);
  if (tokens) {
    // Tokens need basic authentication (a token can't list or delete tokens), as the account itself (or Sudo).
    if (!doer) return message(401, 'token is required');
    if (!basicAuth) return message(401, 'auth required');
    if (doer.login !== tokens[1]) return message(403, 'You are not allowed to perform this action.');
    const mine = f.tokens.filter((x) => x.owner === doer!.login);
    if (!tokens[2] && method === 'GET') return json(200, mine.map((x) => ({ id: x.id, name: x.name, sha1: '', token_last_eight: x.value.slice(-8), scopes: x.scopes })));
    if (tokens[2] && method === 'DELETE') {
      const x = mine.find((y) => String(y.id) === tokens[2] || y.name === tokens[2]);
      if (!x) return notFound();
      f.tokens = f.tokens.filter((y) => y !== x);
      return json(204, undefined);
    }
    return message(405, 'Method Not Allowed');
  }

  // ——— Administration ———
  if (p.startsWith('/admin/')) {
    if (!doer) return message(401, 'token is required');
    if (!doer.admin) return message(403, 'user should be the site admin');
    const scope = need(`${write ? 'write' : 'read'}:admin`);
    if (scope) return scope;
    if (p === '/admin/users' && method === 'GET') return json(200, Object.values(f.users).sort((a, b) => a.id - b.id).map(userJson));
    const au = /^\/admin\/users\/([\w.-]+)$/.exec(p);
    if (au) {
      const u = f.users[au[1]];
      if (!u) return notFound();
      if (method === 'PATCH') {
        if (typeof input.prohibit_login === 'boolean') u.prohibitLogin = input.prohibit_login;
        if (typeof input.active === 'boolean') u.active = input.active;
        if (typeof input.admin === 'boolean') u.admin = input.admin;
        if (typeof input.password === 'string') u.password = input.password;
        if (typeof input.must_change_password === 'boolean') u.mustChangePassword = input.must_change_password;
        if (typeof input.full_name === 'string') u.fullName = input.full_name;
        return json(200, userJson(u));
      }
      if (method === 'DELETE') {
        const refused = deleteUser(f, u.login, params.get('purge') === 'true');
        return refused ? message(422, refused) : json(204, undefined);
      }
    }
    return notFound();
  }

  // ——— Repositories ———
  const rp = /^\/repos\/([\w.-]+)\/([\w.-]+)(\/.*)?$/.exec(p);
  if (!rp) return notFound();
  const key = `${rp[1]}/${rp[2]}`.toLowerCase();
  const r = f.repos[key];
  const perm = r ? permission(f, r, doer?.login ?? null) : 'none';
  if (!r || perm === 'none') return notFound();
  const rest = rp[3] ?? '';
  const scope = need(`${write ? 'write' : 'read'}:repository`);
  if (scope) return scope;
  const isAdmin = perm === 'admin' || perm === 'owner';
  const mustWrite = () => (doer ? (isAdmin ? null : message(403, 'Must have admin permission')) : message(401, 'token is required'));
  const repoJson = () => ({
    id: r.id,
    owner: { id: 1, login: r.owner, username: r.owner },
    name: r.name,
    full_name: `${r.owner}/${r.name}`,
    description: r.description,
    empty: false,
    private: r.private,
    fork: !!r.fork,
    parent: r.fork ? { full_name: r.fork } : null,
    html_url: `https://${f.domain}/${r.owner}/${r.name}`,
    ssh_url: `git@${f.domain}:${r.owner}/${r.name}.git`,
    clone_url: `https://${f.domain}/${r.owner}/${r.name}.git`,
    default_branch: 'main',
    archived: false,
    has_actions: true,
    permissions: { admin: isAdmin, push: canWrite(perm), pull: true },
  });
  if (rest === '' && method === 'GET') return json(200, repoJson());
  if (rest === '' && method === 'PATCH') {
    const no = mustWrite();
    if (no) return no;
    if (typeof input.private === 'boolean') r.private = input.private;
    if (typeof input.description === 'string') r.description = input.description;
    return json(200, repoJson());
  }
  if (rest === '/collaborators' && method === 'GET') return json(200, Object.keys(r.collaborators).sort().map((l) => userJson(f.users[l])).filter(Boolean));
  const col = /^\/collaborators\/([\w.-]+)(\/permission)?$/.exec(rest);
  if (col) {
    const login = col[1];
    if (col[2]) {
      const u = f.users[login];
      if (!u) return notFound();
      const level = permission(f, r, login);
      return json(200, { permission: level === 'owner' ? 'owner' : level, role_name: level, user: userJson(u) });
    }
    if (method === 'GET') return r.collaborators[login] ? json(204, undefined) : notFound();
    const no = mustWrite();
    if (no) return no;
    if (method === 'DELETE') {
      if (!f.users[login]) return notFound();
      delete r.collaborators[login];
      return json(204, undefined);
    }
    if (method === 'PUT') {
      if (!f.users[login]) return notFound();
      const level = String(input.permission ?? 'write');
      r.collaborators[login] = (['read', 'write', 'admin'].includes(level) ? level : 'write') as 'read' | 'write' | 'admin';
      return json(204, undefined);
    }
  }
  const protectionJson = (x: Protection) => ({
    branch_name: x.rule,
    rule_name: x.rule,
    enable_push: x.enablePush,
    enable_push_whitelist: x.enablePushWhitelist,
    push_whitelist_usernames: x.pushWhitelist,
    push_whitelist_teams: [],
    push_whitelist_deploy_keys: false,
    enable_merge_whitelist: false,
    merge_whitelist_usernames: [],
    merge_whitelist_teams: [],
    enable_status_check: x.enableStatusCheck,
    status_check_contexts: x.statusCheckContexts,
    required_approvals: x.requiredApprovals,
    enable_approvals_whitelist: false,
    approvals_whitelist_username: [],
    approvals_whitelist_teams: [],
    block_on_rejected_reviews: x.blockOnRejected,
    block_on_official_review_requests: false,
    block_on_outdated_branch: false,
    dismiss_stale_approvals: x.dismissStale,
    ignore_stale_approvals: false,
    require_signed_commits: x.requireSigned,
    protected_file_patterns: '',
    unprotected_file_patterns: '',
    apply_to_admins: x.applyToAdmins,
    created_at: iso(x.created),
    updated_at: iso(x.updated),
  });
  const applyProtection = (x: Protection) => {
    const b = (k: string) => (typeof input[k] === 'boolean' ? (input[k] as boolean) : undefined);
    const list = (k: string) => (Array.isArray(input[k]) ? (input[k] as unknown[]).map(String) : undefined);
    x.enablePush = b('enable_push') ?? x.enablePush;
    x.enablePushWhitelist = b('enable_push_whitelist') ?? x.enablePushWhitelist;
    x.pushWhitelist = list('push_whitelist_usernames') ?? x.pushWhitelist;
    x.enableStatusCheck = b('enable_status_check') ?? x.enableStatusCheck;
    x.statusCheckContexts = list('status_check_contexts') ?? x.statusCheckContexts;
    if (typeof input.required_approvals === 'number') x.requiredApprovals = input.required_approvals;
    x.requireSigned = b('require_signed_commits') ?? x.requireSigned;
    x.blockOnRejected = b('block_on_rejected_reviews') ?? x.blockOnRejected;
    x.dismissStale = b('dismiss_stale_approvals') ?? x.dismissStale;
    x.applyToAdmins = b('apply_to_admins') ?? x.applyToAdmins;
    x.updated = clock(game);
  };
  if (rest === '/branch_protections') {
    if (method === 'GET') return json(200, r.protections.map(protectionJson));
    if (method === 'POST') {
      const no = mustWrite();
      if (no) return no;
      const rule = String(input.rule_name ?? input.branch_name ?? '');
      if (!rule) return json(422, [{ fieldNames: ['RuleName'], classification: 'RequiredError', message: 'Required' }]);
      if (r.protections.some((x) => x.rule === rule)) return message(403, 'Branch protection already exist');
      const x: Protection = { rule, enablePush: false, enablePushWhitelist: false, pushWhitelist: [], requiredApprovals: 0, enableStatusCheck: false, statusCheckContexts: [], requireSigned: false, blockOnRejected: false, dismissStale: false, applyToAdmins: false, created: clock(game), updated: clock(game) };
      applyProtection(x);
      r.protections.push(x);
      return json(201, protectionJson(x));
    }
  }
  const prot = /^\/branch_protections\/(.+)$/.exec(rest);
  if (prot) {
    const x = r.protections.find((y) => y.rule === decodeURIComponent(prot[1]));
    if (!x) return notFound();
    if (method === 'GET') return json(200, protectionJson(x));
    const no = mustWrite();
    if (no) return no;
    if (method === 'PATCH') {
      applyProtection(x);
      return json(200, protectionJson(x));
    }
    if (method === 'DELETE') {
      r.protections = r.protections.filter((y) => y !== x);
      return json(204, undefined);
    }
  }
  const repoGit: Repo | undefined = game.state.git?.[r.path];
  const branch = /^\/branches\/([\w.-]+)$/.exec(rest);
  if (branch && method === 'GET') {
    const head = repoGit?.commits.at(-1);
    if (branch[1] !== 'main' || !head) return notFound();
    const p_ = protectionFor(r, 'main');
    return json(200, { name: 'main', commit: { id: head.id, message: `${head.message}\n`, url: `https://${f.domain}/${key}/commit/${head.id}`, author: { name: head.author.replace(/\s*<.*$/, ''), email: /<([^>]*)>/.exec(head.author)?.[1] ?? '' }, verification: verificationJson(f, head) }, protected: !!p_, required_approvals: p_?.requiredApprovals ?? 0, enable_status_check: p_?.enableStatusCheck ?? false, status_check_contexts: p_?.statusCheckContexts ?? [], user_can_push: canWrite(perm), user_can_merge: canWrite(perm), effective_branch_protection_name: p_?.rule ?? '' });
  }
  if (rest === '/branches' && method === 'GET') {
    const head = repoGit?.commits.at(-1);
    return json(200, head ? [{ name: 'main', commit: { id: head.id, message: `${head.message}\n` }, protected: !!protectionFor(r, 'main') }] : []);
  }
  if (rest === '/tags' && method === 'GET') return json(200, Object.entries(repoGit?.tags ?? {}).map(([n, tg]) => ({ name: n, message: tg.message ?? '', id: tg.commit, commit: { sha: tg.commit }, tarball_url: `https://${f.domain}/${key}/archive/${n}.tar.gz` })));
  const statuses = /^\/commits\/([\w.-]+)\/(statuses|status)$/.exec(rest);
  if (statuses && method === 'GET') {
    const ref = statuses[1];
    const sha = ref === 'main' || ref === 'HEAD' ? repoGit?.commits.at(-1)?.id : Object.keys(r.statuses).find((s) => s.startsWith(ref)) ?? r.pulls.find((x) => x.head.id.startsWith(ref))?.head.id ?? ref;
    const list = (r.statuses[sha ?? ''] ?? []).slice().reverse().map((st, i) => ({ id: i + 1, status: st.state, target_url: `https://${f.domain}${st.targetUrl}`, description: st.description, context: st.context, created_at: iso(st.created), updated_at: iso(st.created) }));
    if (statuses[2] === 'statuses') return json(200, list);
    const latest = Object.values(Object.fromEntries(list.reverse().map((x) => [x.context, x])));
    return json(200, { state: latest.some((x) => x.status === 'failure') ? 'failure' : latest.length ? 'success' : 'pending', sha, total_count: latest.length, statuses: latest });
  }
  if (rest === '/hooks' && method === 'GET') return isAdmin ? json(200, []) : message(403, 'Must have admin permission');
  if (rest === '/forks' && method === 'GET') return json(200, Object.values(f.repos).filter((x) => x.fork === key).map((x) => ({ full_name: `${x.owner}/${x.name}`, owner: { login: x.owner }, fork: true })));
  if (rest === '/pulls' && method === 'GET')
    return json(200, r.pulls.filter((x) => (params.get('state') ?? 'open') === 'all' || x.state === (params.get('state') ?? 'open')).map((x) => ({ number: x.number, title: x.title, state: x.state, user: { login: x.user }, head: { label: `${x.headRepo.split('/')[0]}:${x.headRef}`, ref: x.headRef, sha: x.head.id, repo: { full_name: x.headRepo, fork: x.headRepo !== key } }, base: { ref: x.base, repo: { full_name: key } }, html_url: `https://${f.domain}/${key}/pulls/${x.number}`, created_at: iso(x.created) })));
  // Actions: secrets (values never shown) and runs.
  if (rest === '/actions/secrets' && method === 'GET') {
    const no = mustWrite();
    if (no) return no;
    return json(200, Object.entries(r.secrets).sort().map(([n, s]) => ({ name: n, created_at: iso(s.created) })));
  }
  const secret = /^\/actions\/secrets\/([\w-]+)$/.exec(rest);
  if (secret) {
    const no = mustWrite();
    if (no) return no;
    const nameUpper = secret[1].toUpperCase();
    if (/^(GITHUB_|GITEA_|FORGEJO_)/.test(nameUpper)) return message(400, 'invalid secret name');
    if (method === 'PUT') {
      if (typeof input.data !== 'string' || input.data === '') return json(422, [{ fieldNames: ['Data'], classification: 'RequiredError', message: 'Required' }]);
      const existed = !!r.secrets[nameUpper];
      r.secrets[nameUpper] = { value: input.data, created: existed ? r.secrets[nameUpper].created : clock(game) };
      (game.state.forgeSecretWrites ??= []).push({ name: nameUpper, at: clock(game) });
      return json(existed ? 204 : 201, undefined);
    }
    if (method === 'DELETE') {
      if (!r.secrets[nameUpper]) return notFound();
      delete r.secrets[nameUpper];
      return json(204, undefined);
    }
  }
  if ((rest === '/actions/runs' || rest === '/actions/tasks') && method === 'GET') {
    const runs = r.runs
      .slice()
      .reverse()
      .filter((x) => !params.get('event') || x.event === params.get('event'))
      .map((x) => ({
        id: x.id,
        title: x.title,
        status: x.status,
        event: x.event,
        workflow_id: x.workflow,
        index_in_repo: x.index,
        commit_sha: x.sha,
        prettyref: x.pull ? `#${x.pull}` : x.ref.replace(/^refs\/(heads|tags)\//, ''),
        trigger_user: { login: x.actor },
        is_fork_pull_request: !!x.pull && r.pulls.find((y) => y.number === x.pull)?.headRepo !== key,
        jobs: x.jobs.map((j, k) => ({ name: j.name, status: j.status, logs_url: `https://${f.domain}/${key}/actions/runs/${x.index}/jobs/${k}/logs` })),
        html_url: `https://${f.domain}/${key}/actions/runs/${x.index}`,
        created: iso(x.created),
        ...(x.invalid ? { error: x.invalid } : {}),
      }));
    return json(200, { workflow_runs: runs, total_count: runs.length });
  }
  return notFound();
}

const verificationJson = (f: ForgeState, c: Commit) => {
  const u = verified(f, c);
  return { verified: !!u, reason: u ? u.login : c.signature ? 'gpg.error.no_gpg_keys_found' : 'gpg.error.not_signed_commit', signature: '', signer: u ? { name: u.fullName, email: u.email, username: u.login } : null, payload: '' };
};

/** forgejo admin user delete / DELETE /admin/users: refused while the account owns repositories, unless purged. */
export function deleteUser(f: ForgeState, login: string, purge: boolean): string | null {
  const u = f.users[login];
  if (!u) return `user does not exist [uid: 0, name: ${login}]`;
  const owned = Object.values(f.repos).filter((r) => r.owner === login);
  if (owned.length && !purge) return `user still has ownership of repositories [uid: ${u.id}]`;
  for (const r of owned) delete f.repos[`${r.owner}/${r.name}`.toLowerCase()];
  for (const r of Object.values(f.repos)) {
    delete r.collaborators[login];
    r.team = r.team.filter((x) => x !== login);
  }
  f.tokens = f.tokens.filter((x) => x.owner !== login);
  delete f.users[login];
  if (purge) f.purged.push(login);
  return null;
}

/** A signature the forge would show for a commit. */
export const forgeSignature = (s: GitSignature | undefined) => (s ? keyFingerprint(s.key) : '');
