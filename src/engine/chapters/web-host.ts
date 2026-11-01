// Histoire « La Maison des associations » — chapitre « L'hébergeur » : le
// nouveau site de la Maison est prêt sur le wiki (/srv/wiki/site). Il est
// publié chez un hébergeur mutualisé, qui ne propose que FTP… et refuse
// désormais le FTP en clair. Gaspard publiait avec FileZilla, sans
// chiffrement, sur ftp.community.example (un nom qui pointe chez l'hébergeur,
// mais que son certificat ne couvre pas).
//   - rapatrier le site du wiki sur le poste, par SSH (sftp, get -r) ;
//   - le publier en FTPS avec lftp, sur le nom de l'hébergeur
//     (ftp.hosting.example), certificat vérifié ;
//   - mirror -R (du poste vers l'hébergement), dans public_html, avec
//     --delete (la page des tarifs de 2025 ne doit plus être en ligne).
// Objectif vérifié sur l'état : public_html contient exactement le site du
// wiki, et le dernier envoi est passé chiffré, certificat vérifié.
// Sources : https://man.openbsd.org/sftp, https://lftp.yar.ru/lftp-man.html,
// https://www.rfc-editor.org/rfc/rfc4217

import { d, f, type Chapter, type Directory } from '../world';
import type { Game, Shell } from '../shell';
import { filesFor, hosting, HOSTINGS, node } from '../web-host';
import { loadSshd, homeAccounts, sshDirectory, homeState, internalHost, M, homeWorld, PASSWORD, homePlan } from './community-centre';

export const ACCOUNT = 'maisonasso';
export const FTP_PASSWORD = 'Kp7-hebergement-2028';
const SITE = '/srv/wiki/site';

const STYLE = `body { font-family: system-ui, sans-serif; margin: 2rem auto; max-width: 40rem; }
header { border-bottom: 2px solid #2a6f4e; }
a { color: #2a6f4e; }`;
const LOGO = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="30" fill="#2a6f4e"/></svg>';

const page = (t: (id: string) => string, id: string) => f(t(id), { lines: true, owner: 'www-data', mode: 'rw-r--r--' });

// L'hébergement de la Maison : l'ancien site, en ligne depuis 2025.
HOSTINGS.hebergeur = {
  names: ['ftp.hosting.example', 'hosting.example', 'ftp.community.example'],
  address: '203.0.113.80',
  certificate: ['*.hosting.example', 'hosting.example'],
  accounts: { [ACCOUNT]: FTP_PASSWORD },
  files: (t) => ({
    [ACCOUNT]: d({
      public_html: d({
        'index.html': f(t('web-host-old-index'), { lines: true }),
        'agenda.html': f(t('web-host-old-agenda'), { lines: true }),
        'tarifs-2025.html': f(t('web-host-old-prices'), { lines: true }),
      }),
      tmp: d({}),
    }),
  }),
};

const workstation = (j: Game) => (j.state.workstation as (() => Shell) | undefined)?.();
const wiki = (j: Game) => (j as Shell).internal('wiki');

// Le site du wiki, par chemin relatif.
function wikiSite(j: Game): Record<string, string> {
  const w = wiki(j);
  const res: Record<string, string> = {};
  const walk = (path: string, rel: string) => {
    const n = w?.find(path);
    if (!n) return;
    if (n.type === 'directory') for (const k of Object.keys(n.children)) walk(`${path}/${k}`, rel ? `${rel}/${k}` : k);
    else res[rel] = w!.read(path) ?? '';
  };
  walk(SITE, '');
  return res;
}

const inLine = (j: Game) => {
  const p = workstation(j);
  return p ? hosting(p, 'hebergeur') : null;
};
const htmlPublic = (j: Game) => {
  const h = inLine(j);
  return h ? (filesFor(h.roots[ACCOUNT], '/public_html') ?? {}) : {};
};
const published = (j: Game) => {
  const online = htmlPublic(j);
  const site = wikiSite(j);
  return Object.keys(site).length > 0 && Object.entries(site).every(([k, v]) => online[k] === v);
};
const exact = (j: Game) => published(j) && Object.keys(htmlPublic(j)).length === Object.keys(wikiSite(j)).length;
const lastSend = (j: Game) =>
  inLine(j)
    ?.log.filter((e) => e.send)
    .at(-1);
const refusal = (j: Game, what: 'plain' | 'certificate') => !!(workstation(j)?.state.ftpRefusal as string[] | undefined)?.includes(what);

export const host: Chapter = {
  id: 'web-host',
  number: 5,
  plan: homePlan({ host: true }),
  commands: ['ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'find', 'id', 'whoami', 'hostname', 'ssh', 'scp', 'sftp', 'lftp'],
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
      commands: ['ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'grep', 'find', 'du', 'id', 'whoami', 'hostname'],
      more: (t) => ({
        srv: d(
          {
            wiki: d({
              site: d(
                {
                  'index.html': page(t, 'web-host-index'),
                  'agenda.html': page(t, 'web-host-agenda'),
                  'adhesion.html': page(t, 'web-host-membership'),
                  'style.css': f(STYLE, { lines: true, owner: 'www-data' }),
                  images: d({ 'logo.svg': f(LOGO, { lines: true, owner: 'www-data' }) }, undefined, { owner: 'www-data' }),
                },
                undefined,
                { owner: 'www-data' },
              ) as Directory,
            }),
          },
          undefined,
          { owner: 'root' },
        ),
      }),
    }),
  },
  createWorld: (t) =>
    homeWorld({
      passwords: 'no',
      home: {
        '.ssh': sshDirectory(),
        'email_yasmine.txt': f(t('web-host-email-yasmine', { account: ACCOUNT, password: FTP_PASSWORD })),
        'email_hosting.txt': f(t('web-host-email-host'), { lines: true }),
        'notes-gaspard.txt': f(t('web-host-notes-gaspard'), { lines: true }),
      },
    }),
  events: [
    { id: 'clear', condition: (j) => refusal(j, 'plain'), message: (j) => j.t('web-host-event-clear') },
    { id: 'certificate', condition: (j) => refusal(j, 'certificate'), message: (j) => j.t('web-host-event-certificate') },
    {
      id: 'without-verification',
      condition: (j) => !!inLine(j)?.log.some((e) => !e.checked),
      message: (j) => j.t('web-host-event-without-verification'),
    },
    {
      id: 'bad-direction',
      condition: (j) => !!workstation(j)?.read('~/site/tarifs-2025.html') || !!workstation(j)?.read('~/public_html/tarifs-2025.html'),
      message: (j) => j.t('web-host-event-bad-direction'),
    },
    {
      id: 'bad-directory',
      condition: (j) => {
        const h = inLine(j);
        return !!h && Object.keys(h.roots[ACCOUNT].children).some((k) => !['public_html', 'tmp'].includes(k)) && !published(j);
      },
      message: (j) => j.t('web-host-event-bad-directory'),
    },
    {
      id: 'rest',
      condition: (j) => published(j) && !!node(inLine(j)!.roots[ACCOUNT], '/public_html/tarifs-2025.html'),
      message: (j) => j.t('web-host-event-rest'),
    },
    { id: 'end', condition: (j) => exact(j) && !!lastSend(j)?.tls && !!lastSend(j)?.checked, message: (j) => j.t('web-host-event-end') },
  ],
};
