# Intégrer Quêtes de Sysadmin dans un site

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
| `histoire` | `effaceur`, `datacenter`, `paquet`, `temps`, `archives` | histoire ouverte au départ |
| `cle` | texte | clé de sauvegarde dans `localStorage` (par défaut `quetes-de-sysadmin`) ; à changer pour séparer plusieurs jeux sur un même site |
| `theme` | `clair`, `sombre` | force un thème (par défaut, celui du système) |
| `langue` | `fr` | langue de l'interface (d'autres langues viendront, voir la feuille de route) |

Exemple : un cours sur le réseau qui ouvre directement « Le Paquet perdu » :

```html
<quetes-de-sysadmin histoire="paquet" cle="cours-reseau"></quetes-de-sysadmin>
```

## Couleurs

Le jeu vit dans une racine fantôme (Shadow DOM) : ses styles ne débordent pas
sur la page, et ceux de la page ne le cassent pas. Pour l'accorder à ton site,
redéfinis ces variables CSS sur l'élément :

```css
quetes-de-sysadmin {
  --qds-accent: #0b6e4f;
  --qds-fond: #ffffff;
  --qds-carte: #f5f5f5;
  --qds-texte: #111111;
  --qds-discret: #555555;
  --qds-bord: #dddddd;
  --qds-terminal-fond: #101010;
  --qds-terminal-texte: #e0ffe0;
  --qds-terminal-invite: #ffcc66;
  --qds-police: system-ui, sans-serif;
  --qds-police-mono: ui-monospace, monospace;
}
```

Garde un contraste suffisant (WCAG AA) entre le texte et le fond.

## Licence et crédit

Le code est sous **GPL v3 ou ultérieure** et les textes sous **CC BY-SA 4.0** :
tu peux l'utiliser, le modifier et le redistribuer, à condition de garder les
mêmes licences et le crédit affiché sous le jeu (projet Quêtes de Sysadmin,
inspiré de Terminus, créé au MIT par Shawn Conrad et Michele Pratusevich).

## Vie privée

Le jeu n'envoie rien : aucune donnée ne quitte le navigateur. La progression
est gardée dans le `localStorage` de la page qui l'accueille, sous la clé
choisie.
