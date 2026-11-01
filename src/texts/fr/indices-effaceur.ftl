### Indices gradués de L'Effaceur (voir src/engine/hints.ts) : un message
### par étape, indice-<chapitre>-<événement>, avec .piste (une direction, sans
### la commande exacte) et .solution (presque la réponse : la commande, avec
### ce qu'elle fait). Les noms des lieux sont ceux de noms.ftl.

## Chapitre 1 — L'Île du Phare

indice-eveil-crabe =
    .piste = La consigne de la SalleDExercice (à l'École des signaux, sur la Colline) demande de ranger le crabe. Ranger, c'est déplacer : quelle commande déplace un objet dans un lieu ?
    .solution = Depuis la SalleDExercice : mv crabe Seau (puis ls Seau pour vérifier).
indice-eveil-filet =
    .piste = Le filet bloque la porte du Phare, au bout de la Jetee. Il suffit de le déplacer ailleurs, dans un lieu qui peut le ranger.
    .solution = Depuis ta maison : mv Jetee/filet Port/Hangar
indice-eveil-lumiere =
    .piste = Il faut une ampoule dans la Lanterne, en haut du Phare. Une ampoule de secours existe, mais elle est cachée : ls -a montre les fichiers dont le nom commence par un point. Et mv sait aussi renommer.
    .solution = Depuis ta maison : mv Port/Remise/.ampoule_de_secours Jetee/Phare/Escalier/Lanterne/ampoule

## Chapitre 2 — Le Bourg

indice-bourg-levain =
    .piste = Le boulanger veut trois levains, sans perdre l'original. Une copie, c'est un nouvel objet identique.
    .solution = Dans la Boulangerie : cp levain levain_2 puis cp levain levain_3
indice-bourg-engrenage =
    .piste = L'artisane de l'Atelier a besoin d'engrenages, et il n'y en a aucun. touch crée un fichier vide.
    .solution = Dans l'Atelier : touch engrenage
indice-bourg-engrenages =
    .piste = Il en faut cinq en tout pour remettre l'horloge en marche : un original et des copies.
    .solution = Dans l'Atelier : cp engrenage engrenage_2, puis _3, _4 et _5.
indice-bourg-barricade =
    .piste = Une barricade bloque la Cour, dans la Ruelle. Trop lourde pour mv. Que reste-t-il, pour un objet dont personne n'a plus besoin ?
    .solution = Dans la Ruelle : rm barricade (attention, rm ne passe par aucune corbeille : c'est définitif).
indice-bourg-rats =
    .piste = Les rats de l'Egout gardent la Galerie. Ce qu'ils aiment se vend au Marche. Le fromage du Marche ne s'efface pas, mais il se copie.
    .solution = Dans l'Egout (Ruelle/Cour/Egout) : cp ~/Marche/fromage .
indice-bourg-nour-sans-classe =
    .piste = Nour est au bout de la Galerie, derrière les rats. Lis ce qu'elle a à dire.
    .solution = cat ~/Ruelle/Cour/Egout/Galerie/nour.txt
indice-bourg-classe =
    .piste = L'Effaceur a effacé la Classe de l'École. Un lieu, c'est un dossier : quelle commande crée un dossier ?
    .solution = mkdir ~/Ecole/Classe
indice-bourg-nour =
    .piste = La Classe est là ? Retourne voir Nour : elle t'attend pour rentrer.
    .solution = cat ~/Ruelle/Cour/Egout/Galerie/nour.txt

## Chapitre 3 — La Racine

indice-racine-alerte =
    .piste = Commence par lire le fichier d'arrivée, dans ta maison.
    .solution = cat arrivee.txt
indice-racine-protege =
    .piste = L'Effaceur efface tes souvenirs parce qu'il a le droit d'écrire dans ce dossier. ls -l montre les droits : r, w et x, pour toi, ton groupe et les autres.
    .solution = chmod o-w souvenirs (les autres ne peuvent plus écrire dans le dossier)
indice-racine-corrige =
    .piste = La configuration de l'Effaceur vise le mauvais lieu, à cause d'une espace en trop. Une version corrigée t'attend, mais /etc appartient à root : il faut sudo, et son mot de passe se cache dans ton journal (grep sait chercher un mot).
    .solution = grep "mot de passe" journal.txt, puis sudo cp ~/effaceur.conf.corrige /etc/effaceur.conf

## Chapitre 4 — La Sauvegarde

indice-sauvegarde-copie =
    .piste = Copie tes souvenirs sur le disque de sauvegarde, avec rsync. Attention à la barre finale : avec elle, rsync copie le CONTENU du dossier.
    .solution = rsync -av ~/souvenirs/ /mnt/sauvegarde/souvenirs/
indice-sauvegarde-fin =
    .piste = Une sauvegarde doit se refaire toute seule chaque nuit : c'est le travail de cron (crontab -e). Puis, au matin, vérifie qu'on sait restaurer ce qui a été effacé.
    .solution = Dans crontab -e : 15 3 * * * rsync -a ~/souvenirs/ /mnt/sauvegarde/souvenirs/ — puis, le matin : rsync -av /mnt/sauvegarde/souvenirs/premiere-lettre.txt ~/souvenirs/
