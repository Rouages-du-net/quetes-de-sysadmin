// Story "The Community Centre" — chapter "The tunnel": the wiki's
// admin page only listens on the wiki's 127.0.0.1:8080 (on purpose:
// it isn't made for the internet), and the wiki has no browser.
// Open a tunnel from your workstation (ssh -f -N -L 8080:localhost:8080 wiki),
// approve the pending sign-ups (except the advertising account), then
// close the tunnel (ps, kill).
// Real traps: "localhost" in -L is understood on the remote machine's
// side (-L 8080:localhost:8080 community leads to community, where nothing listens;
// -L 8080:wiki:8080 community arrives through the wiki's address, not through 127.0.0.1).
// Objective checked on the state: both sign-ups approved, the
// advertising one not, and no tunnel left open on the workstation.
// Sources: https://man.openbsd.org/ssh#L, https://man.openbsd.org/ssh#N

import { f, name, type Chapter } from '../world';
import type { Game, Shell } from '../shell';
import type { App } from '../nginx';
import { newSystemd } from '../systemd';
import { loadSshd, homeAccounts, sshDirectory, homeState, internalHost, M, NOW, homeWorld, PASSWORD, homePlan } from './community-centre';

type Signup = 'pending' | 'approved' | 'refused';
const VALIDATE = ['samir', 'lea'];
const ADVERT = 'promo-casino';
const SIGNUPS = (): Record<string, Signup> => ({ samir: 'pending', lea: 'pending', [ADVERT]: 'pending' });

const signups = (j: Game) => j.state.signups as Record<string, Signup>;

// The wiki's admin page: the list of sign-ups, and an address to approve or refuse each one.
const ADMIN: App = {
  service: 'wiki-admin',
  pages: {},
  answer: (j, path) => {
    const listing = signups(j);
    if (path === '/' || path === '/admin' || path === '/admin/') {
      const lines = Object.entries(listing).map(([account, state]) => j.t('tunnel-admin-line', { name: account, state: state }));
      return { code: 200, type: 'text/plain; charset=utf-8', body: j.t('tunnel-admin-page', { lines: lines.join('\n') }) };
    }
    // /admin/approve/<account> and /admin/reject/<account> (in the language).
    const m = /^\/admin\/([\w-]+)\/([\w-]+)\/?$/.exec(path);
    const action = (['approve', 'reject'] as const).find((a) => m?.[1] === name(j.t, a));
    if (m && action && listing[m[2]]) {
      listing[m[2]] = action === 'approve' ? 'approved' : 'refused';
      return { code: 200, type: 'text/plain; charset=utf-8', body: j.t(`tunnel-admin-${action}`, { name: m[2] }) };
    }
    return { code: 404, type: 'text/plain; charset=utf-8', body: j.t('tunnel-admin-not-found') };
  },
};

const wiki = (j: Game) => (j as Shell).internal('wiki')!;
const workstation = (j: Game) => (j.state.workstation as (() => Shell) | undefined)?.();
// The workstation's tunnels still open (their ssh process is running).
const openTunnels = (j: Game) => {
  const p = workstation(j);
  if (!p) return 0;
  const live = ((p.state.process ?? []) as { pid: number }[]).map((x) => x.pid);
  return ((p.state.tunnels ?? []) as { pid: number }[]).filter((t) => live.includes(t.pid)).length;
};
const approved = (j: Game) => VALIDATE.every((n) => signups(wiki(j))[n] === 'approved');
const approvedAdvert = (j: Game) => signups(wiki(j))[ADVERT] === 'approved';

export const tunnel: Chapter = {
  id: 'tunnel',
  number: 3,
  plan: homePlan(),
  commands: ['ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'id', 'whoami', 'hostname', 'ssh'],
  home: M,
  welcome: 'email_yasmine.txt',
  names: true,
  final: 'end',
  password: PASSWORD,
  accounts: homeAccounts,
  playerKeys: true,
  watchesWorkstation: true,
  state: () => homeState(),
  initialise: loadSshd,
  hosts: {
    wiki: internalHost('wiki', '10.20.0.11', {
      commands: ['ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'id', 'whoami', 'hostname', 'systemctl', 'ss'],
      home: (t) => ({ 'note_gaspard.txt': f(t('tunnel-note-gaspard')) }),
      state: () => ({
        signups: SIGNUPS(),
        listening: [
          { proto: 'tcp', address: '0.0.0.0', port: 22, process: 'sshd', pid: 512 },
          { proto: 'tcp', address: '127.0.0.1', port: 8080, process: 'python3', pid: 731 },
        ],
        apps: { '127.0.0.1:8080': ADMIN },
        systemd: newSystemd('wiki', NOW - 30 * 86_400_000, NOW, {
          'wiki-admin': {
            description: 'Wiki admin interface (127.0.0.1:8080)',
            active: true,
            executable: 'wiki-admin',
            process: [
              { pid: 731, user: 'www-data', cpu: 0.1, mem: 1.4, command: '/usr/bin/python3 /srv/wiki/admin.py --bind 127.0.0.1:8080' },
            ],
          },
        }),
      }),
    }),
    archives: internalHost('archives', '10.20.0.12'),
  },
  createWorld: (t) => homeWorld(t, { passwords: 'no', home: { 'email_yasmine.txt': f(t('tunnel-email-yasmine')), '.ssh': sshDirectory() } }),
  events: [
    { id: 'advert', condition: approvedAdvert, message: (j) => j.t('tunnel-event-advert', { account: ADVERT }) },
    { id: 'approved', condition: (j) => approved(j) && !approvedAdvert(j), message: (j) => j.t('tunnel-event-approved') },
    { id: 'end', condition: (j) => approved(j) && !approvedAdvert(j) && openTunnels(j) === 0, message: (j) => j.t('tunnel-event-end') },
  ],
};
