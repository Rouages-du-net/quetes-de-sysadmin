# Intégrer Quêtes de Sysadmin dans un site

— [English version](EMBEDDING.md) (la version de référence)

Le jeu est un **composant web** autonome : un seul fichier JavaScript, sans
dépendance, sans cookie, sans ressource tierce. Depuis sysadmin.rouages.net,
il compte des statistiques de visite anonymes sur le serveur Umami du projet
(voir « Vie privée » plus bas ; `stats="off"` les coupe). Il fonctionne dans
n'importe quelle page HTML (site statique, CMS, plateforme de cours…).

## En deux lignes

```html
<script type="module" src="https://sysadmin.rouages.net/integration/quetes-de-sysadmin.js"></script>
<quetes-de-sysadmin></quetes-de-sysadmin>
```

Pour ne dépendre d'aucun serveur extérieur, copie le dossier
`dist/integration/` (après `npm run build` : `quetes-de-sysadmin.js` et ses
`chunks/`) sur ton site et change l'adresse du script.

Le fichier est léger : il charge le reste du jeu (son interface et son
moteur, chaque histoire, chaque groupe de textes) depuis `chunks/`, à côté de
lui, par rapport à sa propre adresse, et seulement quand il en a besoin.

Le serveur de sysadmin.rouages.net envoie l'en-tête
`Access-Control-Allow-Origin: *` pour ce fichier et ses morceaux (voir
`public/.htaccess`) : c'est obligatoire pour qu'un script « module » soit
chargé depuis un autre site. Si tu les héberges toi-même sur un autre domaine
que ta page, configure le même en-tête.

## Attributs

| Attribut | Valeurs | Effet |
|---|---|---|
| `lang` | `en`, `fr` | langue du jeu ; sans l'attribut, la langue de la page (`lang` d'un élément parent), sinon l'anglais ; une langue inconnue donne l'anglais |
| `story` | l'identifiant d'une histoire : `eraser`, `datacenter`, `packet`, `time-machine`, `archives`… (les anciens identifiants français, `effaceur`, `paquet`…, marchent toujours) | histoire ouverte au départ, directement sur sa machine, même sans sa clé SSH (sans l'attribut, on part du poste, ou de l'histoire en cours) |
| `save-key` | texte | clé de sauvegarde dans `localStorage` (par défaut `quetes-de-sysadmin`) ; à changer pour séparer plusieurs jeux sur un même site |
| `theme` | `light`, `dark` | force un thème (par défaut, celui du système) |
| `exam-control` | `page` | ta page affiche sa propre case du mode examen (voir plus bas) : celle du jeu, en bas, est cachée |
| `stats` | `off` | aucune statistique de visite depuis ta page (voir « Vie privée ») |

Les anciens noms français marchent toujours : `langue`, `histoire`, `cle`,
et `theme="clair"` / `"sombre"`.

Exemple : un cours sur le réseau qui ouvre directement « Le Paquet perdu » :

```html
<quetes-de-sysadmin story="packet" save-key="cours-reseau" lang="fr"></quetes-de-sysadmin>
```

## Mode examen

Le mode examen (sans indice, un chrono par chapitre) est une case en bas
du jeu. Une page peut l'afficher ailleurs, par exemple dans une section
pour les enseignant·es : ajoute `exam-control="page"`, puis utilise la
propriété `exam` de l'élément (la changer fait recommencer le chapitre en
cours, après confirmation s'il est commencé) et son évènement
`exam-change` (`event.detail.exam`), comme la page d'accueil du site dans
`src/exam-control.ts`. Ton script doit être un fichier, pas du code en
ligne, si ta page a une CSP.

## L'évènement du badge de l'application

Quand ce qui mérite l'attention change (les histoires sorties depuis la
dernière visite, l'incident du jour pas encore réglé), le jeu émet un
évènement `qds-badge` (`event.detail.count`), qui remonte hors de
l'élément. Le site l'affiche sur l'icône de l'application installée
(`src/pwa/badge.ts`) ; une page d'accueil peut l'ignorer, ou s'en servir à
sa guise.

## Signaler un problème

Le jeu a son propre bouton « Signaler un problème ou une idée ». Une page
peut ouvrir la même fenêtre depuis son propre lien en appelant la méthode
`openFeedback()` de l'élément, comme le pied de page du site dans
`src/pwa/feedback-link.ts`. Rien n'est envoyé : le joueur ou la joueuse
voit le signalement et ouvre une issue GitHub ou copie le texte.

## Couleurs

Le jeu vit dans une racine fantôme (Shadow DOM) : ses styles ne débordent pas
sur la page, et ceux de la page ne le cassent pas. Pour l'accorder à ton site,
redéfinis ces variables CSS sur l'élément. Sans elles, le jeu prend son
thème « salle des machines » : lumière de console (vert phosphore, voyants
ambre) sur fond anthracite si le système est en sombre, « salle blanche » en
clair.

```css
quetes-de-sysadmin {
  --qds-accent: #0b6e4f;
  --qds-amber: #8a4f00;
  --qds-background: #ffffff;
  --qds-card: #f5f5f5;
  --qds-text: #111111;
  --qds-muted: #555555;
  --qds-border: #dddddd;
  --qds-terminal-background: #101010;
  --qds-terminal-text: #e0ffe0;
  --qds-terminal-prompt: #ffcc66;
  --qds-font: system-ui, sans-serif;
  --qds-font-mono: ui-monospace, monospace;
}
```

`--qds-accent` colore les liens, les boutons et les diodes des chapitres
finis ; `--qds-amber`, la diode du prochain chapitre à faire et les étoiles
de difficulté. Garde un
contraste suffisant (WCAG AA) entre le texte et le fond. Les noms français
des versions précédentes (`--qds-ambre`, `--qds-fond`, `--qds-carte`,
`--qds-texte`, `--qds-discret`, `--qds-bord`, `--qds-terminal-fond`,
`--qds-terminal-texte`, `--qds-terminal-invite`, `--qds-police`,
`--qds-police-mono`, `--qds-taille-terminal`) marchent toujours.

## Licence et crédit

Le code est sous **GPL v3 ou ultérieure** et les textes sous **CC BY-SA 4.0** :
tu peux l'utiliser, le modifier et le redistribuer, à condition de garder les
mêmes licences et le crédit affiché sous le jeu (projet Quêtes de Sysadmin,
inspiré de Terminus, créé au MIT par Shawn Conrad et Michele Pratusevich).

## Vie privée

**Statistiques de visite.** Le fichier servi par sysadmin.rouages.net
compte, sur le propre serveur [Umami](https://umami.is) du projet, quelques
chiffres anonymes, pour savoir où le jeu sert : une vue au chargement du
jeu (le nom d'hôte et le chemin de ta page, sans ses paramètres ; l'origine
du site d'où vient la personne, si c'en est un autre ; la taille de l'écran
et la langue du navigateur), puis un événement quand une histoire est
ouverte (son identifiant), quand un chapitre est fini (son identifiant), et
la langue du jeu. Pas de cookie, pas d'identifiant gardé dans le
navigateur, pas de script tiers : le jeu envoie lui-même ces chiffres.
Jamais ce que le joueur ou la joueuse tape, sa sauvegarde, ses codes de
progression ni son nom. Rien n'est envoyé en mode examen, ni quand le
navigateur demande à ne pas être suivi (Do Not Track, Global Privacy
Control). La liste exacte : [docs/DEPLOYMENT.md, « Statistics »](DEPLOYMENT.md#statistics).

Pour les couper sur ta page, ajoute `stats="off"` :

```html
<quetes-de-sysadmin stats="off"></quetes-de-sysadmin>
```

Si ta page a sa propre politique de sécurité (CSP), son `connect-src` doit
autoriser le serveur de statistiques pour qu'elles soient comptées ; sinon
le navigateur bloque la requête (et peut le signaler dans sa console) et le
jeu marche de la même façon. Une copie de `dist/integration/` construite
sans les variables des statistiques (le cas par défaut, voir
`.env.example`) n'envoie rien du tout.

**Tout le reste reste dans le navigateur.** La progression est gardée dans le `localStorage` de la page qui l'accueille, sous la clé
choisie. À côté, la même clé suivie d'un suffixe garde les réglages
d'affichage (`CLE-display`), les résultats d'astreinte (`CLE-on-call`, d'où
se calcule la série d'astreintes), les dernières parties de chaque chapitre
fini, pour comparer une partie rejouée (`CLE-runs` : des nombres et les
commandes tapées), les nouveautés depuis la dernière visite (`CLE-whats-new`
: la dernière sortie vue, les histoires encore marquées « Nouveau ») et le
chapitre en cours, un par langue (`CLE-autosave-en`, `CLE-autosave-fr`) :
les saisies tapées depuis l'ouverture du chapitre, pour proposer de le
reprendre après la fermeture de la page. Elles peuvent contenir les mots de
passe de l'histoire tels que le joueur ou la joueuse les a tapés : des mots
de passe fictifs du jeu, qui restent dans le navigateur comme le reste. La
sauvegarde automatique se désactive dans les réglages.

Le fichier d'agenda du rappel quotidien est fabriqué dans le navigateur et
téléchargé : rien n'en sort, et seule l'application d'agenda du joueur ou
de la joueuse garde le rappel. Le flux des nouvelles histoires est un
fichier statique que les lecteurs de flux viennent chercher : le site
n'apprend rien d'eux.
