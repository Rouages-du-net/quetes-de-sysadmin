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

## Le plan du réseau (onglet « Réseau » de la carte ; voir src/moteur/plan.ts)

carte-onglet-lieux = Lieux
carte-onglet-reseau = Réseau
plan-legende = Le réseau tel que l'équipe l'a prévu, comme sur le schéma affiché au mur : ce qui devrait être, pas forcément ce qui est. Pour le vérifier : ip a, ip route, ping, wg show… Les liens en pointillés passent par un tunnel WireGuard.
plan-version-texte = Le plan en liste
plan-internet = Internet
plan-ton-poste = ton poste
plan-ici = tu es ici
plan-visite = déjà connecté·e
plan-pas-visite = pas encore connecté·e
plan-tunnel = par le tunnel WireGuard
plan-dhcp = DHCP
plan-reseau-interne = réseau interne
plan-note-passerelle = passerelle
plan-note-wiki = wiki
plan-note-archives = sauvegardes
plan-note-hebergeur = hébergeur du site
plan-note-routeur = routeur
# { $id } : le numéro du VLAN ; { $nom } : son nom dans la configuration (bureaux, invites…).
plan-vlan = VLAN { $id } · { $nom }
plan-note-teletravail = télétravail
plan-annexe = routeur de l'Annexe
plan-note-annexe = second site
plan-reseau-annexe = réseau de l'Annexe

## Ma progression (voir src/moteur/progression.ts)

# Le titre du carnet quand on a donné son nom.
carnet-titre-de = Le carnet de { $nom }
progression-bouton = Ma progression
progression-titre = Ma progression
progression-intro = Ta progression reste dans ce navigateur. Pour continuer sur une autre machine (une autre salle de TP, chez toi), emporte-la avec le code ou le fichier. Rien n'est envoyé nulle part.
progression-nom = Ton nom (facultatif)
progression-nom-aide = Il s'inscrit en tête de ton carnet (« Le carnet de… ») et dans tes sauvegardes.
progression-code-titre = Le code, à recopier
progression-code-aide = Il contient les chapitres terminés, rien d'autre : ni le carnet, ni les clés que tu as créées. Note-le, puis tape-le sur l'autre machine.
progression-copier = Copier
progression-code-saisie = Reprendre avec un code :
progression-reprendre = Reprendre
progression-fichier-titre = Le fichier, pour tout emporter
progression-fichier-aide = Chapitres, carnet, clés créées, config ssh, records du mode examen. Garde-le sur une clé USB ou envoie-le-toi.
progression-telecharger = Télécharger ma sauvegarde
progression-fichier-saisie = Reprendre avec un fichier :
progression-nom-fichier = quetes-de-sysadmin.json
progression-telechargee = Sauvegarde téléchargée.
# { $nombre } : les chapitres terminés dans le fichier.
progression-confirmer = Reprendre cette sauvegarde ({ $nombre ->
        [one] { $nombre } chapitre terminé
       *[other] { $nombre } chapitres terminés
    }) ? Elle remplacera tout ce qui est gardé dans ce navigateur.
progression-rien-de-neuf = Ce code n'ajoute aucun chapitre à ceux que tu as déjà terminés ici.
progression-code-illisible = Ce n'est pas un code de progression : il commence par QDS, suivi de groupes de lettres et de chiffres.
progression-code-faute = Ce code contient une faute de frappe : vérifie-le, caractère par caractère.
progression-code-trop-recent = Ce code vient d'une version plus récente du jeu : recharge la page.
progression-fichier-illisible = Ce fichier n'est pas une sauvegarde lisible (JSON).
progression-fichier-autre = Ce fichier n'est pas une sauvegarde de Quêtes de Sysadmin.
progression-fichier-trop-recent = Cette sauvegarde vient d'une version plus récente du jeu : recharge la page.

## La mission, la barre de touches, Ctrl-R

mission-bouton = Mission
# { $chapitre } : « Chapitre 2 » ; { $titre } : son titre.
mission-titre = { $chapitre } : { $titre }
mission-consignes = Les consignes
mission-journal = Ce qui s'est passé
mission-rien = Rien encore : l'histoire avance à mesure que tu agis.
touches-titre = Touches du terminal
touche-haut = Commande précédente
touche-bas = Commande suivante
# Ce qu'affiche bash pendant Ctrl-R (en anglais, comme readline).
recherche-historique = (reverse-i-search)`{ $motif }': { $commande }

## Succès et grades (voir src/moteur/succes.ts)

succes-titre = Succès
# { $obtenus } sur { $total } : le compte affiché sur le lien.
succes-bouton = Succès ({ $obtenus }/{ $total })
# Annoncé dans le terminal quand un succès est obtenu.
succes-obtenu = 🏆 Succès : { $nom }
succes-grade = Ton grade : { $grade }.
succes-grade-suivant = Prochain grade, { $grade }, à { $chapitres } chapitres terminés.
succes-le = (le { $date })
succes-cache = Succès caché
    .description = Un clin d'œil à la culture du terminal. À toi de le trouver.
carnet-grade = Grade : { $grade }.
grade-stagiaire = Stagiaire
grade-apprenti = Apprenti·e sysadmin
grade-junior = Admin junior
grade-admin = Admin système
grade-confirme = Admin confirmé·e
grade-senior = Admin senior
grade-sre = SRE (ingénieur·e fiabilité)
succes-premiere-commande = Premier pas
    .description = Lancer une première commande.
succes-manuel = Lire le manuel
    .description = Ouvrir le manuel (man ou apropos) : le premier réflexe des pros.
succes-cache-ls = Ce qui est caché
    .description = Montrer les fichiers cachés (ls -a).
succes-tube = Premier tube
    .description = Relier deux commandes par un tube (|).
succes-redirection = Dans le fichier
    .description = Envoyer la sortie d'une commande dans un fichier (> ou >>).
succes-premier-chapitre = Premier chapitre
    .description = Terminer un chapitre.
succes-effaceur = L'Effaceur arrêté
    .description = Terminer l'histoire de l'Effaceur.
succes-restauration = Restauration testée
    .description = Restaurer une sauvegarde pour de vrai : une sauvegarde qu'on n'a jamais restaurée n'en est pas une.
succes-reseau = Toute la Ruche
    .description = Terminer La Ruche : VLAN, DHCP, pare-feu, VPN, annuaire et Wi-Fi.
succes-trois-histoires = Trois histoires
    .description = Terminer trois histoires.
succes-toutes-histoires = Le grand tour
    .description = Terminer toutes les histoires.
succes-cinquante-commandes = Boîte à outils
    .description = Avoir 50 commandes dans son carnet.
succes-examen = Examen passé
    .description = Terminer un chapitre en mode examen.
succes-examen-eclair = Éclair
    .description = Terminer un chapitre en mode examen en moins de 5 minutes.
succes-xyzzy = Mot magique
    .description = Le mot de passe de la Colossal Cave Adventure (1976), l'un des premiers jeux d'aventure en texte.
succes-sandwich = Avec les droits
    .description = Avec sudo, on obtient tout, même un sandwich (xkcd 149).
succes-sl = Locomotive
    .description = sl au lieu de ls : la faute de frappe la plus célèbre, punie par un train.

## Indices gradués (voir src/moteur/indices.ts ; les indices eux-mêmes : indices-<histoire>.ftl)

indice-titre = Besoin d'aide ?
indice-intro = Trois niveaux, à ouvrir l'un après l'autre : le manuel d'abord, comme au travail. Le débrief dira combien tu en as demandé.
indice-bouton-manuel = Le manuel
indice-bouton-piste = Une piste
indice-bouton-solution = Presque la réponse
# { $pages } : « man mv, man cp ».
indice-manuel = Les pages à lire : { $pages }. Cherche aussi avec man -k et un mot-clé.
indice-plus-rien = Plus d'indice pour ce chapitre : relis les consignes et ce qui s'est passé.
indice-debrief = { $nombre ->
        [one] Un indice demandé pour ce chapitre. La prochaine fois, sans ?
       *[other] { $nombre } indices demandés pour ce chapitre. La prochaine fois, avec moins ?
    }
succes-sans-indice = Sans filet
    .description = Terminer un chapitre sans demander d'indice.

## Le tableau de classe (page des enseignant·es ; voir src/moteur/classe.ts)

classe-fichiers = Les fichiers de sauvegarde des élèves :
classe-glisser = Ou glisse-les ici, plusieurs à la fois.
classe-codes = Ou leurs codes, un par ligne, précédés du nom :
classe-codes-exemple = Lina QDS-047G-0000-000M-G
classe-codes-ajouter = Ajouter les codes
classe-exporter = Télécharger le tableau (CSV)
classe-vider = Vider le tableau
classe-nom-fichier = tableau-de-classe.csv
classe-tableau = La classe
classe-compte = { $nombre ->
        [0] Aucun élève pour l'instant.
        [one] Un élève.
       *[other] { $nombre } élèves.
    }
# { $source } : le fichier ou la ligne ; { $raison } : ce qui ne va pas.
classe-erreur = { $source } : { $raison }
classe-col-eleve = Élève
classe-col-chapitres = Chapitres
classe-col-grade = Grade
classe-col-succes = Succès
classe-col-examen = Meilleur examen
classe-col-date = Sauvegarde
