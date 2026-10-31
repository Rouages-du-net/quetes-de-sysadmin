// Histoire « L'Astreinte » — chapitre « Les inodes » : l'enregistrement de
// nuit échoue encore (« No space left on device »), mais df -h dit que le
// volume des données est presque vide. Chaque fichier occupe un inode, et
// il n'y en a plus : le relais écrit un petit fichier par écoute depuis six
// mois (df -i, du --inodes). rm * échoue (« Liste d'arguments trop
// longue ») ; find … -mtime +30 -delete efface les vieux en gardant le
// dernier mois, et une tâche cron le refait chaque nuit.
// Objectif vérifié sur l'état : après une nuit simulée (la tâche cron
// tourne), aucun fichier de moins de 31 jours n'a disparu, le plus ancien a
// au plus 60 jours, et le volume est sous 80 % d'inodes ; l'enregistrement
// de nuit a pu être écrit.
// Sources : https://www.gnu.org/software/coreutils/manual/html_node/df-invocation.html,
// https://www.gnu.org/software/findutils/manual/html_mono/find.html (-mtime, -delete),
// https://man7.org/linux/man-pages/man2/execve.2.html (E2BIG, ARG_MAX)

import { chemin, d, f, fichiersComptes, type Chapitre, type Comptes, type Dossier, type Droits, type Fichier } from '../world';
import type { Jeu, Shell } from '../shell';
import { journaliser, nouveauSystemd, systemd } from '../systemd';
import { passer } from '../cron';

const M = '/home/vous';
const DONNEES = '/srv/radio';
const STATS = '/srv/radio/stats';
const JOUR = 86_400_000;
const INODES = 65_536;
// Le soir de l'incident : dimanche 29 août 2027, 3 h 20 (heure locale lue comme UTC).
const MAINTENANT = Date.UTC(2027, 7, 29, 3, 20, 0);
// Les statistiques commencent le 1er mars : un fichier par écoute, environ 360 par jour.
const DEBUT = Date.UTC(2027, 2, 1, 0, 0, 0);
const ENREGISTREMENT = '/srv/radio/emissions/nuit-2027-08-29.ogg';
// L'enregistrement de cette nuit, dans la langue (/srv/radio/shows/… en anglais).
const enregistrement = (j: Jeu) => chemin(j.t, ENREGISTREMENT);

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
    sudo: { gid: 27, membres: ['vous', 'zoe'] },
    radio: { gid: 996, membres: [] },
    vous: { gid: 1000, membres: [] },
    zoe: { gid: 1001, membres: [] },
  },
});

const sd = (j: Jeu) => systemd(j)!;
const shell = (j: Jeu) => j as Shell;
const volume = (j: Jeu) => shell(j).montage(DONNEES)!;
const pourcentInodes = (j: Jeu) => Math.ceil((100 * shell(j).inodesUtilises(volume(j))) / INODES);
const jourDe = (ms: number) => Math.floor(ms / JOUR);
const deuxChiffres = (n: number) => String(n).padStart(2, '0');

// Le nom d'un fichier de statistiques : la date de l'écoute, et un numéro.
function nomStat(ms: number, n: number): string {
  const dt = new Date(ms);
  const date = `${dt.getUTCFullYear()}-${deuxChiffres(dt.getUTCMonth() + 1)}-${deuxChiffres(dt.getUTCDate())}`;
  const heure = `${deuxChiffres(dt.getUTCHours())}-${deuxChiffres(dt.getUTCMinutes())}-${deuxChiffres(dt.getUTCSeconds())}`;
  return `ecoute-${date}T${heure}-${String(n).padStart(5, '0')}.json`;
}

const stat = (ms: number): Fichier => ({
  type: 'fichier',
  contenu: '{"listener":"203.0.113.0","seconds":1260}',
  mtime: ms,
  proprio: 'radio',
  lignes: true,
});

// Combien de fichiers de statistiques de chaque jour sont encore là.
function parJour(j: Jeu): Map<number, number> {
  const lieu = j.trouver(STATS);
  const compte = new Map<number, number>();
  if (lieu?.type !== 'dossier') return compte;
  for (const k in lieu.enfants) {
    const e = lieu.enfants[k];
    if (e.type === 'fichier' && e.mtime !== undefined) compte.set(jourDe(e.mtime), (compte.get(jourDe(e.mtime)) ?? 0) + 1);
  }
  return compte;
}

// Les statistiques de moins de 31 jours (find -mtime -31) sont-elles toutes là ?
function recentesIntactes(j: Jeu): boolean {
  const ecrits: Record<number, number> = j.etat.statsEcrites;
  const presents = parJour(j);
  const limite = jourDe(sd(j).horloge) - 30;
  return Object.entries(ecrits).every(([jour, n]) => Number(jour) < limite || (presents.get(Number(jour)) ?? 0) >= n);
}

// L'âge du plus ancien fichier de statistiques, en jours entiers (comme find -mtime).
const plusAncien = (j: Jeu) => {
  const lieu = j.trouver(STATS);
  let min = Infinity;
  if (lieu?.type === 'dossier')
    for (const k in lieu.enfants) {
      const e = lieu.enfants[k];
      if (e.type === 'fichier' && e.mtime !== undefined && e.mtime < min) min = e.mtime;
    }
  return min === Infinity ? 0 : Math.floor((sd(j).horloge - min) / JOUR);
};

/** Écrire un fichier comme le compte radio : réussit seulement s'il reste un inode. */
function ecrireCommeRadio(j: Jeu, chemin: string, n: Fichier): boolean {
  const jeu = shell(j);
  const avant = jeu.qui;
  jeu.qui = 'radio';
  try {
    return jeu.placer('stream', chemin, n) === null;
  } finally {
    jeu.qui = avant;
  }
}

// Le relais note une écoute ; le compteur des fichiers écrits par jour suit.
function noterEcoute(j: Jeu, ms: number): boolean {
  const n = (j.etat.numeroStat = (j.etat.numeroStat ?? 0) + 1);
  const ok = ecrireCommeRadio(j, `${STATS}/${nomStat(ms, n)}`, stat(ms));
  if (ok) j.etat.statsEcrites[jourDe(ms)] = (j.etat.statsEcrites[jourDe(ms)] ?? 0) + 1;
  return ok;
}

// Les crontabs qui parlent des statistiques (pour savoir quand faire passer une nuit).
const empreinteCron = (j: Jeu) => JSON.stringify(j.etat.crontabs ?? {});
const cronStats = (j: Jeu) => Object.values((j.etat.crontabs ?? {}) as Record<string, string>).some((t) => t.includes(STATS));

/** La nuit suivante : une journée d'écoutes, puis cron. Renvoie le compte rendu du matin. */
function nuit(j: Jeu): string {
  const s = sd(j);
  const avant = parJour(j);
  const total = (m: Map<number, number>) => [...m.values()].reduce((a, b) => a + b, 0);
  // La journée : le relais note ses écoutes, tant qu'il reste des inodes.
  const lendemain = (jourDe(s.horloge) + 1) * JOUR;
  const libres = INODES - shell(j).inodesUtilises(volume(j));
  const lieu = j.trouver(STATS);
  const ecrits = lieu?.type === 'dossier' ? Math.max(0, Math.min(360, libres)) : 0;
  for (let k = 0; k < ecrits; k++) {
    const ms = s.horloge + Math.floor((k * (lendemain + 3 * 3600_000 - s.horloge)) / 360);
    const n = (j.etat.numeroStat = (j.etat.numeroStat ?? 0) + 1);
    (lieu as Dossier).enfants[nomStat(ms, n)] = stat(ms);
    j.etat.statsEcrites[jourDe(ms)] = (j.etat.statsEcrites[jourDe(ms)] ?? 0) + 1;
  }
  // La nuit : cron lance les tâches prévues jusqu'à 6 h.
  const debut = s.horloge;
  const fin = lendemain + 6 * 3600_000;
  // Les tâches voient l'heure du matin (find -mtime compte l'âge depuis l'horloge).
  s.horloge = fin;
  const executions = passer(shell(j), debut, fin);
  const effaces = total(avant) + ecrits - total(parJour(j));
  const courriers = executions
    .filter((e) => e.sortie)
    // Un courrier de milliers de lignes (une erreur par fichier) : seulement le début.
    .map((e) => {
      const lignes = e.sortie.split('\n');
      const sortie = lignes.length > 5 ? [...lignes.slice(0, 5), '[…]'].join('\n') : e.sortie;
      return j.t('inodes-courrier', { commande: e.commande, sortie });
    })
    .join('\n\n');
  const resultat = [j.t('inodes-nuit', { taches: executions.length, effaces, ancien: plusAncien(j), pourcent: pourcentInodes(j) }), courriers];
  if (!recentesIntactes(j)) resultat.push(j.t('inodes-nuit-recentes-perdues'));
  else if (!executions.length) resultat.push(j.t('inodes-nuit-rien'));
  else if (plusAncien(j) > 60) resultat.push(j.t('inodes-nuit-trop-vieux', { jours: plusAncien(j) }));
  else if (pourcentInodes(j) >= 80) resultat.push(j.t('inodes-nuit-plein', { pourcent: pourcentInodes(j) }));
  else j.etat.nuitReussie = true;
  return resultat.filter(Boolean).join('\n\n');
}

export const inodes: Chapitre = {
  id: 'inodes',
  numero: 3,
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
    'sort',
    'uniq',
    'find',
    'du',
    'df',
    'rm',
    'mkdir',
    'touch',
    'echo',
    'id',
    'whoami',
    'ps',
    'sudo',
    'nano',
    'systemctl',
    'journalctl',
    'crontab',
  ],
  maison: M,
  accueil: 'message_de_zoe.txt',
  noms: true,
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
      'radio-stream': {
        description: 'Radio Quartier stream relay',
        active: true,
        executable: 'stream',
        processus: [{ pid: 1730, utilisateur: 'radio', cpu: 3.2, mem: 1.1, commande: '/usr/local/bin/stream --config /etc/radio/stream.conf' }],
      },
      cron: {
        description: 'Regular background program processing daemon',
        active: true,
        executable: 'cron',
        processus: [{ pid: 611, utilisateur: 'root', cpu: 0, mem: 0.1, commande: '/usr/sbin/cron -f' }],
      },
    }),
    processus: [
      { pid: 1, utilisateur: 'root', cpu: 0, mem: 0.1, commande: '/sbin/init' },
      { pid: 598, utilisateur: 'root', cpu: 0, mem: 0.2, commande: 'sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups' },
      { pid: 611, utilisateur: 'root', cpu: 0, mem: 0.1, commande: '/usr/sbin/cron -f' },
      { pid: 1730, utilisateur: 'radio', cpu: 3.2, mem: 1.1, commande: '/usr/local/bin/stream --config /etc/radio/stream.conf' },
    ],
    montages: [
      { chemin: '/', capacite: 20_000_000_000, nom: '/dev/vda1', systeme: 'ext4', inodes: 1_310_720, inodesBase: 61_204 },
      // Un petit volume de données : 1 Gio, donc 65 536 inodes (un pour 16 Kio, le réglage par défaut de mkfs.ext4).
      { chemin: DONNEES, capacite: 1_073_741_824, nom: '/dev/vdb1', systeme: 'ext4', inodes: INODES, inodesBase: 11 },
    ],
    crontabs: {},
    statsEcrites: {},
  }),
  // Les statistiques remplissent tous les inodes qui restent sur le volume.
  initialiser: (j) => {
    const s = sd(j);
    const lieu = j.trouver(STATS) as Dossier;
    const reste = INODES - shell(j).inodesUtilises(volume(j));
    const parJourPrevu = reste / ((MAINTENANT - DEBUT) / JOUR);
    for (let k = 0; k < reste; k++) {
      const ms = DEBUT + Math.floor((k * JOUR) / parJourPrevu);
      const n = (j.etat.numeroStat = (j.etat.numeroStat ?? 0) + 1);
      lieu.enfants[nomStat(ms, n)] = stat(ms);
      j.etat.statsEcrites[jourDe(ms)] = (j.etat.statsEcrites[jourDe(ms)] ?? 0) + 1;
    }
    // Ce soir, plus rien ne s'écrit sur le volume.
    s.horloge = MAINTENANT - 40 * 60_000;
    journaliser(s, 'radio-stream.service', 'stream', 1730, `stats: cannot create ${STATS}/${nomStat(s.horloge, 99_001)}: No space left on device`, 3);
    s.horloge = MAINTENANT - 20 * 60_000;
    journaliser(s, 'radio-stream.service', 'stream', 1730, `record: cannot create ${enregistrement(j)}: No space left on device`, 3);
    journaliser(
      s,
      'radio-stream.service',
      'stream',
      1730,
      `stats: cannot create ${STATS}/${nomStat(s.horloge, 99_002)}: No space left on device`,
      3,
      false,
    );
    s.horloge = MAINTENANT;
  },
  // À chaque instant, le relais note une écoute et réessaie d'enregistrer l'émission ; et si la crontab a changé, une nuit passe.
  apresCommande: (j) => {
    const s = sd(j);
    s.horloge += 30_000;
    if (!noterEcoute(j, s.horloge))
      journaliser(s, 'radio-stream.service', 'stream', 1730, `stats: cannot create ${STATS}/...: No space left on device`, 3, false);
    if (
      !j.trouver(enregistrement(j)) &&
      ecrireCommeRadio(j, enregistrement(j), { type: 'fichier', contenu: '', taille: 48_000_000, proprio: 'radio', mtime: s.horloge })
    )
      journaliser(s, 'radio-stream.service', 'stream', 1730, `record: writing ${enregistrement(j)}`, 6, false);
    if (j.etat.nuitReussie || !cronStats(j) || j.etat.empreinteNuit === empreinteCron(j)) return;
    j.etat.empreinteNuit = empreinteCron(j);
    return nuit(j);
  },
  creerMonde: (t) => {
    const racine: Droits = { proprio: 'root' };
    const lieu = (enfants: Parameters<typeof d>[0], droits: Droits = racine) => d(enfants, undefined, droits);
    const fichier = (texte: string, droits: Droits = racine) => f(texte, { lignes: true, ...droits });
    const radio: Droits = { proprio: 'radio' };
    return lieu({
      etc: lieu({ ...fichiersComptes(), hostname: fichier('radio'), radio: lieu({ 'stream.conf': fichier(t('inodes-conf-flux')) }) }),
      home: lieu({ vous: d({ 'message_de_zoe.txt': f(t('inodes-message-de-zoe')) }), zoe: lieu({}, { proprio: 'zoe', mode: 'rwx------' }) }),
      srv: lieu({
        radio: lieu(
          {
            'lost+found': lieu({}, { proprio: 'root', mode: 'rwx------' }),
            emissions: lieu(
              {
                'matinale-2027-08-27.ogg': f('', { proprio: 'radio', taille: 92_000_000 }),
                'matinale-2027-08-28.ogg': f('', { proprio: 'radio', taille: 91_000_000 }),
                'nuit-2027-08-28.ogg': f('', { proprio: 'radio', taille: 48_000_000 }),
              },
              radio,
            ),
            stats: lieu({ 'LISEZMOI.txt': fichier(t('inodes-stats-lisezmoi'), radio) }, radio),
          },
          radio,
        ),
      }),
      tmp: lieu({}, { proprio: 'root', mode: 'rwxrwxrwt' }),
      usr: lieu({
        lib: f('', { proprio: 'root', taille: 3_200_000_000 }),
        local: lieu({ bin: lieu({ stream: f('', { proprio: 'root', mode: 'rwxr-xr-x', taille: 8_400_000 }) }) }),
      }),
      var: lieu({ lib: lieu({ radio: lieu({}, radio) }) }),
    });
  },
  evenements: [
    {
      id: 'presque-vide',
      condition: (j) =>
        j.derniere.commandes.some((c) => c.includes('df')) &&
        !j.derniere.commandes.some((c) => c.some((a) => /^-\w*i/.test(a))) &&
        /\/srv\/radio/.test(j.derniere.sortie),
      message: (j) => j.t('inodes-evenement-presque-vide'),
    },
    { id: 'plus-d-inodes', condition: (j) => /100% \/srv\/radio/.test(j.derniere.sortie), message: (j) => j.t('inodes-evenement-plus-d-inodes') },
    {
      id: 'coupable',
      condition: (j) =>
        /\b6\d{4}\b/.test(j.derniere.sortie) && /stats|^6\d{4}$/m.test(j.derniere.sortie) && !/100% \/srv\/radio/.test(j.derniere.sortie),
      message: (j) => j.t('inodes-evenement-coupable'),
    },
    { id: 'trop-long', condition: (j) => (j.etat.argumentsTropLongs ?? 0) > 0, message: (j) => j.t('inodes-evenement-trop-long') },
    { id: 'recentes-perdues', condition: (j) => !recentesIntactes(j), message: (j) => j.t('inodes-evenement-recentes-perdues') },
    { id: 'repart', condition: (j) => !!j.trouver(enregistrement(j)), message: (j) => j.t('inodes-evenement-repart', { pourcent: pourcentInodes(j) }) },
    {
      id: 'fin',
      condition: (j) => !!j.etat.nuitReussie && recentesIntactes(j) && pourcentInodes(j) < 80,
      message: (j) => j.t('inodes-evenement-fin'),
    },
  ],
};
