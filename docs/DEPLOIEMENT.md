# Déployer sur sysadmin.rouages.net

Le site est **100 % statique** : `npm run build` produit `dist/`, que GitHub
Actions envoie par **FTPS** sur l'hébergement cPanel (Apache) de rouages.net à
chaque push sur `main`, comme pour rouages.net.

## Ce qui se passe à chaque push

Workflow `.github/workflows/deploy.yml` :

1. **tester** (chaque PR et chaque push) : `npm test` (quêtes rejouées),
   `npm run build`, puis `npm run test:navigateur` dans Chromium (1000 et
   375 px, sans erreur console, avec la CSP de `.htaccess`, page 404,
   intégration dans une autre page).
2. **déployer** (seulement `main`) : envoi de `dist/` en FTPS, puis
   vérification du site en ligne (page d'accueil, en-tête CORS du fichier à
   intégrer, CSP, 404, fichier d'état FTP refusé, redirection HTTP → HTTPS).

Tant que les secrets FTP ne sont pas renseignés, l'étape de déploiement est
**ignorée sans échec** (un avis l'indique dans le résumé du workflow).

## Mise en route (une seule fois)

### 1. Sur cPanel

1. **Domaines** → créer le sous-domaine `sysadmin.rouages.net`, avec un
   dossier racine dédié (par exemple `sysadmin.rouages.net/`), **distinct**
   de celui de rouages.net.
2. **SSL/TLS Status** → lancer AutoSSL pour le sous-domaine (certificat
   Let's Encrypt ou Sectigo), sinon la redirection HTTPS de `.htaccess`
   mènera à une erreur de certificat.
3. **Comptes FTP** → créer un compte **limité au dossier du sous-domaine**
   (par exemple `deploiement-sysadmin@rouages.net`), avec un mot de passe
   long et unique. Ne pas réutiliser le compte de rouages.net : un déploiement
   raté ne doit pas pouvoir toucher l'autre site.

### 2. Sur GitHub

Dépôt → *Settings* → *Secrets and variables* → *Actions* (ou l'environnement
`production`) :

| Secret | Valeur |
|---|---|
| `FTP_SERVER` | serveur FTP de l'hébergement (souvent `ftp.rouages.net`) |
| `FTP_USERNAME` | le compte FTP limité créé ci-dessus |
| `FTP_PASSWORD` | son mot de passe |
| `FTP_SERVER_DIR` | facultatif : dossier distant, terminé par `/` (par défaut `./`, la racine du compte limité) |

### 3. Premier déploiement

*Actions* → « Tester et déployer sur sysadmin.rouages.net » → *Run workflow*
sur `main`. L'étape « Vérifier le site en ligne » doit passer ; sinon, son
journal dit quelle vérification échoue.

## Bon à savoir

- **Synchronisation** : l'action FTP garde l'état des fichiers envoyés dans
  `.ftp-deploy-sync-state.json` sur le serveur et n'envoie que les
  différences ; `.htaccess` en interdit la lecture. Pour tout renvoyer,
  supprimer ce fichier sur le serveur.
- **CSP** : `public/.htaccess` n'autorise que les scripts du site lui-même
  (`script-src 'self'`). Ne jamais ajouter de `<script>` en ligne ni de
  ressource tierce ; le test dans le navigateur échoue si on le fait.
- **Fichier à intégrer** : `/integration/quetes-de-sysadmin.js` est servi
  avec `Access-Control-Allow-Origin: *`, indispensable pour qu'un autre site
  le charge en `<script type="module">`, et revalidé à chaque visite (son nom
  ne change pas d'une version à l'autre).
- **Retour arrière** : revenir sur le commit fautif (`git revert`) et pousser
  sur `main` ; le workflow renvoie l'ancienne version.
