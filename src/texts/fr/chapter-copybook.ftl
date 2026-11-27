### Histoire « Le traitement de nuit », chapitre « Largeur fixe » : le
### fichier EBCDIC du centre de traitement, ses enregistrements de largeur fixe
### décrits par un copybook, et pourquoi ses montants condensés ne supportent
### pas une conversion de texte. Les commandes, chemins, descriptions
### d'enregistrements et sorties des programmes ne sont pas traduits.

chapter-copybook = Largeur fixe
    .summary = Le fichier de nuit du mainframe est arrivé sous Linux et ressemble à du charabia : lire ses octets, ses enregistrements et son copybook, et le convertir sans abîmer les montants.

## Partagé par l'histoire

night-batch-notes-ramon =
    Notes de Ramón - le traitement de nuit (job NIGHTLY), pour qui viendra après moi

    LE FICHIER. Chaque nuit, le centre de traitement envoie les cotisations
    du jour : /srv/drop/contrib.ebc. Il arrive du mainframe tel quel : en
    EBCDIC (page de code 037), des enregistrements fixes de 40 octets les
    uns derrière les autres, sans retour à la ligne (RECFM=FB, LRECL=40). La
    description est dans copybooks/CONTRIB.cpy : un en-tête (H), un
    enregistrement par cotisation (D), et un enregistrement de fin (T) qui
    donne le nombre de cotisations et leur total. Le vérifier à chaque fois.

    LES MONTANTS sont des décimaux condensés (COMP-3) : deux chiffres par
    octet, le signe dans le dernier demi-octet. 42,50 s'écrit 00 00 04 25 0C.

    LA CONVERSION. ebc2asc (dans bin/, son source dans src/) convertit
    champ par champ, en suivant le copybook. Il écrit le fichier ASCII que
    lit le traitement (copybooks/CONTRIBA.cpy, un enregistrement par ligne) :
        bin/ebc2asc FICHIER-EBCDIC FICHIER-ASCII

    LE TRAITEMENT. src/contrib.cob lit le fichier converti et écrit le
    relevé des prélèvements que la comptabilité envoie à la banque. Il se
    compile avec cobc (GnuCOBOL). Il n'a pas failli une seule fois en trente
    ans. Ce qui a failli, à chaque fois, c'est ce qu'il y a autour : un
    fichier qui n'est pas venu, venu deux fois, ou venu coupé.

    Ramón

## Fichiers

copybook-email-ayesha =
    De :  Ayesha
    À :   toi

    Bonjour, et merci de venir nous aider ! Depuis trente ans, les
    cotisations de nos adhérent·es sont encaissées par un programme COBOL
    qui tourne chaque nuit sur le mainframe d'un centre de traitement. Le
    centre ferme sa salle machines à la fin du mois : le traitement
    déménage ici, sur boulier.

    Ramón a écrit ces programmes en 1994 et part à la retraite vendredi. Il
    a tout laissé dans /opt/batch : ses notes (NOTES.txt), les copybooks (la
    description des enregistrements) et les sources. Le centre continuera
    de nous envoyer les cotisations du jour chaque nuit, dans /srv/drop ; le
    fichier de cette nuit y est, contrib.ebc.

    J'ai essayé de l'ouvrir : du charabia. Sur un forum, on conseille
    « iconv -f EBCDIC-US -t ASCII », mais ça s'arrête sur une erreur. Ramón a
    un convertisseur à lui, mais avant de lui faire confiance, j'aimerais
    qu'on comprenne ce qu'il y a dans ce fichier.

    Pourrais-tu mettre le fichier converti là où le traitement le lira,
    /srv/batch/in/contrib.dat, et remplir verification.txt ? On comparera
    cette nuit.

    Ayesha

copybook-check =
    Le fichier du centre de traitement du 21 novembre - vérifications avant la première nuit sous Linux

    Taille du fichier, en octets :
    Nombre d'enregistrements (un tous les 40 octets) :
    Cotisations (enregistrements de détail) :
    Total de contrôle (dans l'enregistrement de fin) :
    Montant de la première cotisation, ses 5 octets dans le fichier (hexa) :

## Événements

copybook-event-garbage =
    Des � et des @ partout : ce n'est pas du texte que ton terminal sait
    lire. Ses lettres sont en EBCDIC, le jeu de caractères du mainframe : un
    A majuscule est l'octet 0xC1, qui n'est pas de l'UTF-8 valide (�), et
    l'espace est 0x40, un @ en ASCII. Et il n'y a aucun retour à la ligne :
    les enregistrements se suivent. Regarde ses octets (od -c, xxd,
    hexdump -C) et sa taille (wc -c).
copybook-event-data =
    file répond « data » : aucun jeu de caractères qu'il connaisse. libmagic
    ne reconnaît pas l'EBCDIC ; le copybook et les notes de Ramón disent ce
    que c'est.
copybook-event-records =
    560 octets : 14 enregistrements de 40 octets (LRECL=40), un en-tête,
    douze cotisations et un enregistrement de fin. Une taille qui ne serait
    pas un multiple de la longueur d'enregistrement voudrait dire un
    fichier coupé.
copybook-event-bytes =
    Les octets tels quels. C8 est un H en EBCDIC, F0 à F9 sont les chiffres,
    40 est l'espace. Mais dans chaque enregistrement, les octets 34 à 38
    (CR-AMOUNT dans le copybook) ne sont pas des caractères du tout :
    00 00 04 25 0C, c'est 42,50 condensé (COMP-3), deux chiffres par octet et
    le signe à la fin (C : positif).
copybook-event-illegal =
    iconv s'arrête à la position 75 : le 36e octet du deuxième
    enregistrement, en plein dans son montant (octets 34 à 38). Cet octet,
    0x04, n'est pas un caractère : c'est la moitié d'un nombre condensé. Un
    jeu de caractères ne peut pas faire du texte avec ce qui n'en est pas.
copybook-event-text-converted =
    C'est passé, mais regarde les montants : une conversion de texte
    traite chaque octet comme un caractère. D'IBM037 vers UTF-8, l'octet
    0x25 (les chiffres 2 et 5 de 42,50) est devenu un retour à la ligne, et
    les enregistrements n'ont plus 40 octets ; avec dd conv=ascii, la
    longueur reste, mais 0x04 est devenu 0x9C : le montant est perdu. Seuls
    les champs de texte peuvent passer par une table ; les montants doivent
    être décondensés. Les notes de Ramón disent comment.
copybook-event-wrong-dat =
    /srv/batch/in/contrib.dat n'est pas ce qu'attend le traitement : 14
    lignes de 43 caractères, chaque montant décondensé avec son signe
    (+000004250). S'il sort d'iconv ou de dd, les montants ont été abîmés en
    route. Les notes de Ramón disent quel outil convertit champ par champ.
copybook-event-converted =
    contrib.dat est juste : 14 lignes, le texte en ASCII, chaque montant
    décondensé avec son signe (+000004250, c'est 42,50). La dernière ligne
    est l'enregistrement de fin : le nombre de cotisations et leur total de
    contrôle.
copybook-event-end =
    Ayesha : « Alors c'est ça qu'il y avait dedans ! Je comparerai tes
    chiffres avec ceux du centre cette nuit. Et je ne lui passerai plus
    iconv dessus. »

    Bravo ! Tu as terminé le chapitre « Largeur fixe ».

    CE QUI S'EST PASSÉ
    Le fichier du centre de traitement est le fichier du mainframe tel
    quel : de l'EBCDIC, des enregistrements fixes de 40 octets sans retour à
    la ligne, et des montants en décimal condensé. Tu l'as lu avec des
    outils qui montrent des octets plutôt que du texte (wc -c, od, xxd,
    hexdump), trouvé sa structure dans le copybook, et vu pourquoi une
    conversion de texte du fichier entier abîme les montants : iconv
    s'arrête dessus, ou change un de leurs octets en retour à la ligne ;
    dd conv=ascii les modifie sans rien dire. L'ebc2asc de Ramón convertit
    champ par champ : le texte par la table EBCDIC, les montants
    décondensés.

    BONNE PRATIQUE
    - Regarder les octets avant de croire le nom : file, wc -c, od -c, xxd.
    - Un fichier d'enregistrements se lit avec sa description (le
      copybook) : longueur d'enregistrement, type de chaque champ. La
      taille doit être un multiple de la longueur d'enregistrement.
    - Ne jamais faire passer des champs binaires (COMP-3, COMP) par une
      conversion de texte : convertir champ par champ, ou demander à
      l'expéditeur un fichier tout en texte (montants en DISPLAY, signe
      séparé).
    - Vérifier avec l'enregistrement de fin : le nombre d'enregistrements
      et le total de contrôle sont là pour ça.

    UNE AUTRE FAÇON DE FAIRE
    Quand le fichier est tout en texte (pas de COMP-3), dd conv=ascii cbs=80
    convertit des enregistrements fixes et ajoute un retour à la ligne
    après chacun ; iconv -f IBM037 fait de même caractère par caractère.
    Certains outils de transfert (le FTP en mode ASCII depuis le mainframe)
    convertissent en route, ce qui est tout aussi dangereux pour les champs
    condensés : transférer en binaire, convertir à l'arrivée.

    DOCUMENTATION
    - iconv(1) : https://man7.org/linux/man-pages/man1/iconv.1.html
    - dd, conv=ascii : https://www.gnu.org/software/coreutils/manual/html_node/dd-invocation.html
    - od : https://www.gnu.org/software/coreutils/manual/html_node/od-invocation.html
    - GnuCOBOL, USAGE COMP-3 : https://gnucobol.sourceforge.io/doc/gnucobol.html
