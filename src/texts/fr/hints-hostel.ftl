### Indices gradués de L'Auberge (voir src/engine/hints.ts) : un message par
### étape, hint-<chapitre>-<événement>, avec .lead (une direction, sans la
### commande exacte) et .solution (presque la réponse).

## Chapitre 1 — Scellé

hint-sealed-status =
    .lead = Demande à OpenBao lui-même dans quel état il est, avant de toucher à quoi que ce soit (man bao).
    .solution = bao status
hint-sealed-first-share =
    .lead = Un serveur scellé attend ses parts de clé, une commande par part. Où est ta propre part ?
    .solution = bao operator unseal, puis colle à l'invite la part de /media/cle/unseal-share-3.txt
hint-sealed-unsealed =
    .lead = Il faut trois parts différentes. Desquelles des quatre que tu as reçues peux-tu être sûr·e ?
    .solution = bao operator unseal avec la part d'Hiroko, puis celle de Nnamdi (pas celle, floue, de Desta) ; bao status : Sealed false
hint-sealed-restarted =
    .lead = Le coffre est ouvert, mais le site de réservation tourne-t-il ? Demande à systemd, et lis son journal.
    .solution = systemctl status bunks ; journalctl -u bunks ; sudo systemctl restart bunks
hint-sealed-checked =
    .lead = Vérifie que Bunks répond vraiment (les notes de Ruslan parlent d'une page de santé sur le port 8080).
    .solution = curl http://127.0.0.1:8080/health
hint-sealed-end =
    .lead = Vérifie chaque partie : le coffre descellé, Bunks qui tourne, sa page de santé qui répond.
    .solution = bao status ; systemctl status bunks ; curl http://127.0.0.1:8080/health

## Chapitre 2 — Besoin d'en connaître

hint-need-to-know-policy =
    .lead = Écris les règles de Bunks dans un fichier HCL : quels chemins, quelles capacités. Attention au vrai chemin d'API d'un secret KV version 2 (notes de Ruslan, man bao).
    .solution = un fichier bunks.hcl avec path "secret/data/bunks/*" et capabilities = ["read"], puis bao policy write bunks bunks.hcl
hint-need-to-know-token =
    .lead = Crée un jeton qui ne porte que cette politique, avec ton propre jeton admin (pas le jeton root).
    .solution = bao token create -policy=bunks -display-name=bunks -ttl=768h
hint-need-to-know-switched =
    .lead = Vérifie ce que le nouveau jeton peut faire, puis donne-le à Bunks : où Bunks lit-il son jeton, et quand ?
    .solution = bao token capabilities JETON secret/data/bunks/db ; sudo nano /etc/bunks/bunks.env (BAO_TOKEN=le nouveau jeton) ; sudo systemctl restart bunks
hint-need-to-know-checked =
    .lead = Bunks répond-il avec son nouveau jeton ?
    .solution = curl http://127.0.0.1:8080/health
hint-need-to-know-root-revoked =
    .lead = Le jeton root de l'init est toujours valable. Un jeton peut être révoqué par qui en a le droit (man bao : token revoke).
    .solution = bao token revoke suivi de l'ancienne valeur de BAO_TOKEN (le jeton root)
hint-need-to-know-end =
    .lead = Vérifie chaque partie : le jeton de Bunks et ce qu'il peut faire, le jeton root disparu, la page de santé.
    .solution = bao token capabilities JETON secret/data/treasurer/bank (deny) ; bao token lookup sur le jeton root (bad token) ; curl http://127.0.0.1:8080/health

## Chapitre 3 — Jeton divulgué

hint-leaked-token-identified =
    .lead = Commence par le jeton du message du forum : demande à OpenBao ce que c'est (man bao : token lookup).
    .solution = bao token lookup suivi du jeton de message_du_forum.txt
hint-leaked-token-traced =
    .lead = Chaque requête est dans le journal d'audit, mais les jetons y sont écrits en HMAC. OpenBao peut calculer pour toi le HMAC d'une valeur ; ou cherche les requêtes qui ne venaient pas de 127.0.0.1.
    .solution = bao write sys/audit-hash/file input=JETON, puis sudo grep ce hash /var/log/openbao/audit.log (ou sudo jq sur remote_address)
hint-leaked-token-revoked =
    .lead = Le jeton doit cesser de marcher maintenant, avant toute autre chose.
    .solution = bao token revoke suivi du jeton divulgué
hint-leaked-token-rotated =
    .lead = Le journal montre quel secret a été lu. Donne-lui sa nouvelle valeur sans perdre son autre champ (man bao : kv patch).
    .solution = bao kv patch secret/bunks/payments api_key= suivi de la nouvelle clé du message de Desta
hint-leaked-token-switched =
    .lead = Bunks a besoin d'un nouveau jeton, avec sa politique, et doit redémarrer pour le lire, ainsi que la nouvelle clé.
    .solution = bao token create -policy=bunks -display-name=bunks ; sudo nano /etc/bunks/bunks.env ; sudo systemctl restart bunks
hint-leaked-token-end =
    .lead = Vérifie chaque partie : le jeton divulgué refusé, la nouvelle clé en place, le secret de la base intact, Bunks en bonne santé.
    .solution = bao token lookup JETON_DIVULGUÉ (bad token) ; bao kv get secret/bunks/payments ; curl http://127.0.0.1:8080/health
