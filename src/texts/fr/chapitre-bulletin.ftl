### Histoire « La Veille », chapitre « Le bulletin » : trier les CVE d'un
### bulletin de sécurité hebdomadaire, dire lesquelles concernent vraiment ce
### serveur. Les identifiants de CVE sont fictifs (CVE-2099-NNNNN, de la
### forme des vraies) ; les noms de paquets, les commandes et les chemins ne
### se traduisent pas. Les titres de section du modèle (bulletin-section-…)
### doivent rester ceux du modèle.

chapter-bulletin = Le bulletin
    .resume = Trier un bulletin de CVE : ce qui concerne vraiment ce serveur, et ce qui n'est qu'une fausse alerte.

## Fichiers

bulletin-email-salome =
    De :     Salomé
    À :      toi
    Objet :  La veille, six mois après

    Bonjour !

    Ça fait six mois depuis l'audit. L'activité a grandi : vous avez migré
    sur un nouveau serveur (petrin), et Nadia m'a redemandée, pas pour tout
    revérifier cette fois, mais pour t'aider à prendre une habitude : la
    veille de sécurité. Je ne reviendrai pas tous les six mois pour toujours
    tout vérifier à ta place.

    Chaque semaine, une liste de diffusion que je suis (comme les avis de
    sécurité Debian) envoie un bulletin des failles corrigées récemment.
    Celui de cette semaine est dans ton dossier : bulletin-securite.txt.

    Première règle, et la plus importante : une ligne du bulletin n'est une
    alerte QUE si elle concerne ce serveur précisément. Avant de t'inquiéter
    pour une CVE, vérifie :
    - le paquet est-il seulement installé ici ? (apt list --installed)
    - si oui, la version installée est-elle dans la plage touchée, ou
      déjà au-delà de la version corrigée ?

    Trie ce que tu trouves dans veille.md : ce qui concerne ce serveur d'un
    côté, ce qui n'a pas lieu de t'inquiéter de l'autre (avec pourquoi).

    Salomé
    (Pour sudo, ton mot de passe est : levain-2028)

bulletin-file =
    BULLETIN DE SÉCURITÉ — semaine du 8 septembre 2028
    (CVE fictives, à but pédagogique : aucune n'existe réellement)

    CVE-2099-41042 — nginx                                        [élevé, 8.2]
    Contournement des restrictions d'accès par confusion de requêtes HTTP/2.
    Un serveur en reverse proxy peut laisser passer une requête vers un
    chemin normalement protégé.
    Versions touchées : nginx < 1.26.3-3+deb13u3
    Corrigé dans :      nginx 1.26.3-3+deb13u3

    CVE-2099-37715 — rsync                                        [critique, 9.8]
    L'extraction d'une archive construite pour l'occasion peut exécuter du
    code arbitraire avec les droits du compte qui lance rsync.
    Versions touchées : rsync < 3.4.1+ds1-5
    Corrigé dans :      rsync 3.4.1+ds1-5

    CVE-2099-50288 — python3-certbot-nginx                        [moyen, 5.3]
    Pendant le renouvellement d'un certificat, la clé de compte reste
    brièvement lisible par tous les comptes du système (une fraction de
    seconde, le temps d'une écriture de fichier).
    Versions touchées : python3-certbot-nginx < 3.5.0

    CVE-2099-12003 — curl                                         [moyen, 6.1]
    En suivant une redirection avec un en-tête construit pour l'occasion,
    curl peut lire au-delà de la zone mémoire prévue (déni de service).
    Versions touchées : curl ≤ 8.14.1-2
    Corrigé dans :      curl 8.14.1-3

    CVE-2099-29107 — openssh-server                                [moyen, 5.9]
    Canal auxiliaire temporel dans l'authentification « keyboard-interactive »
    (KbdInteractiveAuthentication) : le temps de réponse du serveur peut
    laisser deviner des informations sur un mot de passe en cours de
    vérification. Aucun correctif Debian pour l'instant ; en attendant,
    désactiver KbdInteractiveAuthentication dans sshd_config.
    Versions touchées : openssh-server (toutes, si l'option est activée)

bulletin-template =
    # Veille — Le Fournil

    ## Concerne ce serveur
    (à compléter : les CVE qui s'appliquent vraiment, avec leur identifiant)

    ## Sans objet
    (à compléter : les CVE qui ne s'appliquent pas, avec leur identifiant et pourquoi)

bulletin-section-concerne = Concerne ce serveur
bulletin-section-sansobjet = Sans objet
bulletin-a-complete = (à compléter
bulletin-words-missing = n'est pas installé, pas installé, non installé, absent, aucun paquet, n'existe pas sur ce serveur
bulletin-words-fixed = déjà corrigé, déjà à jour, version installée, au-delà de la version corrigée, supérieure à la version corrigée, plus récente

## Relecture

bulletin-review = Salomé relit ton tri :
bulletin-missing-template = Il reste des lignes « (à compléter) » du modèle.
bulletin-missing-concerns = Sous « Concerne ce serveur », il doit y avoir exactement nginx, rsync et openssh-server (celle-ci s'applique, même si elle ne demande rien de plus ici) — ni certbot ni curl, qui n'ont rien à faire là.
bulletin-missing-not-applicable = Sous « Sans objet », explique pourquoi pour chacune : certbot (regarde s'il est seulement installé) et curl (compare la version installée à la version corrigée du bulletin).

## Événements

bulletin-event-read =
    Cinq lignes, cinq CVE. Avant de rien corriger : lesquelles concernent
    VRAIMENT ce serveur ? apt list --installed te dit ce qui est posé ici,
    et avec quelle version (man apt).
bulletin-event-sort =
    Ton tri distingue ce qui mérite qu'on s'en occupe de ce qui n'a pas lieu
    d'inquiéter : certbot n'est pas sur ce serveur, curl est déjà au-delà de
    la version corrigée. Il reste nginx, rsync, et openssh-server (déjà
    protégé par la configuration, mais à garder à l'œil).
bulletin-event-end =
    Salomé : « Voilà le bon réflexe : lire avant de s'affoler. La moitié
    d'un bulletin de sécurité, en général, ne te concerne pas. »

    Bravo ! Tu as terminé le chapitre « Le bulletin ».

    CE QUI S'EST PASSÉ
    Un bulletin de sécurité liste des failles corrigées dans des logiciels
    largement utilisés ; la plupart ne concernent pas un serveur donné (le
    paquet n'y est pas, ou la version installée n'est pas dans la plage
    touchée). Trier avant d'agir évite de paniquer pour rien, et garde
    l'attention pour ce qui compte vraiment.

    LA BONNE PRATIQUE
    - Vérifier l'installation ET la version avant de retenir une CVE
      (apt list --installed, jamais seulement le nom du paquet).
    - Une CVE qui s'applique en théorie peut déjà être sans effet grâce à
      une configuration déjà prudente (ici, KbdInteractiveAuthentication).
    - Garder une trace écrite du tri : la prochaine veille s'appuiera
      dessus, et une autre personne doit pouvoir la relire.

    UNE AUTRE VOIE
    De grandes organisations utilisent un scanner de vulnérabilités (OpenVAS,
    Nessus, ou le Lynis déjà vu dans « L'Audit ») qui croise automatiquement
    les versions installées avec une base de CVE : cela retire une partie du
    travail manuel de ce chapitre, sans retirer la décision de ce qui vaut la
    peine d'être corrigé.

    LA DOCUMENTATION
    - Avis de sécurité Debian : https://www.debian.org/security/
    - CVE : https://www.cve.org/
    - CVSS (le calcul du score) : https://www.first.org/cvss/calculator/4-0
