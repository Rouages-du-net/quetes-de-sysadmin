// Histoire « La Ludothèque » — chapitre « Les instantanés » : après
// l'attaque, Malo veut pouvoir revenir à n'importe quel jour des deux
// dernières semaines. rsnapshot est installé avec la configuration de
// Debian ; il faut la régler (tabulations !) pour /srv/partage vers le second
// disque (/mnt/instantanes), 7 instantanés quotidiens et 4 hebdomadaires, et
// le lancer avec cron. Le jeu fait alors passer deux semaines : Bérénice
// travaille chaque jour, et le dernier soir écrase l'inventaire par erreur.
// Il faut le reprendre dans l'instantané de la veille.
// Objectif vérifié sur l'état : 7 instantanés du niveau le plus fréquent et
// au moins un du niveau suivant sur /mnt/instantanes, tous avec le partage,
// et l'inventaire du partage revenu à sa version de l'avant-veille.
// Sources : https://rsnapshot.org/rsnapshot/docs/docs.html,
// https://manpages.debian.org/bookworm/rsnapshot/rsnapshot.1.en.html

import { chemin, d, f, fichiersComptes, type Chapitre, type Comptes, type Droits, type Noeud } from '../world';
import type { Jeu, Shell } from '../shell';
import { nouveauSystemd, systemd } from '../systemd';
import { passer } from '../cron';
import type { Peripherique } from '../commands/disks';
import { CONF, CONF_DEBIAN, lireConf } from '../commands/rsnapshot';

const M = '/home/vous';
const PARTAGE = '/srv/partage';
const DISQUE = '/mnt/instantanes';
const INVENTAIRE = `${PARTAGE}/inventaire.csv`;
const Go = 1_000_000_000;
const JOUR = 86_400_000;
const DEBUT = Date.UTC(2027, 5, 28, 10, 0, 0);

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

// L'inventaire au soir du jour n (un jeu de plus chaque jour).
const inventaire = (t: Jeu['t'], n: number) =>
  [t('rancon-inventaire'), ...Array.from({ length: n }, (_, k) => t('instantanes-ligne-inventaire', { numero: k + 1 }))].join('\n');

const sd = (j: Jeu) => systemd(j)!;
const conf = (j: Jeu) => lireConf(j.lire(CONF) ?? '');
const racine = (j: Jeu) => conf(j).conf.racine;
const instantanes = (j: Jeu, niveau: string) => {
  const n = j.trouver(racine(j));
  return n?.type === 'dossier' ? Object.keys(n.enfants).filter((k) => k.startsWith(`${niveau}.`)) : [];
};
const sauvesBien = (j: Jeu) => {
  const { conf: c, erreurs } = conf(j);
  const partage = chemin(j.t, PARTAGE);
  if (erreurs.length || c.niveaux.length < 2 || !c.racine.startsWith(`${chemin(j.t, DISQUE)}/`)) return false;
  const [petit, grand] = c.niveaux;
  const tous = [...instantanes(j, petit.nom), ...instantanes(j, grand.nom)];
  const b = c.sauvegardes.find((x) => x.source === `${partage}/`);
  return (
    !!b &&
    instantanes(j, petit.nom).length >= 7 &&
    instantanes(j, grand.nom).length >= 1 &&
    tous.every((nom) => j.trouver(`${c.racine}${nom}/${b.destination}${chemin(j.t, INVENTAIRE)}`)?.type === 'fichier')
  );
};
const crontabsRsnapshot = (j: Jeu) =>
  Object.values((j.etat.crontabs ?? {}) as Record<string, string>)
    .join('\n')
    .includes('rsnapshot');

/** Deux semaines passent : le jour, Bérénice tient l'inventaire ; la nuit, cron. */
function deuxSemaines(j: Jeu): string[] {
  const jeu = j as Shell;
  const mails: string[] = [];
  for (let n = 1; n <= 14; n++) {
    const soir = DEBUT + (n - 1) * JOUR + 8 * 3600_000;
    sd(j).horloge = soir;
    // Le quatorzième soir, une vieille copie de l'inventaire écrase la bonne.
    jeu.placer(
      'cp',
      chemin(j.t, INVENTAIRE),
      f(n === 14 ? j.t('instantanes-inventaire-ancien') : inventaire(j.t, n), {
        lignes: true,
        proprio: 'berenice',
        groupe: 'ludo',
        mode: 'rw-rw-r--',
      }),
    );
    for (const e of passer(jeu, soir + 4 * 3600_000, soir + 12 * 3600_000)) if (e.sortie) mails.push(`${e.commande}\n${e.sortie}`);
  }
  sd(j).horloge = DEBUT + 14 * JOUR + 2 * 3600_000;
  return mails;
}

export const instantanesChapitre: Chapitre = {
  id: 'instantanes',
  numero: 2,
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
    'ln',
    'id',
    'whoami',
    'crontab',
    'lsblk',
    'mount',
    'rsnapshot',
    'rsync',
    'sudo',
    'nano',
  ],
  maison: M,
  accueil: 'message_de_berenice.txt',
  noms: true,
  final: 'fin',
  motDePasse: 'ludo-2027',
  comptes,
  etat: () => {
    const arbre = d({}, undefined, { proprio: 'root', mode: 'rwxr-xr-x' });
    const second: Peripherique = {
      disque: '/dev/sdc',
      majmin: [8, 33],
      amovible: false,
      taille: 500 * Go,
      systeme: 'ext4',
      etiquette: 'INSTANTANES',
      uuid: 'b2e41c07-5d3a-4f19-8c6e-0a7d93f1e258',
      arbre,
    };
    return {
      systemd: nouveauSystemd('ludotheque', Date.UTC(2027, 5, 21, 11, 0, 0), DEBUT, {
        ssh: {
          description: 'OpenBSD Secure Shell server',
          active: true,
          executable: 'sshd',
          processus: [{ pid: 611, utilisateur: 'root', cpu: 0, mem: 0.2, commande: 'sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups' }],
        },
        cron: { description: 'Regular background program processing daemon', active: true, executable: 'cron' },
      }),
      montages: [{ chemin: '/', capacite: 40 * Go, nom: '/dev/vda1', systeme: 'ext4' }],
      peripheriques: { '/dev/sdc1': second },
      comptesVerrouilles: ['accueil'],
    };
  },
  initialiser: (j) => {
    // Le second disque, monté au démarrage.
    const jeu = j as Shell;
    const avant = jeu.qui;
    jeu.qui = 'root';
    jeu.sousCommande(`mount /dev/sdc1 ${chemin(j.t, DISQUE)}`, '/');
    jeu.qui = avant;
  },
  // Une fois rsnapshot programmé avec une configuration valable, deux semaines passent.
  apresCommande: (j) => {
    if (j.etat.semainesPassees || !crontabsRsnapshot(j) || conf(j).erreurs.length) return;
    j.etat.semainesPassees = true;
    const mails = deuxSemaines(j);
    j.etat.mailsCron = mails;
    return j.t('instantanes-deux-semaines', { mails: mails.length });
  },
  creerMonde: (t) => {
    const racine: Droits = { proprio: 'root' };
    const lieu = (enfants: Parameters<typeof d>[0], droits: Droits = racine) => d(enfants, undefined, droits);
    const fichier = (texte: string, droits: Droits = racine) => f(texte, { lignes: true, ...droits });
    const ludo = (proprio: string, taille?: number): Droits & { taille?: number } => ({
      proprio,
      groupe: 'ludo',
      mode: 'rw-rw-r--',
      ...(taille ? { taille } : {}),
    });
    const partage: Record<string, Noeud> = {
      'inventaire.csv': fichier(t('rancon-inventaire'), ludo('berenice')),
      'planning-benevoles.txt': fichier(t('rancon-planning'), ludo('berenice')),
      'affiche-fete-du-jeu.txt': fichier(t('rancon-affiche'), ludo('berenice')),
      regles: lieu(
        {
          'jeu-de-l-oie.txt': fichier(t('rancon-regles-oie'), ludo('berenice')),
          'petits-chevaux.txt': fichier(t('rancon-regles-chevaux'), ludo('berenice')),
          'dames.txt': fichier(t('rancon-regles-dames'), ludo('berenice')),
          // Les règles numérisées : de gros fichiers qui ne changent jamais.
          'scans-regles.pdf': f(t('archives-document-pdf'), { lignes: true, ...ludo('berenice', 48_000_000) }),
        },
        { proprio: 'berenice', groupe: 'ludo', mode: 'rwxrwxr-x' },
      ),
    };
    return lieu({
      etc: lieu({ ...fichiersComptes(), hostname: fichier('ludotheque'), 'rsnapshot.conf': fichier(CONF_DEBIAN) }),
      home: lieu({
        vous: d({ 'message_de_berenice.txt': f(t('instantanes-message-de-berenice')) }),
        accueil: lieu({}, { proprio: 'accueil', mode: 'rwxr-x---' }),
        berenice: lieu({}, { proprio: 'berenice', mode: 'rwx------' }),
      }),
      tmp: lieu({}, { proprio: 'root', mode: 'rwxrwxrwt' }),
      srv: lieu({ partage: lieu(partage, { proprio: 'root', groupe: 'ludo', mode: 'rwxrwxr-x' }) }),
      mnt: lieu({ instantanes: lieu({}), cle: lieu({}) }),
      var: lieu({ cache: lieu({}) }),
    });
  },
  evenements: [
    {
      id: 'espaces',
      condition: (j) => j.derniere.erreurs.some((e) => e.includes('spaces where only tabs should be')),
      message: (j) => j.t('instantanes-evenement-espaces'),
    },
    {
      id: 'meme-disque',
      condition: (j) => !!j.etat.semainesPassees && !conf(j).conf.racine.startsWith(`${chemin(j.t, DISQUE)}/`),
      message: (j) => j.t('instantanes-evenement-meme-disque'),
    },
    {
      id: 'mails',
      condition: (j) => ((j.etat.mailsCron ?? []) as string[]).some((m) => m.includes('ERROR')),
      message: (j) =>
        j.t('instantanes-evenement-mails', {
          exemple: ((j.etat.mailsCron ?? []) as string[])
            .find((m) => m.includes('ERROR'))!
            .split('\n')
            .slice(0, 7)
            .join('\n'),
        }),
    },
    {
      id: 'liens',
      condition: (j) =>
        !!j.etat.semainesPassees &&
        j.derniere.commandes.some((c) => c[0] === 'du' || (c[0] === 'rsnapshot' && c.includes('du'))) &&
        /\.1\/?\s*$/m.test(j.derniere.sortie),
      message: (j) => j.t('instantanes-evenement-liens'),
    },
    { id: 'erreur-berenice', condition: (j) => sauvesBien(j), message: (j) => j.t('instantanes-evenement-erreur-berenice') },
    {
      id: 'mauvaise-version',
      condition: (j) =>
        sauvesBien(j) &&
        j.lire(chemin(j.t, INVENTAIRE)) === j.t('instantanes-inventaire-ancien') &&
        j.derniere.commandes.some((c) => ['cp', 'rsync'].includes(c[0])),
      message: (j) => j.t('instantanes-evenement-mauvaise-version'),
    },
    { id: 'fin', condition: (j) => sauvesBien(j) && j.lire(chemin(j.t, INVENTAIRE)) === inventaire(j.t, 13), message: (j) => j.t('instantanes-evenement-fin') },
  ],
};
