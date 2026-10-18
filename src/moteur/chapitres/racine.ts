// Chapitre 3 — La Racine : ls -l, permissions (rwx), chmod, whoami, sudo.
// Ici, l'arborescence ressemble enfin à un vrai Linux : /home, /etc,
// /var/log, /root. Fin de l'histoire de l'Effaceur.

import { d, f, type Chapitre } from '../monde';

const M = '/home/vous';
const SOUVENIRS = `${M}/souvenirs`;
const CONF = '/etc/effaceur.conf';
const TOTAL = 8;

const souvenir = (texte: string) => f(texte);

export const racine: Chapitre = {
  id: 'racine',
  numero: 3,
  titre: 'La Racine',
  resume: 'Les permissions et l’administration : ls -l, chmod, whoami, sudo.',
  commandes: ['ls', 'cd', 'pwd', 'cat', 'less', 'mv', 'grep', 'rm', 'touch', 'cp', 'mkdir', 'chmod', 'whoami', 'sudo'],
  maison: M,
  accueil: 'arrivee.txt',
  final: 'corrige',
  motDePasse: 'tournesol',
  creerMonde: () =>
    d(
      {
        home: d(
          {
            vous: d({
              'arrivee.txt': f(
                `
Tu glisses le long du Toboggan et tu atterris… dans une pièce qui te
semble familière. Sur la porte, une plaque : /home/vous.

Ta maison. La vraie. Tout en bas du royaume, à la Racine (« / »), les lieux
ont enfin leurs vrais noms de Linux : /home pour les maisons des
utilisateurs, /etc pour les réglages, /var/log pour les journaux, /root
pour l'administrateur.

Lis le manuel posé sur la table :  cat manuel_admin.txt
`,
                { lu: (j) => void j.drapeaux.add('arrivee') },
              ),
              'manuel_admin.txt': f(`
MANUEL DE L'ADMINISTRATEUR·ICE

Chaque objet et chaque lieu a un PROPRIÉTAIRE et des PERMISSIONS.
Pour les voir :  ls -l

  d rwx r-x r-x   vous  vous  4096  souvenirs/
  │  │   │   │     └─ propriétaire
  │  │   │   └─ les autres : r-x
  │  │   └─ le groupe : r-x
  │  └─ le propriétaire : rwx
  └─ d = un lieu (dossier), - = un objet (fichier)

(ls -l écrit les trois groupes collés : drwxr-xr-x.)

  r  lire           (read)
  w  écrire         (write)   pour un lieu : y créer, y effacer, y renommer
  x  exécuter       (execute) pour un lieu : y entrer, le traverser

chmod change les permissions (seul le propriétaire peut le faire) :
  chmod o-w lieu    retire aux autres (o) le droit d'écrire (w)
  chmod 755 lieu    rwx pour le propriétaire, r-x pour les autres

whoami dit qui tu es. root, lui, a TOUS les droits. Pour agir en tant que
root, on écrit sudo devant la commande. sudo demande TON mot de passe.

Ton mot de passe ? L'Effaceur te l'a fait oublier, avec le reste. Tu l'as
peut-être noté quelque part chez toi… Ton journal.txt est long : grep est
fait pour ça. (Les guillemets gardent les espaces : grep "mot de passe" …)
`),
              'journal.txt': f(
                `
JOURNAL

An 98 : on me confie l'administration du royaume. Grande responsabilité.
An 99 : installé l'horloge du Bourg. Les engrenages tournent bien.
An 100 : la Corbeille déborde. Il faudrait un programme pour la vider.
An 101 : j'écris l'Effaceur, un petit démon qui videra la Corbeille.
An 102 : écrit la configuration de l'Effaceur dans /etc. Pas eu le temps de relire.
An 102 : mon mot de passe change. Je le note ici (très mauvaise idée !) : tournesol
An 102 : Démarré l'Effaceur. Il tourne sous son propre utilisateur, « effaceur ».
An 103 : catastrophe. Le levain de la Boulangerie disparaît. Puis les engrenages.
An 103 : j'ai trouvé l'erreur dans la configuration. J'ai préparé une version corrigée, ici, dans ma maison.
An 103 : il faut l'installer avec sudo avant que l'Effaceur n'arrive jusqu'à moi.
`,
                { mode: 'rw-------', lignes: true },
              ),
              'effaceur.conf.corrige': f(`
# Configuration de l'Effaceur — version corrigée (an 103)
# Le démon efface, à chaque passage, tout ce qui se trouve dans la cible.
cible = /Royaume/Corbeille
`, { lignes: true }),
              souvenirs: d(
                {
                  ecole: souvenir('Une salle de classe. Quelqu’un t’apprend à compter en binaire sur tes doigts : jusqu’à 31 avec une seule main.'),
                  premier_programme: souvenir('Ton tout premier programme. Il affichait « Bonjour » et tu as crié de joie.'),
                  jardin: souvenir('Un jardin plein de tournesols. Tu adorais leur couleur.'),
                  chanson: souvenir('Une chanson que tu fredonnais en réparant les serveurs.'),
                  voyage: souvenir('Un voyage en train, le nez collé à la vitre.'),
                  amie: souvenir('Une amie qui te disait : « Relis toujours avant d’appuyer sur Entrée. »'),
                  bibliotheque: souvenir('Une bibliothèque immense, où tu as appris le mot « Unix ».'),
                  premier_serveur: souvenir('Le premier serveur dont tu as eu la charge. Il ronronnait comme un chat.'),
                },
                undefined,
                { mode: 'rwxrwxrwx' },
              ),
            }),
            nour: d(
              {
                'journal_intime.txt': f(
                  (j) =>
                    j.qui === 'root'
                      ? 'Tu pourrais le lire : root a tous les droits. Mais c’est le journal intime de Nour. Tu le refermes sans le lire.\n(#1 : respectez la vie privée des autres.)'
                      : '',
                  { proprio: 'nour', mode: 'rw-------' },
                ),
              },
              undefined,
              { proprio: 'nour', mode: 'rwx------' },
            ),
          },
          undefined,
          { proprio: 'root' },
        ),
        etc: d(
          {
            'effaceur.conf': f(
              `
# Configuration de l'Effaceur — écrite par : vous (an 102)
# Le démon efface, à chaque passage, tout ce qui se trouve dans la cible.
cible = /Royaume /Corbeille
`,
              { proprio: 'root', lignes: true },
            ),
            sudoers: f(
              `
# Qui a le droit d'utiliser sudo, et pour quoi faire.
root    ALL=(ALL:ALL) ALL
vous    ALL=(ALL:ALL) ALL   # vous : administrateur·ice du royaume
`,
              { proprio: 'root', mode: 'r--r-----', lignes: true },
            ),
          },
          undefined,
          { proprio: 'root' },
        ),
        var: d(
          {
            log: d(
              {
                'effaceur.log': f(
                  `
[an 102] démarrage du démon effaceur (utilisateur : effaceur)
[an 102] lecture de /etc/effaceur.conf
[an 102] cible = /Royaume /Corbeille
[an 102] 2 cibles trouvées : « /Royaume » et « /Corbeille »
[an 102] effacement de /Royaume/Corbeille/vieux_papiers
[an 102] effacement de /Royaume/Bourg/Boulangerie/levain_4
[an 103] effacement de /Royaume/Bourg/Boulangerie/levain_5
[an 103] effacement de /Royaume/Bourg/Atelier/engrenage_12
[an 104] effacement de /Royaume/Ile/Phare/ampoule
[an 131] nouvelle cible accessible : /home/vous/souvenirs (droits : rwxrwxrwx)
`,
                  { proprio: 'root', lignes: true },
                ),
              },
              undefined,
              { proprio: 'root' },
            ),
          },
          undefined,
          { proprio: 'root' },
        ),
        root: d(
          {
            'notes.txt': f(
              `
Si tu lis ceci, c'est que tu es root (ou que tu as utilisé sudo).

root peut tout lire, tout modifier, tout effacer, y compris le système
lui-même. C'est pour cela qu'on ne travaille jamais en root au quotidien :
on utilise sudo, pour une seule commande, quand c'est nécessaire.
`,
              { proprio: 'root', mode: 'rw-------' },
            ),
          },
          undefined,
          { proprio: 'root', mode: 'rwx------' },
        ),
      },
      undefined,
      { proprio: 'root' },
    ),
  // L'Effaceur avance : à chaque commande, il efface un souvenir, tant que
  // les autres utilisateurs ont le droit d'écrire dans le lieu.
  apresCommande: (j) => {
    if (!j.drapeaux.has('alerte') || j.drapeaux.has('corrige') || !j.existe(CONF)) return;
    const lieu = j.trouver(SOUVENIRS);
    if (lieu?.type !== 'dossier' || !j.peut(lieu, 'w', 'effaceur') || !j.peut(lieu, 'x', 'effaceur')) return;
    const nom = Object.keys(lieu.enfants).sort()[0];
    if (!nom) return;
    delete lieu.enfants[nom];
    return `✗ Un souvenir s’efface : ${nom}`;
  },
  evenements: [
    {
      id: 'alerte',
      condition: (j) => j.drapeaux.has('arrivee'),
      message: `
Soudain, un grésillement venu du lieu souvenirs… L'Effaceur est ici ! À
chacune de tes commandes, il va effacer un de tes souvenirs.

Regarde les permissions :  ls -l
Le lieu souvenirs est en rwxrwxrwx : tout le monde, y compris l'utilisateur
« effaceur », a le droit d'y écrire, donc d'y effacer. Retire ce droit aux
autres (o), vite :

  chmod o-w souvenirs
`,
    },
    {
      id: 'protege',
      condition: (j) => {
        const lieu = j.trouver(SOUVENIRS);
        return j.drapeaux.has('alerte') && !j.drapeaux.has('corrige') && lieu?.type === 'dossier' && !(j.peut(lieu, 'w', 'effaceur') && j.peut(lieu, 'x', 'effaceur'));
      },
      message: (j) => `
L'Effaceur s'acharne sur tes souvenirs… « Permission non accordée ». Il
recule. Sous Linux, effacer un fichier, c'est modifier le lieu qui le
contient : sans le droit d'écrire dans ce lieu, impossible d'y effacer.

Tu as sauvé ${j.compter(SOUVENIRS, '')} souvenir(s) sur ${TOTAL}. Mais l'Effaceur continue ailleurs, dans
tout le royaume. D'où vient son ordre ? Les démons écrivent ce qu'ils font
dans un journal :

  cat /var/log/effaceur.log
`,
    },
    {
      id: 'conf-effacee',
      condition: (j) => !j.existe(CONF),
      message: `
Le démon cherche sa configuration… et ne la trouve plus. Il s'arrête.
C'est mieux que rien, mais plus personne ne vide la Corbeille. Il manque
une configuration correcte dans /etc : le démon ne lit que le fichier
/etc/effaceur.conf, sous ce nom exact.
`,
    },
    {
      id: 'corrige',
      condition: (j) => {
        const conf = j.trouver(CONF);
        return conf?.type === 'fichier' && typeof conf.contenu === 'string' && conf.contenu.includes('cible = /Royaume/Corbeille');
      },
      message: (j) => {
        const sauves = j.compter(SOUVENIRS, '');
        return `
Le démon relit sa configuration : « cible = /Royaume/Corbeille ». Une
seule cible, cette fois. L'Effaceur s'arrête net… puis se met à vider la
Corbeille, comme au premier jour.

Et tout te revient. Tu étais l'administrateur·ice du royaume. C'est toi
qui avais écrit cette configuration, avec une espace de trop : « /Royaume
/Corbeille » au lieu de « /Royaume/Corbeille ». Pour l'Effaceur, cela
faisait deux cibles, dont le royaume entier. Il n'était pas méchant : il
faisait exactement ce qu'on lui avait écrit.

Tu as sauvé ${sauves} souvenir(s) sur ${TOTAL}.${sauves < TOTAL ? " Ceux qui sont partis ne reviendront pas : il n'y a pas de corbeille… à moins d'avoir fait des sauvegardes. Mais ça, c'est une autre histoire." : ''}

FIN DE L'HISTOIRE DE L'EFFACEUR.

Tu connais maintenant les permissions (ls -l, chmod), la différence entre
un utilisateur et root, et sudo — avec ses trois règles. La deuxième est
la plus importante : réfléchis avant de taper.
`;
      },
    },
  ],
};
