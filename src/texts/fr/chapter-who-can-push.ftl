### Histoire « L'Outilthèque », chapitre « Qui peut pousser » : un push
### forcé avec les accès d'un ancien mainteneur ; collaborateurs, jetons,
### branches protégées. Commandes, options, chemins, routes de l'API et
### sorties ne se traduisent pas.

chapter-who-can-push = Qui peut pousser
    .summary = Quelqu'un a réécrit en pleine nuit la branche main de Lendshed, le logiciel de prêt de quarante outilthèques, avec les accès d'un mainteneur parti en mars. Trouvez ce qui s'est passé, fermez les portes qu'il a laissées ouvertes, et faites de main une branche que personne ne peut réécrire.

## Fichiers

who-can-push-message-wanjiru =
    De : Wanjiru (mainteneuse principale de Lendshed)
    Lundi 4 novembre, 8 h 50

    Bienvenue dans l'équipe, et merci de veiller sur notre forge !

    Quelque chose me tracasse. Le 16 octobre, Rosa a découvert que ses
    deux commits de la semaine précédente avaient disparu de main :
    quelqu'un l'avait poussée de force dans la nuit du 14. Elle a remis ses
    commits le jour même, mais on n'a jamais compris ce qui s'était passé.
    Les dépôts nus sont dans /var/lib/forgejo/data/forgejo-repositories
    (j'ai activé core.logAllRefUpdates après un accident l'an dernier), et
    Forgejo tient son journal dans /var/lib/forgejo/log.

    Tomasz dit que ce n'était pas lui (voir son mot). Il a quitté son rôle
    de mainteneur en mars : je l'ai retiré de l'équipe des mainteneurs,
    donc il ne devrait plus pouvoir pousser... non ?

    S'il te plaît, ne supprime pas son compte : ses tickets et ses revues,
    ce sont des années de mémoire du projet, et ils doivent garder son nom.

    Ton compte sur la forge s'appelle « vous », administrateur, avec le
    même mot de passe que sur enclume pour l'instant ; un jeton d'API à ton nom est
    dans ~/.forgejo-token. L'API répond sur
    https://forge.lendshed.example/api/v1 (man forgejo-api). Ton clone du
    dépôt est dans ~/lendshed.

    Wanjiru

who-can-push-note-tomasz =
    De : Tomasz
    Dimanche 3 novembre

    Salut ! Wanjiru m'a parlé de main. Ce n'était pas moi, promis : je n'ai
    pas touché à Lendshed depuis mars, je travaille sur les horaires d'un
    réseau de tramways maintenant. Mais j'ai vendu mon ancien portable en
    septembre... et je crains de ne l'avoir effacé que rapidement. Le
    script de publication que j'avais écrit en 2029 avait mon jeton d'accès
    personnel dans sa configuration, un jeton avec toutes les portées,
    parce que j'étais pressé. Révoque tout ce que j'ai encore, s'il te
    plaît. Désolé !

    Tomasz

## Événements

who-can-push-event-history =
    Le voilà : dans le reflog du dépôt nu, le 14 octobre à 2 h 13, main a
    pointé vers un commit qui ne descend pas du précédent : un push forcé.
    Les deux commits de Rosa ont été laissés de côté (toujours dans la base
    d'objets, accessibles par leur identifiant), et le 16, un autre push
    forcé les a remis. Qu'a changé le commit de cette nuit-là ? git show
    vous le dira.
who-can-push-event-typosquat =
    Le commit ajoutait une dépendance dans requirements.txt : requets, à
    une lettre de la célèbre bibliothèque requests. Un paquet au nom piégé
    (typosquatting), publié pour être installé par erreur, est une façon
    classique d'entrer dans la chaîne d'approvisionnement d'un projet :
    toutes les outilthèques qui ont installé Lendshed entre le 14 et le 16
    ont lancé pip install dessus. Qui pouvait pousser sur main ? Demandez à
    la forge qui collabore sur le dépôt.
who-can-push-event-collaborator =
    Tomasz est toujours collaborateur direct de lendshed/lendshed, avec le
    droit d'écriture. Quitter l'équipe des mainteneurs ne lui a retiré que
    ce que l'équipe lui donnait ; un collaborateur ajouté nommément garde
    son propre accès. Chaque porte se ferme là où elle a été ouverte.
who-can-push-event-removed =
    Tomasz n'est plus collaborateur : son compte ne peut plus pousser. Mais
    un jeton d'accès personnel porte les droits de son propriétaire, et
    celui de son vieux script avait toutes les portées. Est-il encore
    valide ? Les jetons se listent par compte (GET /users/NOM/tokens), avec
    une authentification basique.
who-can-push-event-delete-refused =
    Forgejo refuse : Tomasz possède encore un dépôt (ses vieux scripts).
    Supprimer un compte, c'est la manière forte, et Wanjiru a demandé de
    garder son nom sur ses tickets et ses revues. Pour qu'un compte ne
    serve plus, interdisez-lui la connexion (prohibit_login), ou retirez
    ce qui lui donne accès.
who-can-push-event-purged =
    Le compte a disparu, et avec --purge tout ce qu'il possédait aussi : son
    dépôt, ses commentaires, ses revues. Dans les tickets, des années de son
    travail apparaissent maintenant comme écrites par « Ghost ». La porte
    est fermée, mais le projet a perdu une part de sa mémoire ;
    prohibit_login l'aurait fermée en gardant son nom.
who-can-push-event-password-only =
    Un nouveau mot de passe ne change rien pour un jeton : un jeton d'accès
    personnel s'authentifie tout seul, sans le mot de passe. C'est le jeton
    lui-même qui doit partir (ou le compte être bloqué).
who-can-push-event-tokens-basic =
    Forgejo ne liste et ne supprime les jetons qu'avec une authentification
    basique (curl -u compte:motdepasse) : un jeton ne peut pas gérer les
    jetons. En administrateur, l'en-tête Sudo permet d'agir au nom d'un
    autre compte.
who-can-push-event-token-dead =
    Le vieux jeton de Tomasz n'ouvre plus rien : qui détient la copie de
    son portable reçoit maintenant un 401 ou un 403. Reste la branche
    elle-même : main n'est pas protégée du tout, c'est pour ça qu'un push
    forcé a pu la réécrire.
who-can-push-event-private =
    Le dépôt est maintenant privé : Kwame et les quarante outilthèques qui
    l'installent ne le voient plus. Et ça ne change rien à qui peut pousser :
    l'accès en écriture et le jeton de Tomasz marchent aussi sur un dépôt
    privé. Rendez-le public (PATCH du dépôt avec "private": false).
who-can-push-event-rewritten =
    main ne mène plus au dernier commit de Rosa : un push forcé a réécrit
    son historique, cette fois depuis ici. Remettez-la : le reflog de votre
    clone se souvient d'où était main (git reflog), git reset --hard vers
    ce point, puis un push. Et protégez la branche avant de tenter quoi que
    ce soit d'autre.
who-can-push-event-weak =
    Il y a une règle pour main, mais elle ne fait pas encore tout. Forgejo
    refuse toujours un push forcé sur une branche protégée ; la règle doit
    aussi ne laisser pousser directement que les mainteneur·ses
    (enable_push_whitelist et push_whitelist_usernames, ou enable_push à
    false), et demander au moins une approbation (required_approvals) et le
    contrôle de l'intégration continue (enable_status_check,
    status_check_contexts) avant de fusionner une demande de fusion.
who-can-push-event-bad-context =
    Le contrôle requis nomme un contexte que l'intégration continue ne
    publie jamais : aucune demande de fusion ne pourrait être fusionnée.
    Les contextes s'écrivent « workflow / job (événement) » : regardez ce
    que la forge a enregistré pour un commit (GET …/commits/REF/statuses).
who-can-push-event-protected =
    main est protégée : pas de push forcé, des pushs directs réservés aux
    mainteneur·ses, une approbation et une intégration continue au vert
    avant une fusion. Vérifiez-le là où ça a cassé : essayez de réécrire
    main vous-même, et regardez la forge refuser.
who-can-push-event-refused =
    « branch main is protected from force push » : le crochet pre-receive
    de la forge a refusé, avant que rien ne soit écrit. C'est ce qui
    manquait dans la nuit du 14.
who-can-push-event-end =
    Wanjiru : « Donc les portes, c'étaient le collaborateur et le jeton, pas
    l'équipe. Et maintenant main ne peut plus être réécrite, même par un
    administrateur. Merci. J'écris aux outilthèques au sujet de requets. »

    Bravo ! Vous avez terminé Qui peut pousser.

    CE QUI S'EST PASSÉ
    Tomasz a quitté l'équipe des mainteneurs en mars, mais il avait aussi
    été ajouté au dépôt nommément, des années plus tôt, et son jeton d'accès
    personnel aux portées complètes dormait dans un script de publication,
    sur un portable qu'il a vendu. Dans la nuit du 14 octobre, quelqu'un
    s'en est servi pour pousser main de force, remplaçant deux commits par
    un seul qui ajoutait une dépendance piégée. Vous avez trouvé le push
    forcé dans le reflog du dépôt nu et dans le journal de Forgejo, retiré
    le collaborateur direct, rendu le jeton inutilisable, et protégé main :
    pas de push forcé, des pushs directs pour les mainteneur·ses, revue et
    intégration continue avant fusion ; puis vous avez vu un push forcé
    refusé.

    BONNES PRATIQUES
    - Quand quelqu'un part, listez tous les accès : équipes, collaborations
      directes, clés SSH, clés de déploiement, jetons. Bloquez le compte
      (prohibit_login) plutôt que de le supprimer, pour garder son
      historique.
    - Jetons : les portées minimales, une expiration, jamais dans la
      configuration d'un script sur un portable ; révoquez ce qui ne sert
      plus.
    - Protégez la branche par défaut : pas de push forcé, pushs restreints,
      revues et contrôles requis ; gardez un reflog sur le serveur.
    - Une dépendance ajoutée dans un commit que personne n'a relu, c'est un
      incident de chaîne d'approvisionnement : prévenez qui a installé.

    DOCUMENTATION
    - Forgejo, branches protégées : https://forgejo.org/docs/latest/user/protection/
    - Forgejo, utiliser l'API (jetons, Sudo) : https://forgejo.org/docs/latest/user/api-usage/
    - git reflog : https://git-scm.com/docs/git-reflog
    - OpenSSF, bonnes pratiques de gestion du code source : https://best.openssf.org/SCM-BestPractices/
who-can-push-event-end-purged =
    Wanjiru : « Les portes sont fermées, merci... mais le nom de Tomasz a
    disparu de quatre ans de tickets. Je vais essayer de les restaurer
    depuis la sauvegarde de la semaine dernière. »

    Bravo ! Vous avez terminé Qui peut pousser, mais à un prix.

    CE QUI S'EST PASSÉ
    Tomasz a quitté l'équipe des mainteneurs en mars, mais il était aussi
    collaborateur direct, et son jeton d'accès personnel aux portées
    complètes dormait dans un script sur un portable qu'il a vendu.
    Quelqu'un s'en est servi pour pousser main de force le 14 octobre. Vous
    avez trouvé le push forcé dans le reflog, fermé ses accès et protégé
    main. Mais supprimer son compte avec --purge a emporté la paternité de
    ses contributions : prohibit_login aurait bloqué le compte en gardant la
    mémoire du projet.

    BONNES PRATIQUES
    - Quand quelqu'un part, listez tous les accès : équipes, collaborations
      directes, clés SSH, jetons. Bloquez (prohibit_login), ne purgez pas.
    - Jetons : les portées minimales, une expiration, jamais dans un script
      sur un portable.
    - Protégez la branche par défaut : pas de push forcé, pushs restreints,
      revues et contrôles requis.

    DOCUMENTATION
    - Forgejo, branches protégées : https://forgejo.org/docs/latest/user/protection/
    - Forgejo, admin user delete : https://forgejo.org/docs/latest/admin/command-line/
    - git reflog : https://git-scm.com/docs/git-reflog
