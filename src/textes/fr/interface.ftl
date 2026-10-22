### Interface du jeu : choix des histoires et des chapitres, terminal,
### progression. Une phrase entière par message ; variables entre { }.

histoires-titre = Histoires
# { $histoire } : titre de l'histoire
chapitres-titre = Chapitres de « { $histoire } »
chapitre-numero = Chapitre { $numero }
chapitre-titre-complet = { $histoire } — chapitre { $numero } : { $titre }
etat-histoire-terminee = ✓ Terminée
etat-chapitres-faits =
    { $faits ->
        [one] { $faits } chapitre
       *[other] { $faits } chapitres
    } sur { $total }
etat-chapitre-termine = ✓ Terminé
etat-verrouille = 🔒 Termine le chapitre précédent
etat-cle-manquante = 🔒 Verrouillée
cle-aide = 🔑 Les histoires grisées s'ouvrent quand tu termines La Racine (L'Effaceur, chapitre 3) : tu reçois alors la clé de leurs machines.
bouton-suivant = Chapitre suivant →
bouton-recommencer = Recommencer ce chapitre
astuces = Astuces : Tab complète les noms, ↑ rappelle les commandes, « aide » liste celles que tu connais, « man commande » ouvre le manuel, « exit » ramène à ton poste. Comme dans la plupart des terminaux Linux, sélectionner du texte le copie et le clic droit le colle. Ta progression est gardée dans ce navigateur.
# { $lignes } : nombre de lignes non affichées
sortie-coupee =
    { $lignes ->
        [one] (… { $lignes } ligne plus haut, non affichée)
       *[other] (… { $lignes } lignes plus haut, non affichées)
    }
poste-titre = Ton poste
saisie-etiquette = Commande
credit = Quêtes de Sysadmin, jeu libre (GPL v3, textes CC BY-SA 4.0), inspiré de Terminus, créé au MIT par Shawn Conrad et Michele Pratusevich.
credit-lien-projet = Le projet
credit-lien-original = Terminus (en anglais)

## Le carnet du sysadmin

carnet-titre = Le carnet du sysadmin
# { $nombre } : le nombre de commandes notées
carnet-compte = { $nombre ->
    [0] (vide)
    [one] ({ $nombre } commande)
   *[other] ({ $nombre } commandes)
}
carnet-aide = Chaque commande que tu lances pour la première fois s'ajoute ici, avec ce qu'elle fait et la ligne que tu as tapée. Ton aide-mémoire, à emporter.
carnet-vide = Rien encore : lance une commande (ls, par exemple), elle viendra s'inscrire ici.
carnet-exporter = Télécharger (Markdown)
carnet-copier = Copier
carnet-copie = Copié dans le presse-papiers.
carnet-copie-impossible = Ce navigateur refuse l'accès au presse-papiers : utilise plutôt le téléchargement.
# Le nom du fichier téléchargé : sans espace ni caractère difficile.
carnet-fichier = carnet-du-sysadmin.md
# En tête du fichier Markdown. { $nombre } : le nombre de commandes
carnet-markdown-intro = { $nombre ->
    [one] Une commande apprise en jouant à Quêtes de Sysadmin.
   *[other] { $nombre } commandes apprises en jouant à Quêtes de Sysadmin.
}
carnet-progression = Progression
carnet-progression-vide = Aucun chapitre terminé pour l'instant.
# { $histoire } : le titre de l'histoire ; { $faits } et { $total } : chapitres terminés et en tout
carnet-progression-histoire = { $histoire } : { $faits ->
    [one] { $faits } chapitre terminé
   *[other] { $faits } chapitres terminés
} sur { $total }
# { $chapitre } : le titre du chapitre où la commande a servi la première fois
carnet-decouverte = Découverte dans « { $chapitre } ».
# { $commande } : la commande qui ouvre le manuel (man ls)
carnet-manuel = Pour aller plus loin : { $commande }

## Liens vers Les rouages du net (après un chapitre)

rouages-intro = Pour comprendre ce qui se passe sous le capot, sur Les rouages du net :
rouages-lien-entree-nom = « De l'Entrée à la page » : le nom devient une adresse (DNS)
rouages-lien-entree-box = « De l'Entrée à la page » : ta box et ton réseau local
rouages-lien-entree-liaison = « De l'Entrée à la page » : ouvrir la liaison (TCP, ports)
rouages-lien-entree-cadenas = « De l'Entrée à la page » : le cadenas (TLS, certificats)
rouages-lien-entree-voyage = « De l'Entrée à la page » : le voyage des paquets
rouages-lien-entree-serveur = « De l'Entrée à la page » : le serveur répond
rouages-lien-ordinateur-binaire = « Comment marche un ordinateur » : tout est nombre
rouages-lien-ordinateur-memoire = « Comment marche un ordinateur » : la mémoire
rouages-lien-glossaire-ttl = Glossaire : TTL
rouages-lien-glossaire-port = Glossaire : port
rouages-lien-glossaire-nat = Glossaire : NAT
rouages-lien-glossaire-routeur = Glossaire : routeur
rouages-lien-glossaire-commutateur = Glossaire : commutateur
rouages-lien-glossaire-hebergeur = Glossaire : hébergeur
rouages-lien-glossaire-chiffrement = Glossaire : chiffrement
rouages-lien-glossaire-autorite-certification = Glossaire : autorité de certification
rouages-lien-glossaire-code-http = Glossaire : code HTTP
rouages-lien-glossaire-requete = Glossaire : requête
rouages-lien-glossaire-datacenter = Glossaire : datacenter
rouages-lien-glossaire-octet = Glossaire : octet

## Le mode examen

examen-case = Mode examen : sans indice, avec un chrono (le chapitre recommence)
# { $temps } : le temps écoulé, en minutes:secondes
examen-chrono = ⏱ { $temps }
examen-debut = Mode examen : aucun indice ne s'affichera, le chrono tourne. Ta mission est dans le message d'accueil (relis-le avec cat). Le débrief viendra à la fin. Pour repartir de zéro, machine et chrono : « Recommencer ce chapitre », sous le terminal.
# { $temps } : le temps de cette partie ; { $record } : le meilleur temps de ce navigateur
examen-fini = Examen réussi en { $temps }. Ton meilleur temps sur ce chapitre : { $record }.
examen-fini-record = Examen réussi en { $temps } : c'est ton meilleur temps sur ce chapitre.

## La carte (un bouton à côté du terminal ; voir src/moteur/carte.ts)

carte-bouton = Carte
# { $machine } : le nom de la machine où l'on est (royaume, poste…).
carte-titre = Carte de { $machine }
carte-legende = Les lieux (dossiers) que tu connais sur cette machine : ceux où tu es entré·e, et en italique ceux que tu as seulement aperçus. Les fichiers n'y sont pas : pour eux, ls.
carte-ici = ← tu es ici
carte-maison = ta maison, ~
carte-ferme = fermé pour l'instant
carte-apercu = pas encore visité
carte-fermer = Fermer
