### Histoire « L'Outilthèque », chapitre « Signé et scellé » : commits et
### étiquettes signés avec SSH, une forge qui les exige, une version dont
### les sommes de contrôle sont signées, et une vérification comme la ferait
### un·e utilisateur·rice. Commandes, options, chemins et sorties ne se
### traduisent pas.

chapter-signed-release = Signé et scellé
    .summary = Une fausse version de Lendshed circule avec une somme de contrôle qui « la prouve ». Rendez vérifiable chaque étape de la prochaine version, des commits jusqu'à l'archive : signée avec les clés des mainteneur·ses, exigée par la forge, et vérifiée comme le fera une outilthèque à l'autre bout du monde.

## Fichiers

signed-release-message-aroha =
    De : Aroha (outilthèque de Wellington)
    Dimanche 24 novembre

    Kia ora ! Je fais tourner Lendshed pour notre outilthèque. Quelqu'un a
    posté la semaine dernière un « lendshed-2.3.1.tar.gz » sur le forum
    des outilthèques, avec un fichier .sha256 à côté, en disant qu'il
    corrige les rappels. Il n'y a pas de 2.3.1 sur votre site. La somme
    correspondait au fichier, évidemment, puisqu'elle venait avec.

    Comment savoir qu'une version vient bien de vous ? Je vérifierais
    volontiers une signature, si vous me dites comment. J'installerai la
    2.4.0 dès sa sortie.

    Aroha

signed-release-note-wanjiru =
    De : Wanjiru
    Lundi 25 novembre, 9 h 30

    Aroha a raison, et après octobre je veux qu'on aille plus loin : chaque
    commit de main signé par un·e mainteneur·se, la forge qui refuse les
    autres, l'étiquette de la version signée, et les sommes de contrôle des
    archives signées aussi.

    Utilisons nos clés SSH, on les a déjà : la tienne est ~/.ssh/id_ed25519
    (pas l'ancienne, celle de ton précédent portable, qui n'est jamais allée
    sur la forge). Nos clés publiques sont aussi sur la forge : celles de
    chaque compte sont sur https://forge.lendshed.example/NOM.keys.

    Le plan pour la 2.4.0 :
    - un fichier allowed_signers à la racine du dépôt, avec nos trois clés,
      pour que tout le monde puisse vérifier nos signatures ;
    - tes commits signés (le changement de version dans
      lendshed/__init__.py est la dernière chose à faire) ;
    - main qui exige des commits signés ;
    - l'étiquette v2.4.0, signée ;
    - lendshed-2.4.0.tar.gz dans /srv/www/downloads, faite à partir de
      l'étiquette (préfixe lendshed-2.4.0/), avec SHA256SUMS et sa
      signature ;
    - et tout vérifier comme le fera Aroha, avant de l'annoncer.

    Wanjiru

## Événements

signed-release-event-signing =
    git signe maintenant avec SSH (gpg.format = ssh) et sait avec quelle
    clé (user.signingKey) : git commit -S signe un commit, commit.gpgsign =
    true les signe tous.
signed-release-event-old-key =
    Ce commit est signé avec l'ancienne clé de votre précédent portable.
    Elle signe très bien, mais personne ne la connaît : elle n'est pas dans
    allowed_signers, et la forge ne l'a pas sur votre compte. Une signature
    ne prouve quelque chose qu'avec une clé à laquelle les autres font déjà
    confiance. Signez à nouveau avec ~/.ssh/id_ed25519 (git commit --amend
    -S --no-edit).
signed-release-event-signed-commit =
    Votre dernier commit porte une signature faite avec votre clé. git
    peut-il la vérifier ? Il lui faut savoir à quelles clés se fier.
signed-release-event-no-allowed =
    Pour vérifier une signature SSH, git lit un fichier allowed_signers :
    une ligne par signataire, « principal clé », le principal étant
    l'adresse de l'auteur·rice du commit. git config
    gpg.ssh.allowedSignersFile lui dit où est ce fichier.
signed-release-event-allowed =
    git connaît les signataires autorisés, et votre clé parmi eux.
signed-release-event-verified =
    Good "git" signature pour votre adresse : le commit a été signé par une
    clé qu'allowed_signers attribue à son auteur·rice.
signed-release-event-require =
    main exige maintenant des commits signés : Forgejo vérifie la signature
    de chaque commit poussé avec les clés du compte dont l'adresse l'a
    signé.
signed-release-event-unsigned-refused =
    La forge a refusé le push : un commit n'est pas vérifié, soit non
    signé, soit signé par une clé qu'aucun compte n'a avec cette adresse.
    Signez les commits (git commit --amend -S --no-edit pour le dernier),
    puis poussez à nouveau.
signed-release-event-not-in-repo =
    Votre commit signé est sur main, mais le dépôt n'a toujours pas de
    fichier allowed_signers avec votre clé : qui le clone ne peut pas
    vérifier nos signatures. Ajoutez-le à la racine, validez, poussez.
signed-release-event-pushed =
    La tête de main est signée, vérifiée par la forge, et le dépôt contient
    allowed_signers : tout le monde peut la vérifier avec git verify-commit.
signed-release-event-lightweight =
    v2.4.0 est une étiquette légère : un simple nom pour un commit, sans
    auteur·rice, sans message, sans signature. git verify-tag n'a rien à
    vérifier. Faites à sa place une étiquette annotée et signée (git tag -s
    -f), et si la légère a été poussée, poussez la nouvelle avec --force.
signed-release-event-tag =
    L'étiquette v2.4.0 est sur la forge, annotée et signée avec votre clé,
    sur main : git verify-tag v2.4.0 la vérifie.
signed-release-event-tarball =
    L'archive vient de l'étiquette (git archive) : la même étiquette donne
    toujours les mêmes octets, ce qui permet à chacun·e de la refaire et de
    comparer.
signed-release-event-sums =
    SHA256SUMS correspond à l'archive. Une somme de contrôle ne protège
    pourtant que d'un téléchargement abîmé : qui remplace l'archive
    remplace la somme à côté, comme l'a fait l'auteur de la fausse 2.3.1.
signed-release-event-sum-only =
    sha256sum -c dit OK, mais c'est ce qu'Aroha avait déjà avec la fausse
    2.3.1. Sans signature sur SHA256SUMS, la somme ne prouve rien sur qui a
    fait le fichier. Signez-la : ssh-keygen -Y sign -n file.
signed-release-event-sum-checked =
    La somme correspond, et le fichier des sommes est signé : encore une
    vérification et la version est prouvée.
signed-release-event-sig =
    SHA256SUMS.sig : SHA256SUMS signé avec votre clé, dans l'espace de noms
    « file » (une signature faite pour git ne peut pas passer pour celle
    d'un fichier, ni l'inverse).
signed-release-event-sig-checked =
    Good "file" signature : SHA256SUMS a été signé par votre clé,
    qu'allowed_signers attribue à votre adresse.
signed-release-event-end =
    Wanjiru : « Signé du premier commit au dernier octet. J'ai mis les deux
    commandes dans VERIFYING.md pour Aroha et les autres. »
    Aroha : « Vérifié ! Les deux réponses sont bonnes. Merci. »

    Bravo ! Vous avez terminé Signé et scellé.

    CE QUI S'EST PASSÉ
    Une fausse version circulait avec une somme de contrôle, qui ne prouvait
    rien puisqu'elle venait avec le fichier. Vous avez réglé git pour signer
    avec votre clé SSH, publié les clés des mainteneur·ses dans
    allowed_signers, signé votre commit, fait exiger par la forge des
    commits vérifiés sur main, signé l'étiquette v2.4.0, construit l'archive
    à partir d'elle avec git archive, écrit et signé SHA256SUMS, et vérifié
    la version comme le ferait un·e utilisateur·rice : sha256sum -c, puis
    ssh-keygen -Y verify avec allowed_signers.

    BONNES PRATIQUES
    - Une somme de contrôle détecte un fichier abîmé ; seule une signature
      dit qui l'a fait.
    - Signez commits et étiquettes avec des clés auxquelles les autres font
      déjà confiance (allowed_signers dans le dépôt, clés sur la forge) ;
      laissez la forge refuser le reste.
    - Une étiquette annotée et signée pour chaque version ; l'archive
      reconstruite à partir d'elle.
    - Dites aux utilisateur·rices comment vérifier, en deux commandes.
    - SLSA et l'OpenSSF vont plus loin : provenance des constructions,
      constructions reproductibles, revue à deux personnes.

    DOCUMENTATION
    - git, signer son travail : https://git-scm.com/book/fr/v2/Utilitaires-Git-Signer-votre-travail
    - git-config, gpg.format et gpg.ssh.allowedSignersFile : https://git-scm.com/docs/git-config
    - ssh-keygen -Y et ALLOWED SIGNERS : https://man.openbsd.org/ssh-keygen
    - Forgejo, branches protégées : https://forgejo.org/docs/latest/user/protection/
    - SLSA, menaces sur la chaîne d'approvisionnement : https://slsa.dev/spec/v1.0/threats
