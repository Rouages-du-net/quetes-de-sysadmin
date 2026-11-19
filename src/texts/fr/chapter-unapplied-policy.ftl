### Histoire « Le Catalogue », chapitre « La stratégie qui ne
### s'applique pas » : une GPO qui connecte le lecteur Events n'atteint
### qu'une partie des personnes à qui elle est destinée : un lien sur la
### mauvaise OU, et un filtrage de sécurité auquel il manque un groupe.
### Les commandes, cmdlets, comptes, noms d'ordinateurs, noms de GPO et
### sorties ne sont pas traduits.

chapter-unapplied-policy = La stratégie qui ne s'applique pas
    .summary = Les affiches des heures du conte du printemps sont sur le partage Events, mais la moitié des personnes qui en ont besoin n'ont pas de lecteur E:. Lisez ce que la stratégie de groupe a appliqué sur leurs postes, trouvez pourquoi la GPO ne les atteint pas, et corrigez sans donner le lecteur à tout le monde.

## Fichiers

unapplied-policy-email-nandini =
    De :  Nandini Mukherjee (directrice du réseau)
    À :   vous

    Bonjour,

    Les affiches des heures du conte du printemps sont prêtes sur le
    partage Events, et les bibliothèques doivent les imprimer
    aujourd'hui. Sauf que :

      - Josephine (Hilltop) n'a pas de lecteur E:. Elle est sur HILL-DESK1.
      - Kofi (Riverside) non plus, sur RIVER-DESK1.
      - Et moi ! Je suis sur CENTRAL-DESK1, pas de E: non plus. Pourtant
        l'équipe jeunesse d'ici, à Central, l'a depuis l'automne.

    Bongani (HILL-DESK2) dit qu'il n'a pas de E: non plus, mais il ne
    s'en sert jamais. Thanh n'en a pas besoin, il est au prêt.

    Tout le monde est connecté en ce moment. Tomas a dit que le lecteur
    vient « d'une GPO ». Vous pourriez regarder ?

    Nandini

## Événements

unapplied-policy-event-no-rsop =
    « Does not have RSoP data » : gpresult montre ce qui a été appliqué
    sur CET ordinateur, à ses ouvertures de session. Josephine ne s'est
    jamais connectée à registre. Le jeu de stratégie résultant vit sur
    son poste : gpresult sait le lire à distance (man gpresult : /s,
    /user), Get-GPResultantSetOfPolicy aussi.
unapplied-policy-event-gpupdate-here =
    Cela a rafraîchi la stratégie de registre lui-même : le contrôleur
    de domaine, et vous. Les postes des bibliothécaires se rafraîchissent
    seuls (toutes les 90 minutes, ou à la prochaine connexion), ou quand
    on le leur demande d'ici : Get-Help Invoke-GPUpdate.
unapplied-policy-event-josephine =
    Son poste a appliqué Staff Drives (S:), et filtré Archives Drive
    (elle n'est pas au fonds local). Mais Events Drive n'apparaît nulle
    part : ni appliquée, ni filtrée. Une GPO que gpresult ne cite même
    pas n'a pas été trouvée sur le chemin du domaine à son OU : aucun
    lien ne l'atteint. Où est-elle liée ? (Get-Help Get-GPInheritance,
    Get-GPOReport.)
unapplied-policy-event-links =
    Events Drive n'est liée qu'à OU=Central, là où Tomas l'a testée.
    Riverside et Hilltop héritent de ce qui est lié au-dessus d'elles
    (le domaine, OU=Branches), pas de ce qui est lié sur une OU sœur.
    Les conventions de Tomas disent où va une GPO pour le personnel.
unapplied-policy-event-root =
    Un lien à la racine du domaine : chaque compte et chaque ordinateur
    du domaine lit maintenant cette GPO à chaque connexion et
    actualisation, contrôleur de domaine et serveurs compris, et seul le
    filtrage de sécurité sépare le lecteur de tout le monde. Les
    conventions réservent la racine à la Default Domain Policy :
    liez-la plutôt à OU=Branches (Remove-GPLink, New-GPLink).
unapplied-policy-event-enforced =
    Enforced (appliqué) ne l'emporte que sur un héritage bloqué et sur
    les GPO liées plus bas. Il ne fait pas atteindre une OU au-dessus de
    laquelle la GPO n'est pas liée, ni passer le filtrage de sécurité.
    Rien ici ne bloque l'héritage : retirez-le (Set-GPLink … -Enforced
    No).
unapplied-policy-event-linked =
    Chaque bibliothèque est maintenant sous un lien d'Events Drive.
    Est-ce assez ? Rafraîchissez un poste et relisez son résultat ;
    celui de Nandini aussi.
unapplied-policy-event-nandini =
    À Central, où le lien a toujours été, le poste de Nandini range
    Events Drive dans les GPO filtrées : Filtering: Denied (Security).
    La GPO a atteint son compte ; ses permissions ne l'ont pas laissée
    s'appliquer. Qui a le droit de l'appliquer ? (Get-Help
    Get-GPPermission.)
unapplied-policy-event-filtering =
    Apply Group Policy : GG_Children seulement. Tomas a testé avec
    l'équipe jeunesse ; les responsables ont été oublié·es. Le partage
    qu'elle connecte, Events, est pour DL_Events_RW : GG_Children et
    GG_Management.
# { $accounts } : des noms de comptes (non traduits).
unapplied-policy-event-everyone =
    Maintenant le lecteur atteint des personnes à qui il n'est pas
    destiné : { $accounts }… Chaque agent·e de prêt, chaque archiviste,
    les comptes de service si le lien est assez haut, reçoivent un E:
    qu'ils ne peuvent même pas ouvrir (les permissions NTFS du partage
    sont pour DL_Events_RW). Le filtrage de sécurité doit nommer les
    mêmes groupes que le partage, pas Authenticated Users.
    (Authenticated Users garde GpoRead : les ordinateurs doivent pouvoir
    lire la GPO.)
unapplied-policy-event-filtered =
    Les responsables peuvent l'appliquer maintenant, et personne d'autre
    ne l'a gagnée.
unapplied-policy-event-filtered-unlinked =
    Les responsables peuvent l'appliquer maintenant, et personne d'autre
    ne l'a gagnée. À Central, cela suffit ; Riverside et Hilltop n'ont
    toujours aucun lien au-dessus d'elles.
unapplied-policy-event-right =
    Dans l'annuaire, la stratégie est juste : chaque bibliothécaire
    jeunesse et chaque responsable des trois bibliothèques recevrait E:,
    personne d'autre. Mais les postes l'appliquent à leur prochaine
    actualisation : demandez-le à l'un d'eux maintenant (Get-Help
    Invoke-GPUpdate -Examples), puis vérifiez avec gpresult.
unapplied-policy-event-end =
    Josephine, une minute plus tard : « E: est là ! J'imprime les
    affiches. »

    Bravo ! Vous avez terminé le chapitre « La stratégie qui ne
    s'applique pas ».

    CE QUI S'EST PASSÉ
    Tomas a créé la GPO « Events Drive » à l'automne et l'a testée à
    Central avec l'équipe jeunesse : il l'a liée à OU=Central et filtrée
    sur GG_Children. Deux couches, deux symptômes. À Riverside et
    Hilltop, gpresult ne citait pas du tout la GPO : aucun lien au-dessus
    de leur OU. À Central, il la donnait « Denied (Security) » pour
    Nandini : atteinte, mais pas autorisée. Vous l'avez liée là où est
    le personnel, avez donné à GG_Management le droit de l'appliquer, et
    demandé à un poste de se rafraîchir.

    BONNES PRATIQUES
    - Partir du résultat, sur l'ordinateur de la personne : gpresult /s
      ORDINATEUR /user DOMAINE\compte /r (ou
      Get-GPResultantSetOfPolicy). Appliquée, filtrée (et pourquoi), ou
      absente : trois problèmes différents.
    - Absente : un problème de lien (où elle est liée, un héritage
      bloqué, l'objet dans une autre OU qu'on ne croit). « Denied
      (Security) » : le filtrage de sécurité. « Disabled (Link) »,
      « Disabled (GPO) », « Not Applied (Empty) » : la GPO elle-même.
    - Lier là où sont les objets, filtrer avec les groupes que le
      paramètre concerne. Pas à la racine, pas en Enforced, pas
      Authenticated Users par réflexe.
    - Garder GpoRead pour Authenticated Users (ou Domain Computers)
      quand on filtre : depuis la mise à jour MS16-072, les ordinateurs
      lisent aussi les GPO des utilisateur·rices.
    - Après un changement : Invoke-GPUpdate -Computer, ou attendre
      l'actualisation en arrière-plan (90 minutes, à 30 près).

    COMME « L'ANNUAIRE », EN ACTIVE DIRECTORY
    Une GPO vit dans l'annuaire (CN={"{"}GUID{"}"},CN=Policies,CN=System) et
    une OU la désigne par son attribut gPLink, que le module montre sous
    le nom LinkedGroupPolicyObjects : Get-ADOrganizationalUnit
    'OU=Branches,DC=lending,DC=internal' | Select-Object -ExpandProperty
    LinkedGroupPolicyObjects montre le lien que vous avez ajouté.

    DOCUMENTATION
    - gpresult : https://learn.microsoft.com/windows-server/administration/windows-commands/gpresult
    - Le filtrage de sécurité : https://learn.microsoft.com/troubleshoot/windows-server/group-policy/apply-group-policy-objects-users-computers
    - New-GPLink : https://learn.microsoft.com/powershell/module/grouppolicy/new-gplink
    - Set-GPPermission : https://learn.microsoft.com/powershell/module/grouppolicy/set-gppermission
    - Invoke-GPUpdate : https://learn.microsoft.com/powershell/module/grouppolicy/invoke-gpupdate
