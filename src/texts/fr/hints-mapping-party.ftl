### Indices gradués de l'histoire « La Cartopartie » (voir src/engine/hints.ts) :
### un message par étape, hint-<chapitre>-<événement>, avec .lead (une
### direction, sans la commande exacte) et .solution (presque la réponse).

## Chapitre 1 — Le Premier Plan

hint-first-plan-initialised =
    .lead = Le code vit dans /srv/dns. Une copie neuve doit être initialisée une fois avant qu'OpenTofu puisse s'en servir : cela installe le fournisseur (man tofu, les notes de Yusra).
    .solution = cd /srv/dns ; tofu init
hint-first-plan-formatted =
    .lead = Le bloc d'Andile est mal indenté. OpenTofu a son propre outil de mise en forme pour tout le répertoire.
    .solution = tofu fmt (il liste les fichiers qu'il a réécrits)
hint-first-plan-valid =
    .lead = Vérifie la configuration par rapport au schéma du fournisseur avant de planifier ; lis le fichier, la ligne et la suggestion de chaque erreur.
    .solution = tofu validate, puis nano records.tf : adresses → addresses ; tofu validate à nouveau
hint-first-plan-planned =
    .lead = Le plan s'arrête sur une variable sans valeur. Où vivent les valeurs de cette configuration ? Ensuite, lis ce que ferait OpenTofu.
    .solution = ajoute tiles_address = "192.0.2.180" à terraform.tfvars ; tofu plan
hint-first-plan-applied =
    .lead = Applique le plan, et ne réponds à sa question qu'après avoir lu la ligne de bilan.
    .solution = tofu apply, puis yes
hint-first-plan-checked =
    .lead = Demande au serveur DNS lui-même ce qu'il répond pour le nouveau nom (man dig).
    .solution = dig @127.0.0.1 tiles.wayfinders.example
hint-first-plan-end =
    .lead = Vérifie chaque partie : l'enregistrement servi, géré dans l'état, les fichiers formatés, la valeur gardée dans un fichier.
    .solution = tofu plan (No changes), tofu fmt -check, dig tiles.wayfinders.example

## Chapitre 2 — Dérive

hint-drift-locked =
    .lead = Commence là où Andile s'est arrêtée : demande à OpenTofu ce qu'il changerait, et lis pourquoi il refuse.
    .solution = cd /srv/dns ; tofu plan (lis Lock Info : qui, quelle opération, depuis quand)
hint-drift-freed =
    .lead = Le verrou d'un état local appartient au processus qui l'a pris. Ce processus tourne-t-il encore ? (man ps, man kill)
    .solution = ps aux | grep tofu, puis sudo kill 23817 (le tofu apply de Femi)
hint-drift-drift =
    .lead = Maintenant, planifie, et lis les deux parties : ce qui a changé hors d'OpenTofu, et ce qu'appliquer le code y ferait.
    .solution = tofu plan (Objects have changed outside of OpenTofu : www)
hint-drift-code =
    .lead = Quel côté est vrai, le code ou le serveur ? Le message d'Andile le dit. Fais dire à records.tf ce qui est vrai, puis planifie à nouveau.
    .solution = nano records.tf : addresses = ["198.51.100.41"] pour www (ttl 60, ou 300 avec un remplacement) ; tofu plan ; tofu apply
hint-drift-imported =
    .lead = status existe dans named mais ni dans le code ni dans l'état. Décris-le dans records.tf, puis adopte l'enregistrement existant (man tofu : import).
    .solution = un bloc resource "dns_a_record_set" "status" (zone, name = "status", addresses = ["198.51.100.42"], ttl = 300), puis tofu import dns_a_record_set.status status.wayfinders.example.
hint-drift-end =
    .lead = Le travail est fini quand OpenTofu ne trouve plus rien à faire.
    .solution = tofu plan : No changes. Your infrastructure matches the configuration.
