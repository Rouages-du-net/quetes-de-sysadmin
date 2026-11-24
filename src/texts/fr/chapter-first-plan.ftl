### Histoire « La Cartopartie », chapitre « Le Premier Plan » : un
### enregistrement DNS ajouté en code avec OpenTofu (init, fmt, validate, une
### variable, plan, apply, dig). Commandes, options, chemins, adresses de
### ressources, noms d'enregistrements et sorties d'OpenTofu : non traduits.

chapter-first-plan = Le Premier Plan
    .summary = La cartopartie de samedi a besoin d'un nom pour son serveur de tuiles. Le DNS du collectif est tenu en code avec OpenTofu, et la coordinatrice a écrit le nouvel enregistrement elle-même, à la hâte. Lis la configuration, fais-la fonctionner, planifie, applique, et vérifie ce que dit vraiment le serveur DNS.

## Fichiers

first-plan-message-andile =
    De : Andile (coordination de Wayfinders)
    Jeudi 10 juin, 18 h 30

    Bonjour, et merci de reprendre le DNS !

    Samedi, c'est notre cartopartie au centre social : quarante personnes
    qui parcourent la vieille ville avec leur téléphone et notent chaque
    bordure, chaque marche, chaque rampe. Dilnoza a monté un serveur de
    tuiles pour la carte de la soirée, en 192.0.2.180, et les téléphones ont
    besoin d'un nom pour lui : tiles.wayfinders.example.

    Yusra m'a appris qu'on ne touche jamais la zone à la main : les
    enregistrements vivent en code dans /srv/dns, et OpenTofu fait
    correspondre le serveur DNS au code. Alors hier soir j'ai ajouté
    l'enregistrement dans /srv/dns/records.tf moi-même, en copiant celui de
    www. Je n'ai encore rien osé lancer ; je ne me suis jamais servie de la
    commande tofu sur cairn.

    Ses notes sont dans ton dossier personnel. Tu peux faire marcher
    tiles.wayfinders.example avant samedi ?

    Andile

first-plan-notes-yusra =
    Notes de Yusra (le DNS en code, 2031)

    - La zone wayfinders.example est servie par named sur cette machine.
      C'est une zone dynamique : les changements arrivent en mises à jour
      signées (RFC 2136) avec la clé tofu-key, et named les garde dans son
      journal. Ne modifie pas /var/lib/bind/db.wayfinders.example : named
      l'ignorerait.
    - Le code est dans /srv/dns (groupe dnsadmins) : versions.tf (OpenTofu
      et le fournisseur dns), provider.tf, variables.tf, records.tf,
      outputs.tf. Les valeurs vont dans terraform.tfvars ; le secret de la
      clé dans secrets.auto.tfvars, jamais commité.
    - OpenTofu se souvient de ce qu'il gère dans terraform.tfstate. Ne le
      modifie pas, ne le supprime pas.
    - Une copie neuve du code doit être initialisée une fois (tofu init) :
      elle installe le fournisseur depuis le miroir local (pas d'internet sur
      cairn, voir ~/.tofurc) et écrit .terraform.lock.hcl, les versions
      choisies.
    - Ensuite, à chaque fois : tofu fmt, tofu validate, tofu plan, lire le
      plan, tofu apply. Et vérifier avec dig.
    - man tofu.

## Événements

first-plan-event-not-initialised =
    Cette copie du code n'a jamais été initialisée sur cairn : pas de
    fichier de verrouillage (.terraform.lock.hcl), pas de fournisseur dans
    le dossier .terraform. OpenTofu a besoin du fournisseur dns pour comprendre les
    ressources, et c'est tofu init qui l'installe.
first-plan-event-initialised =
    Le répertoire de travail est initialisé : le fournisseur hashicorp/dns
    est venu du miroir local, et .terraform.lock.hcl note sa version et sa
    somme de contrôle. Ce fichier a sa place dans le gestionnaire de
    versions, pour que tout le monde ait le même fournisseur ; .terraform/
    non (voir .gitignore).
first-plan-event-formatted =
    tofu fmt a réécrit les fichiers dans le style standard : deux espaces
    par niveau, les « = » des arguments voisins alignés. Il ne change que la
    mise en forme ; une faute de frappe reste une faute de frappe.
first-plan-event-invalid =
    tofu validate vérifie le code par rapport au schéma du fournisseur sans
    rien toucher : dans records.tf, le bloc tiles n'a pas « addresses » et a
    un argument que le fournisseur ne connaît pas. OpenTofu propose même le
    bon nom.
first-plan-event-valid =
    La configuration est valide. Valide ne veut pas dire complète : une
    variable attend encore sa valeur avant qu'OpenTofu puisse planifier.
first-plan-event-no-value =
    La variable tiles_address est déclarée dans variables.tf, sans valeur
    par défaut, et aucun fichier ne lui en donne. -var en donne une pour une
    seule commande ; terraform.tfvars la garde pour tous ceux qui lancent
    tofu ici.
first-plan-event-planned =
    Le plan se lit comme un diff : + crée, ~ modifie sur place, - détruit,
    -/+ remplace. Ici : un ensemble d'enregistrements à ajouter, rien d'autre
    de touché. www et wiki sont relus, comparés au code, et laissés tels
    quels.
first-plan-event-zone-by-hand =
    Le fichier de zone a été modifié à la main. named ne relit pas le
    fichier d'une zone dynamique (rndc reload refuse) : sa vérité est en
    mémoire et dans le journal. Et OpenTofu n'en saurait rien non plus.
    Remets le fichier comme il était (Yusra le garde intact), et change
    plutôt le code.
first-plan-event-state-gone =
    terraform.tfstate a disparu. Sans lui, OpenTofu oublie qu'il gère www et
    wiki, et voudrait les créer à nouveau. La version précédente est dans
    terraform.tfstate.backup : recopie-la avant toute chose.
first-plan-event-applied =
    OpenTofu a envoyé la mise à jour à named et écrit le nouvel
    enregistrement dans son état : il gère maintenant tiles, comme www et
    wiki.
first-plan-event-cli-var =
    L'enregistrement est là, mais la valeur de tiles_address était
    seulement dans ta ligne de commande : le prochain tofu plan ici, par
    Andile ou n'importe qui, s'arrêtera sur « No value for required
    variable ». Garde-la dans terraform.tfvars.
first-plan-event-checked =
    dig a interrogé named directement : tiles.wayfinders.example répond
    192.0.2.180. Le code, l'état d'OpenTofu et le serveur sont d'accord.
first-plan-event-end =
    Andile : « Dilnoza voit les tuiles sur son téléphone. Samedi est sauvé ! »

    Bravo ! Tu as terminé Le Premier Plan.

    CE QUI S'EST PASSÉ
    L'enregistrement était écrit en code, mais le code n'avait jamais
    tourné sur cairn : tofu init a installé le fournisseur dns depuis le
    miroir local et écrit le fichier de verrouillage. tofu fmt a remis la
    mise en forme d'aplomb, tofu validate a attrapé la faute de frappe
    (adresses), et la nouvelle variable a reçu sa valeur dans
    terraform.tfvars. tofu plan a montré un seul ajout, tofu apply l'a fait
    après ton « yes » (une mise à jour dynamique signée avec la clé TSIG),
    et dig a confirmé ce que sert named.

    BONNE PRATIQUE
    - Tout changement passe par le code : l'état du serveur en est la
      conséquence, et le code garde la trace de qui a changé quoi (dans git,
      avec .terraform.lock.hcl).
    - init une fois par copie, puis fmt, validate, plan, apply : lis la
      ligne de bilan du plan avant de dire yes.
    - Les valeurs dont tout le monde a besoin vont dans un fichier .tfvars ;
      les secrets dans un fichier jamais commité (ou dans des variables
      TF_VAR_).
    - Ne modifie jamais à la main ce que gère OpenTofu, ni les
      enregistrements ni terraform.tfstate.
    - Vérifie le résultat là où il compte (dig @127.0.0.1 tiles.wayfinders.example).

    UNE AUTRE FAÇON DE FAIRE
    Terraform, dont OpenTofu est un fork depuis 2023, lit les mêmes
    fichiers et fonctionne de la même façon. Ansible (module nsupdate) ou
    nsupdate tout seul peuvent faire le même changement, mais sans plan à
    lire ni état à comparer la fois suivante.

    DOCUMENTATION
    - tofu init : https://opentofu.org/docs/cli/commands/init/
    - tofu plan et apply : https://opentofu.org/docs/cli/commands/plan/
    - Les variables : https://opentofu.org/docs/language/values/variables/
    - Le fichier de verrouillage des dépendances : https://opentofu.org/docs/language/files/dependency-lock/
    - Le fournisseur dns : https://search.opentofu.org/provider/hashicorp/dns/latest
