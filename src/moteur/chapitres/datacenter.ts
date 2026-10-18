// Histoire « Le Datacenter » — chapitre « Premier jour » : lire un journal
// de serveur avec head, tail, wc, grep, cut, sort, uniq et les tubes |,
// écrire avec > et >>, gérer les processus (ps, kill) et un service
// (systemctl), écrire dans un fichier de root avec sudo tee.
//
// Le journal suit le format « combined » de nginx, sans les deux derniers
// champs (page d'origine et navigateur). Toutes les adresses IP sont
// réservées à la documentation (RFC 5737).

import { d, f, type Chapitre } from '../monde';
import type { Processus } from '../commandes/systeme';

const M = '/home/vous';
const ROBOT = '198.51.100.77';
const BLOQUES = '/etc/nginx/bloques.conf';

// Journal d'accès déterministe : des visiteurs, puis un robot qui aspire le
// catalogue et fait tomber le service (erreurs 503).
function journal(): { texte: string; erreurs503: number; requetesRobot: number } {
  const visiteurs = ['192.0.2.14', '192.0.2.31', '192.0.2.58', '203.0.113.9', '203.0.113.42', '203.0.113.87', '192.0.2.120', '203.0.113.150'];
  const pages = ['/', '/agenda', '/catalogue', '/horaires', '/catalogue/livre/1984', '/expositions', '/contact', '/catalogue/livre/beloved'];
  let graine = 42;
  const hasard = () => (graine = (graine * 1103515245 + 12345) % 2147483648) / 2147483648;
  const lignes: string[] = [];
  let e503 = 0;
  let robot = 0;
  for (let i = 0; i < 360; i++) {
    const s = 20 * 3600 + i * 7;
    const heure = `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
    const estRobot = i >= 120 && hasard() < 0.7;
    const ip = estRobot ? ROBOT : visiteurs[Math.floor(hasard() * visiteurs.length)];
    const page = estRobot ? `/catalogue/recherche?q=${String.fromCharCode(97 + (i % 26))}${i}` : pages[Math.floor(hasard() * pages.length)];
    const surcharge = i >= 210 && hasard() < 0.75;
    const statut = surcharge ? 503 : 200;
    if (statut === 503) e503++;
    if (estRobot) robot++;
    const taille = statut === 503 ? 197 : 1200 + Math.floor(hasard() * 9000);
    lignes.push(`${ip} - - [13/Oct/2026:${heure} +0200] "GET ${page} HTTP/1.1" ${statut} ${taille}`);
  }
  return { texte: lignes.join('\n'), erreurs503: e503, requetesRobot: robot };
}

const JOURNAL = journal();
export const ERREURS_503 = JOURNAL.erreurs503;
export const REQUETES_ROBOT = JOURNAL.requetesRobot;

const BLOQUES_INITIAL = `# Adresses bloquées par nginx (une règle par ligne)
deny 203.0.113.5;
deny 192.0.2.99;`;

const catalogueStable = (): Processus => ({ pid: 4243, utilisateur: 'www-data', cpu: 1.2, mem: 2.1, commande: 'php-fpm: pool catalogue' });

export const datacenter: Chapitre = {
  id: 'premier-jour',
  numero: 1,
  titre: 'Premier jour',
  resume: 'Lire un journal de serveur, enchaîner les commandes avec |, écrire avec > et >>, arrêter un processus.',
  commandes: ['ls', 'cd', 'pwd', 'cat', 'less', 'head', 'tail', 'wc', 'grep', 'cut', 'sort', 'uniq', 'echo', 'tee', 'cp', 'mv', 'rm', 'ps', 'kill', 'systemctl', 'sudo', 'whoami'],
  maison: M,
  accueil: 'courriel_awa.txt',
  final: 'rapport',
  motDePasse: 'bienvenue-2026',
  etat: () => ({
    processus: [
      { pid: 1, utilisateur: 'root', cpu: 0, mem: 0.1, commande: '/sbin/init' },
      { pid: 612, utilisateur: 'root', cpu: 0, mem: 0.3, commande: 'nginx: master process /usr/sbin/nginx' },
      { pid: 613, utilisateur: 'www-data', cpu: 4.8, mem: 0.6, commande: 'nginx: worker process' },
      { pid: 4242, utilisateur: 'www-data', cpu: 99.3, mem: 38.5, commande: 'php-fpm: pool catalogue' },
      { pid: 5120, utilisateur: 'vous', cpu: 0, mem: 0.1, commande: '-bash' },
    ] satisfies Processus[],
    services: {
      nginx: { description: 'A high performance web server and a reverse proxy server', actif: true },
      catalogue: { description: 'Catalogue en ligne de la médiathèque (php-fpm)', actif: true },
    },
    // Configuration que nginx a réellement chargée (il ne relit le fichier
    // qu'au reload ou au restart).
    confChargee: BLOQUES_INITIAL,
    surSystemctl: (jeu: any, action: string, nom: string) => {
      if (nom !== 'nginx' || action === 'stop') return '';
      jeu.etat.confChargee = jeu.lire(BLOQUES) ?? '';
      return '';
    },
    surKill: (jeu: any, p: Processus) => {
      if (p.commande !== 'php-fpm: pool catalogue') return '';
      // systemd relance automatiquement le service (Restart=always).
      const bloque = jeu.etat.confChargee.includes(`deny ${ROBOT};`);
      const nouveau = bloque ? catalogueStable() : { ...catalogueStable(), pid: p.pid + 2, cpu: 99.1, mem: 37.9 };
      jeu.etat.processus.push(nouveau);
      return bloque
        ? `systemd relance le service catalogue : nouveau processus ${nouveau.pid}. Le robot étant bloqué, il reste calme.`
        : `systemd relance aussitôt le service catalogue : nouveau processus ${nouveau.pid}… et le robot recommence. Il est déjà à 99 % !`;
    },
  }),
  creerMonde: () =>
    d(
      {
        home: d(
          {
            vous: d({
              'courriel_awa.txt': f(`
De : Awa (responsable d'exploitation)
À : toi, stagiaire
Objet : Bienvenue… et urgence !

Bienvenue dans l'équipe ! Tu tombes bien : depuis 20 h 25, le site de la
médiathèque répond par des erreurs 503 (« Service indisponible »).

Je suis coincée en réunion. Peux-tu enquêter ? Le journal du serveur web
est ici :

  /var/log/nginx/access.log

Chaque ligne est une visite : l'adresse IP du visiteur, la date, la page
demandée, puis le code de réponse (200 = OK, 503 = en panne).

1. Combien y a-t-il d'erreurs 503 dans le journal ?
2. Qui envoie autant de demandes ?
3. Remets le site en état, puis écris-moi un petit rapport dans
   ~/rapport.txt : le nombre d'erreurs 503 et l'adresse du coupable.

Ton mot de passe provisoire (pour sudo) : bienvenue-2026
Change-le vite, et ne le note nulle part !

Mes notes sont dans ~/notes_awa.txt.
`),
              'notes_awa.txt': f(`
NOTES D'AWA — LES COMMANDES DU QUOTIDIEN

  head fichier        le début (10 lignes)       tail fichier   la fin
  wc -l fichier       compte les lignes
  grep motif fichier  les lignes qui contiennent le motif

La vraie force d'Unix : le TUBE |. La sortie d'une commande devient
l'entrée de la suivante. Par exemple :

  grep " 503 " access.log | wc -l     compte les lignes qui contiennent « 503 »

(les guillemets gardent les espaces : on cherche « 503 » entouré d'espaces,
pour ne pas tomber sur un 503 caché dans une adresse ou une taille).

Pour savoir qui demande le plus souvent :

  cut -d " " -f 1 fichier     garde le 1er champ de chaque ligne (l'IP)
  sort                        trie les lignes
  uniq -c                     compte les lignes identiques qui se suivent
  sort -n                     trie par nombre
  tail -3                     garde les 3 dernières (les plus grandes)

On les enchaîne toutes avec des | . Essaie !

Écrire dans un fichier :
  commande > fichier     ÉCRASE le fichier avec le résultat
  commande >> fichier    AJOUTE le résultat à la fin

Le serveur web (nginx) bloque les adresses listées dans
/etc/nginx/bloques.conf, au format : deny ADRESSE;
Ce fichier appartient à root. Après l'avoir modifié, il faut demander à
nginx de le relire : sudo systemctl reload nginx
`),
            }),
          },
          undefined,
          { proprio: 'root' },
        ),
        var: d(
          {
            log: d(
              {
                nginx: d(
                  {
                    'access.log': f(JOURNAL.texte, { proprio: 'root', lignes: true }),
                  },
                  undefined,
                  { proprio: 'root' },
                ),
              },
              undefined,
              { proprio: 'root' },
            ),
          },
          undefined,
          { proprio: 'root' },
        ),
        etc: d(
          {
            nginx: d(
              {
                'bloques.conf': f(BLOQUES_INITIAL, { proprio: 'root', lignes: true }),
                'bloques.conf.bak': f(BLOQUES_INITIAL, { proprio: 'root', lignes: true }),
              },
              undefined,
              { proprio: 'root' },
            ),
          },
          undefined,
          { proprio: 'root' },
        ),
      },
      undefined,
      { proprio: 'root' },
    ),
  evenements: [
    {
      id: 'compte',
      condition: (j) => {
        const cmds = j.derniere.commandes.flat();
        return cmds.includes('grep') && j.derniere.sortie.trim().split(/\s+/)[0] === String(ERREURS_503);
      },
      message: `
Exact : ${ERREURS_503} erreurs 503. Tu viens d'enchaîner deux petits outils :
grep filtre les lignes, wc les compte. C'est toute la philosophie d'Unix :
des outils simples, qu'on branche les uns aux autres.

Question suivante : qui envoie autant de demandes ? (voir ~/notes_awa.txt)
`,
    },
    {
      id: 'robot',
      condition: (j) => j.derniere.commandes.flat().includes('uniq') && j.derniere.sortie.includes(ROBOT),
      message: `
${ROBOT} : ${REQUETES_ROBOT} demandes en quelques minutes, toutes vers
/catalogue/recherche. Ce n'est pas un humain : c'est un robot qui aspire
le catalogue, et le service « catalogue » n'arrive plus à suivre.

Regarde ce qui se passe sur la machine :  ps aux
`,
    },
    {
      id: 'surcharge',
      condition: (j) => j.derniere.commandes[0]?.[0] === 'ps' && j.derniere.sortie.includes('99.3'),
      message: `
Le processus 4242 (php-fpm: pool catalogue) utilise 99 % du processeur.
Tu pourrais l'arrêter avec kill… mais si le robot continue, il retombera
aussitôt. Bloque d'abord le robot dans /etc/nginx/bloques.conf.

Ce fichier appartient à root, et  sudo echo … >> fichier  ne marche pas :
la redirection >> est faite par TON shell, pas par sudo. L'astuce
classique, c'est tee, qui écrit ce qu'il reçoit dans un fichier :

  echo "deny ${ROBOT};" | sudo tee -a ${BLOQUES}
`,
    },
    {
      id: 'ecrase',
      condition: (j) => !(j.lire(BLOQUES) ?? '').includes('deny 203.0.113.5;'),
      message: `
Oups ! Les anciennes règles de bloques.conf ont disparu : le fichier a été
ÉCRASÉ (> ou tee sans -a) au lieu d'être complété (>> ou tee -a). Pas de
panique : une copie de sauvegarde existe. Restaure-la avec
sudo cp /etc/nginx/bloques.conf.bak ${BLOQUES}, puis recommence avec -a.
`,
    },
    {
      id: 'regle',
      condition: (j) => (j.lire(BLOQUES) ?? '').includes(`deny ${ROBOT};`),
      message: `La règle est écrite. Mais nginx ne relit pas son fichier tout seul : sudo systemctl reload nginx`,
    },
    {
      id: 'bloque',
      condition: (j) => j.etat.confChargee.includes(`deny ${ROBOT};`),
      message: (j) => {
        const p = (j.etat.processus as Processus[]).find((q) => q.cpu > 90);
        return `
nginx a relu sa configuration : ${ROBOT} reçoit maintenant « 403 Forbidden »
au lieu de pages.${p ? ` Reste le processus ${p.pid}, toujours bloqué à 99 % : arrête-le
(il appartient à www-data, donc… sudo). systemd le relancera tout propre.` : ''}
`;
      },
    },
    {
      id: 'repare',
      condition: (j) =>
        j.drapeaux.has('bloque') && !(j.etat.processus as Processus[]).some((p) => p.cpu > 90),
      message: `
Le site de la médiathèque répond de nouveau ! Dernière chose : le rapport
pour Awa, dans ~/rapport.txt. Avec > on crée le fichier, avec >> on ajoute
une ligne. Par exemple :

  grep " 503 " /var/log/nginx/access.log | wc -l > ~/rapport.txt
  echo "Coupable : ${ROBOT}" >> ~/rapport.txt
`,
    },
    {
      id: 'rapport',
      condition: (j) => {
        const r = j.lire(`${M}/rapport.txt`) ?? '';
        return j.drapeaux.has('repare') && r.includes(String(ERREURS_503)) && r.includes(ROBOT);
      },
      message: `
Awa sort de réunion et lit ton rapport : « ${ERREURS_503} erreurs, robot
identifié, bloqué, service relancé. Pour un premier jour… bravo ! »

FIN DU CHAPITRE « PREMIER JOUR ».

Tu sais maintenant lire un journal (head, tail, grep), compter et classer
(wc, cut, sort, uniq), enchaîner les outils avec |, écrire dans un fichier
(> écrase, >> ajoute), et gérer processus et services (ps, kill,
systemctl). Ce sont les gestes de tous les jours des personnes qui font
tourner les serveurs d'internet.
`,
    },
  ],
};
