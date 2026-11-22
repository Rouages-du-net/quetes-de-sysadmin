### Histoire « La Chorale », chapitre « La Demande d'accès » : une
### choriste demande une copie de toutes les données que la chorale détient
### sur elle (article 15 du RGPD). psql (WHERE, --csv), grep -r, zgrep,
### find, cp. Les commandes, options, chemins et sorties ne sont pas
### traduits.

chapter-access-request = La Demande d'accès
    .summary = Une alto demande à la chorale une copie de tout ce qu'elle détient sur elle. Sa ligne dans la table des choristes, c'est le plus facile : retrouvez-la partout où le serveur la garde, et envoyez-lui tout, et rien sur les autres.

## Fichiers

access-request-message-amara =
    De : Amara (présidente)
    Lundi 17 mars, 18 h 40

    Re-bonjour,

    Priya Raman, une de nos altos, nous a écrit (son message est dans
    votre dossier personnel). C'est son droit, et nous avons un mois pour
    répondre.

    Pourriez-vous rassembler tout ce que le serveur détient sur elle dans
    /srv/choir/demandes-rgpd/priya-raman/ ? N'importe quel format, pourvu
    qu'elle puisse le lire ; je le lui enverrai par l'espace choristes avec
    un courrier. Seulement ses données, s'il vous plaît : rien sur les
    autres.

    Amara

access-request-request-priya =
    De : Priya Raman
    À : le bureau de la Chorale des Berges
    Dimanche 16 mars

    Cher bureau,

    En application de l'article 15 du RGPD, je souhaite recevoir une copie
    de toutes les données personnelles que la chorale détient sur moi, où
    qu'elles soient conservées, et savoir combien de temps vous les gardez.

    Rien ne va mal, j'adore chanter avec vous ! Je suis simplement
    curieuse, et je travaille dans la protection des données : j'aime
    appliquer ce que je prêche.

    Bien à vous,
    Priya Raman (alto)

## Événements

access-request-event-her-row =
    Voilà sa fiche dans la table des choristes : ses coordonnées. Mais une
    appli de choristes garde rarement une personne dans une seule table.
    Que contient d'autre la base (\dt), et quelles tables pointent vers
    elle, par son identifiant ou son adresse électronique ?
access-request-event-tables =
    Ses répétitions et ses cotisations sont à elle aussi : chaque ligne qui
    pointe vers son identifiant est une donnée la concernant. psql peut les
    écrire directement dans un fichier (redirigez sa sortie, ou --csv pour
    un tableur).
access-request-event-backups =
    La sauvegarde de la nuit contient encore ses données, comme toute
    sauvegarde. Vous ne lui envoyez pas les sauvegardes elles-mêmes (elles
    contiennent les données de tout le monde), mais la réponse doit dire
    qu'elles existent et combien de temps elles sont gardées : la politique
    dit trois mois.
access-request-event-uploads =
    Sa photo et son formulaire de consentement, dans les fichiers envoyés
    par les choristes (un dossier par identifiant). Ils sont à elle : des
    copies vont dans la réponse.
access-request-event-logs =
    Les journaux parlent d'elle aussi : le journal de sécurité de l'espace
    choristes (celui du mois, et celui du mois dernier, compressé : zgrep le
    lit), et le journal du courrier (les lettres d'information envoyées à
    son adresse). Ses lignes sont ses données ; les autres lignes ne le
    sont pas.
access-request-event-old-copy =
    Une copie oubliée : l'export de la chaîne téléphonique fait par Ruben
    en octobre dernier, avec son ancienne adresse. Une donnée qu'on ignorait
    avoir reste une donnée qu'on détient : elle va dans la réponse (sa
    ligne seulement), et ensuite le fichier n'a plus de raison d'exister.
access-request-event-members-only =
    La réponse contient sa fiche de la table des choristes, et rien
    d'autre. La table des choristes est un endroit parmi d'autres : ses
    répétitions, ses cotisations, la lettre d'information, ses fichiers, les
    journaux… Cherchez plus large : grep -r sur son adresse électronique,
    les tables de la base.
access-request-event-leak =
    La réponse contient des données d'autres choristes (une adresse
    électronique ou un numéro de téléphone qui n'est pas le sien) : un
    fichier copié en entier, une table sans WHERE, un journal sans grep.
    L'envoyer serait une violation de données à elle seule. Ne gardez que
    ses lignes.
access-request-event-incomplete =
    La réponse prend forme. Il manque encore : { $missing }.
access-request-part-member = sa fiche de la table des choristes
access-request-part-attendance = ses répétitions
access-request-part-payments = ses cotisations
access-request-part-newsletter = son inscription à la lettre d'information
access-request-part-photo = sa photo
access-request-part-consent = son formulaire de consentement
access-request-part-audit = ses lignes du journal de sécurité (les deux mois)
access-request-part-mail = ses lignes du journal du courrier
access-request-part-phone-tree = sa ligne du vieil export de la chaîne téléphonique
access-request-event-end =
    Amara : « J'ai tout relu avant de l'envoyer : je n'imaginais pas que
    nous en savions autant sur nos choristes. Priya a déjà répondu :
    "Impressionnant, et rien sur personne d'autre. Merci !" »

    Bravo ! Vous avez terminé La Demande d'accès.

    CE QUI S'EST PASSÉ
    Priya a exercé son droit d'accès. Ses données n'étaient pas seulement
    dans la table des choristes : ses répétitions et ses cotisations dans
    deux autres tables, la lettre d'information, sa photo et son formulaire
    de consentement dans les fichiers envoyés, ses lignes dans deux journaux
    (dont un compressé), et un export de la chaîne téléphonique avec son
    ancienne adresse dont personne ne se souvenait. Vous avez tout
    rassemblé, et seulement ce qui la concerne.

    BONNES PRATIQUES
    - Le droit d'accès (RGPD, article 15) couvre toutes les données
      détenues sur une personne, où qu'elles soient, et ce qu'on en fait,
      combien de temps, et qui les reçoit. La réponse est due sous un mois
      (article 12, 3).
    - Savoir où vivent les données personnelles avant qu'on le demande : un
      court inventaire (tables, fichiers, journaux, exports, sauvegardes)
      transforme une demande en une soirée de travail plutôt qu'en chasse
      au trésor.
    - Chercher par chaque identifiant : l'identifiant dans la base,
      l'adresse électronique dans les journaux, le téléphone dans un
      tableur.
    - Répondre à une personne, et seulement à elle : une table sans WHERE
      ou un journal entier dans la réponse est une violation des données de
      tous les autres.
    - Les exports oubliés sont la fuite classique : une fois la réponse
      envoyée, le fichier de la chaîne téléphonique doit partir.
    - Les sauvegardes contiennent les mêmes données : le dire, et combien
      de temps elles sont gardées, plutôt que de fouiller dedans.

    DOCUMENTATION
    - RGPD, articles 12 et 15 : https://eur-lex.europa.eu/eli/reg/2016/679/oj
    - La CNIL : https://www.cnil.fr/
    - psql : https://www.postgresql.org/docs/16/app-psql.html
    - gzip et zgrep : https://www.gnu.org/software/gzip/manual/gzip.html
