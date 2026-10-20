// Histoire « La Gazette » — chapitre « Le retour arrière » : chaque push est
// publié dans son propre dossier (releases/), et un lien current désigne la
// version en ligne. Hier soir, Théo a poussé une nouvelle mise en page… sans
// index.html : le site répond 403. Revenir à la version précédente, c'est
// basculer le lien (ln -sfn), instantanément. Puis faire lancer tests.sh par
// le crochet avant de basculer, pour qu'une version cassée ne soit jamais
// mise en ligne ; Théo repousse pour vérifier. Enfin, réparer pour de bon
// (git pull, le bon nom de fichier, git push).
// Objectif vérifié sur l'état : le site sert la nouvelle mise en page,
// publiée par le crochet après ses tests, et le push cassé de Théo n'a pas
// été mis en ligne.
// Sources : https://git-scm.com/docs/githooks#post-receive,
// https://www.gnu.org/software/coreutils/manual/html_node/ln-invocation.html,
// https://nginx.org/en/docs/http/ngx_http_core_module.html#root

import { d, f, fichiersComptes, type Chapitre, type Droits, type Noeud } from '../monde';
import type { Jeu, Shell } from '../shell';
import { nouveauSystemd } from '../systemd';
import { chargerNginx, requete, verifierNginx } from '../nginx';
import { nouveauCommit, type Commit, type Depot } from '../commandes/git';
import { MIME, NGINX_CONF } from '../commandes/apt';
import { AUTRICE, CONF_GAZETTE, SITE, agenda, comptesGazette, historique } from './depot-nu';

const M = '/home/vous';
const LOCAL = `${M}/gazette`;
const DEPOT = '/srv/git/gazette.git';
const BASE = '/srv/gazette';
const RELEASES = `${BASE}/releases`;
const CURRENT = `${BASE}/current`;
const BONNE = '20270514101502';
const CASSEE = '20270517203012';
const THEO = '/home/theo/gazette';
const AUTEUR_THEO = 'Theo Martin <theo@gazette.example>';
const GAZETTE = 'gazette.example';

// L'historique : celui du chapitre 1 (titre corrigé, agenda), les tests de
// Samia, puis la nouvelle mise en page de Théo (accueil.html au lieu d'index.html).
function commits(t: Jeu['t']): Commit[] {
  const [c1, c2] = historique(t);
  const c3 = nouveauCommit(c2, t('retour-arriere-commit-3'), 'vous <vous@gazette.example>', 'Mon May 10 09:31:00 2027 +0200', {
    ...c2.fichiers,
    'index.html': t('retour-arriere-site-index'),
  });
  const c4 = nouveauCommit(c3, t('retour-arriere-commit-4'), 'vous <vous@gazette.example>', 'Mon May 10 09:40:00 2027 +0200', {
    ...c3.fichiers,
    'agenda.html': agenda(t, 12),
  });
  const c5 = nouveauCommit(c4, t('retour-arriere-commit-5'), AUTRICE, 'Fri May 14 10:14:51 2027 +0200', {
    ...c4.fichiers,
    'tests.sh': t('retour-arriere-tests'),
  });
  const { 'index.html': _index, ...sansIndex } = c5.fichiers;
  const c6 = nouveauCommit(c5, t('retour-arriere-commit-6'), AUTEUR_THEO, 'Mon May 17 20:29:40 2027 +0200', {
    ...sansIndex,
    'accueil.html': t('retour-arriere-site-accueil'),
  });
  return [c1, c2, c3, c4, c5, c6];
}

// Le crochet de déploiement : une version par push, puis le lien current.
const CROCHET = (t: Jeu['t']) => `#!/bin/sh
# ${t('retour-arriere-crochet-commentaire')}
set -e
VERSION=$(date +%Y%m%d%H%M%S)
mkdir -p ${RELEASES}/$VERSION
git --work-tree=${RELEASES}/$VERSION checkout -f main
ln -sfn ${RELEASES}/$VERSION ${CURRENT}
echo "${t('retour-arriere-crochet-echo')}"`;

const depot = (j: Jeu, chemin: string): Depot | undefined => j.etat.git?.[chemin];
const lien = (j: Jeu) => (j.trouver(CURRENT, false) as { lien?: string } | null)?.lien ?? null;
// La version en ligne : le dossier de releases/ que vise current.
const enLigne = (j: Jeu) => {
  const l = lien(j);
  return l ? (l.startsWith('/') ? l : `${BASE}/${l}`).replace(/\/$/, '').split('/').at(-1)! : null;
};
const page = (j: Jeu) => requete(j, GAZETTE, '/', 80, false);
const marche = (j: Jeu) => page(j)?.code === 200;
const nouvelleMiseEnPage = (j: Jeu) => marche(j) && (page(j)?.corps ?? '').includes('class="une"');
const crochet = (j: Jeu) => j.lire(`${DEPOT}/hooks/post-receive`) ?? '';
// Un lien créé DANS la version cassée (ln -sf sans -n : ln est entré dans le lieu visé).
const lienDedans = (j: Jeu) => {
  const n = j.trouver(`${RELEASES}/${CASSEE}`);
  return n?.type === 'dossier' && Object.values(n.enfants).some((e) => e.type === 'fichier' && e.lien !== undefined);
};
// La version de releases/ où le crochet a extrait le dernier commit du serveur.
const deployeParCrochet = (j: Jeu) => {
  const tete = depot(j, DEPOT)?.commits.at(-1);
  const ici = Object.entries(j.etat.gitDeploiements ?? {}).find(([, id]) => id === tete?.id)?.[0];
  return !!ici && ici.replace(/\/$/, '').split('/').at(-1) === enLigne(j);
};

/** Théo repousse une mise en page sans index.html, comme s'il le faisait de chez lui. */
function theoRepousse(j: Jeu): string {
  const jeu = j as Shell;
  const serveur = depot(j, DEPOT)!;
  const tete = serveur.commits.at(-1)!;
  const numero = (j.etat.essaisTheo = (j.etat.essaisTheo ?? 0) + 1);
  const { 'index.html': _index, ...sansIndex } = tete.fichiers;
  const c = nouveauCommit(tete, j.t('retour-arriere-commit-theo', { numero }), AUTEUR_THEO, 'Mon May 17 21:05:00 2027 +0200', {
    ...sansIndex,
    'accueil.html': `${j.t('retour-arriere-site-accueil')}\n<!-- ${numero} -->`,
  });
  j.etat.git[THEO] = { commits: [...serveur.commits, c], index: { ...c.fichiers }, distants: { prod: DEPOT } };
  const avant = jeu.qui;
  jeu.qui = 'theo';
  try {
    const r = jeu.sousCommande('git push prod main', THEO);
    j.etat.theoAPousse = c.id;
    return j.t('retour-arriere-theo-pousse', { sortie: r.sortie.replace(/^/gm, '  ') });
  } finally {
    jeu.qui = avant;
  }
}

export const retourArriere: Chapitre = {
  id: 'retour-arriere',
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
    'diff',
    'cp',
    'mv',
    'rm',
    'mkdir',
    'touch',
    'ln',
    'readlink',
    'chmod',
    'echo',
    'tee',
    'id',
    'whoami',
    'date',
    'test',
    'sh',
    'sudo',
    'nano',
    'git',
    'curl',
    'systemctl',
  ],
  maison: M,
  accueil: 'message_de_samia.txt',
  noms: true,
  final: 'fin',
  motDePasse: 'gazette-2027',
  comptes: comptesGazette,
  etat: (t) => {
    const tous = commits(t);
    return {
      systemd: nouveauSystemd('gazette', Date.UTC(2027, 4, 2, 6, 40, 0), Date.UTC(2027, 4, 17, 21, 2, 0), {
        ssh: {
          description: 'OpenBSD Secure Shell server',
          active: true,
          executable: 'sshd',
          processus: [{ pid: 604, utilisateur: 'root', cpu: 0, mem: 0.2, commande: 'sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups' }],
        },
        nginx: {
          description: 'A high performance web server and a reverse proxy server',
          active: true,
          executable: 'nginx',
          processus: [
            { pid: 801, utilisateur: 'root', cpu: 0, mem: 0.3, commande: 'nginx: master process /usr/sbin/nginx -g daemon on; master_process on;' },
            { pid: 802, utilisateur: 'www-data', cpu: 0.1, mem: 0.6, commande: 'nginx: worker process' },
          ],
          verifier: verifierNginx,
          charger: chargerNginx,
          verifierAuRechargement: true,
        },
      }),
      nginx: { charge: null, noms: ['gazette', GAZETTE, `www.${GAZETTE}`, '192.0.2.16'] },
      git: {
        [DEPOT]: { commits: tous, index: {}, nu: true },
        // Ta copie s'est arrêtée aux tests de Samia : la mise en page de Théo est sur le serveur.
        [LOCAL]: { commits: tous.slice(0, 5), index: { ...tous[4].fichiers }, distants: { prod: DEPOT } },
      },
      auteur: 'vous <vous@gazette.example>',
      date: 'Mon May 17 21:10:00 2027 +0200',
    };
  },
  initialiser: (j) => chargerNginx(j),
  apresCommande: (j) => {
    // Une fois le site rétabli et les tests ajoutés au crochet, Théo repousse
    // sa mise en page (cassée) : à chaque nouvelle version du crochet.
    const c = crochet(j);
    if (!j.etat.retabli || !c.includes('tests.sh') || c === j.etat.crochetTeste) return;
    j.etat.crochetTeste = c;
    j.etat.versionAvantTheo = enLigne(j);
    return theoRepousse(j);
  },
  creerMonde: (t) => {
    const racine: Droits = { proprio: 'root' };
    const lieu = (enfants: Parameters<typeof d>[0], droits: Droits = racine) => d(enfants, undefined, droits);
    const fichier = (texte: string, droits: Droits = racine) => f(texte, { lignes: true, ...droits });
    const partage: Droits = { proprio: 'vous', groupe: 'redaction', mode: 'rwxrwxr-x' };
    const tous = commits(t);
    const version = (c: Commit): Noeud =>
      lieu(
        Object.fromEntries(
          Object.entries(c.fichiers).map(([nom, texte]) => [nom, fichier(texte, { proprio: 'vous', groupe: 'redaction', mode: 'rw-rw-r--' })]),
        ),
        partage,
      );
    const conf = CONF_GAZETTE.replace(`root ${SITE};`, `root ${CURRENT};`);
    return lieu({
      etc: lieu({
        ...fichiersComptes(),
        hostname: fichier('gazette'),
        nginx: lieu({
          'nginx.conf': fichier(NGINX_CONF),
          'mime.types': fichier(MIME),
          'conf.d': lieu({}),
          'modules-enabled': lieu({}),
          'sites-available': lieu({ gazette: fichier(conf) }),
          'sites-enabled': lieu({ gazette: f('', { proprio: 'root', lien: '/etc/nginx/sites-available/gazette' }) }),
        }),
      }),
      home: lieu({
        vous: d({
          'message_de_samia.txt': f(t('retour-arriere-message-de-samia')),
          gazette: d({
            '.git': d({ HEAD: f('ref: refs/heads/main', { lignes: true }) }),
            ...Object.fromEntries(Object.entries(tous[4].fichiers).map(([nom, texte]) => [nom, f(texte, { lignes: true })])),
          }),
        }),
        samia: lieu({}, { proprio: 'samia', mode: 'rwx------' }),
        theo: lieu({ gazette: lieu({ '.git': lieu({}, { proprio: 'theo' }) }, { proprio: 'theo' }) }, { proprio: 'theo', mode: 'rwx------' }),
      }),
      srv: lieu({
        // Le dépôt partagé par la rédaction (git init --bare --shared=group).
        git: lieu({
          'gazette.git': lieu(
            {
              HEAD: fichier('ref: refs/heads/main', partage),
              config: fichier('[core]\n\trepositoryformatversion = 0\n\tfilemode = true\n\tbare = true\n\tsharedrepository = 1', partage),
              hooks: lieu({ 'post-receive': fichier(CROCHET(t), { ...partage, mode: 'rwxrwxr-x' }) }, partage),
              objects: lieu({}, partage),
              refs: lieu({ heads: lieu({ main: fichier(tous[5].id, partage) }, partage) }, partage),
            },
            partage,
          ),
        }),
        gazette: lieu(
          {
            releases: lieu({ [BONNE]: version(tous[4]), [CASSEE]: version(tous[5]) }, partage),
            current: f('', { proprio: 'vous', groupe: 'redaction', lien: `${RELEASES}/${CASSEE}` }),
          },
          partage,
        ),
      }),
      usr: lieu({ sbin: lieu({ nginx: f('', { proprio: 'root', mode: 'rwxr-xr-x', taille: 1_342_520 }) }) }),
      var: lieu({
        log: lieu({
          nginx: lieu(
            {
              'access.log': f('', { lignes: true, proprio: 'www-data', groupe: 'adm', mode: 'rw-r-----' }),
              'error.log': f('', { lignes: true, proprio: 'www-data', groupe: 'adm', mode: 'rw-r-----' }),
            },
            { proprio: 'root', groupe: 'adm' },
          ),
        }),
      }),
    });
  },
  evenements: [
    {
      id: 'panne',
      condition: (j) => j.derniere.commandes.some((c) => c[0] === 'curl') && page(j)?.code === 403,
      message: (j) => j.t('retour-arriere-evenement-panne'),
    },
    { id: 'sans-n', condition: (j) => lienDedans(j), message: (j) => j.t('retour-arriere-evenement-sans-n') },
    {
      id: 'retabli',
      condition: (j) => {
        const ok = marche(j);
        if (ok) j.etat.retabli = true;
        return ok;
      },
      message: (j) => j.t('retour-arriere-evenement-retabli'),
    },
    {
      id: 'garde-fou',
      condition: (j) => {
        const ok = !!j.etat.theoAPousse && marche(j) && enLigne(j) === j.etat.versionAvantTheo;
        if (ok) j.etat.gardeFou = true;
        return ok;
      },
      message: (j) => j.t('retour-arriere-evenement-garde-fou'),
    },
    { id: 'garde-fou-perce', condition: (j) => !!j.etat.theoAPousse && !marche(j), message: (j) => j.t('retour-arriere-evenement-garde-fou-perce') },
    {
      id: 'tests-ailleurs',
      condition: (j) =>
        j.derniere.commandes.some((c) => c[0] === 'git' && c.includes('push')) &&
        'index.html' in (depot(j, DEPOT)?.commits.at(-1)?.fichiers ?? {}) &&
        !deployeParCrochet(j),
      message: (j) => j.t('retour-arriere-evenement-tests-ailleurs'),
    },
    {
      id: 'fin',
      condition: (j) => !!j.etat.gardeFou && nouvelleMiseEnPage(j) && deployeParCrochet(j) && crochet(j).includes('tests.sh'),
      message: (j) => j.t('retour-arriere-evenement-fin'),
    },
  ],
};
