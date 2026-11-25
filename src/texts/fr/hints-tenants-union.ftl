### Indices gradués du Syndicat des locataires (voir src/engine/hints.ts) :
### un message par étape, hint-<chapitre>-<événement>, avec .lead (une
### direction, sans la commande exacte) et .solution (presque la réponse).

## Chapitre 1 — Hors de vue

hint-out-of-the-open-history-seen =
    .lead = Avant de réparer quoi que ce soit, regarde ce que les visiteurs de la forge ont pu voir : chaque version de .env, dans l'historique du dépôt (man git).
    .solution = cd /srv/repairline ; git log -p
hint-out-of-the-open-key-made =
    .lead = Pour chiffrer pour toi, il te faut ta propre clé age, à l'endroit où sops la lit (man sops, man age-keygen).
    .solution = mkdir -p ~/.config/sops/age ; age-keygen -o ~/.config/sops/age/keys.txt
hint-out-of-the-open-rule-written =
    .lead = Un .sops.yaml à la racine du dépôt dit quels fichiers sont chiffrés, et pour quelles clés publiques : celle du serveur (dans le README) et la tienne.
    .solution = nano .sops.yaml : creation_rules:, puis - path_regex: \.env$ et age: CLE_DU_SERVEUR,TA_CLE (age-keygen -y ~/.config/sops/age/keys.txt affiche la tienne)
hint-out-of-the-open-encrypted =
    .lead = Chiffre le fichier sur place : sops trouve tout seul la règle dans .sops.yaml.
    .solution = sops --encrypt --in-place .env ; puis cat .env
hint-out-of-the-open-rotated =
    .lead = L'ancien mot de passe est dans l'historique pour de bon : change-le là où il est vérifié, dans PostgreSQL, avec son compte d'administration.
    .solution = sudo -u postgres psql -c "ALTER ROLE repairline PASSWORD 'un-nouveau-long-mot-de-passe'"
hint-out-of-the-open-deployed =
    .lead = Mets le nouveau mot de passe dans le .env chiffré avec sops, puis fais déchiffrer .env par deploy.sh avec la clé du serveur, et lance-le.
    .solution = sops set .env '["DB_PASSWORD"]' '"un-nouveau-long-mot-de-passe"' ; dans deploy.sh : export SOPS_AGE_KEY_FILE=/etc/repairline/age.key et sops --decrypt .env > /etc/repairline/env ; sudo ./deploy.sh
hint-out-of-the-open-committed =
    .lead = Commite ce dont les autres ont besoin : le .env chiffré, .sops.yaml et deploy.sh. Jamais le mot de passe en clair.
    .solution = git add .env .sops.yaml deploy.sh ; git commit -m "Chiffrer .env avec sops et age"
hint-out-of-the-open-pushed =
    .lead = Les bénévoles clonent depuis origin.
    .solution = git push
hint-out-of-the-open-end =
    .lead = Vérifie chaque partie : l'appli tourne, les réglages déployés ne sont qu'à root, .env est chiffré pour le serveur et pour toi, origin a la même chose.
    .solution = systemctl status repairline ; ls -l /etc/repairline/env ; sops -d .env ; git log --stat -1 ; git status

## Chapitre 2 — Les clés changent de mains

hint-keys-change-hands-config-updated =
    .lead = Qui reçoit les nouveaux fichiers, c'est .sops.yaml qui le décide : mets-y la clé publique d'Ikenna (dans son message), retire celle de Makoa.
    .solution = nano .sops.yaml : remplace le age1… de Makoa par celui d'Ikenna
hint-keys-change-hands-keys-updated =
    .lead = Les fichiers déjà chiffrés ne suivent pas la règle tout seuls : sops peut mettre chacun d'eux en accord avec elle (man sops).
    .solution = sops updatekeys .env, réponds y ; sops updatekeys mail.env, réponds y
hint-keys-change-hands-data-rotated =
    .lead = La clé de Makoa pouvait ouvrir la clé de données des deux fichiers : cette clé-là doit changer aussi.
    .solution = sops rotate --in-place .env ; sops rotate --in-place mail.env
hint-keys-change-hands-rotated =
    .lead = Makoa lisait le mot de passe de la base quand il déployait : change-le dans PostgreSQL.
    .solution = sudo -u postgres psql -c "ALTER ROLE repairline PASSWORD 'un-autre-long-mot-de-passe'"
hint-keys-change-hands-deployed =
    .lead = Le nouveau mot de passe va dans le .env chiffré, sans jamais sortir de sops, puis le déploiement.
    .solution = sops edit .env (ou sops set .env '["DB_PASSWORD"]' '"un-autre-long-mot-de-passe"') ; sudo /srv/repairline/deploy.sh
hint-keys-change-hands-committed =
    .lead = Commite la règle et les deux fichiers.
    .solution = git add .sops.yaml .env mail.env ; git commit -m "Ikenna arrive, Makoa part, nouvelles clés"
hint-keys-change-hands-pushed =
    .lead = Ikenna clonera depuis origin.
    .solution = git push
hint-keys-change-hands-end =
    .lead = Vérifie que la clé de Makoa a disparu partout, et que ta propre clé n'a jamais quitté ton keys.txt.
    .solution = grep age1 .sops.yaml ; sops filestatus .env ; systemctl status repairline ; ls -l ~/.config/sops/age/keys.txt
