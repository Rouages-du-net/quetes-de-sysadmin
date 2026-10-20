// Histoire « La Gazette » — chapitre « Le dépôt nu » : déployer par git.
// Le site du journal du quartier est servi par nginx depuis /var/www/gazette,
// où chacun·e copiait ses fichiers à la main. Le code est déjà suivi par git
// dans ~/gazette. Il faut un dépôt nu sur le serveur (/srv/git/gazette.git)
// et un crochet post-receive qui extrait chaque push dans /var/www/gazette.
// Piège : Théo a corrigé une faute directement sur le serveur ; elle n'est
// pas dans git, et le premier déploiement l'efface.
// Objectif vérifié sur l'état : le site est exactement le dernier commit du
// dépôt du serveur, extrait par son crochet ; il contient l'article de Samia,
// la correction de Théo, puis la date corrigée de l'agenda.
// Sources : https://git-scm.com/book/fr/v2/Git-sur-le-serveur-Mise-en-place-du-serveur,
// https://git-scm.com/docs/githooks#post-receive, https://git-scm.com/docs/git#Documentation/git.txt---work-treeltpathgt

import { d, f, fichiersComptes, type Chapitre, type Comptes, type Droits } from '../monde';
import type { Jeu } from '../shell';
import { nouveauSystemd } from '../systemd';
import { chargerNginx, requete, verifierNginx } from '../nginx';
import { nouveauCommit, type Commit, type Depot } from '../commandes/git';
import { contenu } from '../outils';
import { MIME, NGINX_CONF } from '../commandes/apt';

const M = '/home/vous';
const LOCAL = `${M}/gazette`;
export const DEPOT = '/srv/git/gazette.git';
export const SITE = '/var/www/gazette';
const GAZETTE = 'gazette.example';
export const AUTRICE = 'Samia Haddad <samia@gazette.example>';

export const comptesGazette = (): Comptes => ({
  utilisateurs: {
    root: { uid: 0, groupe: 'root', maison: '/root' },
    'www-data': { uid: 33, groupe: 'www-data', maison: '/var/www', shell: '/usr/sbin/nologin' },
    vous: { uid: 1000, groupe: 'vous' },
    samia: { uid: 1001, groupe: 'samia' },
    theo: { uid: 1002, groupe: 'theo' },
  },
  groupes: {
    root: { gid: 0, membres: [] },
    sudo: { gid: 27, membres: ['vous', 'samia'] },
    'www-data': { gid: 33, membres: [] },
    vous: { gid: 1000, membres: [] },
    samia: { gid: 1001, membres: [] },
    theo: { gid: 1002, membres: [] },
    redaction: { gid: 1100, membres: ['vous', 'samia', 'theo'] },
  },
});

export const CONF_GAZETTE = `server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name ${GAZETTE} www.${GAZETTE};

    root ${SITE};
    index index.html;

    location / {
        try_files $uri $uri/ =404;
    }
}`;

export const STYLE = `body { font-family: Georgia, serif; max-width: 40em; margin: auto; }
h1 { border-bottom: 3px double; }
time { font-weight: bold; }`;

// L'agenda, avec la date du vide-grenier (dans le texte et dans datetime).
export const agenda = (t: Jeu['t'], jour: number) =>
  t('depot-nu-site-agenda', { date: `2027-06-${String(jour).padStart(2, '0')}`, jour: String(jour) });

// L'historique du site dans ~/gazette : la première version (avec la faute
// du titre), puis l'article de Samia, pas encore en ligne.
export function historique(t: Jeu['t']): Commit[] {
  const v1 = { 'index.html': t('depot-nu-site-index-v1'), 'style.css': STYLE, 'agenda.html': agenda(t, 21) };
  const c1 = nouveauCommit(null, t('depot-nu-commit-1'), AUTRICE, 'Mon Apr 12 10:02:41 2027 +0200', v1);
  const c2 = nouveauCommit(c1, t('depot-nu-commit-2'), AUTRICE, 'Fri May 7 18:30:12 2027 +0200', {
    ...v1,
    'index.html': t('depot-nu-site-index-v2'),
    'fete-des-voisins.html': t('depot-nu-site-article'),
  });
  return [c1, c2];
}

const depot = (j: Jeu, chemin: string): Depot | undefined => j.etat.git?.[chemin];
const tete = (j: Jeu) => depot(j, DEPOT)?.commits.at(-1);
const lireSite = (j: Jeu, nom: string) => {
  const n = j.trouver(`${SITE}/${nom}`);
  return n?.type === 'fichier' ? contenu(n, j) : null;
};
// Le site est-il exactement le dernier commit du serveur, extrait par son crochet ?
const deploye = (j: Jeu) => {
  const c = tete(j);
  return !!c && j.etat.gitDeploiements?.[SITE] === c.id && Object.entries(c.fichiers).every(([nom, texte]) => lireSite(j, nom) === texte);
};
const avecFaute = (j: Jeu) => (lireSite(j, 'index.html') ?? '').includes(j.t('depot-nu-titre-faute'));
const avecArticle = (j: Jeu) =>
  (lireSite(j, 'index.html') ?? '').includes('href="fete-des-voisins.html"') && lireSite(j, 'fete-des-voisins.html') !== null;
const agendaCorrige = (j: Jeu) => {
  const a = lireSite(j, 'agenda.html') ?? '';
  return a.includes('2027-06-12') && !a.includes('2027-06-21');
};
const enLigne = (j: Jeu) => deploye(j) && avecArticle(j) && !avecFaute(j);
const sortie = (j: Jeu) => [j.derniere.sortie, ...j.derniere.erreurs].join('\n');

export const depotNu: Chapitre = {
  id: 'depot-nu',
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
    'diff',
    'cp',
    'mv',
    'rm',
    'mkdir',
    'touch',
    'chmod',
    'chown',
    'chgrp',
    'echo',
    'tee',
    'id',
    'whoami',
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
  etat: (t) => ({
    systemd: nouveauSystemd('gazette', Date.UTC(2027, 4, 2, 6, 40, 0), Date.UTC(2027, 4, 10, 9, 15, 0), {
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
    git: { [LOCAL]: { commits: historique(t), index: historique(t).at(-1)!.fichiers } },
    auteur: 'vous <vous@gazette.example>',
    date: 'Mon May 10 09:20:00 2027 +0200',
  }),
  initialiser: (j) => chargerNginx(j),
  creerMonde: (t) => {
    const racine: Droits = { proprio: 'root' };
    const lieu = (enfants: Parameters<typeof d>[0], droits: Droits = racine) => d(enfants, undefined, droits);
    const fichier = (texte: string, droits: Droits = racine) => f(texte, { lignes: true, ...droits });
    const redaction = (texte: string, proprio = 'vous') => fichier(texte, { proprio, groupe: 'redaction', mode: 'rw-rw-r--' });
    const derniere = historique(t).at(-1)!.fichiers;
    return lieu({
      etc: lieu({
        ...fichiersComptes(),
        hostname: fichier('gazette'),
        nginx: lieu({
          'nginx.conf': fichier(NGINX_CONF),
          'mime.types': fichier(MIME),
          'conf.d': lieu({}),
          'modules-enabled': lieu({}),
          'sites-available': lieu({ gazette: fichier(CONF_GAZETTE) }),
          'sites-enabled': lieu({ gazette: f('', { proprio: 'root', lien: '/etc/nginx/sites-available/gazette' }) }),
        }),
      }),
      home: lieu({
        vous: d({
          'message_de_samia.txt': f(t('depot-nu-message-de-samia')),
          'mot_de_theo.txt': f(t('depot-nu-mot-de-theo')),
          gazette: d({
            '.git': d({ HEAD: f('ref: refs/heads/main', { lignes: true }) }),
            ...Object.fromEntries(Object.entries(derniere).map(([nom, texte]) => [nom, f(texte, { lignes: true })])),
          }),
        }),
        samia: lieu({}, { proprio: 'samia', mode: 'rwx------' }),
        theo: lieu({}, { proprio: 'theo', mode: 'rwx------' }),
      }),
      srv: lieu({ git: lieu({}) }),
      usr: lieu({ sbin: lieu({ nginx: f('', { proprio: 'root', mode: 'rwxr-xr-x', taille: 1_342_520 }) }) }),
      var: lieu({
        www: lieu({
          // La première version, posée à la main… et la faute du titre corrigée sur place par Théo.
          gazette: lieu(
            {
              'index.html': redaction(t('depot-nu-site-index-theo'), 'theo'),
              'style.css': redaction(STYLE),
              'agenda.html': redaction(agenda(t, 21)),
            },
            { proprio: 'vous', groupe: 'redaction', mode: 'rwxrwxr-x' },
          ),
        }),
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
      id: 'derive',
      condition: (j) => j.derniere.commandes.some((c) => c[0] === 'diff') && sortie(j).includes(j.t('depot-nu-titre-faute')),
      message: (j) => j.t('depot-nu-evenement-derive'),
    },
    { id: 'droits', condition: (j) => sortie(j).includes(j.t('git-push-droits').split('\n')[0]), message: (j) => j.t('depot-nu-evenement-droits') },
    {
      id: 'sans-crochet',
      condition: (j) =>
        j.derniere.commandes.some((c) => c[0] === 'git' && c.includes('push')) &&
        !!tete(j) &&
        !j.existe(`${DEPOT}/hooks/post-receive`) &&
        !j.etat.gitDeploiements?.[SITE],
      message: (j) => j.t('depot-nu-evenement-sans-crochet'),
    },
    {
      id: 'crochet-ignore',
      condition: (j) => sortie(j).includes('hooks/post-receive') && sortie(j).includes('advice.ignoredHook'),
      message: (j) => j.t('depot-nu-evenement-crochet-ignore'),
    },
    {
      id: 'non-suivis',
      condition: (j) => sortie(j).includes(j.t('git-checkout-non-suivis', { fichiers: '' }).split('\n')[0]),
      message: (j) => j.t('depot-nu-evenement-non-suivis'),
    },
    {
      id: 'correction-perdue',
      condition: (j) => !!j.etat.gitDeploiements?.[SITE] && avecFaute(j),
      message: (j) => j.t('depot-nu-evenement-correction-perdue'),
    },
    { id: 'en-ligne', condition: (j) => enLigne(j), message: (j) => j.t('depot-nu-evenement-en-ligne') },
    { id: 'a-la-main', condition: (j) => agendaCorrige(j) && !deploye(j), message: (j) => j.t('depot-nu-evenement-a-la-main') },
    {
      id: 'fin',
      condition: (j) => enLigne(j) && agendaCorrige(j) && requete(j, GAZETTE, '/agenda.html', 80, false)?.code === 200,
      message: (j) => j.t('depot-nu-evenement-fin'),
    },
  ],
};
