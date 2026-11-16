### Histoire « Le Bastion », chapitre « L'Éradication » : retirer les
### portes de retour laissées par l'intrus·e (crontab, clé, fichiers) sans
### emporter ce qui est légitime, trouver ce qui a été modifié, et le
### restaurer depuis une version dont la signature est vérifiée. Les
### commandes, chemins, clés et empreintes ne sont pas traduits.

chapter-eradication = L'Éradication
    .summary = Retirer les portes de retour laissées par l'intrus·e, trouver ce qui a été modifié, et le restaurer depuis une version signée que tu as vérifiée.

## Fichiers

# { $fingerprint } : l'empreinte de la clé ssh de Selma
eradication-email-selma =
    De :     Selma
    À :      toi
    Objet :  Re : compte deploy

    Nadia m'a appelée. Je suis désolée, le mot de passe devait être
    temporaire, juste pour mes premiers déploiements en mars. Ma clé est la
    seule qui devrait être sur deploy ; son empreinte est :

        { $fingerprint }

    La crontab contient une tâche à moi, sync-orders, tous les quarts
    d'heure : garde-la, les commandes de la boutique passent par elle.

    Mes versions sont signées avec ma clé gpg (déjà dans le trousseau du
    serveur, gpg --list-keys). La version 2.3.1 est dans /srv/releases, avec
    sa signature. Ne te fie à rien d'autre.

    Selma

eradication-incident =
    # Incident — four (livraisons)

    ## Confiné (14/04, 9 h 30)
    Pool et 203.0.113.66 bloqués (iptables), mineur et chien de garde
    arrêtés, deploy expiré.

    ## Reste à faire
    - Qu'a-t-on laissé pour revenir ? (crontab, clés, fichiers)
    - Qu'a-t-on modifié ? L'appli relançait le mineur à son démarrage.
    - L'historique de deploy (/home/deploy/.bash_history) en dit peut-être
      long.

## Événements

# { $line } : la tâche de Selma
eradication-event-cron-all =
    La tâche de Selma a disparu de la crontab de deploy ({ $line }) : les
    commandes de la boutique ne se synchronisent plus. Remets-la (crontab -u
    deploy -e).
# { $line } : la ligne retirée
eradication-event-cron =
    La ligne @reboot a disparu ({ $line }) : au prochain démarrage, rien ne
    relancera le chien de garde. Et la tâche de Selma est toujours là.
eradication-event-key-all =
    La clé de Selma a disparu aussi : elle ne pourra plus déployer. Seule la
    clé de l'intrus·e devait partir : compare les empreintes (ssh-keygen
    -lf) avec celle de son courriel.
eradication-event-key =
    La clé de l'intrus·e est retirée, celle de Selma gardée. Le commentaire
    (deploy@ci-runner) avait l'air légitime : seule l'empreinte les distinguait.
eradication-event-files =
    Le mineur et son chien de garde ont disparu de /tmp/.cache.
eradication-event-bad-signature =
    BAD signature : cette archive n'est pas celle que Selma a signée. Son
    contenu a changé après la signature : c'est la copie reconstruite par
    l'intrus·e, avec sa ligne dedans. Ne restaure pas depuis elle.
eradication-event-verified =
    Good signature, par la clé de Selma : cette archive est exactement celle
    qu'elle a publiée. Tu peux restaurer depuis elle.
eradication-event-restored =
    server.js est de nouveau identique à la version publiée : la ligne
    ajoutée a disparu.
eradication-event-relaunched =
    L'appli est repartie, et avec elle le chien de garde et le mineur :
    server.js les relance toujours, et leur script est toujours là.
    Arrête-les, puis occupe-toi de la cause.
eradication-event-end =
    Selma : « Merci. Je vais changer mes habitudes : plus de mot de passe,
    même “juste pour une semaine”. »

    Bravo ! Tu as terminé le chapitre « L'Éradication ».

    CE QUI S'EST PASSÉ
    L'intrus·e avait laissé trois portes de retour : une ligne de crontab à
    chaque démarrage, sa propre clé dans les authorized_keys de deploy, et
    une ligne dans l'appli qui relançait le mineur à chaque démarrage. Tu
    les as retirées une à une sans emporter ce qui était légitime, et tu as
    restauré l'appli depuis une version dont tu as d'abord vérifié la
    signature, pas depuis la copie laissée à côté.

    BONNE PRATIQUE
    - Chercher la persistance partout où un compte peut écrire : sa crontab,
      ses clés, ses fichiers, ce que ses services exécutent. L'historique de
      deploy en disait long, mais une intrusion peut l'effacer : ne pas
      compter que sur lui.
    - Retirer ligne par ligne : crontab -r ou vider authorized_keys emporte
      le légitime avec le reste.
    - Restaurer depuis une source de confiance et vérifiable (une version
      signée, une sauvegarde antérieure à l'intrusion), jamais depuis une
      copie que l'intrus·e a pu toucher.

    UNE AUTRE FAÇON DE FAIRE
    En cas de doute sur ce qui a pu changer d'autre, réinstaller : un
    nouveau serveur construit depuis des sources connues (paquets, version
    signée, sauvegarde des données), puis les données vérifiées avant de
    revenir. C'est plus long, mais c'est la seule façon d'être sûr·e. Ici,
    l'intrus·e n'a jamais eu root, ce qui rendait un nettoyage ciblé
    raisonnable.

    DOCUMENTATION
    - crontab : https://man7.org/linux/man-pages/man5/crontab.5.html
    - ssh-keygen (-l) : https://man.openbsd.org/ssh-keygen
    - gpg --verify : https://www.gnupg.org/documentation/manuals/gnupg/Operational-GPG-Commands.html
    - NIST SP 800-61r2, éradication et reprise : https://csrc.nist.gov/pubs/sp/800/61/r2/final
