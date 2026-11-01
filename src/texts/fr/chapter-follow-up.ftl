### Histoire « L'Audit », chapitre « La contre-visite » : refaire le balayage et
### passer Lynis pour prouver que les correctifs tiennent, durcir ce qui vaut
### l'effort, écrire le rapport de clôture. Les commandes, les options, les
### chemins et les sorties de nmap et de Lynis (en anglais) ne se traduisent
### pas. Les titres de section du modèle (contre-visite-section-…) doivent
### rester ceux du modèle.

chapter-follow-up = La contre-visite
    .summary = Prouver que les correctifs tiennent : nouveau balayage, audit Lynis, durcissement raisonné, et le rapport de clôture.

## Fichiers

follow-up-email-salome =
    De :     Salomé (auditrice)
    À :      toi
    Objet :  Audit du Fournil — la contre-visite

    Bonjour,

    Les quatre parties du rapport sont traitées : bravo. Avant de clore, je fais
    ce que je fais toujours : la contre-visite. On ne dit pas « c'est corrigé »,
    on le montre.

    Ce que j'attends, dans cet ordre :
    1. Refais l'inventaire, comme au premier jour : nmap -sV sur le serveur
       (et seulement sur lui, rappelle-toi la lettre de mission). Que voit-on
       d'internet maintenant ?
    2. Passe Lynis sur le serveur (man lynis). Il ne corrige rien : il dit ce
       qu'il trouve, et à toi de décider. Les avertissements d'abord ; parmi les
       suggestions, celles qui valent l'effort (certaines demandent un vrai
       chantier : on les met au rapport, on ne les installe pas en urgence).
    3. Corrige, et prouve : un indice de durcissement d'au moins 70, sans aucun
       avertissement, et un nouveau balayage qui montre les versions à jour.
    4. Écris le rapport de clôture dans rapport-cloture.md. Je le relis à chaque
       enregistrement.

    Salomé
    (Pour sudo, ton mot de passe est toujours : farine-2028)

follow-up-template =
    # Rapport de clôture — Le Fournil

    ## Résumé
    (à compléter : en deux phrases, où en est la sécurité du serveur)

    ## Constats corrigés
    (à compléter : un point par constat des parties 1 à 4 : SSH, compte oublié, sudo, secret, exposition, clé et cron de l'intrus)

    ## Preuves
    (à compléter : le nouveau balayage nmap et l'indice de durcissement Lynis, avec leurs chiffres)

    ## Reste à faire
    (à compléter : ce qui n'est pas corrigé et pourquoi, avec les identifiants Lynis)

follow-up-section-resume = Résumé
follow-up-section-constats = Constats corrigés
follow-up-section-preuves = Preuves
follow-up-section-reste = Reste à faire
follow-up-a-complete = (à compléter

## Mots que la relecture cherche (séparés par des virgules, sans tenir compte des majuscules)

follow-up-words-hint = indice, durcissement, index, hardening
follow-up-words-ssh = ssh, root
follow-up-words-account = lucas, compte
follow-up-words-sudo = sudo, nopasswd
follow-up-words-secret = .env, secret
follow-up-words-network = ufw, pare-feu, redis, firewall
follow-up-words-key = clé, cle, cron

## Relecture

follow-up-review = Salomé relit ton rapport :
follow-up-missing-template = Il reste des lignes « (à compléter) » du modèle.
follow-up-missing-summary = Le résumé tient en deux phrases, mais il en faut (un peu plus qu'un mot).
follow-up-missing-findings = Dans « Constats corrigés », il manque des constats : reprends les parties 1 à 4 (SSH, le compte oublié, sudo, le secret, l'exposition réseau, la clé et la tâche cron de l'intrus), au moins cinq sur six.
follow-up-missing-lynis = Il faut d'abord lancer Lynis : sans audit, pas de chiffre à citer.
follow-up-missing-proofs = Dans « Preuves », cite l'indice de durcissement de ton dernier audit Lynis (le chiffre exact) et ce que montre ton dernier balayage (les ports 22, 80 et 443).
follow-up-missing-rest = Dans « Reste à faire », cite au moins un constat Lynis encore ouvert avec son identifiant (comme FINT-4350) : un rapport honnête dit ce qui n'est pas fait.

## Événements

follow-up-event-error-ssh =
    Il y a une erreur dans la configuration de SSH ! Avant de recharger, vérifie
    toujours avec  sudo sshd -t  : il donne le fichier et la ligne en cause.
follow-up-event-locked-out =
    ATTENTION : avec la configuration que sshd vient de charger, une nouvelle
    connexion de ton compte serait refusée. Ta session reste ouverte : corrige
    AVANT de te déconnecter.
follow-up-event-outside-scope =
    Tu as sondé une adresse hors de la lettre de mission ({ $addresses }). Même pour
    une contre-visite, on reste dans le périmètre : { $neighbour ->
        [oui] le serveur du voisin n'est toujours pas à nous.
       *[non] ce qui n'y figure pas n'est pas à nous.
    }
# { $outdated } : « oui » si la version de SSH affichée n'est pas à jour
follow-up-event-scan =
    Voilà ce que voit internet maintenant. Compare avec le premier jour : les
    ports 5432 (PostgreSQL) et 6379 (Redis) ne répondent plus, il reste SSH, le
    site et son port sécurisé. Les correctifs de pare-feu tiennent.
    { $outdated ->
        [oui] Mais regarde la version de SSH : elle n'est pas celle d'une machine à jour. Une mise à jour de sécurité attend (apt list --upgradable) ; c'est le genre de détail que nmap -sV révèle et que personne ne regarde.
       *[non] Et la version de SSH est celle d'une machine à jour.
    }
follow-up-event-lynis =
    Voilà l'audit : un indice de durcissement de { $hint }, et
    { $warnings } avertissement(s). Un indice sert à comparer, pas à
    viser 100 : lis chaque suggestion, son identifiant (SSH-7408…) et sa page
    d'explication. Certaines se corrigent ici ; d'autres (intégrité des
    fichiers, antimalware, journaux distants, auditd) sont de vrais chantiers
    qu'on met au rapport.

    L'audit est gardé dans /var/log/lynis-report.dat : un  sudo grep
    suggestion  dessus donne la liste d'un coup.
follow-up-event-update =
    Plus de mise à jour de sécurité en attente : l'avertissement de Lynis
    (PKGS-7392) a disparu, et la version de SSH que nmap affichera sera la
    nouvelle. (Pense à relancer nmap et Lynis : un correctif non prouvé n'est
    qu'une intention.)
follow-up-event-ssh-a-reload =
    Tu as modifié la configuration de SSH, mais sshd tourne encore avec
    l'ancienne : un service relit sa configuration quand on le lui demande
    (sudo sshd -t pour vérifier, puis sudo systemctl reload ssh). Lynis, lui,
    lit le fichier : son nouvel indice ne dit pas ce qui est appliqué.
# { $target } : l'indice à atteindre
follow-up-event-hardened =
    Aucun avertissement et un indice d'au moins { $target }, avec une
    configuration de SSH appliquée. C'est un bon niveau pour ce serveur ; le
    reste est de l'ordre du chantier, pas de l'urgence.

    Prouve-le : relance Lynis, et refais le balayage.
follow-up-event-proof-lynis =
    Le dernier audit Lynis reflète l'état actuel de la machine : sans
    avertissement, et au-dessus de la cible. Note le chiffre de l'indice : le
    rapport le cite.
follow-up-event-nmap-own =
    Le dernier balayage ne voit que SSH, le site et son port sécurisé, avec la
    version de SSH à jour. C'est la preuve, côté internet, que tout tient.
    Reste le rapport de clôture.
# { $mistake } : « oui » si un balayage a débordé du périmètre
follow-up-event-end =
    Salomé : « C'est complet, et c'est honnête. Je le transmets à Nadia et à son
    assureur. Je repasserai dans six mois : la sécurité, ça se revérifie. »

    Bravo ! Tu as terminé le chapitre « La contre-visite », et l'histoire
    « L'Audit ».

    CE QUI S'EST PASSÉ
    Tu as refait le balayage de ports, passé Lynis, appliqué les mises à jour et
    durci ce qui vaut l'effort, puis refait les deux pour le prouver. Le nouvel
    indice et le nouveau balayage sont dans ton rapport, avec ce qui reste à
    faire. Une contre-visite ne cherche pas à tout corriger : elle montre ce qui
    est corrigé, et dit franchement ce qui ne l'est pas.
    { $mistake ->
        [oui] Ton balayage a aussi touché une adresse qui n'était pas dans la lettre de mission : à noter pour la prochaine mission.
       *[non] Tous tes balayages sont restés dans le périmètre.
    }

    LA BONNE PRATIQUE
    - Prouver, pas affirmer : le même outil, la même commande, avant et après.
    - Lynis donne un indice, pas une note à maximiser : des suggestions
      valent un après-midi, d'autres un projet. Le rapport hiérarchise.
    - Un avertissement (warning) se traite avant les suggestions.
    - Après un changement de configuration, appliquer (reload) ET vérifier
      (nmap, lynis, sshd -T) : le fichier n'est pas le service.
    - La version affichée par un service est une preuve (nmap -sV) : une mise à
      jour de sécurité se voit de l'extérieur.
    - Un rapport honnête liste ce qui reste : un risque connu et accepté vaut
      mieux qu'un risque ignoré.

    UNE AUTRE VOIE
    OpenSCAP ou les benchmarks du CIS (Center for Internet Security) font un
    travail voisin de Lynis avec une grille de référence précise : on les
    utilise quand un contrat ou une norme demande de prouver sa conformité.
    Un scanner de vulnérabilités (OpenVAS, Nessus) croise, lui, les versions
    avec des bases de failles connues, ce que nmap -sV ne fait pas.

    LA DOCUMENTATION
    - Lynis : https://cisofy.com/documentation/lynis/
    - Les contrôles de Lynis : https://cisofy.com/lynis/controls/
    - nmap : https://nmap.org/book/man.html
    - sshd_config : https://man.openbsd.org/sshd_config
    - Guides d'hygiène et d'audit des autorités nationales : l'ANSSI (France, cyber.gouv.fr), le BSI (Allemagne, bsi.bund.de), le NCSC (Royaume-Uni, ncsc.gov.uk), le CCN-CERT (Espagne, ccn-cert.cni.es), le CCB (Belgique, ccb.belgium.be), le NCSC (Suisse, ncsc.admin.ch), la CISA (États-Unis, cisa.gov)
