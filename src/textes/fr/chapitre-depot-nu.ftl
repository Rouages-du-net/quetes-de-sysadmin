### Histoire « La Gazette », chapitre 1 « Le dépôt nu » : déployer un site
### avec git push, un dépôt nu et un crochet post-receive. Les commandes,
### chemins et messages de git, nginx et diff ne se traduisent pas.

chapitre-depot-nu = Le dépôt nu
    .resume = Publier le site du journal avec git push : un dépôt nu sur le serveur, un crochet post-receive, et plus de retouche à la main.

## Fichiers

depot-nu-message-de-samia =
    Un message de Samia, rédactrice en chef de La Gazette du quartier :

    « Bienvenue à la Gazette ! Notre site (curl http://gazette.example) est
    servi par nginx depuis /var/www/gazette. Jusqu'ici, chacun·e y copiait
    ses fichiers à la main… et la semaine dernière, un article a été écrasé
    par une vieille version.

    Le site est déjà suivi par git, dans ~/gazette. À partir de maintenant,
    on ne publie plus que par git :
      - un dépôt sur le serveur : /srv/git/gazette.git (un dépôt « nu ») ;
      - dès qu'on y pousse des commits (git push), le site se met à jour tout
        seul.

    Mon article sur la fête des voisins est prêt dans ~/gazette, mais pas
    encore en ligne. Tout est dans man git. Pour sudo : gazette-2027. »
depot-nu-mot-de-theo =
    Un mot de Théo, le stagiaire :

    « Encore désolé pour l'article écrasé ! Au fait : j'ai corrigé une faute
    dans le titre du site, directement dans /var/www/gazette/index.html.
    Je n'ai pas eu le temps de la mettre dans git… »

## Le site (HTML ; { $date } : AAAA-MM-JJ, { $jour } : le jour du mois)

depot-nu-titre-faute = La Gazzette du quartier
depot-nu-site-index-v1 =
    <!DOCTYPE html>
    <html lang="fr">
    <head><meta charset="utf-8"><title>La Gazzette du quartier</title><link rel="stylesheet" href="style.css"></head>
    <body>
    <h1>La Gazzette du quartier</h1>
    <p>Les nouvelles de la rue, par celles et ceux qui y vivent.</p>
    <ul>
    <li><a href="agenda.html">L'agenda du mois</a></li>
    </ul>
    </body>
    </html>
depot-nu-site-index-theo =
    <!DOCTYPE html>
    <html lang="fr">
    <head><meta charset="utf-8"><title>La Gazette du quartier</title><link rel="stylesheet" href="style.css"></head>
    <body>
    <h1>La Gazette du quartier</h1>
    <p>Les nouvelles de la rue, par celles et ceux qui y vivent.</p>
    <ul>
    <li><a href="agenda.html">L'agenda du mois</a></li>
    </ul>
    </body>
    </html>
depot-nu-site-index-v2 =
    <!DOCTYPE html>
    <html lang="fr">
    <head><meta charset="utf-8"><title>La Gazzette du quartier</title><link rel="stylesheet" href="style.css"></head>
    <body>
    <h1>La Gazzette du quartier</h1>
    <p>Les nouvelles de la rue, par celles et ceux qui y vivent.</p>
    <ul>
    <li><a href="fete-des-voisins.html">La fête des voisins, côté cour</a></li>
    <li><a href="agenda.html">L'agenda du mois</a></li>
    </ul>
    </body>
    </html>
depot-nu-site-article =
    <!DOCTYPE html>
    <html lang="fr">
    <head><meta charset="utf-8"><title>La fête des voisins, côté cour</title><link rel="stylesheet" href="style.css"></head>
    <body>
    <h1>La fête des voisins, côté cour</h1>
    <p>Trois tables, deux guitares et un gâteau à la pistache : vendredi soir,
    la cour du 12 a fait la fête jusqu'à la nuit. Par Samia.</p>
    </body>
    </html>
depot-nu-site-agenda =
    <!DOCTYPE html>
    <html lang="fr">
    <head><meta charset="utf-8"><title>L'agenda du mois</title><link rel="stylesheet" href="style.css"></head>
    <body>
    <h1>L'agenda du mois</h1>
    <p>Vide-grenier de la rue : samedi <time datetime="{ $date }">{ $jour } juin</time>, de 8 h à 18 h.</p>
    </body>
    </html>
depot-nu-commit-1 = Première version du site
depot-nu-commit-2 = Article : la fête des voisins

## Événements

depot-nu-evenement-derive =
    Voilà la correction de Théo : « Gazzette » devenu « Gazette », dans la
    copie du serveur seulement. Elle n'est pas dans git : si tu déploies
    ~/gazette tel quel, elle disparaîtra. Mieux vaut la reporter d'abord dans
    ~/gazette/index.html, puis git commit.
depot-nu-evenement-droits =
    Le dépôt a été créé avec sudo : il appartient à root, et git push, lancé
    en ton nom, n'a pas le droit d'y écrire. Regarde ls -l /srv/git : à qui
    devrait-il appartenir ? (man chown)
depot-nu-evenement-sans-crochet =
    Le dépôt du serveur a bien reçu tes commits (git log --oneline dans
    /srv/git/gazette.git), mais le site n'a pas bougé : rien ne les extrait
    dans /var/www/gazette. C'est le rôle d'un crochet, hooks/post-receive,
    lancé après chaque réception (man git).
depot-nu-evenement-crochet-ignore =
    Le push est passé, mais git n'a pas lancé le crochet : il n'est pas
    exécutable (ls -l /srv/git/gazette.git/hooks). Un crochet est un
    programme ; voir man chmod.
depot-nu-evenement-non-suivis =
    git refuse d'écraser des fichiers qu'il ne connaît pas dans
    /var/www/gazette : ils ont été posés à la main, et il ne veut rien
    perdre. Avec -f (force), il les remplace. Avant de forcer, regarde ce
    que tu perdrais : diff -r ~/gazette /var/www/gazette.
depot-nu-evenement-correction-perdue =
    La correction de Théo a disparu du site : le déploiement a remplacé
    index.html par celui de git, qui ne l'avait pas. Désormais, ce qui
    n'est pas dans git n'existe pas. Refais la correction dans ~/gazette
    (« Gazzette » devient « Gazette », deux fois dans index.html), puis
    commit et push.
depot-nu-evenement-en-ligne =
    Samia : « Mon article est en ligne, et la faute du titre a disparu,
    merci ! Une petite chose : dans agenda.html, le vide-grenier est le
    samedi 12 juin, pas le 21. La date est écrite deux fois : dans le texte
    et dans datetime="2027-06-21". Tu corriges, et tu publies comme il se
    doit ? »
depot-nu-evenement-a-la-main =
    La date est corrigée sur le serveur, mais pas dans git : c'est
    exactement ce qu'on voulait arrêter. Au prochain push, la correction
    serait écrasée. Corrige-la dans ~/gazette, puis commit et push.
depot-nu-evenement-fin =
    Le site est à jour, et il ne se modifie plus qu'avec git push. Samia :
    « Plus personne n'écrase le travail des autres. Et si une publication
    tourne mal, l'historique est là. »

    Bravo ! Tu as terminé le chapitre 1 de La Gazette.

    CE QUI S'EST PASSÉ
    Le site vivait dans un dossier modifié à la main : impossible de savoir
    qui avait changé quoi, et une copie pouvait en écraser une autre. Un
    dépôt nu (git init --bare) n'a pas de copie de travail : il ne sert qu'à
    recevoir des push. Son crochet post-receive, un script lancé après
    chaque réception, extrait le dernier commit dans le dossier du site
    (git --work-tree=… checkout -f). Ce qui n'était que sur le serveur (la
    correction de Théo) devait d'abord entrer dans git.

    LA BONNE PRATIQUE
    - Une seule source : le dépôt. On ne modifie jamais le site sur le
      serveur ; diff -r pour repérer ce qui a dérivé avant de basculer.
    - Le dépôt du serveur appartient au compte qui pousse (ou à un groupe,
      avec git init --bare --shared=group).
    - Un crochet est un programme : chmod +x, et il commence par #!/bin/sh.
    - Le déploiement doit être reproductible : le même commit donne le même
      site.

    LA DOCUMENTATION
    - Git sur le serveur : https://git-scm.com/book/fr/v2/Git-sur-le-serveur-Mise-en-place-du-serveur
    - Les crochets de git : https://git-scm.com/docs/githooks
    - --work-tree : https://git-scm.com/docs/git
