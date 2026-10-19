// Histoire « L'Astreinte » — chapitre « La sonde » : après quatre nuits à
// réparer après coup, Zoé veut être prévenue avant que ça casse. Elle a
// commencé une sonde (/usr/local/bin/sonde) qui lance des plugins de
// supervision (monitoring-plugins : check_disk, check_http, check_procs) et
// envoie par courrier tout ce qui n'est pas OK. À compléter (le volume des
// données et ses inodes, le direct) et à planifier toutes les 5 minutes
// (un timer systemd, ou cron). Puis Zoé organise un exercice : cette nuit,
// elle provoquera deux pannes (le relais qui tombe, des milliers de petits
// fichiers qui épuisent les inodes du volume des données).
// Objectif vérifié sur l'état, après la nuit simulée : chaque panne a donné
// une alerte à temps (le relais en moins de 15 minutes, les inodes avant
// d'être épuisés), et aucune alerte n'est partie quand tout allait bien.
// Sources : https://www.monitoring-plugins.org/doc/guidelines.html,
// https://www.freedesktop.org/software/systemd/man/latest/systemd.timer.html

import { d, f, fichiersComptes, type Chapitre, type Comptes, type Dossier, type Droits } from '../monde';
import type { Jeu, Shell } from '../shell';
import { demarrer, journaliser, nouveauSystemd, systemd } from '../systemd';
import { passerTemps } from '../minuteries';
import { courriers, PLUGINS } from '../commandes/supervision';

const M = '/home/vous';
const DONNEES = '/srv/radio';
const VIGNETTES = '/srv/radio/podcasts/vignettes';
const MINUTE = 60_000;
const INODES = 16_384;
// Lundi 6 septembre 2027, 18 h 30.
const MAINTENANT = Date.UTC(2027, 8, 6, 18, 30, 0);
// Les deux pannes de l'exercice, en minutes après minuit, et le délai pour réagir.
const PANNE_RELAIS = 70; // 1 h 10
const DELAI_RELAIS = 15;
const PANNE_INODES = 100; // 1 h 40 : l'import commence
const PAR_MINUTE = 120;

const comptes = (): Comptes => ({
  utilisateurs: {
    root: { uid: 0, groupe: 'root', maison: '/root' },
    radio: { uid: 996, groupe: 'radio', maison: '/var/lib/radio', shell: '/usr/sbin/nologin' },
    vous: { uid: 1000, groupe: 'vous' },
    zoe: { uid: 1001, groupe: 'zoe' },
  },
  groupes: {
    root: { gid: 0, membres: [] },
    adm: { gid: 4, membres: ['vous', 'zoe'] },
    mail: { gid: 8, membres: [] },
    sudo: { gid: 27, membres: ['vous', 'zoe'] },
    radio: { gid: 996, membres: [] },
    vous: { gid: 1000, membres: [] },
    zoe: { gid: 1001, membres: [] },
  },
});

const sd = (j: Jeu) => systemd(j)!;
const shell = (j: Jeu) => j as Shell;
const relais = (j: Jeu) => sd(j).services['radio-flux'];
const volume = (j: Jeu) => shell(j).montage(DONNEES)!;
const heure = (ms: number) => new Date(ms).toISOString().slice(11, 16);
// Les alertes que Zoé reçoit (directement, ou par l'alias de root).
const alertesPourZoe = (j: Jeu) => courriers(shell(j)).filter((c) => c.a === 'zoe');

// Ce qui décide d'une nouvelle nuit : la sonde, les crontabs, et les timers tels que systemd les a chargés.
function empreinte(j: Jeu): string {
  const timers = Object.entries(sd(j).minuteries ?? {}).map(([n, m]) => [
    n,
    m.etat,
    m.unite,
    m.calendrier,
    m.apresDemarrage,
    m.apresActivation,
    m.apresDerniere,
  ]);
  const services = Object.entries(sd(j).services)
    .filter(([, x]) => x.fichier)
    .map(([n, x]) => [n, x.fichier]);
  return JSON.stringify([j.lire('/usr/local/bin/sonde'), j.etat.crontabs, timers, services]);
}

// Quelque chose est-il planifié (un timer actif, une ligne de crontab) ?
const planifie = (j: Jeu) =>
  Object.values(sd(j).minuteries ?? {}).some((m) => m.etat === 'active' && m.fichier.startsWith('/etc/')) ||
  Object.values((j.etat.crontabs ?? {}) as Record<string, string>).some((t) => t.split('\n').some((l) => l.trim() && !l.trim().startsWith('#')));

/** La nuit d'exercice : de maintenant à 6 h, deux pannes ; Zoé réagit aux alertes qu'elle reçoit. */
function nuit(j: Jeu): string {
  const s = sd(j);
  const debut = s.horloge;
  const minuit = (Math.floor(debut / 86_400_000) + 1) * 86_400_000;
  const fin = minuit + 6 * 60 * MINUTE;
  const dejaRecues = alertesPourZoe(j).length;
  const lieu = () => j.trouver(VIGNETTES) as Dossier | null;
  // Les fenêtres où une alerte est attendue : [début, réparation + 15 min].
  const relaisTombe = minuit + PANNE_RELAIS * MINUTE;
  const importDebut = minuit + PANNE_INODES * MINUTE;
  let relaisAlerte: number | null = null;
  let relaisRepare: number | null = null;
  let inodesAlerte: number | null = null;
  let inodesArrete: number | null = null;
  let inodesPleins: number | null = null;
  let fausses = 0;
  let vues = dejaRecues;
  let numero = 0;
  const pendant = (t: number, debutPanne: number, repare: number | null) => t >= debutPanne && t <= (repare ?? Infinity) + 15 * MINUTE;
  const lancements = passerTemps(shell(j), debut, fin, (t) => {
    // Les courriers arrivés depuis la minute d'avant : Zoé les lit.
    const recues = alertesPourZoe(j);
    for (const c of recues.slice(vues)) {
      const relaisEnPanne = pendant(c.temps, relaisTombe, relaisRepare);
      const inodesEnPanne = pendant(c.temps, importDebut, inodesArrete);
      if (relaisEnPanne && relaisAlerte === null && relais(j).etat !== 'active') relaisAlerte = c.temps;
      if (inodesEnPanne && inodesAlerte === null && inodesArrete === null) inodesAlerte = c.temps;
      if (!relaisEnPanne && !inodesEnPanne) fausses++;
    }
    vues = recues.length;
    // Panne 1 : le relais tombe.
    if (t === relaisTombe) {
      relais(j).etat = 'failed';
      relais(j).resultat = 'signal';
      relais(j).depuis = t;
      j.etat.processus = (j.etat.processus ?? []).filter((p: { pid: number }) => p.pid !== 1730);
      journaliser(s, 'radio-flux.service', 'systemd', 1, 'radio-flux.service: Main process exited, code=killed, status=11/SEGV', 4, false);
      journaliser(s, 'radio-flux.service', 'systemd', 1, "radio-flux.service: Failed with result 'signal'.", 4, false);
    }
    // Zoé relance le relais 10 minutes après l'alerte (ou à son réveil, à 6 h).
    if (relaisAlerte !== null && relaisRepare === null && t >= relaisAlerte + 10 * MINUTE) {
      demarrer(j, s, 'radio-flux');
      relaisRepare = t;
    }
    // Panne 2 : l'import des vignettes crée des milliers de petits fichiers, jusqu'à ce que Zoé l'arrête.
    if (t >= importDebut && inodesArrete === null && inodesPleins === null) {
      const v = lieu();
      const libres = INODES - shell(j).inodesUtilises(volume(j));
      const combien = Math.min(PAR_MINUTE, libres);
      if (v)
        for (let k = 0; k < combien; k++)
          v.enfants[`vignette-${String(++numero).padStart(5, '0')}.jpg`] = { type: 'fichier', contenu: '', taille: 0, proprio: 'radio' };
      if (libres <= PAR_MINUTE) {
        inodesPleins = t;
        journaliser(s, 'radio-flux.service', 'flux', 1730, `record: cannot create /srv/radio/emissions/nuit.ogg: No space left on device`, 3, false);
      }
    }
    // Zoé arrête l'import et efface les vignettes en trop, 10 minutes après l'alerte.
    if (inodesAlerte !== null && inodesArrete === null && t >= inodesAlerte + 10 * MINUTE) {
      inodesArrete = t;
      const v = lieu();
      if (v) v.enfants = {};
    }
  });
  // Au matin, Zoé remet tout d'aplomb (et note ce qui s'est passé).
  if (relais(j).etat !== 'active') demarrer(j, s, 'radio-flux');
  const v = lieu();
  if (v) v.enfants = {};
  const r: string[] = [j.t('sonde-nuit', { lancements })];
  r.push(
    relaisAlerte !== null
      ? j.t('sonde-nuit-relais-vu', {
          alerte: heure(relaisAlerte),
          repare: heure(relaisRepare ?? relaisAlerte),
          minutes: Math.round(((relaisRepare ?? relaisAlerte) - relaisTombe) / MINUTE),
        })
      : j.t('sonde-nuit-relais-rate'),
  );
  r.push(
    inodesAlerte !== null && (inodesPleins === null || inodesAlerte < inodesPleins)
      ? j.t('sonde-nuit-inodes-vu', { alerte: heure(inodesAlerte) })
      : j.t('sonde-nuit-inodes-rate', { plein: heure(inodesPleins ?? fin) }),
  );
  if (fausses) r.push(j.t('sonde-nuit-fausses', { nombre: fausses }));
  if (!lancements) r.push(j.t('sonde-nuit-jamais'));
  const relaisOk = relaisAlerte !== null && relaisAlerte - relaisTombe <= DELAI_RELAIS * MINUTE;
  const inodesOk = inodesAlerte !== null && (inodesPleins === null || inodesAlerte < inodesPleins);
  if (relaisOk && inodesOk && !fausses) j.etat.exerciceReussi = true;
  else if (relaisAlerte !== null && !relaisOk) r.push(j.t('sonde-nuit-relais-lent'));
  // Le matin : 7 h.
  s.horloge = fin + 60 * MINUTE;
  return r.join('\n\n');
}

export const sonde: Chapitre = {
  id: 'sonde',
  numero: 5,
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
    'chmod',
    'touch',
    'mkdir',
    'cp',
    'df',
    'du',
    'curl',
    'systemctl',
    'journalctl',
    'crontab',
    'date',
    'mail',
    'check_disk',
    'check_http',
    'check_procs',
    'systemd-analyze',
  ],
  maison: M,
  accueil: 'message_de_zoe.txt',
  final: 'fin',
  motDePasse: 'antenne-2027',
  comptes,
  etat: () => ({
    systemd: (() => {
      const s = nouveauSystemd('radio', Date.UTC(2027, 7, 30, 9, 30, 0), MAINTENANT, {
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
        logrotate: { description: 'Rotate log files', active: false, etat: 'inactive', executable: 'logrotate', ponctuel: true },
      });
      // Les timers livrés avec Debian.
      s.minuteries = {
        logrotate: {
          description: 'Daily rotation of log files',
          unite: 'logrotate',
          calendrier: ['daily'],
          active: true,
          etat: 'active',
          depuis: s.horloge,
          fichier: '/usr/lib/systemd/system/logrotate.timer',
          dernier: Date.UTC(2027, 8, 6, 0, 0, 0),
        },
      };
      return s;
    })(),
    processus: [
      { pid: 1, utilisateur: 'root', cpu: 0, mem: 0.1, commande: '/sbin/init' },
      { pid: 598, utilisateur: 'root', cpu: 0, mem: 0.2, commande: 'sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups' },
      { pid: 611, utilisateur: 'root', cpu: 0, mem: 0.1, commande: '/usr/sbin/cron -f' },
      { pid: 1730, utilisateur: 'radio', cpu: 3.2, mem: 1.1, commande: '/usr/local/bin/flux --config /etc/radio/flux.conf' },
    ],
    // Le relais sert le direct sur le port 8000.
    applis: { '127.0.0.1:8000': { service: 'radio-flux', pages: { '/direct': 'OggS', '/': 'Radio Quartier relay' } } },
    ecoute: [{ proto: 'tcp', adresse: '0.0.0.0', port: 8000, processus: 'flux', pid: 1730 }],
    montages: [
      { chemin: '/', capacite: 20_000_000_000, nom: '/dev/vda1', systeme: 'ext4', inodes: 1_310_720, inodesBase: 61_204 },
      { chemin: DONNEES, capacite: 268_435_456, nom: '/dev/vdb1', systeme: 'ext4', inodes: INODES, inodesBase: 11 },
    ],
    crontabs: {},
  }),
  apresCommande: (j) => {
    sd(j).horloge += 20_000;
    if (j.etat.exerciceReussi || !planifie(j) || j.etat.empreinteNuit === empreinte(j)) return;
    j.etat.empreinteNuit = empreinte(j);
    return nuit(j);
  },
  creerMonde: (t) => {
    const racine: Droits = { proprio: 'root' };
    const lieu = (enfants: Parameters<typeof d>[0], droits: Droits = racine) => d(enfants, undefined, droits);
    const fichier = (texte: string, droits: Droits = racine) => f(texte, { lignes: true, ...droits });
    const plugin = () => f('', { proprio: 'root', mode: 'rwxr-xr-x', taille: 180_000 });
    const radio: Droits = { proprio: 'radio' };
    return lieu({
      etc: lieu({
        ...fichiersComptes(),
        hostname: fichier('radio'),
        aliases: fichier('# See man 5 aliases for format\npostmaster:    root\nroot: zoe'),
        systemd: lieu({ system: lieu({}) }),
      }),
      home: lieu({ vous: d({ 'message_de_zoe.txt': f(t('sonde-message-de-zoe')) }), zoe: lieu({}, { proprio: 'zoe', mode: 'rwx------' }) }),
      srv: lieu({
        radio: lieu(
          {
            'lost+found': lieu({}, { proprio: 'root', mode: 'rwx------' }),
            emissions: lieu(
              {
                'matinale-2027-09-06.ogg': f('', { proprio: 'radio', taille: 92_000_000 }),
                'nuit-2027-09-06.ogg': f('', { proprio: 'radio', taille: 48_000_000 }),
              },
              radio,
            ),
            podcasts: lieu({ vignettes: lieu({}, radio), 'LISEZMOI.txt': fichier(t('sonde-podcasts-lisezmoi'), radio) }, radio),
          },
          radio,
        ),
      }),
      tmp: lieu({}, { proprio: 'root', mode: 'rwxrwxrwt' }),
      usr: lieu({
        lib: lieu({
          nagios: lieu({ plugins: lieu({ check_disk: plugin(), check_http: plugin(), check_procs: plugin() }) }),
          modules: f('', { proprio: 'root', taille: 9_000_000_000 }),
        }),
        local: lieu({
          bin: lieu({
            sonde: fichier(t('sonde-script'), { proprio: 'root', mode: 'rwxr-xr-x' }),
            flux: f('', { proprio: 'root', mode: 'rwxr-xr-x', taille: 8_400_000 }),
          }),
        }),
      }),
      var: lieu({ mail: lieu({}, { proprio: 'root', groupe: 'mail', mode: 'rwxrwsr-x' }), lib: lieu({ radio: lieu({}, radio) }) }),
    });
  },
  evenements: [
    {
      id: 'plugin-hors-path',
      condition: (j) => j.derniere.commandes.some((c) => /^check_/.test(c[0]) || (c[0] === 'sudo' && /^check_/.test(c[1] ?? ''))),
      message: (j) => j.t('sonde-evenement-plugin-hors-path', { dossier: PLUGINS }),
    },
    {
      id: 'premiere-alerte',
      condition: (j) => !j.etat.empreinteNuit && alertesPourZoe(j).length > 0,
      message: (j) => j.t('sonde-evenement-premiere-alerte'),
    },
    { id: 'fin', condition: (j) => !!j.etat.exerciceReussi, message: (j) => j.t('sonde-evenement-fin') },
  ],
};
