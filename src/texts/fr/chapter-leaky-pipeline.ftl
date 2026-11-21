### Histoire « L'Outilthèque », chapitre « La Chaîne qui fuit » : un workflow
### d'intégration continue qui confie la clé de déploiement à la demande de
### fusion d'un fork, et l'affiche. Commandes, options, chemins, routes de
### l'API et sorties ne se traduisent pas.

chapter-leaky-pipeline = La Chaîne qui fuit
    .summary = L'intégration continue qui teste les demandes de fusion de Lendshed et publie sa documentation a affiché la clé de déploiement dans un journal public, et l'a confiée au code de n'importe quel fork. Trouvez la fuite, changez la clé, et reconstruisez la chaîne pour que le code d'un·e contributeur·rice soit testé sans jamais toucher un secret.

## Fichiers

leaky-pipeline-message-rosa =
    De : Rosa (mainteneuse)
    Mercredi 13 novembre, 13 h 40

    Salut ! Il y a un truc bizarre dans l'intégration continue. Je lisais
    l'exécution de la demande de fusion de Kwame (la n° 57, sa traduction
    en swahili) et le job « test » affiche une énorme ligne de lettres et
    de chiffres sous une étape appelée « Show deploy configuration ».
    Tomasz l'avait ajoutée en février « pour déboguer le déploiement », et
    le workflow est resté comme ça depuis.

    Notre dépôt est public, et ses exécutions et leurs journaux aussi.

    L'intégration continue, c'est .forgejo/workflows/ci.yml dans le dépôt
    (ton clone est dans ~/lendshed). Les exécutions sont dans l'API (man
    forgejo-api), et le journal de chaque job est une simple page web. La
    documentation est publiée par le job « deploy » avec le compte deploy
    d'enclume (par rsync sur ssh), et la clé est rangée dans le secret
    DEPLOY_KEY de la forge.

    Ton jeton d'API est toujours dans ~/.forgejo-token.

    Rosa

## Événements

leaky-pipeline-kwame-sync = (Kwame a rebasé sa demande de fusion n° 57 sur la nouvelle main : l'intégration continue a tourné à nouveau dessus.)
leaky-pipeline-event-runs =
    Les exécutions de la forge : les pushs sur main, et la demande de
    fusion n° 57 de Kwame, lancée sur pull_request_target. Chaque job a son
    journal (logs_url) ; pour un dépôt public, tout le monde peut le lire.
leaky-pipeline-event-log =
    L'étape « Show deploy configuration » affiche une longue ligne : du
    base64. L'exécuteur masque dans les journaux les secrets qu'il connaît
    (*** à leur place), mais seulement leur texte exact : une fois encodé,
    le secret n'est qu'une ligne comme une autre. Qu'est-ce que c'est ?
    base64 -d la relit.
leaky-pipeline-event-decoded =
    C'est la clé de déploiement : une clé privée OpenSSH, dans un journal
    public depuis février, et confiée en plus au code de chaque demande de
    fusion. Elle doit être considérée comme volée : cacher le journal
    maintenant ne change rien. Une clé qui a fuité se remplace : une
    nouvelle clé, l'ancienne refusée, le secret mis à jour. Et le workflow,
    comment donne-t-il la clé à un fork ?
leaky-pipeline-event-workflow =
    Voilà le motif que le laboratoire de sécurité de GitHub appelle une
    « pwn request » : pull_request_target exécute le workflow de la branche
    de base avec les secrets du dépôt, pour qu'un workflow puisse commenter
    une demande de fusion ; mais celui-ci récupère le code de la demande
    elle-même (github.event.pull_request.head.sha) et l'exécute, avec
    DEPLOY_KEY dans l'environnement de tout le workflow. Le pip install ou
    un fichier de test d'un fork pourrait la lire. Le code d'une demande de
    fusion se teste avec pull_request, qui ne donne aucun secret à un
    fork ; la clé n'appartient qu'à l'étape de déploiement, sur un push
    vers main.
leaky-pipeline-event-old-key-gone =
    La clé qui a fuité n'est plus dans les authorized_keys du compte
    deploy : qui l'a copiée reçoit « Permission denied ». La documentation
    ne peut plus être publiée tant qu'une nouvelle clé n'est pas en place.
leaky-pipeline-event-unrestricted =
    Une clé sans aucune option dans authorized_keys peut tout ce que peut
    le compte deploy : un shell, des redirections de ports... Pour la clé
    d'une intégration continue, restreignez-la : restrict, from="192.0.2.80"
    (l'adresse de l'exécuteur) et command="rrsync /srv/www/docs", qui
    n'autorise que rsync vers ce répertoire (man sshd, AUTHORIZED_KEYS ;
    rrsync).
leaky-pipeline-event-new-key =
    Une nouvelle clé, restreinte, pour le compte deploy. Sa moitié privée
    doit maintenant aller dans le secret DEPLOY_KEY de la forge (PUT
    /repos/PROPRIÉTAIRE/DÉPÔT/actions/secrets/NOM, un corps JSON
    {"{"}"data": "…"{"}"}), puis quitter cette machine.
leaky-pipeline-event-json-error =
    Forgejo ne peut pas lire le JSON : une clé privée a des retours à la
    ligne, et une chaîne JSON ne peut pas en contenir tels quels ; ils
    s'écrivent \n. jq construit le JSON proprement : jq -Rs '{"{"}data: .{"}"}' < CLÉ
    lit le fichier comme une seule chaîne. Attention aussi : curl -d
    @FICHIER retire les retours à la ligne du fichier qu'il envoie ;
    --data-binary @FICHIER les garde.
leaky-pipeline-event-secret =
    Le secret DEPLOY_KEY contient maintenant la nouvelle clé (la forge ne
    montre plus jamais la valeur d'un secret : seulement son nom et sa
    date). Effacez votre copie locale de la clé privée une fois rangée.
leaky-pipeline-event-pushed =
    main a bougé : la forge a lancé le workflow du push, et Kwame va mettre
    sa demande de fusion à jour par-dessus.
leaky-pipeline-event-no-ci =
    Il n'y a plus aucun workflow sur main : plus de fuite, mais plus de
    tests sur les demandes de fusion non plus, ni de documentation publiée.
    L'intégration continue doit rester ; elle doit juste cesser de confier
    des secrets à du code qu'on ne connaît pas.
leaky-pipeline-event-still-exposed =
    La dernière exécution de Kwame confie encore les secrets au code du
    fork, ou en affiche encore un. Relisez les exécutions et leurs
    journaux : quel événement, quel code récupéré, où est DEPLOY_KEY dans
    l'environnement.
leaky-pipeline-event-untested =
    L'exécution de Kwame ne touche plus la clé, mais elle ne teste plus son
    code non plus : pull_request_target avec le code de la branche de base
    teste main, pas la demande de fusion. Testez les demandes de fusion sur
    pull_request : leur propre code, sans secrets.
leaky-pipeline-event-masked-only =
    Le workflow est sûr maintenant, mais la clé qui a fuité ouvre toujours
    le compte deploy : elle a été publique pendant neuf mois. Une fuite ne
    se répare qu'en changeant la clé.
leaky-pipeline-event-safe =
    La dernière exécution de Kwame : son code testé sur pull_request, sans
    aucun secret, rien d'affiché. Même un fork malveillant ne pourrait
    casser que sa propre exécution.
leaky-pipeline-event-stale-context =
    Le contrôle requis sur main nomme encore « ci / test
    (pull_request_target) » : ce contexte ne reviendra jamais, et aucune
    demande de fusion ne pourrait être fusionnée. Mettez la protection à
    jour avec le contexte que publie maintenant la demande de fusion.
leaky-pipeline-event-context =
    La protection attend maintenant le contexte que l'intégration continue
    publie vraiment sur les demandes de fusion.
leaky-pipeline-event-deploy-failed =
    Le job de déploiement du dernier push a échoué : lisez son journal. La
    clé du secret, la ligne d'authorized_keys et ses options (from=, le
    répertoire de rrsync) doivent concorder. Une fois corrigé, un nouveau
    push sur main relance le déploiement (git commit --allow-empty, par
    exemple).
leaky-pipeline-event-deployed =
    Le dernier push sur main a déployé la documentation avec la nouvelle
    clé, la seule que le compte deploy accepte.
leaky-pipeline-event-end =
    Rosa : « Donc la clé a traîné dehors pendant neuf mois... et elle ne
    vaut plus rien. Les exécutions de Kwame sont au vert, et aucun code
    autre que le nôtre ne voit jamais un secret. Merci ! »

    Bravo ! Vous avez terminé La Chaîne qui fuit.

    CE QUI S'EST PASSÉ
    L'intégration continue lançait les demandes de fusion sur
    pull_request_target, qui donne les secrets du dépôt au workflow, et
    récupérait le code du fork ; la clé de déploiement était dans
    l'environnement de chaque job, et une étape de débogage l'affichait en
    base64, à travers le masquage des journaux. La clé avait fuité dans des
    journaux publics. Vous l'avez décodée pour en être sûr·e, changée (une
    nouvelle clé, restreinte par rrsync et from=, l'ancienne retirée, le
    secret de la forge mis à jour par l'API), réécrit le workflow
    (demandes de fusion testées sur pull_request sans secrets, déploiement
    seulement sur un push vers main, la clé dans sa seule étape), et
    vérifié les exécutions suivantes.

    BONNES PRATIQUES
    - Du code non fiable (la demande de fusion d'un fork) ne tourne jamais
      là où il y a un secret : pull_request, pas pull_request_target avec
      le code de la demande.
    - Un secret est dans l'environnement de l'étape qui en a besoin, nulle
      part ailleurs ; jamais affiché, même encodé : le masquage ne connaît
      que son texte exact.
    - Un secret qui a fuité se remplace, il ne se cache pas.
    - La clé de déploiement d'une intégration continue est restreinte sur
      le serveur : restrict, from=, command= (rrsync pour rsync).
    - Les contrôles requis suivent les contextes du workflow.

    DOCUMENTATION
    - Forgejo Actions, événements : https://forgejo.org/docs/latest/user/actions/reference/
    - Forgejo Actions, sécurité : https://forgejo.org/docs/latest/user/actions/security/
    - GitHub Security Lab, éviter les pwn requests : https://securitylab.github.com/resources/github-actions-preventing-pwn-requests/
    - sshd, AUTHORIZED_KEYS FILE FORMAT : https://man.openbsd.org/sshd#AUTHORIZED_KEYS_FILE_FORMAT
