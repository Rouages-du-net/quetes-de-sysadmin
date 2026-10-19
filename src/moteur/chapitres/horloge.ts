// Histoire « L'Astreinte » — chapitre « L'horloge » : lundi matin, la
// matinale (6 h – 9 h) ne s'est enregistrée qu'à partir de 8 h 09. Le
// serveur, migré ce week-end, vit à l'heure UTC (cron lance l'enregistrement
// à 6 h UTC, 8 h à Paris) et son horloge retarde : NTP est arrêté, et la
// configuration de timesyncd vise le serveur NTP de l'ancien hébergeur, qui
// ne répond pas. On règle le fuseau, on donne le bon serveur NTP, on active
// la synchronisation, et on redémarre cron (qui lit le fuseau au démarrage).
// Objectif vérifié sur l'état : fuseau Europe/Paris, horloge synchronisée
// par timesyncd (activé au démarrage), cron redémarré après le changement.
// Sources : https://www.freedesktop.org/software/systemd/man/latest/timedatectl.html,
// https://www.freedesktop.org/software/systemd/man/latest/timesyncd.conf.html,
// https://wiki.debian.org/TimeZoneChanges

import { d, f, fichiersComptes, type Chapitre, type Comptes, type Droits } from '../monde';
import type { Jeu } from '../shell';
import { nouveauSystemd, systemd } from '../systemd';
import { desynchroniser, heure, majAffichage, synchroniser } from '../heure';

const M = '/home/vous';
// La vraie heure : lundi 30 août 2027, 9 h 12 à Paris (heure locale lue comme UTC).
const MAINTENANT = Date.UTC(2027, 7, 30, 9, 12, 0);

const comptes = (): Comptes => ({
  utilisateurs: {
    root: { uid: 0, groupe: 'root', maison: '/root' },
    radio: { uid: 996, groupe: 'radio', maison: '/var/lib/radio', shell: '/usr/sbin/nologin' },
    'systemd-timesync': { uid: 997, groupe: 'systemd-timesync', maison: '/', shell: '/usr/sbin/nologin' },
    vous: { uid: 1000, groupe: 'vous' },
    zoe: { uid: 1001, groupe: 'zoe' },
  },
  groupes: {
    root: { gid: 0, membres: [] },
    adm: { gid: 4, membres: ['vous', 'zoe'] },
    sudo: { gid: 27, membres: ['vous', 'zoe'] },
    radio: { gid: 996, membres: [] },
    'systemd-timesync': { gid: 997, membres: [] },
    vous: { gid: 1000, membres: [] },
    zoe: { gid: 1001, membres: [] },
  },
});

const sd = (j: Jeu) => systemd(j)!;
const h = (j: Jeu) => heure(j)!;
const timesyncd = (j: Jeu) => sd(j).services['systemd-timesyncd'];
const aParis = (j: Jeu) => h(j).fuseau === 'Europe/Paris';
// cron lit le fuseau à son démarrage : a-t-il redémarré depuis le changement ?
const cronAJour = (j: Jeu) =>
  h(j).fuseauChange !== undefined && sd(j).services.cron.etat === 'active' && sd(j).services.cron.depuis >= h(j).fuseauChange!;
const commandes = (j: Jeu, ...noms: string[]) => j.derniere.commandes.some((c) => noms.includes(c[0]) || (c[0] === 'sudo' && noms.includes(c[1])));

export const horloge: Chapitre = {
  id: 'horloge',
  numero: 4,
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
    'systemctl',
    'journalctl',
    'crontab',
    'date',
    'timedatectl',
  ],
  maison: M,
  accueil: 'message_de_zoe.txt',
  final: 'fin',
  motDePasse: 'antenne-2027',
  comptes,
  etat: () => ({
    systemd: nouveauSystemd('radio', Date.UTC(2027, 7, 28, 22, 40, 0), MAINTENANT, {
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
        processus: [{ pid: 1730, utilisateur: 'radio', cpu: 3.2, mem: 1.1, commande: '/usr/local/bin/flux --config /etc/radio/flux.conf' }],
      },
      cron: {
        description: 'Regular background program processing daemon',
        active: true,
        executable: 'cron',
        processus: [{ pid: 611, utilisateur: 'root', cpu: 0, mem: 0.1, commande: '/usr/sbin/cron -f' }],
      },
      'systemd-timesyncd': {
        description: 'Network Time Synchronization',
        active: false,
        etat: 'inactive',
        executable: 'systemd-timesyncd',
        processus: [{ pid: 702, utilisateur: 'systemd-timesync', cpu: 0, mem: 0.1, commande: '/lib/systemd/systemd-timesyncd' }],
        charger: synchroniser,
        arret: desynchroniser,
      },
    }),
    processus: [
      { pid: 1, utilisateur: 'root', cpu: 0, mem: 0.1, commande: '/sbin/init' },
      { pid: 598, utilisateur: 'root', cpu: 0, mem: 0.2, commande: 'sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups' },
      { pid: 611, utilisateur: 'root', cpu: 0, mem: 0.1, commande: '/usr/sbin/cron -f' },
      { pid: 1730, utilisateur: 'radio', cpu: 3.2, mem: 1.1, commande: '/usr/local/bin/flux --config /etc/radio/flux.conf' },
    ],
    // La machine : en UTC, et son horloge retarde de 9 minutes.
    heure: {
      fuseau: 'Etc/UTC',
      decalage: -9 * 60_000 - 17_000,
      synchronise: false,
      serveurs: { 'ntp.hebergeur.example': '192.0.2.123' },
      // Les serveurs NTP publics sont filtrés par l'hébergeur ; l'ancien ne répond plus.
      muets: {
        'ntp.ancien-hebergeur.example': '198.51.100.7',
        '0.debian.pool.ntp.org': '203.0.113.10',
        '1.debian.pool.ntp.org': '203.0.113.11',
        '2.debian.pool.ntp.org': '203.0.113.12',
        '3.debian.pool.ntp.org': '203.0.113.13',
      },
    },
    crontabs: {
      radio: '# m h  dom mon dow   command\n0 6 * * 1-5 /usr/local/bin/enregistrer matinale 180\n0 23 * * * /usr/local/bin/enregistrer nuit 240\n',
    },
  }),
  initialiser: (j) => majAffichage(j),
  // Chaque commande, quelques secondes passent ; sans NTP, l'horloge prend encore du retard.
  apresCommande: (j) => {
    sd(j).horloge += 5000;
    if (!h(j).synchronise) h(j).decalage -= 1000;
    majAffichage(j);
  },
  creerMonde: (t) => {
    const racine: Droits = { proprio: 'root' };
    const lieu = (enfants: Parameters<typeof d>[0], droits: Droits = racine) => d(enfants, undefined, droits);
    const fichier = (texte: string, droits: Droits = racine) => f(texte, { lignes: true, ...droits });
    return lieu({
      etc: lieu({
        ...fichiersComptes(),
        hostname: fichier('radio'),
        timezone: fichier('Etc/UTC'),
        localtime: f('', { proprio: 'root', lien: '/usr/share/zoneinfo/Etc/UTC' }),
        systemd: lieu({ 'timesyncd.conf': fichier(t('horloge-timesyncd-conf')), system: lieu({}) }),
      }),
      home: lieu({
        vous: d({ 'message_de_zoe.txt': f(t('horloge-message-de-zoe')), 'mail_hebergeur.txt': f(t('horloge-mail-hebergeur')) }),
        zoe: lieu({}, { proprio: 'zoe', mode: 'rwx------' }),
      }),
      tmp: lieu({}, { proprio: 'root', mode: 'rwxrwxrwt' }),
      usr: lieu({ local: lieu({ bin: lieu({ enregistrer: fichier(t('horloge-script-enregistrer'), { proprio: 'root', mode: 'rwxr-xr-x' }) }) }) }),
      var: lieu({
        log: lieu({
          radio: lieu(
            { 'enregistrer.log': f(t('horloge-journal-enregistrer'), { lignes: true, proprio: 'radio', groupe: 'adm', mode: 'rw-r-----' }) },
            { proprio: 'radio', groupe: 'adm', mode: 'rwxr-x---' },
          ),
        }),
      }),
    });
  },
  evenements: [
    {
      id: 'utc',
      condition: (j) => commandes(j, 'date', 'timedatectl') && /\bUTC\b/.test(j.derniere.sortie) && !aParis(j),
      message: (j) => j.t('horloge-evenement-utc'),
    },
    {
      id: 'retard',
      condition: (j) => commandes(j, 'timedatectl') && /synchronized: no/.test(j.derniere.sortie),
      message: (j) => j.t('horloge-evenement-retard'),
    },
    { id: 'manuel', condition: (j) => !!h(j).manuel && !h(j).synchronise, message: (j) => j.t('horloge-evenement-manuel') },
    { id: 'muet', condition: (j) => timesyncd(j).etat === 'active' && !h(j).synchronise, message: (j) => j.t('horloge-evenement-muet') },
    { id: 'synchro', condition: (j) => h(j).synchronise, message: (j) => j.t('horloge-evenement-synchro') },
    { id: 'non-active', condition: (j) => h(j).synchronise && !timesyncd(j).active, message: (j) => j.t('horloge-evenement-non-active') },
    {
      id: 'cron',
      condition: (j) => aParis(j) && !cronAJour(j) && commandes(j, 'timedatectl', 'date', 'systemctl', 'crontab'),
      message: (j) => j.t('horloge-evenement-cron'),
    },
    {
      id: 'fin',
      condition: (j) => aParis(j) && h(j).synchronise && timesyncd(j).etat === 'active' && timesyncd(j).active && cronAJour(j),
      message: (j) => j.t('horloge-evenement-fin'),
    },
  ],
};
