// Histoire « La Maison des associations » — chapitre « Le tunnel » : la page
// d'administration du wiki n'écoute que sur 127.0.0.1:8080 du wiki (exprès :
// elle n'est pas faite pour internet), et le wiki n'a pas de navigateur.
// Ouvrir un tunnel depuis son poste (ssh -f -N -L 8080:localhost:8080 wiki),
// valider les inscriptions en attente (sauf le compte publicitaire), puis
// refermer le tunnel (ps, kill).
// Pièges réels : « localhost » dans -L s'entend du côté de la machine d'en
// face (-L 8080:localhost:8080 maison mène à maison, où rien n'écoute ;
// -L 8080:wiki:8080 maison arrive par l'adresse du wiki, pas par 127.0.0.1).
// Objectif vérifié sur l'état : les deux inscriptions validées, la
// publicitaire non, et plus aucun tunnel ouvert sur le poste.
// Sources : https://man.openbsd.org/ssh#L, https://man.openbsd.org/ssh#N

import { f, type Chapter } from '../world';
import type { Game, Shell } from '../shell';
import type { App } from '../nginx';
import { newSystemd } from '../systemd';
import { loadSshd, homeAccounts, sshDirectory, homeState, internalHost, M, NOW, homeWorld, PASSWORD, homePlan } from './community-centre';

type Signup = 'attente' | 'validee' | 'refusee';
const VALIDATE = ['samir', 'lea'];
const ADVERT = 'promo-casino';
const SIGNUPS = (): Record<string, Signup> => ({ samir: 'attente', lea: 'attente', [ADVERT]: 'attente' });

const signups = (j: Game) => j.state.signups as Record<string, Signup>;

// La page d'administration du wiki : la liste des inscriptions, et une adresse pour valider ou refuser chacune.
const ADMIN: App = {
  service: 'wiki-admin',
  pages: {},
  answer: (j, path) => {
    const listing = signups(j);
    if (path === '/' || path === '/admin' || path === '/admin/') {
      const lines = Object.entries(listing).map(([name, state]) => j.t('tunnel-admin-ligne', { name: name, state: state }));
      return { code: 200, type: 'text/plain; charset=utf-8', body: j.t('tunnel-admin-page', { lines: lines.join('\n') }) };
    }
    const m = /^\/admin\/(valider|refuser)\/([\w-]+)\/?$/.exec(path);
    if (m && listing[m[2]]) {
      listing[m[2]] = m[1] === 'valider' ? 'validee' : 'refusee';
      return { code: 200, type: 'text/plain; charset=utf-8', body: j.t(`tunnel-admin-${m[1]}`, { name: m[2] }) };
    }
    return { code: 404, type: 'text/plain; charset=utf-8', body: j.t('tunnel-admin-introuvable') };
  },
};

const wiki = (j: Game) => (j as Shell).internal('wiki')!;
const workstation = (j: Game) => (j.state.workstation as (() => Shell) | undefined)?.();
// Les tunnels du poste encore ouverts (leur processus ssh tourne).
const openTunnels = (j: Game) => {
  const p = workstation(j);
  if (!p) return 0;
  const live = ((p.state.process ?? []) as { pid: number }[]).map((x) => x.pid);
  return ((p.state.tunnels ?? []) as { pid: number }[]).filter((t) => live.includes(t.pid)).length;
};
const approved = (j: Game) => VALIDATE.every((n) => signups(wiki(j))[n] === 'validee');
const approvedAdvert = (j: Game) => signups(wiki(j))[ADVERT] === 'validee';

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
  createWorld: (t) => homeWorld({ passwords: 'no', home: { 'email_yasmine.txt': f(t('tunnel-email-yasmine')), '.ssh': sshDirectory() } }),
  events: [
    { id: 'advert', condition: approvedAdvert, message: (j) => j.t('tunnel-event-advert', { account: ADVERT }) },
    { id: 'approved', condition: (j) => approved(j) && !approvedAdvert(j), message: (j) => j.t('tunnel-event-approved') },
    { id: 'end', condition: (j) => approved(j) && !approvedAdvert(j) && openTunnels(j) === 0, message: (j) => j.t('tunnel-event-end') },
  ],
};
