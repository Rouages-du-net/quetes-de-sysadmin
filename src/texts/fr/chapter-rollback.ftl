### Histoire « La Gazette », chapitre 2 « Le retour arrière » : une version
### par dossier, un lien current, revenir en arrière avec ln -sfn, et des
### tests avant de mettre en ligne. Les commandes, chemins et messages de
### git, ln, nginx et sh ne se traduisent pas.

chapter-rollback = Le retour arrière
    .summary = Une mise en ligne qui casse le site : revenir à la version d'avant en un instant, puis faire passer des tests avant chaque publication.

## Fichiers

rollback-message-samia =
    Un message de Samia, lundi 21 h 02 :

    « Au secours ! Le site affiche une erreur depuis que Théo a poussé sa
    nouvelle mise en page, et la lettre d'information part demain matin
    avec un lien vers la Gazette.

    Depuis la semaine dernière, le crochet du serveur
    (/srv/git/gazette.git/hooks/post-receive) publie chaque push dans son
    propre dossier, /srv/gazette/releases/, puis fait pointer le lien
    /srv/gazette/current vers la nouvelle version. nginx sert current.
    Les anciennes versions sont donc toujours là…

    Dans l'ordre :
      1. remets le site en état, tout de suite ;
      2. fais en sorte que ça ne puisse plus arriver : j'ai écrit tests.sh
         (dans le dépôt), mais personne ne le lance avant de publier ;
      3. puis publie la mise en page de Théo, réparée.

    Pour sudo : gazette-2027. »
rollback-hook-comment = Publie chaque push dans un nouveau dossier de releases/, puis bascule le lien current.
rollback-hook-echo = Version $VERSION en ligne
rollback-tests =
    #!/bin/sh
    # Vérifications avant publication (Samia).
    # À lancer depuis le dossier du site : sh tests.sh
    set -e
    echo "Vérification de la page d'accueil (index.html)..."
    test -f index.html
    grep -q "<title>" index.html
    echo "Vérification de l'agenda (agenda.html)..."
    test -f agenda.html
    echo "Tests OK"

## Le site

rollback-site-index =
    <!DOCTYPE html>
    <html lang="fr">
    <head><meta charset="utf-8"><title>La Gazette du quartier</title><link rel="stylesheet" href="style.css"></head>
    <body>
    <h1>La Gazette du quartier</h1>
    <p>Les nouvelles de la rue, par celles et ceux qui y vivent.</p>
    <ul>
    <li><a href="fete-des-voisins.html">La fête des voisins, côté cour</a></li>
    <li><a href="agenda.html">L'agenda du mois</a></li>
    </ul>
    </body>
    </html>
rollback-site-welcome =
    <!DOCTYPE html>
    <html lang="fr">
    <head><meta charset="utf-8"><title>La Gazette du quartier</title><link rel="stylesheet" href="style.css"></head>
    <body>
    <header><h1>La Gazette du quartier</h1><p>Les nouvelles de la rue, par celles et ceux qui y vivent.</p></header>
    <section class="lead">
    <h2><a href="fete-des-voisins.html">À la une : la fête des voisins, côté cour</a></h2>
    </section>
    <nav><a href="agenda.html">L'agenda du mois</a></nav>
    </body>
    </html>
rollback-commit-3 = Titre : Gazette, sans faute
rollback-commit-4 = Agenda : le vide-grenier est le 12 juin
rollback-commit-5 = Ajout de tests.sh : vérifications avant publication
rollback-commit-6 = Nouvelle mise en page de l'accueil
# { $number } : le numéro de l'essai
rollback-commit-theo = Nouvelle mise en page, essai { $number }

## Événements

# { $output } : ce que git a affiché à Théo (lignes en retrait)
rollback-theo-push =
    Théo, depuis chez lui : « Je retente ma mise en page… » Il pousse
    (toujours sans index.html). Voici ce que git lui répond :

    { $output }
rollback-event-failure =
    403 Forbidden : nginx sert /srv/gazette/current, mais n'y trouve pas de
    page d'accueil (index.html). Regarde ce que vise current (ls -l
    /srv/gazette, ou readlink), et ce qu'il y a dans chaque version de
    releases/. La version d'avant est intacte : il suffit que current la
    désigne de nouveau (man ln).
rollback-event-without-n =
    Le nouveau lien a été créé DANS la version cassée (ls -l
    /srv/gazette/releases/20270517203012) : current vise un lieu, alors ln
    est entré dedans au lieu de remplacer le lien. C'est l'option -n qui
    traite current comme un simple fichier : ln -sfn cible current.
rollback-event-restored =
    Le site répond de nouveau. Samia : « Ouf ! Et ça a pris une seconde :
    l'ancienne version n'avait jamais été effacée, on a juste changé de
    lien. Maintenant, que ça ne se reproduise plus : le crochet doit lancer
    tests.sh sur la nouvelle version, et ne pas basculer current si les
    tests échouent. » (Regarde le crochet, et man sh.)
rollback-event-safeguard =
    Le push de Théo est arrivé sur le serveur, mais ses tests ont échoué et
    le crochet s'est arrêté avant de basculer current : le site n'a pas
    bougé. C'est le rôle d'un garde-fou. Reste à publier sa mise en page
    pour de bon : récupère ses commits (git pull), mets la page au bon nom,
    commit et push.
rollback-event-safeguard-pierced =
    Le push cassé de Théo est passé en ligne malgré tout : le crochet n'a
    pas arrêté la publication. Rétablis le site, puis regarde le crochet :
    les tests sont-ils lancés AVANT de basculer current, depuis le dossier
    de la nouvelle version, et un échec arrête-t-il le script (set -e,
    ou || exit 1) ? Théo réessaiera dès que le crochet changera.
rollback-event-tests-elsewhere =
    La dernière version contient bien index.html, mais elle n'a pas été mise
    en ligne : ses tests ont échoué quand même. tests.sh cherche index.html
    dans le lieu d'où on le lance. D'où le crochet le lance-t-il ? (Un
    crochet démarre dans le dépôt, /srv/git/gazette.git ; cd change de lieu.)
rollback-event-end =
    La nouvelle mise en page est en ligne, publiée par le crochet après ses
    tests. Samia : « Cette fois, une erreur dans le dépôt ne peut plus
    casser le site. Et si une version passe les tests mais nous déplaît, on
    sait revenir en arrière en une seconde. »

    Bravo ! Tu as terminé le chapitre 2 de La Gazette. (La suite t'attend :
    ssh gazette.)

    CE QUI S'EST PASSÉ
    Chaque publication va dans son propre dossier ; le lien current
    désigne celle qui est en ligne. Revenir en arrière, c'est changer de
    lien : ln -sfn remplace le lien d'un coup (sans -n, ln entre dans le
    lieu visé). Puis le crochet a appris à lancer les tests sur la nouvelle
    version AVANT de basculer, et à s'arrêter s'ils échouent : une version
    cassée arrive sur le serveur, mais jamais en ligne.

    LA BONNE PRATIQUE
    - Garder les versions précédentes ; on bascule, on ne recopie pas.
    - Un retour arrière doit être une seule commande, essayée à l'avance.
    - Tester avant de mettre en ligne (intégration continue), et arrêter
      tout au premier échec : set -e, ou commande || exit 1.
    - post-receive ne peut plus refuser le push (il est déjà reçu) ; pour
      refuser les commits eux-mêmes, c'est pre-receive.
    - Faire le ménage des vieilles versions de temps en temps (en garder
      quelques-unes).

    LA DOCUMENTATION
    - ln (coreutils) : https://www.gnu.org/software/coreutils/manual/html_node/ln-invocation.html
    - Les crochets de git : https://git-scm.com/docs/githooks
    - dash, le /bin/sh de Debian : https://manpages.debian.org/bookworm/dash/dash.1.en.html
