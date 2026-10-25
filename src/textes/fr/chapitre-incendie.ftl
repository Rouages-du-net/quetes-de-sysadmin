### Histoire « Le Datacenter », chapitre 4 « Le grand incendie » :
### reconstruire un serveur à partir des sauvegardes. Les commandes, les
### chemins, les noms de fichiers et les messages d'apt, de nginx et de tar
### ne se traduisent pas. Les pages HTML du site (incendie-site-*) sont
### celles de la médiathèque : elles se traduisent.

chapitre-incendie = Le grand incendie
    .resume = Le datacenter a brûlé : repartir d'une machine vide avec les sauvegardes, apt, tar et nginx -t.

## Fichiers

incendie-courriel-awa =
    De :     Awa (responsable d'exploitation)
    À :      toi
    Objet :  Incendie au datacenter : on reconstruit

    Cette nuit, vers 0 h 47, un incendie s'est déclaré dans le datacenter de
    notre hébergeur. Personne n'est blessé. Mais la salle de notre serveur a
    brûlé : le serveur, ses disques, et tout ce qu'il y avait dessus.

    L'hébergeur nous a livré ce matin une machine neuve : une Debian toute
    propre, avec le même nom et la même adresse IP (il l'a basculée sur la
    nouvelle machine). Ton compte y est, avec ton mot de passe habituel
    (bienvenue-2026). Rien d'autre : ni nginx, ni le site.

    Heureusement, nos sauvegardes partent chaque nuit vers un autre
    datacenter, dans une autre ville. L'hébergeur les a montées sur
    /mnt/sauvegarde. Mon plan de reprise y est aussi : PRA.txt.

    Je suis sur place avec les pompiers. Remets le site de la médiathèque en
    ligne, et dis-moi ce qu'on a perdu.
incendie-pra =
    PLAN DE REPRISE (PRA) — SITE DE LA MÉDIATHÈQUE
    À suivre si le serveur est perdu : on repart d'une machine neuve.

    Sauvegardé chaque nuit à 0 h 30, dans un autre datacenter :
      /etc/nginx/sites-available/mediatheque   le site, pour nginx
      /etc/nginx/sites-enabled/mediatheque     le même, activé
      /etc/nginx/bloques.conf                  les adresses bloquées
      /var/www/mediatheque/                    les pages

    Une archive par nuit : /mnt/sauvegarde/mediatheque-AAAA-MM-JJ.tar.gz

    Les chemins y sont enregistrés depuis la racine, sans le / du début.

    1. Installer nginx (paquet Debian).
    2. Vérifier l'archive AVANT de l'extraire : la lister en entier.
    3. L'extraire à sa place, depuis la racine.
    4. Vérifier la configuration de nginx, puis la recharger.
    5. Tester avec curl, en demandant le site par son nom.

    Le détail de chaque commande est dans son manuel (man apt, man tar,
    man nginx, man curl).

## Le site de la médiathèque (pages restaurées)

incendie-site-index-1 =
    <!DOCTYPE html>
    <html lang="fr">
    <head><meta charset="utf-8"><title>Médiathèque du quartier</title></head>
    <body>
    <h1>Médiathèque du quartier</h1>
    <p>Ouverte du mardi au samedi, de 10 h à 18 h.</p>
    <p>Le catalogue en ligne revient bientôt.</p>
    </body>
    </html>
incendie-site-index-2 =
    <!DOCTYPE html>
    <html lang="fr">
    <head><meta charset="utf-8"><title>Médiathèque du quartier</title></head>
    <body>
    <h1>Médiathèque du quartier</h1>
    <p>Ouverte du mardi au samedi, de 10 h à 18 h.</p>
    <p>Vacances de la Toussaint : ouverture exceptionnelle le dimanche 25 octobre, de 14 h à 17 h.</p>
    <p>Le catalogue en ligne revient bientôt.</p>
    </body>
    </html>
incendie-site-index-3 =
    <!DOCTYPE html>
    <html lang="fr">
    <head><meta charset="utf-8"><title>Médiathèque du quartier</title></head>
    <body>
    <h1>Médiathèque du quartier</h1>
    <p>Ouverte du mardi au samedi, de 10 h à 18 h.</p>
    <p>Vacances de la Toussaint : ouverture exceptionnelle le dimanche 25 octobre, de 14 h à 17 h.</p>
    <p>Jeudi 29 octobre, 18 h : rencontre avec une autrice de bande dessinée.</p>
    <p>Le catalogue en ligne revient bientôt.</p>
    </body>
    </html>
incendie-site-horaires =
    <!DOCTYPE html>
    <html lang="fr">
    <head><meta charset="utf-8"><title>Horaires — Médiathèque du quartier</title></head>
    <body>
    <h1>Horaires</h1>
    <p>Du mardi au samedi, de 10 h à 18 h. Fermée le dimanche et le lundi.</p>
    </body>
    </html>

## Événements

incendie-evenement-liste-vide =
    Une machine neuve ne connaît encore aucun paquet : sa liste des paquets
    disponibles est vide. Il faut d'abord la télécharger depuis les dépôts
    Debian. Le manuel dit comment : man apt.
incendie-evenement-nginx =
    nginx est installé, et il tourne déjà : sur Debian, installer un service
    le démarre et l'active. Essaie curl http://localhost : c'est la page de
    bienvenue de nginx. Le serveur web est là ; reste le site.
incendie-evenement-tronquee =
    « Fin de fichier inattendue » : l'archive de cette nuit est coupée.
    La sauvegarde a démarré à 0 h 30 ; à 0 h 47, le feu a pris, et l'envoi
    s'est arrêté au milieu. Regarde sa taille avec ls -l, à côté des autres.

    tar lit ce qui précède la coupure, puis s'arrête : extraite, cette
    archive rendrait la configuration, mais aucune page du site. Une sauvegarde qu'on n'a jamais relue n'est qu'un espoir. Prends la
    dernière archive qui se lit jusqu'au bout.
incendie-evenement-mauvais-lieu =
    L'archive s'est extraite là où tu étais : dans ton dossier, et pas à la
    place des fichiers perdus. nginx ne les trouvera pas là. Relis man tar :
    une option permet de choisir le lieu où extraire. (Tu peux effacer ce
    qui a été extrait ici.)
incendie-evenement-doublon =
    nginx refuse la configuration : « a duplicate default server ». Deux
    sites veulent être le site par défaut du port 80 : celui de la
    médiathèque, restauré de la sauvegarde, et celui que Debian installe
    avec nginx, dans /etc/nginx/sites-enabled/. Sur l'ancien serveur, il n'y
    en avait qu'un. Lequel garder ? (man nginx, et nginx -t après chaque
    changement.)

    Bonne nouvelle : tant que la nouvelle configuration est refusée, nginx
    garde l'ancienne. Le serveur ne tombe pas.
incendie-evenement-mercredi =
    Le site répond… avec la page de mercredi : il manque les horaires des
    vacances, qu'Awa a ajoutés mercredi après-midi. Cette archive n'est pas
    la plus récente qui soit intacte.
incendie-evenement-fin =
    curl http://medialibrary.example répond : la médiathèque est de nouveau en
    ligne, sur une machine qui n'existait pas hier soir.

    Awa : « Merci. On a perdu la journée de jeudi : l'annonce de la rencontre
    de jeudi prochain était dans la sauvegarde de cette nuit, celle que le
    feu a coupée. Je la remettrai. Tout le reste est là, parce que les
    sauvegardes étaient AILLEURS. »

    Bravo ! Tu as terminé le chapitre 4 du Datacenter. (Un dernier chapitre
    t'attend, trois mois plus tard : Le certificat a expiré.)

    CE QUI S'EST PASSÉ
    Le feu a détruit le serveur et ses disques. Ce qui a sauvé le site : une
    sauvegarde chaque nuit, dans un autre datacenter, et un plan de reprise
    écrit à l'avance. La dernière archive, elle, a été coupée en pleine
    écriture : sans tar -tzf, on aurait restauré un site à moitié vide.

    Ce n'est pas de la fiction. Dans la nuit du 9 au 10 mars 2021, un
    incendie a détruit un bâtiment du datacenter d'OVHcloud à Strasbourg
    (SBG2). Des milliers de clients ont été touchés, et certains ont tout
    perdu : leurs sauvegardes étaient dans le même site que leurs serveurs.

    LA BONNE PRATIQUE
    - 3-2-1 : trois copies, sur deux supports, dont une loin (une autre ville,
      pas seulement un autre bâtiment).
    - Écrire le plan de reprise AVANT l'incendie, et l'essayer pour de vrai
      sur une machine vide.
    - Relire ses sauvegardes (tar -tzf) et surveiller leur taille : une
      archive coupée ressemble à une archive.
    - Décider à l'avance ce qu'on accepte de perdre (ici, une journée) et
      en combien de temps on doit repartir.
    - Une clé d'hôte SSH qui change : vérifier la nouvelle empreinte par un
      autre moyen avant de retirer l'ancienne (ssh-keygen -R).
    - sudo nginx -t avant chaque rechargement ; un seul default_server par
      port.

    LA DOCUMENTATION
    - apt : https://manpages.debian.org/trixie/apt/apt.8.en.html
    - nginx, la ligne de commande : https://nginx.org/en/docs/switches.html
    - nginx, le choix du site : https://nginx.org/en/docs/http/request_processing.html
    - GNU tar : https://www.gnu.org/software/tar/manual/
    - ssh-keygen : https://man.openbsd.org/ssh-keygen
