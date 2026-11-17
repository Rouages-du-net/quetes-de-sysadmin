### Histoire « Le traitement de nuit », chapitre « Code retour » :
### recompiler le traitement avec GnuCOBOL (copybooks, colonnes du format de
### référence, -x), le lancer et lire son code retour. Les commandes, chemins,
### messages du compilateur et sorties des programmes ne sont pas traduits.

chapter-return-code = Code retour
    .summary = Compiler le traitement COBOL avec cobc : trouver ses copybooks, mettre les lignes d'Ayesha dans les colonnes qu'attend COBOL, fabriquer un exécutable, puis lire ce que dit son code retour.

## Fichiers

return-code-email-ayesha =
    De :  Ayesha
    À :   toi

    Le fichier converti est prêt, merci. Maintenant, le traitement
    lui-même : le programme que faisait tourner le centre est un module
    chargeable pour son mainframe, il ne peut pas tourner ici. On le
    recompile à partir du source de Ramón, /opt/batch/src/contrib.cob, avec
    cobc (GnuCOBOL, déjà installé).

    Sur le mainframe, un·e opérateur·rice lisait chaque matin le journal du
    job et comparait les totaux avec l'enregistrement de fin. Ici, personne
    ne le fera. Alors j'ai ajouté une vérification à la fin du programme :
    si les totaux ne correspondent pas à l'enregistrement de fin, code
    retour 8. Mais cobc refuse mes lignes, et je ne vois pas pourquoi :
    elles ressemblent aux autres.

    Une fois qu'il compile, pourrais-tu le lancer sur le fichier de cette
    nuit (/srv/batch/in/contrib.dat), puis sur le fichier de test du centre
    (/srv/batch/in/test-bad.dat, il y manque un enregistrement exprès), et
    regarder le code retour à chaque fois ? Le programme prend deux
    arguments : le fichier à lire, et le relevé à écrire (dans
    /srv/batch/out, par exemple).

    Ayesha

## Événements

return-code-event-copy-missing =
    COPY CONTRIBA : cobc cherche le copybook dans le répertoire courant et
    dans les répertoires qu'on lui indique ; ceux de Ramón sont dans
    /opt/batch/copybooks. Dis à cobc où chercher (man cobc, -I).
return-code-event-indicator =
    « invalid indicator at column 7 » : le format de référence de COBOL
    vient de la carte perforée. Les colonnes 1 à 6 portent un numéro de
    séquence, la colonne 7 l'indicateur (* pour un commentaire, - pour une
    suite, une espace pour du code), et le texte du programme va de la
    colonne 8 (zone A : divisions, noms de paragraphes) ou 12 (zone B :
    instructions) jusqu'à la colonne 72. Les lignes d'Ayesha commencent en
    colonne 1 : leur 7e caractère est lu comme un indicateur. Compare-les
    avec les lignes de Ramón juste au-dessus.
return-code-event-free =
    -free passe cobc en format libre, sans colonnes : les numéros de
    séquence de Ramón (000100, 000200…) deviennent des erreurs de syntaxe.
    Le fichier est en format fixe : déplace plutôt les lignes d'Ayesha dans
    les bonnes colonnes.
return-code-event-module =
    Segmentation fault : sans -x, cobc fabrique un module (contrib.so), fait
    pour être chargé par un autre programme ou par cobcrun, pas pour être
    lancé directement. -x fabrique un exécutable.
return-code-event-not-defined =
    PERFORM CHECK-TOTALS appelle un paragraphe qui n'est plus là : les
    lignes d'Ayesha ont été retirées. Garde sa vérification, dans les
    bonnes colonnes.
return-code-event-unchecked =
    Ce contrib ne compare pas les totaux avec l'enregistrement de fin : la
    vérification d'Ayesha a été mise en commentaire ou retirée. Il compile,
    mais un fichier faux passerait avec le code retour 0.
return-code-event-compiled =
    Ça compile : un exécutable, avec la vérification d'Ayesha. Lance-le avec
    ses deux arguments (le fichier à lire, le relevé à écrire), puis regarde
    son code retour : echo $?
return-code-event-report =
    Code retour 0 : le relevé est écrit, 12 cotisations pour 515.20, comme
    l'enregistrement de fin. Un programme dit comment ça s'est passé par son
    code de sortie (RETURN-CODE en COBOL, $? dans le shell) : 0 veut dire
    que tout va bien.
return-code-event-passed-bad =
    Le fichier de test est passé avec le code retour 0, et pourtant il
    manque un enregistrement : ce contrib ne vérifie pas l'enregistrement de
    fin. La vérification d'Ayesha doit être compilée dedans.
return-code-event-rc =
    Code retour 8 : les totaux ne correspondent pas à l'enregistrement de
    fin (11 cotisations au lieu de 12). Sur le mainframe, l'étape suivante
    du job aurait été sautée (COND dans le JCL) ; ici, c'est à ce qui lance
    le programme de regarder son code.
return-code-event-end =
    Ayesha : « Code retour 8 sur le fichier de test du centre : ma
    vérification marche ! Et le relevé du 21 est identique à celui du
    mainframe. »

    Bravo ! Tu as terminé le chapitre « Code retour ».

    CE QUI S'EST PASSÉ
    Le programme lui-même n'a pas changé : le source de Ramón a compilé avec
    GnuCOBOL dès que cobc a su où étaient les copybooks (-I) et que les
    lignes d'Ayesha ont été dans les colonnes du format de référence (le
    code à partir de la colonne 8, la colonne 7 pour l'indicateur).
    Fabriqué avec -x, c'est un exécutable ; lancé sur les deux fichiers, il
    a dit comment chacun s'est passé par son code retour : 0, puis 8.

    BONNE PRATIQUE
    - Respecter le format dans lequel un source est écrit : en format fixe,
      les colonnes font partie du langage. Ne pas passer tout le fichier en
      -free pour contourner une ligne.
    - Garder les copybooks à un seul endroit et l'indiquer au compilateur
      (-I, ou COB_COPY_DIR).
    - Un programme de traitement par lots dit comment il s'est passé par
      son code retour : 0 tout va bien, 4 un avertissement, 8 une erreur, 12
      ou 16 pire (la convention du mainframe). Toujours le lire : echo $? à
      la main, et dans les scripts.

    UNE AUTRE FAÇON DE FAIRE
    cobc -x -I ../copybooks -o /opt/batch/bin/contrib contrib.cob l'installe
    là où le traitement le cherche. Un module (cobc -m, par défaut) se lance
    avec cobcrun, ou est appelé par un autre programme COBOL. GnuCOBOL peut
    aussi écrire le listing (-t) pour lire le programme avec ses copybooks
    dépliés.

    DOCUMENTATION
    - Manuel de GnuCOBOL (format de référence, COPY, options de cobc) : https://gnucobol.sourceforge.io/doc/gnucobol.html
    - Bash, paramètres spéciaux ($?) : https://www.gnu.org/software/bash/manual/html_node/Special-Parameters.html
