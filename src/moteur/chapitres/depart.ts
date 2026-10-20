// Histoire « La Coopérative » — chapitre « Le départ » : Marc, le bénévole
// qui tenait le serveur, part s'installer loin. Il faut lui retirer tous ses
// accès, proprement, sans rien casser :
//   - son compte : usermod -L ne verrouille que le mot de passe (sa clé SSH
//     passe toujours, comme le dit man usermod) ; il faut le faire expirer
//     (usermod -e 1, chage -E 0), lui retirer son shell, ou le supprimer ;
//   - sa clé est AUSSI dans le compte partagé deploy (le piège classique) :
//     retirer cette ligne-là, sans toucher aux autres ;
//   - sudo : le retirer du groupe sudo ;
//   - sa session est encore ouverte (who, ps -u marc) : la fermer ;
//   - sa crontab lance la sauvegarde de la caisse depuis son dossier : la
//     confier à un compte qui reste (root, ou deploy) avant de supprimer quoi
//     que ce soit (userdel -r effacerait le script ; cron ignore la crontab
//     d'un compte supprimé).
// Objectif vérifié sur l'état : marc ne peut plus entrer (ni mot de passe, ni
// clé, ni dans deploy), n'a plus sudo ni aucun processus, et la sauvegarde
// tourne toujours (le même script, hors de /home/marc, dans la crontab de
// root ou de deploy, ou dans /etc/cron.d).
// Sources : https://man7.org/linux/man-pages/man8/usermod.8.html,
// https://man7.org/linux/man-pages/man8/userdel.8.html,
// https://man7.org/linux/man-pages/man1/chage.1.html

import { d, f, type Chapitre } from '../monde';
import type { Jeu, Shell } from '../shell';
import { analyser } from '../cron';
import { AUJOURDHUI, CLES, comptesCooperative, M, mondeCooperative, MOT_DE_PASSE } from './cooperative';

const SCRIPT = `#!/bin/sh
# Nightly backup of the till and homes (Marc, 2024)
set -e
JOUR=$(date +%F)
mkdir -p /srv/sauvegardes/$JOUR
tar -czf /srv/sauvegardes/$JOUR/caisse.tar.gz /srv/caisse
tar -czf /srv/sauvegardes/$JOUR/home.tar.gz /home`;
const CRONTAB_MARC = `# m h  dom mon dow   command
30 2 * * * /home/marc/bin/sauvegarde-caisse.sh`;
const DEPLOY = '/home/deploy/.ssh/authorized_keys';
const fichier = (contenu: string, proprio: string, mode?: string) => f(contenu, { lignes: true, proprio, ...(mode ? { mode } : {}) });
const sh = (j: Jeu) => j as Shell;
const cle = (ligne: string) => ligne.trim().split(/\s+/).slice(0, 2).join(' ');
const MARC = cle(CLES.marc);

// Les clés autorisées d'un compte.
const autorisees = (j: Jeu, compte: string, maison: string) =>
  (j.lire(`${maison}/.ssh/authorized_keys`) ?? '')
    .split('\n')
    .filter((l) => l.trim().startsWith('ssh-'))
    .map(cle);

const compteOuvert = (j: Jeu, nom: string) => {
  const u = j.comptes.utilisateurs[nom];
  if (!u) return false;
  if (u.expire && u.expire <= AUJOURDHUI) return false;
  return !/(nologin|false)$/.test(u.shell ?? '/bin/bash');
};

// Marc peut-il encore entrer ? Par son compte (mot de passe, ou sa clé : -L n'y fait rien), ou par deploy.
const parSonCompte = (j: Jeu) => {
  if (!compteOuvert(j, 'marc')) return false;
  const verrouille = ((j.etat.comptesVerrouilles ?? []) as string[]).includes('marc');
  return !verrouille || autorisees(j, 'marc', '/home/marc').includes(MARC);
};
const parDeploy = (j: Jeu) => compteOuvert(j, 'deploy') && autorisees(j, 'deploy', '/home/deploy').includes(MARC);
const deployIntact = (j: Jeu) => [CLES.ci, CLES.lina].map(cle).every((c) => autorisees(j, 'deploy', '/home/deploy').includes(c));
const sudoPourMarc = (j: Jeu) => !!j.comptes.utilisateurs.marc && sh(j).groupesDe('marc').includes('sudo');
const processusDeMarc = (j: Jeu) => ((j.etat.processus ?? []) as { utilisateur: string }[]).some((p) => p.utilisateur === 'marc');

// Les tâches cron (commande et compte) : crontabs des comptes qui existent, et /etc/cron.d (avec la colonne du compte).
function taches(j: Jeu): { compte: string; commande: string }[] {
  const res: { compte: string; commande: string }[] = [];
  for (const [compte, texte] of Object.entries((j.etat.crontabs ?? {}) as Record<string, string>))
    if (j.comptes.utilisateurs[compte]) for (const t of analyser(texte, compte).taches) res.push({ compte, commande: t.commande });
  const cronD = j.trouver('/etc/cron.d');
  if (cronD?.type === 'dossier')
    for (const nom of Object.keys(cronD.enfants))
      for (const l of (j.lire(`/etc/cron.d/${nom}`) ?? '').split('\n')) {
        const mots = l.trim().split(/\s+/);
        if (mots.length >= 7 && !l.trim().startsWith('#') && !/=/.test(mots[0])) res.push({ compte: mots[5], commande: mots.slice(6).join(' ') });
      }
  return res;
}

// La sauvegarde tourne-t-elle encore, confiée à un compte qui n'est pas celui d'une personne ?
const sauvegardeConfiee = (j: Jeu, comptes = ['root', 'deploy']) =>
  taches(j).some(({ compte, commande }) => {
    const chemin = commande.split(/\s+/).find((m) => m.startsWith('/'));
    if (!chemin || chemin.startsWith('/home/marc/') || !comptes.includes(compte) || !j.comptes.utilisateurs[compte]) return false;
    return (j.lire(chemin) ?? '').trim() === SCRIPT.trim();
  });

const ferme = (j: Jeu) => !parSonCompte(j) && !parDeploy(j) && !sudoPourMarc(j) && !processusDeMarc(j);

export const depart: Chapitre = {
  id: 'depart',
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
    'cp',
    'mv',
    'mkdir',
    'rm',
    'chmod',
    'chown',
    'nano',
    'sudo',
    'id',
    'groups',
    'whoami',
    'who',
    'ps',
    'kill',
    'pkill',
    'usermod',
    'chage',
    'gpasswd',
    'userdel',
    'crontab',
  ],
  maison: M,
  accueil: 'courriel_awa.txt',
  noms: true,
  final: 'fin',
  motDePasse: MOT_DE_PASSE,
  comptes: () => comptesCooperative(),
  etat: () => ({
    crontabs: { marc: CRONTAB_MARC },
    processus: [
      { pid: 612, utilisateur: 'root', cpu: 0, mem: 0.2, commande: 'sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups' },
      { pid: 731, utilisateur: 'caisse', cpu: 1.2, mem: 3.4, commande: '/usr/bin/node /srv/caisse/app/server.js' },
      { pid: 2741, utilisateur: 'marc', cpu: 0, mem: 0.1, commande: 'sshd: marc@pts/1' },
      { pid: 2745, utilisateur: 'marc', cpu: 0, mem: 0.1, commande: '-bash', ppid: 2741 },
      { pid: 2790, utilisateur: 'marc', cpu: 0.1, mem: 0.1, commande: 'tail -f /var/log/caisse/app.log', ppid: 2745 },
      { pid: 3102, utilisateur: 'vous', cpu: 0, mem: 0.1, commande: '-bash' },
    ],
    sessions: [
      { utilisateur: 'marc', tty: 'pts/1', depuis: '2027-10-19 08:12', de: '198.51.100.40', pid: 2741 },
      { utilisateur: 'vous', tty: 'pts/0', depuis: '2027-10-19 09:28', de: '192.0.2.2' },
    ],
  }),
  creerMonde: (t) =>
    mondeCooperative({
      maison: { 'courriel_awa.txt': f(t('depart-courriel-awa')) },
      maisons: {
        marc: d(
          {
            '.ssh': d({ authorized_keys: fichier(CLES.marc, 'marc', 'rw-------') }, undefined, { proprio: 'marc', mode: 'rwx------' }),
            bin: d({ 'sauvegarde-caisse.sh': fichier(SCRIPT, 'marc', 'rwxr-xr-x') }, undefined, { proprio: 'marc' }),
            'notes.txt': fichier(t('depart-notes-marc'), 'marc'),
          },
          undefined,
          { proprio: 'marc', mode: 'rwxr-xr-x' },
        ),
      },
      plus: {
        srv: d(
          {
            caisse: d({}, undefined, { proprio: 'caisse', groupe: 'caisse' }),
            // La sauvegarde de la nuit dernière (elle contient /home : le script de Marc y est).
            sauvegardes: d(
              {
                '2027-10-18': d({ home: d({ marc: d({ bin: d({ 'sauvegarde-caisse.sh': fichier(SCRIPT, 'root', 'rwxr-xr-x') }) }) }) }, undefined, {
                  proprio: 'root',
                }),
              },
              undefined,
              { proprio: 'root', mode: 'rwx------' },
            ),
          },
          undefined,
          { proprio: 'root' },
        ),
      },
    }),
  evenements: [
    {
      id: 'verrou-seul',
      condition: (j) => ((j.etat.comptesVerrouilles ?? []) as string[]).includes('marc') && parSonCompte(j),
      message: (j) => j.t('depart-evenement-verrou-seul'),
    },
    { id: 'deploy-vide', condition: (j) => !deployIntact(j), message: (j) => j.t('depart-evenement-deploy-vide', { fichier: DEPLOY }) },
    {
      id: 'script-perdu',
      condition: (j) => !j.existe('/home/marc/bin') && !sauvegardeConfiee(j),
      message: (j) => j.t('depart-evenement-script-perdu'),
    },
    {
      id: 'tache-personnelle',
      condition: (j) => sauvegardeConfiee(j, ['vous']) && !sauvegardeConfiee(j),
      message: (j) => j.t('depart-evenement-tache-personnelle'),
    },
    { id: 'sauvegarde', condition: (j) => sauvegardeConfiee(j), message: (j) => j.t('depart-evenement-sauvegarde') },
    { id: 'ferme', condition: (j) => ferme(j) && deployIntact(j), message: (j) => j.t('depart-evenement-ferme') },
    { id: 'fin', condition: (j) => ferme(j) && deployIntact(j) && sauvegardeConfiee(j), message: (j) => j.t('depart-evenement-fin') },
  ],
};
