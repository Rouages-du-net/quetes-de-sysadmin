# Intégrer Quêtes de Sysadmin dans un site

— [English version](EMBEDDING.md) (la version de référence)

Le jeu est un **composant web** autonome : un seul fichier JavaScript, sans
dépendance, sans pisteur, sans requête vers l'extérieur. Il fonctionne dans
n'importe quelle page HTML (site statique, CMS, plateforme de cours…).

## En deux lignes

```html
<script type="module" src="https://sysadmin.rouages.net/integration/quetes-de-sysadmin.js"></script>
<quetes-de-sysadmin></quetes-de-sysadmin>
```

Pour ne dépendre d'aucun serveur extérieur, copie le fichier
`dist/integration/quetes-de-sysadmin.js` (après `npm run build`) sur ton site
et change l'adresse du script.

Le serveur de sysadmin.rouages.net envoie l'en-tête
`Access-Control-Allow-Origin: *` pour ce fichier (voir `public/.htaccess`) :
c'est obligatoire pour qu'un script « module » soit chargé depuis un autre
site. Si tu héberges toi-même le fichier sur un autre domaine que ta page,
configure le même en-tête.

## Attributs

| Attribut | Valeurs | Effet |
|---|---|---|
| `lang` | `en`, `fr` | langue du jeu ; sans l'attribut, la langue de la page (`lang` d'un élément parent), sinon l'anglais ; une langue inconnue donne l'anglais |
| `story` | l'identifiant d'une histoire : `eraser`, `datacenter`, `packet`, `time-machine`, `archives`… (les anciens identifiants français, `effaceur`, `paquet`…, marchent toujours) | histoire ouverte au départ, directement sur sa machine, même sans sa clé SSH (sans l'attribut, on part du poste, ou de l'histoire en cours) |
| `save-key` | texte | clé de sauvegarde dans `localStorage` (par défaut `quetes-de-sysadmin`) ; à changer pour séparer plusieurs jeux sur un même site |
| `theme` | `light`, `dark` | force un thème (par défaut, celui du système) |

Les anciens noms français marchent toujours : `langue`, `histoire`, `cle`,
et `theme="clair"` / `"sombre"`.

Exemple : un cours sur le réseau qui ouvre directement « Le Paquet perdu » :

```html
<quetes-de-sysadmin story="packet" save-key="cours-reseau" lang="fr"></quetes-de-sysadmin>
```

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

Le jeu n'envoie rien : aucune donnée ne quitte le navigateur. La progression
est gardée dans le `localStorage` de la page qui l'accueille, sous la clé
choisie.
