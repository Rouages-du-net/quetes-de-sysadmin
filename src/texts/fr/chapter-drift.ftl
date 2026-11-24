### Histoire « La Cartopartie », chapitre « Dérive » : des enregistrements
### changés à la main pendant un incident, un apply oublié qui tient le
### verrou de l'état, la dérive montrée par tofu plan, et tofu import.
### Commandes, options, chemins, adresses de ressources, noms
### d'enregistrements et sorties d'OpenTofu : non traduits.

chapter-drift = Dérive
    .summary = Un soir, l'hébergeur du site web est tombé, et le bénévole d'astreinte a réparé le DNS à la main, vite et bien. Maintenant le code dit une chose, le serveur DNS une autre, et OpenTofu refuse même de démarrer. Remets-les d'accord sans casser le site.

## Fichiers

drift-message-andile =
    De : Andile
    Vendredi 25 juin, 9 h 10

    Bonjour,

    Femi a sauvé notre soirée hier : l'ancien hébergeur du site
    (198.51.100.40) est tombé à neuf heures, et il a déplacé le site sur la
    machine de secours, 198.51.100.41. L'hébergeur a confirmé ce matin que
    l'ancienne est perdue pour de bon : le site reste sur la .41.

    Mais Femi l'a fait « à l'ancienne », à la main, et Yusra nous rappelle
    que le code doit dire ce qui est vrai. Et ce matin, tofu plan ne démarre
    même pas chez moi : une histoire de verrou.

    Tu peux remettre de l'ordre ? Le site doit continuer à marcher. Femi a
    aussi ajouté un enregistrement pour la page d'état de Dilnoza : garde-le,
    mais sous OpenTofu comme les autres. Sa note est dans ton dossier.

    Andile

drift-message-femi =
    De : Femi
    Jeudi 24 juin, 22 h 05

    Désolé, une note pressée avant d'aller dormir.

    21 h 30 : le site ne répondait plus, son hébergeur était mort. Dilnoza a
    démarré la machine de secours (198.51.100.41) et y a copié le site.

    21 h 41 : j'ai lancé tofu apply dans /srv/dns pour changer l'adresse,
    mais le plan voulait changer des choses que je ne comprenais pas, alors
    je l'ai laissé attendre à sa question et j'ai utilisé nsupdate, que je
    connais, avec la clé de /etc/bind/tofu-key.key :
      update delete www.wayfinders.example A
      update add www.wayfinders.example 60 A 198.51.100.41
    (TTL 60, pour pouvoir revenir en arrière vite.)

    21 h 51 : la page d'état de Dilnoza tourne sur 198.51.100.42, alors j'ai
    ajouté status.wayfinders.example de la même façon, TTL 300.

    Je n'ai pas touché au code. La batterie de mon portable a lâché avant
    que je puisse fermer quoi que ce soit.

    Femi

## Événements

drift-event-locked =
    OpenTofu verrouille l'état avant de le lire, pour que deux exécutions ne
    puissent pas l'écrire en même temps. Quelqu'un d'autre tient le verrou :
    Lock Info dit qui, pour quelle opération et depuis quand. Cette
    exécution est-elle encore en vie ?
drift-event-force-unlock =
    tofu force-unlock ne peut rien pour un état local : le verrou est tenu
    par le système d'exploitation pour le processus qui l'a pris, et seul ce
    processus peut le rendre. Trouve le processus (ps), et décide quoi en
    faire.
drift-event-no-lock =
    -lock=false alors que l'apply de Femi attend toujours : si quelqu'un
    répond yes dans sa session, il applique son vieux plan et écrit son
    propre état par-dessus le tien. C'est justement ce qu'empêche le
    verrou ; arrête plutôt son exécution.
drift-event-freed =
    L'apply de Femi a reçu le signal, annulé son opération et libéré le
    verrou en s'arrêtant (son .terraform.tfstate.lock.info a disparu).
    L'état est libre.
drift-event-freed-kill =
    L'apply de Femi est mort, tué sans pouvoir ranger : le système a
    libéré le verrou avec le processus, mais son fichier de verrou
    (.terraform.tfstate.lock.info) est resté. C'est sans danger, la
    prochaine exécution le remplace ; un simple kill (TERM) laisse OpenTofu
    s'arrêter proprement.
drift-event-drift =
    « Objects have changed outside of OpenTofu » : la relecture a trouvé les
    changements de Femi sur www, que l'état ne connaissait pas. Lis le plan
    en dessous : appliquer le code tel quel remettrait www sur
    198.51.100.40, l'hôte mort. La décision t'appartient : ici, le
    changement à la main est la vérité, donc c'est le code qui doit suivre.
drift-event-reverted =
    www pointe de nouveau sur 198.51.100.40, l'hôte qui est tombé : le site
    est en panne pour tous ceux dont le résolveur demande maintenant. Le
    code avait encore l'ancienne adresse, et le plan le disait. Corrige
    records.tf et applique à nouveau.
drift-event-hand-edit =
    terraform.tfstate a été modifié à la main. L'état est la mémoire
    qu'OpenTofu a des objets réels, avec un numéro de série et une lignée,
    et une mauvaise modification le fait mentir. Pour enregistrer ce qui a
    changé dehors, tofu apply -refresh-only le fait proprement ; pour
    oublier ou renommer quelque chose, tofu state rm et tofu state mv. La
    version précédente est dans terraform.tfstate.backup.
drift-event-state-rm =
    tofu state rm a fait oublier un enregistrement à OpenTofu, pas le DNS :
    l'enregistrement est toujours dans named, et toujours dans le code, donc
    le prochain plan veut le créer. La différence n'a pas disparu, elle a
    changé de forme. Ramène-le avec tofu import.
drift-event-code =
    records.tf dit maintenant ce qui est vrai : www sur 198.51.100.41. Lis
    le prochain plan : et le TTL que Femi a descendu à 60 ? Garde 60 dans le
    code, ou reviens à 300 (ttl force le remplacement de l'ensemble
    d'enregistrements : le plan le dit).
drift-event-created-over =
    status.wayfinders.example a été « créé » par-dessus l'enregistrement de
    Femi : le fournisseur dns ajoute les adresses une à une, alors c'est
    passé. Avec la plupart des fournisseurs, créer quelque chose qui existe
    échoue (« already exists »), et la façon d'adopter un objet, c'est tofu
    import.
drift-event-imported =
    status.wayfinders.example est maintenant dans l'état d'OpenTofu, avec
    les valeurs qu'il a vraiment. Désormais, un changement le concernant
    passe par le code comme les autres.
drift-event-end =
    Andile : « tofu plan dit No changes. C'est la plus belle phrase de la
    semaine. » Femi : « La prochaine fois, je change le code, même la
    nuit. »

    Bravo ! Tu as terminé Dérive.

    CE QUI S'EST PASSÉ
    Pendant l'incident, Femi a laissé un tofu apply attendre son « yes »,
    ce qui tenait le verrou de l'état, et il a changé www et ajouté status
    avec nsupdate. Tu as arrêté son exécution (OpenTofu a libéré le
    verrou), et tofu plan a montré la dérive : le vrai www différait de
    l'état, et appliquer le vieux code aurait remis le site sur l'hôte
    mort. Tu as fait suivre au code le vrai changement, appliqué, et adopté
    status avec tofu import, jusqu'à ce qu'OpenTofu n'ait plus rien à faire.

    BONNE PRATIQUE
    - Une dérive n'est pas forcément une erreur : décide quel côté est
      vrai. Si le changement à la main est le bon, mets le code à jour ;
      sinon, applique le code.
    - Lis le plan avant chaque apply, surtout quand il détruit ou remplace :
      -auto-approve, c'est pour des chaînes où le plan a déjà été relu.
    - Un verrou veut dire qu'une exécution est (ou était) en cours :
      trouve-la, ne force pas. Jamais -lock=false sur un état partagé.
    - Adopte ce qui a été fait à la main avec tofu import (ou un bloc
      import), puis fais correspondre le code jusqu'à ce que plan dise No
      changes.
    - Ne modifie pas terraform.tfstate, et n'utilise pas state rm pour
      cacher une différence ; détecte la dérive régulièrement avec tofu plan
      -detailed-exitcode (code de sortie 2 quand quelque chose diffère).

    UNE AUTRE FAÇON DE FAIRE
    Un bloc import dans le code (import avec to et id) fait la même chose
    que tofu import, mais passe par plan et apply comme tout changement, et
    peut être relu. tofu apply -refresh-only enregistre dans l'état les
    changements faits dehors sans rien toucher, quand le code les suit déjà.

    DOCUMENTATION
    - Le verrouillage de l'état : https://opentofu.org/docs/language/state/locking/
    - tofu force-unlock : https://opentofu.org/docs/cli/commands/force-unlock/
    - Les modes de plan (refresh-only) : https://opentofu.org/docs/cli/commands/plan/
    - L'import : https://opentofu.org/docs/cli/import/ et https://opentofu.org/docs/language/import/
    - BIND, les mises à jour dynamiques : https://bind9.readthedocs.io/en/stable/reference.html#dynamic-update-policies
