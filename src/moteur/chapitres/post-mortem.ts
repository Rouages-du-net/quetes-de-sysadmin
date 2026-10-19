// Histoire « L'Astreinte » — chapitre « Le post-mortem » : dimanche nuit,
// Théo était d'astreinte et le direct a coupé 45 minutes. Pour
// l'association, on écrit un post-mortem sans reproche. Les notes de Théo
// sont approximatives : les vraies heures et la vraie cause sont dans les
// journaux (journalctl --since/--until, last, l'historique d'apt, le
// courrier d'alerte). La mise à jour automatique (unattended-upgrades, avec
// needrestart) a relancé le relais à 2 h 13 ; il n'a pas pu repartir à
// cause d'une option inconnue écrite dans sa configuration le 20 août, et
// jamais appliquée depuis.
// Objectif vérifié sur l'état : le fichier ~/postmortem.md, complété (plus
// de « à compléter »), avec les heures exactes (2 h 13, 2 h 15, 2 h 58),
// l'impact (45 minutes), le déclencheur et la cause (flux.conf, depuis le
// 20 août), au moins deux actions, ce qui a marché, et sans reproche.
// Source : https://sre.google/sre-book/postmortem-culture/

import { d, f, fichiersComptes, type Chapitre, type Comptes, type Droits } from '../monde';
import type { Jeu } from '../shell';
import { journaliser, nouveauSystemd, systemd } from '../systemd';

const M = '/home/vous';
const FICHIER = `${M}/postmortem.md`;
// Lundi 13 septembre 2027, 10 h.
const MAINTENANT = Date.UTC(2027, 8, 13, 10, 0, 0);
const NUIT = (h: number, m: number, s = 0) => Date.UTC(2027, 8, 12, h, m, s);

const comptes = (): Comptes => ({
  utilisateurs: {
    root: { uid: 0, groupe: 'root', maison: '/root' },
    radio: { uid: 996, groupe: 'radio', maison: '/var/lib/radio', shell: '/usr/sbin/nologin' },
    vous: { uid: 1000, groupe: 'vous' },
    zoe: { uid: 1001, groupe: 'zoe' },
    theo: { uid: 1002, groupe: 'theo' },
  },
  groupes: {
    root: { gid: 0, membres: [] },
    adm: { gid: 4, membres: ['vous', 'zoe', 'theo'] },
    mail: { gid: 8, membres: [] },
    sudo: { gid: 27, membres: ['vous', 'zoe', 'theo'] },
    radio: { gid: 996, membres: [] },
    vous: { gid: 1000, membres: [] },
    zoe: { gid: 1001, membres: [] },
    theo: { gid: 1002, membres: [] },
  },
});

const sd = (j: Jeu) => systemd(j)!;

// Le texte du post-mortem, section par section (titres « ## », dans la langue du jeu).
function sections(j: Jeu, texte: string): Record<string, string> {
  const noms = ['resume', 'chronologie', 'impact', 'causes', 'marche', 'actions'];
  const titres = Object.fromEntries(noms.map((n) => [j.t(`post-mortem-section-${n}`).toLowerCase(), n]));
  const r: Record<string, string> = {};
  let courante = '';
  for (const ligne of texte.split('\n')) {
    const titre = /^##\s+(.*)$/.exec(ligne);
    if (titre) {
      courante = titres[titre[1].trim().toLowerCase()] ?? '';
      continue;
    }
    if (courante) r[courante] = `${r[courante] ?? ''}${ligne}\n`;
  }
  return r;
}

// Une heure, écrite 02:13, 2:13, 2 h 13 ou 2h13.
const heure = (h: number, m: number) => new RegExp(`\\b0?${h}\\s*(?::|h)\\s*${String(m).padStart(2, '0')}\\b`, 'i');
const mots = (j: Jeu, cle: string) =>
  j
    .t(cle)
    .split(',')
    .map((m) => m.trim().toLowerCase())
    .filter(Boolean);
const contientUn = (texte: string, liste: string[]) => liste.some((m) => texte.toLowerCase().includes(m));

/** Ce qui manque encore au post-mortem (identifiants de messages), vide s'il est complet. */
export function manques(j: Jeu): string[] {
  const texte = j.lire(FICHIER) ?? '';
  const s = sections(j, texte);
  const plein = (n: string) => (s[n] ?? '').trim().length > 0;
  const m: string[] = [];
  if (texte.includes(j.t('post-mortem-a-completer'))) m.push('modele');
  const chrono = s.chronologie ?? '';
  if (!heure(2, 13).test(chrono) || !heure(2, 15).test(chrono) || !heure(2, 58).test(chrono)) m.push('chronologie');
  if (!/\b45\b/.test(s.impact ?? '')) m.push('impact');
  const causes = s.causes ?? '';
  if (!/flux\.conf|bitrate_max/i.test(causes) || !contientUn(causes, mots(j, 'post-mortem-mots-declencheur'))) m.push('cause');
  if (!contientUn(causes, mots(j, 'post-mortem-mots-origine'))) m.push('origine');
  if ((s.actions ?? '').split('\n').filter((l) => /^\s*[-*]\s+\S/.test(l)).length < 2) m.push('actions');
  if (!plein('marche') || !plein('resume')) m.push('marche');
  return m;
}

// Un mot qui cherche un coupable, dans les sections (pas dans l'en-tête du modèle).
const reproche = (j: Jeu) => {
  const texte = Object.values(sections(j, j.lire(FICHIER) ?? ''))
    .join('\n')
    .toLowerCase();
  return mots(j, 'post-mortem-mots-reproche').find((mot) => texte.includes(mot));
};

export const postMortem: Chapitre = {
  id: 'post-mortem',
  numero: 6,
  commandes: [
    'ls',
    'cd',
    'pwd',
    'cat',
    'less',
    'head',
    'tail',
    'grep',
    'wc',
    'find',
    'echo',
    'id',
    'whoami',
    'ps',
    'sudo',
    'nano',
    'cp',
    'systemctl',
    'journalctl',
    'last',
    'mail',
    'diff',
  ],
  maison: M,
  accueil: 'message_de_zoe.txt',
  final: 'fin',
  motDePasse: 'antenne-2027',
  comptes,
  etat: () => ({
    systemd: nouveauSystemd('radio', Date.UTC(2027, 7, 1, 6, 0, 0), MAINTENANT, {
      ssh: {
        description: 'OpenBSD Secure Shell server',
        active: true,
        executable: 'sshd',
        processus: [{ pid: 598, utilisateur: 'root', cpu: 0, mem: 0.2, commande: 'sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups' }],
      },
      'radio-flux': {
        description: 'Radio Quartier stream relay',
        active: true,
        executable: 'flux',
        processus: [{ pid: 25232, utilisateur: 'radio', cpu: 3.2, mem: 1.1, commande: '/usr/local/bin/flux --config /etc/radio/flux.conf' }],
      },
      cron: {
        description: 'Regular background program processing daemon',
        active: true,
        executable: 'cron',
        processus: [{ pid: 611, utilisateur: 'root', cpu: 0, mem: 0.1, commande: '/usr/sbin/cron -f' }],
      },
      'apt-daily-upgrade': {
        description: 'Daily apt upgrade and clean activities',
        active: false,
        etat: 'inactive',
        executable: 'unattended-upgrade',
        ponctuel: true,
      },
      sonde: { description: 'Sonde de Radio Quartier', active: false, etat: 'inactive', executable: 'sonde', ponctuel: true },
    }),
    processus: [
      { pid: 1, utilisateur: 'root', cpu: 0, mem: 0.1, commande: '/sbin/init' },
      { pid: 598, utilisateur: 'root', cpu: 0, mem: 0.2, commande: 'sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups' },
      { pid: 611, utilisateur: 'root', cpu: 0, mem: 0.1, commande: '/usr/sbin/cron -f' },
      { pid: 25232, utilisateur: 'radio', cpu: 3.2, mem: 1.1, commande: '/usr/local/bin/flux --config /etc/radio/flux.conf' },
    ],
    connexionsPassees: [
      { compte: 'zoe', tty: 'pts/1', depuis: '198.51.100.80', debut: Date.UTC(2027, 7, 20, 21, 16), fin: Date.UTC(2027, 7, 20, 21, 54) },
      { compte: 'vous', tty: 'pts/0', depuis: '198.51.100.23', debut: Date.UTC(2027, 8, 6, 18, 25), fin: Date.UTC(2027, 8, 6, 19, 40) },
      { compte: 'theo', tty: 'pts/0', depuis: '203.0.113.45', debut: NUIT(2, 41), fin: NUIT(3, 5) },
      { compte: 'vous', tty: 'pts/0', depuis: '198.51.100.23', debut: MAINTENANT - 60_000, fin: null },
    ],
  }),
  // La nuit du 11 au 12 septembre, telle que le journal l'a gardée.
  initialiser: (j) => {
    const s = sd(j);
    const maintenant = s.horloge;
    const ligne = (ms: number, unite: string, ident: string, pid: number, message: string, priorite = 6) => {
      s.horloge = ms;
      journaliser(s, unite, ident, pid, message, priorite, false);
    };
    const flux = 'radio-flux.service';
    const sudo = (ms: number, pid: number, compte: string, commande: string) =>
      ligne(
        ms,
        '',
        'sudo',
        pid,
        `${compte.padStart(8)} : TTY=pts/${compte === 'zoe' ? 1 : 0} ; PWD=/home/${compte} ; USER=root ; COMMAND=${commande}`,
        5,
      );
    ligne(Date.UTC(2027, 7, 20, 21, 16, 2), 'ssh.service', 'sshd', 7712, 'Accepted publickey for zoe from 198.51.100.80 port 50122 ssh2');
    sudo(Date.UTC(2027, 7, 20, 21, 20, 41), 7790, 'zoe', '/usr/bin/nano /etc/radio/flux.conf');
    ligne(Date.UTC(2027, 7, 20, 21, 54, 10), 'ssh.service', 'sshd', 7712, 'Disconnected from user zoe 198.51.100.80 port 50122');
    ligne(
      NUIT(2, 12, 40),
      'apt-daily-upgrade.service',
      'systemd',
      1,
      'Starting apt-daily-upgrade.service - Daily apt upgrade and clean activities...',
    );
    ligne(NUIT(2, 13, 5), flux, 'systemd', 1, 'Stopping radio-flux.service - Radio Quartier stream relay...');
    ligne(NUIT(2, 13, 5), flux, 'systemd', 1, 'Stopped radio-flux.service - Radio Quartier stream relay.');
    ligne(NUIT(2, 13, 5), flux, 'systemd', 1, 'Started radio-flux.service - Radio Quartier stream relay.');
    ligne(NUIT(2, 13, 6), flux, 'flux', 24410, "/etc/radio/flux.conf:7: unknown option 'bitrate_max'", 3);
    ligne(NUIT(2, 13, 6), flux, 'systemd', 1, 'radio-flux.service: Main process exited, code=exited, status=1/FAILURE', 4);
    ligne(NUIT(2, 13, 6), flux, 'systemd', 1, "radio-flux.service: Failed with result 'exit-code'.", 4);
    ligne(NUIT(2, 13, 20), 'apt-daily-upgrade.service', 'systemd', 1, 'apt-daily-upgrade.service: Deactivated successfully.');
    ligne(NUIT(2, 13, 20), 'apt-daily-upgrade.service', 'systemd', 1, 'Finished apt-daily-upgrade.service - Daily apt upgrade and clean activities.');
    // La sonde du chapitre précédent, toutes les 5 minutes : elle alerte de 2 h 15 à 2 h 55.
    const alertes: string[] = [];
    for (let m = 15; m <= 55; m += 5) {
      ligne(NUIT(2, m), 'sonde.service', 'systemd', 1, 'Starting sonde.service - Sonde de Radio Quartier...');
      ligne(NUIT(2, m, 1), 'sonde.service', 'systemd', 1, 'Finished sonde.service - Sonde de Radio Quartier.');
      alertes.push(
        `From root@radio Sun Sep 12 02:${String(m).padStart(2, '0')}:01 2027\nTo: root\nSubject: Alerte-radio\nFrom: root <root@radio>\n\nconnect to address localhost and port 8000: Connection refused\nHTTP CRITICAL - Unable to open TCP socket\n`,
      );
      if (m === 40) ligne(NUIT(2, 41, 12), 'ssh.service', 'sshd', 25102, 'Accepted publickey for theo from 203.0.113.45 port 52114 ssh2');
      if (m === 40) sudo(NUIT(2, 44, 30), 25140, 'theo', '/usr/bin/journalctl -u radio-flux');
      if (m === 50) sudo(NUIT(2, 52, 10), 25188, 'theo', '/usr/bin/nano /etc/radio/flux.conf');
    }
    sudo(NUIT(2, 58, 3), 25230, 'theo', '/usr/bin/systemctl restart radio-flux');
    ligne(NUIT(2, 58, 3), flux, 'systemd', 1, 'Starting radio-flux.service - Radio Quartier stream relay...');
    ligne(NUIT(2, 58, 4), flux, 'systemd', 1, 'Started radio-flux.service - Radio Quartier stream relay.');
    ligne(NUIT(3, 5, 40), 'ssh.service', 'sshd', 25102, 'Disconnected from user theo 203.0.113.45 port 52114');
    ligne(MAINTENANT - 60_000, 'ssh.service', 'sshd', 26011, 'Accepted publickey for vous from 198.51.100.23 port 40388 ssh2');
    s.services['radio-flux'].depuis = NUIT(2, 58, 4);
    s.horloge = maintenant;
    const boite = j.trouver('/var/mail/theo');
    if (boite?.type === 'fichier') boite.contenu = alertes.join('\n');
    j.etat.postMortemLu = j.lire(FICHIER);
  },
  // Après chaque enregistrement du post-mortem, Zoé le relit.
  apresCommande: (j) => {
    const texte = j.lire(FICHIER);
    if (texte === j.etat.postMortemLu || j.etat.postMortemFini) return;
    j.etat.postMortemLu = texte;
    const mot = reproche(j);
    const reste = manques(j);
    if (!reste.length && !mot) {
      j.etat.postMortemFini = true;
      return;
    }
    return [
      j.t('post-mortem-relecture'),
      ...(mot ? [j.t('post-mortem-reproche', { mot })] : []),
      ...reste.map((m) => `- ${j.t(`post-mortem-manque-${m}`)}`),
    ].join('\n');
  },
  creerMonde: (t) => {
    const racine: Droits = { proprio: 'root' };
    const lieu = (enfants: Parameters<typeof d>[0], droits: Droits = racine) => d(enfants, undefined, droits);
    const fichier = (texte: string, droits: Droits = racine) => f(texte, { lignes: true, ...droits });
    const journal = (texte: string) => f(texte, { lignes: true, proprio: 'root', groupe: 'adm', mode: 'rw-r-----' });
    return lieu({
      etc: lieu({
        ...fichiersComptes(),
        hostname: fichier('radio'),
        aliases: fichier('# See man 5 aliases for format\npostmaster:    root\nroot: zoe, theo'),
        radio: lieu({ 'flux.conf': fichier(t('post-mortem-conf-flux')) }),
        apt: lieu({ 'apt.conf.d': lieu({ '50unattended-upgrades': fichier(t('post-mortem-unattended-conf')) }) }),
      }),
      home: lieu({
        vous: d({
          'message_de_zoe.txt': f(t('post-mortem-message-de-zoe')),
          'notes_theo.txt': f(t('post-mortem-notes-theo')),
          'postmortem.md': f(t('post-mortem-modele'), { lignes: true }),
        }),
        zoe: lieu({}, { proprio: 'zoe', mode: 'rwx------' }),
        theo: lieu({}, { proprio: 'theo', mode: 'rwx------' }),
      }),
      tmp: lieu({}, { proprio: 'root', mode: 'rwxrwxrwt' }),
      var: lieu({
        log: lieu({
          apt: lieu({ 'history.log': journal(t('post-mortem-apt-history')) }),
          'unattended-upgrades': lieu({ 'unattended-upgrades-dpkg.log': journal(t('post-mortem-unattended-dpkg')) }),
        }),
        mail: lieu(
          { theo: f('', { lignes: true, proprio: 'theo', groupe: 'mail', mode: 'rw-rw----' }) },
          { proprio: 'root', groupe: 'mail', mode: 'rwxrwsr-x' },
        ),
      }),
    });
  },
  evenements: [
    {
      id: 'notes',
      condition: (j) => j.derniere.commandes.some((c) => c.some((a) => a.endsWith('notes_theo.txt'))),
      message: (j) => j.t('post-mortem-evenement-notes'),
    },
    {
      id: 'redemarrage',
      condition: (j) => /Stopping radio-flux\.service/.test(j.derniere.sortie) && /Starting apt-daily-upgrade/.test(j.derniere.sortie),
      message: (j) => j.t('post-mortem-evenement-redemarrage'),
    },
    {
      id: 'origine',
      condition: (j) => /zoe : TTY=pts\/1 .*flux\.conf/.test(j.derniere.sortie),
      message: (j) => j.t('post-mortem-evenement-origine'),
    },
    { id: 'fin', condition: (j) => !!j.etat.postMortemFini, message: (j) => j.t('post-mortem-evenement-fin') },
  ],
};
