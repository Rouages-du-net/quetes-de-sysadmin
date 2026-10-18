// Histoire « La Ludothèque » — chapitre « La rançon » : lundi matin, les
// fichiers partagés de la ludothèque sont chiffrés (.locked) et une demande
// de rançon traîne dans chaque dossier. Le mot de passe du compte accueil a
// été deviné ; un programme tourne encore sous ce compte, et sa crontab le
// relance. La copie de cette nuit sur le NAS est chiffrée aussi : rsync
// --delete a fidèlement recopié les dégâts. Reste le disque USB du tiroir,
// hors ligne : un dépôt restic d'il y a une semaine.
// Objectif vérifié sur l'état : le chiffreur est arrêté et ne revient plus
// (crontab nettoyée), le compte accueil est verrouillé, tous les fichiers
// sont restaurés, plus aucun .locked ni demande de rançon, et le disque de
// sauvegarde est démonté (de nouveau hors ligne).
// Sources : https://www.cisa.gov/stopransomware/ransomware-guide,
// https://cyber.gouv.fr/publications/attaques-par-rancongiciels-tous-concernes,
// https://restic.readthedocs.io/en/stable/050_restore.html,
// https://man7.org/linux/man-pages/man8/mount.8.html

import { d, f, fichiersComptes, type Chapitre, type Comptes, type Dossier, type Droits, type Noeud } from '../monde';
import type { Jeu, Shell } from '../shell';
import { journaliser, nouveauSystemd, systemd } from '../systemd';
import type { Processus } from '../commandes/systeme';
import { ajouterInstantane, ecrireDepot, hex, type Depot, type Version } from '../commandes/restic';
import type { Peripherique } from '../commandes/disques';

const M = '/home/vous';
const PARTAGE = '/srv/partage';
const NAS = '/mnt/nas';
const CLE = '/mnt/cle';
const USB = '/dev/sdb1';
const CHIFFREUR = '/home/accueil/.cache/.maj/maj-systeme';
const NOTE = 'LISEZ-MOI-POUR-RECUPERER.txt';
const MOT_DE_PASSE = 'pion-cavalier-tour-27';
const Go = 1_000_000_000;

const comptes = (): Comptes => ({
  utilisateurs: {
    root: { uid: 0, groupe: 'root', maison: '/root' },
    vous: { uid: 1000, groupe: 'vous' },
    accueil: { uid: 1001, groupe: 'accueil' },
    berenice: { uid: 1002, groupe: 'berenice' },
  },
  groupes: {
    root: { gid: 0, membres: [] },
    sudo: { gid: 27, membres: ['vous', 'berenice'] },
    vous: { gid: 1000, membres: [] },
    accueil: { gid: 1001, membres: [] },
    berenice: { gid: 1002, membres: [] },
    ludo: { gid: 1100, membres: ['vous', 'accueil', 'berenice'] },
  },
});

// Les fichiers du partage (chemin relatif → identifiant du texte).
const FICHIERS: Record<string, string> = {
  'inventaire.csv': 'rancon-inventaire',
  'planning-benevoles.txt': 'rancon-planning',
  'affiche-fete-du-jeu.txt': 'rancon-affiche',
  'regles/jeu-de-l-oie.txt': 'rancon-regles-oie',
  'regles/petits-chevaux.txt': 'rancon-regles-chevaux',
  'regles/dames.txt': 'rancon-regles-dames',
};

// Un fichier chiffré : un nom en .locked et des octets illisibles.
const illisible = (graine: string) =>
  hex(`chiffre-${graine}`, 160)
    .replace(/(.{40})/g, '$1\n')
    .trim();

// La sauvegarde du dimanche 13 juin, sur le disque USB.
function depotUsb(t: Jeu['t']): Depot {
  const depot: Depot = { id: hex('depot-ludotheque'), motDePasse: MOT_DE_PASSE, instantanes: [], packs: [], verifie: true, aElaguer: false };
  const dimanches = [Date.UTC(2027, 4, 30, 18, 0, 0), Date.UTC(2027, 5, 6, 18, 0, 0), Date.UTC(2027, 5, 13, 18, 0, 0)];
  dimanches.forEach((temps, i) => {
    const fichiers: Record<string, Version> = {};
    for (const [rel, id] of Object.entries(FICHIERS)) {
      const texte = t(id);
      fichiers[`${PARTAGE}/${rel}`] = { contenu: texte, taille: new TextEncoder().encode(texte).length, modifie: temps - 86_400_000 };
    }
    ajouterInstantane(depot, { id: hex(`instantane-ludo-${i}`), temps, hote: 'ludotheque', chemins: [PARTAGE], fichiers });
  });
  depot.verifie = true;
  return depot;
}

// Le contenu attendu de chaque fichier restauré.
const attendus = (j: Jeu) => Object.fromEntries(Object.entries(FICHIERS).map(([rel, id]) => [`${PARTAGE}/${rel}`, j.t(id)]));

const sd = (j: Jeu) => systemd(j)!;
const processus = (j: Jeu): Processus[] => j.etat.processus ?? [];
const chiffreurActif = (j: Jeu) => processus(j).some((p) => p.commande.startsWith(CHIFFREUR));
const persistance = (j: Jeu) => (j.etat.crontabs?.accueil ?? '').includes('maj-systeme');
const verrouille = (j: Jeu) => (j.etat.comptesVerrouilles ?? []).includes('accueil');
const cleMontee = (j: Jeu) => (j.etat.montages ?? []).some((m: { nom: string }) => m.nom === USB);

// Tous les fichiers sous un lieu (chemins absolus).
function tous(j: Jeu, lieu: string): string[] {
  const n = j.trouver(lieu);
  if (n?.type !== 'dossier') return [];
  return Object.entries(n.enfants).flatMap(([nom, e]) => (e.type === 'dossier' ? tous(j, `${lieu}/${nom}`) : [`${lieu}/${nom}`]));
}
const restes = (j: Jeu) => tous(j, PARTAGE).filter((c) => c.endsWith('.locked') || c.endsWith(`/${NOTE}`));
const restaures = (j: Jeu) => Object.entries(attendus(j)).filter(([c, texte]) => j.lire(c) === texte).length;
const toutRestaure = (j: Jeu) => restaures(j) === Object.keys(FICHIERS).length;

/**
 * Le chiffreur au travail : chaque fichier en clair du partage que le compte
 * accueil peut modifier devient illisible, renommé en .locked, avec une
 * demande de rançon dans son dossier. Renvoie le nombre de fichiers touchés.
 */
function chiffrer(j: Jeu, lieu: string): number {
  const n = j.trouver(lieu);
  if (n?.type !== 'dossier' || !j.peut(n, 'w', 'accueil')) return 0;
  let touches = 0;
  for (const [nom, e] of Object.entries(n.enfants)) {
    if (e.type === 'dossier') touches += chiffrer(j, `${lieu}/${nom}`);
    else if (!nom.endsWith('.locked') && nom !== NOTE && e.lien === undefined) {
      delete n.enfants[nom];
      n.enfants[`${nom}.locked`] = {
        type: 'fichier',
        contenu: illisible(`${lieu}/${nom}`),
        lignes: true,
        proprio: 'accueil',
        groupe: 'ludo',
        mode: 'rw-rw-r--',
      };
      touches++;
    }
  }
  if (touches && !n.enfants[NOTE]) n.enfants[NOTE] = { type: 'fichier', contenu: j.t('rancon-note'), proprio: 'accueil', groupe: 'ludo' };
  return touches;
}

export const rancon: Chapitre = {
  id: 'rancon',
  numero: 1,
  commandes: [
    'ls',
    'cd',
    'pwd',
    'cat',
    'less',
    'head',
    'tail',
    'grep',
    'find',
    'wc',
    'du',
    'df',
    'diff',
    'cp',
    'mv',
    'rm',
    'mkdir',
    'touch',
    'id',
    'whoami',
    'ps',
    'kill',
    'crontab',
    'usermod',
    'journalctl',
    'systemctl',
    'lsblk',
    'mount',
    'umount',
    'restic',
    'sudo',
    'nano',
  ],
  maison: M,
  accueil: 'message_de_berenice.txt',
  final: 'fin',
  motDePasse: 'ludo-2027',
  comptes,
  etat: (t) => {
    const arbre = d({ depot: d({}, undefined, { proprio: 'root' }) }, undefined, { proprio: 'root', mode: 'rwxr-xr-x' });
    const usb: Peripherique = {
      disque: '/dev/sdb',
      majmin: [8, 17],
      amovible: true,
      taille: 32 * Go,
      systeme: 'exfat',
      etiquette: 'SAUVEGARDE',
      uuid: '6A1C-3F2E',
      arbre,
    };
    return {
      systemd: nouveauSystemd('ludotheque', Date.UTC(2027, 5, 1, 7, 0, 0), Date.UTC(2027, 5, 21, 8, 45, 0), {
        ssh: {
          description: 'OpenBSD Secure Shell server',
          active: true,
          executable: 'sshd',
          processus: [{ pid: 611, utilisateur: 'root', cpu: 0, mem: 0.2, commande: 'sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups' }],
        },
        cron: { description: 'Regular background program processing daemon', active: true, executable: 'cron' },
      }),
      processus: [
        { pid: 1, utilisateur: 'root', cpu: 0, mem: 0.1, commande: '/sbin/init' },
        { pid: 611, utilisateur: 'root', cpu: 0, mem: 0.2, commande: 'sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups' },
        { pid: 640, utilisateur: 'root', cpu: 0, mem: 0.1, commande: '/usr/sbin/cron -f' },
        { pid: 3141, utilisateur: 'accueil', cpu: 97.3, mem: 1.4, commande: `${CHIFFREUR} --silencieux` },
      ],
      crontabs: {
        root: `# ${t('rancon-crontab-root')}\n30 2 * * * rsync -a --delete ${PARTAGE}/ ${NAS}/partage/`,
        accueil: `*/10 * * * * ${CHIFFREUR} --silencieux\n@reboot ${CHIFFREUR} --silencieux`,
      },
      montages: [
        { chemin: '/', capacite: 40 * Go, nom: '/dev/vda1', systeme: 'ext4' },
        {
          chemin: NAS,
          capacite: 2000 * Go,
          nom: '//nas.ludotheque.example/sauvegardes',
          systeme: 'cifs',
          options: 'relatime,vers=3.1.1,uid=0,file_mode=0777,dir_mode=0777',
        },
      ],
      peripheriques: { [USB]: usb },
      restic: { [`${CLE}/depot`]: depotUsb(t) },
      resticHorloge: Date.UTC(2027, 5, 21, 9, 0, 0),
    };
  },
  initialiser: (j) => {
    const jeu = j as Shell;
    // Les fichiers du dépôt restic, sur le disque USB (monté le temps de les écrire).
    const lieu = j.trouver(CLE) as Dossier;
    const arbre = (j.etat.peripheriques[USB] as Peripherique).arbre;
    const cache = lieu.enfants;
    lieu.enfants = arbre.enfants;
    ecrireDepot(jeu, `${CLE}/depot`, j.etat.restic[`${CLE}/depot`]);
    lieu.enfants = cache;
    // La nuit : connexion réussie sur accueil après des essais, puis le chiffrement.
    const s = sd(j);
    const maintenant = s.horloge;
    s.horloge = Date.UTC(2027, 5, 21, 3, 11, 0);
    for (const n of [1, 2, 3])
      journaliser(s, 'ssh.service', 'sshd', 4100 + n, `Failed password for accueil from 203.0.113.66 port ${51200 + n * 7} ssh2`, 6);
    journaliser(s, 'ssh.service', 'sshd', 4104, 'Accepted password for accueil from 203.0.113.66 port 51240 ssh2');
    s.horloge = Date.UTC(2027, 5, 21, 3, 14, 0);
    journaliser(s, 'cron.service', 'CRON', 3140, `(accueil) CMD (${CHIFFREUR} --silencieux)`);
    s.horloge = maintenant;
    // Ce que le chiffreur a déjà fait, et ce que rsync a recopié cette nuit sur le NAS.
    chiffrer(j, PARTAGE);
    const nas = j.trouver(`${NAS}/partage`);
    const partage = j.trouver(PARTAGE);
    if (nas?.type === 'dossier' && partage?.type === 'dossier') nas.enfants = structuredClone(partage.enfants);
  },
  // Tant qu'il tourne, le chiffreur repasse ; tant que sa crontab existe, il revient.
  apresCommande: (j) => {
    const messages: string[] = [];
    if (chiffreurActif(j)) {
      const touches = chiffrer(j, PARTAGE);
      if (touches) j.etat.rechiffres = (j.etat.rechiffres ?? 0) + touches;
    } else if (persistance(j)) {
      j.etat.attente = (j.etat.attente ?? 0) + 1;
      if (j.etat.attente >= 4) {
        j.etat.attente = 0;
        const pid = 3141 + (j.etat.retours = (j.etat.retours ?? 0) + 1) * 7;
        processus(j).push({ pid, utilisateur: 'accueil', cpu: 97.3, mem: 1.4, commande: `${CHIFFREUR} --silencieux` });
        journaliser(sd(j), 'cron.service', 'CRON', pid - 1, `(accueil) CMD (${CHIFFREUR} --silencieux)`);
        chiffrer(j, PARTAGE);
        messages.push(j.t('rancon-retour'));
      }
    }
    return messages.join('\n\n') || undefined;
  },
  creerMonde: (t) => {
    const racine: Droits = { proprio: 'root' };
    const lieu = (enfants: Parameters<typeof d>[0], droits: Droits = racine) => d(enfants, undefined, droits);
    const fichier = (texte: string, droits: Droits = racine) => f(texte, { lignes: true, ...droits });
    const ludo = (proprio: string): Droits => ({ proprio, groupe: 'ludo', mode: 'rw-rw-r--' });
    const partage: Record<string, Noeud> = {};
    for (const [rel, id] of Object.entries(FICHIERS)) {
      const [dossier, nom] = rel.includes('/') ? rel.split('/') : ['', rel];
      const cible = dossier
        ? ((partage[dossier] ??= lieu({}, { proprio: 'berenice', groupe: 'ludo', mode: 'rwxrwxr-x' })) as Dossier).enfants
        : partage;
      cible[nom] = fichier(t(id), ludo(dossier ? 'berenice' : 'accueil'));
    }
    return lieu({
      etc: lieu({ ...fichiersComptes(), hostname: fichier('ludotheque') }),
      home: lieu({
        vous: d({ 'message_de_berenice.txt': f(t('rancon-message-de-berenice')) }),
        accueil: lieu(
          {
            '.cache': lieu(
              {
                '.maj': lieu(
                  { 'maj-systeme': f(illisible('binaire'), { proprio: 'accueil', mode: 'rwxr-xr-x', taille: 2_481_336 }) },
                  { proprio: 'accueil' },
                ),
              },
              { proprio: 'accueil' },
            ),
          },
          { proprio: 'accueil', mode: 'rwxr-x---' },
        ),
        berenice: lieu({}, { proprio: 'berenice', mode: 'rwx------' }),
      }),
      srv: lieu({ partage: lieu(partage, { proprio: 'root', groupe: 'ludo', mode: 'rwxrwxr-x' }) }),
      mnt: lieu({
        // Le partage du NAS, monté en permanence : tout le monde peut y écrire.
        nas: lieu({ partage: lieu({}, { proprio: 'root', mode: 'rwxrwxrwx' }) }, { proprio: 'root', mode: 'rwxrwxrwx' }),
        cle: lieu({}),
      }),
    });
  },
  evenements: [
    {
      id: 'etendue',
      condition: (j) => /\.locked/.test(j.derniere.sortie) && !j.derniere.commandes.some((c) => c.includes(NAS) || c.some((a) => a.startsWith(NAS))),
      message: (j) => j.t('rancon-evenement-etendue'),
    },
    {
      id: 'chiffreur-vu',
      condition: (j) => j.derniere.sortie.includes('maj-systeme') && j.derniere.commandes.some((c) => c[0] === 'ps') && chiffreurActif(j),
      message: (j) => j.t('rancon-evenement-chiffreur-vu'),
    },
    {
      id: 'nas',
      condition: (j) => j.derniere.commandes.some((c) => c.some((a) => a.startsWith(NAS))) && /\.locked/.test(j.derniere.sortie),
      message: (j) => j.t('rancon-evenement-nas'),
    },
    { id: 'rechiffre', condition: (j) => (j.etat.rechiffres ?? 0) > 0, message: (j) => j.t('rancon-evenement-rechiffre') },
    { id: 'cle-trop-tot', condition: (j) => cleMontee(j) && chiffreurActif(j), message: (j) => j.t('rancon-evenement-cle-trop-tot') },
    { id: 'restaure', condition: (j) => toutRestaure(j) && !chiffreurActif(j), message: (j) => j.t('rancon-evenement-restaure') },
    {
      id: 'fin',
      condition: (j) => !chiffreurActif(j) && !persistance(j) && verrouille(j) && toutRestaure(j) && restes(j).length === 0 && !cleMontee(j),
      message: (j) => j.t('rancon-evenement-fin'),
    },
  ],
};
