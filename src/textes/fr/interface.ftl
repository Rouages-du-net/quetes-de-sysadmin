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
# { $chapitres } : les titres des chapitres qui restent à finir (liste mise en forme)
etat-cle-apres = 🔒 Après { $chapitres }
# { $titre } : le titre d'un chapitre, dans la liste ci-dessus
etat-cle-chapitre = « { $titre } »
cle-aide = 🔑 Les histoires grisées s'ouvrent peu à peu : chacune dit sous son nom les chapitres à finir avant d'en recevoir la clé. Les premières s'ouvrent après La Racine (L'Effaceur, chapitre 3).
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
## Le menu des histoires : deux vues
vue-titre = Présentation des histoires
vue-reseau = Carte du réseau
vue-baies = Baies
vue-internet = Internet
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
# La confirmation, quand un chapitre est en cours (le mode examen le fait recommencer).
examen-confirmer-titre = Passer en mode examen ?
examen-confirmer-texte = Le chapitre en cours va recommencer depuis le début, sur une machine neuve : ce que tu y as déjà fait sera perdu. Les chapitres terminés restent acquis.
examen-confirmer = Recommencer en mode examen
examen-quitter-titre = Quitter le mode examen ?
examen-quitter-texte = Le chapitre en cours va recommencer depuis le début, avec les indices : ce que tu y as déjà fait sera perdu. Les chapitres terminés restent acquis.
examen-quitter = Recommencer sans le mode examen
examen-annuler = Annuler
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
# Pendant tail -f ou journalctl -f : le bouton qui fait Ctrl-C.
suivi-arreter = Arrêter (Ctrl-C)
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
## Le bilan de fin de chapitre (voir src/moteur/bilan.ts)
# { $temps } : « 6:12 » ; { $commandes }, { $erreurs }, { $indices } : des nombres
bilan-resume = Bilan : { $temps } · { $commandes ->
        [one] une commande
       *[other] { $commandes } commandes
    }{ $erreurs ->
        [0] {""}
       *[other] {" "}(dont { $erreurs } en erreur)
    } · { $indices ->
        [0] aucun indice
        [one] un indice
       *[other] { $indices } indices
    }
bilan-bouton = Voir le détail
# { $chapitre } : le titre du chapitre
bilan-titre = Bilan : { $chapitre }
bilan-intro = Ta commande à côté de la solution de référence, étape par étape. Le jeu vérifie l'état de la machine, pas la commande tapée : une autre façon de faire est tout aussi juste si elle arrive au même résultat.
bilan-col-etape = Étape
bilan-col-toi = Ta commande
bilan-col-reference = La solution de référence
bilan-autrement = (passée autrement)
bilan-encourager = { $indices ->
        [0] Sans indice : bravo. Rejoue-le en mode examen pour battre ton temps ?
       *[other] La prochaine fois, avec moins d'indices ?
    }
## L'instantané de secours (panneau Mission ; voir Console.restaurer)
secours-titre = Instantané de secours
secours-intro = Comme l'instantané d'une machine virtuelle avant une opération risquée : prends-en un, tente ta manœuvre, et reviens-y si ça tourne mal. Le chapitre est rejoué jusqu'à ce point, sans rien perdre d'autre.
secours-prendre = Prendre un instantané
secours-revenir = Revenir à l'instantané
secours-annuler = Annuler la dernière saisie
secours-aucun = Pas encore d'instantané dans ce chapitre.
# { $pas } : le nombre de saisies (commandes, réponses, enregistrements de nano) depuis le début du chapitre
secours-pris = { $pas ->
        [0] Instantané pris au début du chapitre.
        [one] Instantané pris après une saisie.
       *[other] Instantané pris après { $pas } saisies.
    }
secours-impossible = Pas d'instantané possible ici : le chapitre a été repris ou on est passé par le poste. « Recommencer ce chapitre » repart de zéro.
secours-examen = Pas d'instantané en mode examen.
secours-restaure = { $pas ->
        [0] ↺ Machine remise comme au début du chapitre.
        [one] ↺ Machine remise comme après la première saisie du chapitre.
       *[other] ↺ Machine remise comme après { $pas } saisies du chapitre.
    }
## Les parcours thématiques (menu « Parcours » ; voir src/moteur/parcours.ts)
vue-parcours = Parcours
parcours-choix = Choisir un parcours
parcours-debuter = Premiers pas
    .description = Se déplacer, lire, chercher, ranger, puis le réseau, git et les archives : pour qui n'a jamais ouvert un terminal.
parcours-securite = Protéger un serveur
    .description = SSH, pare-feu, fail2ban, comptes et droits, secrets, mises à jour, puis l'audit de clôture : fermer les portes, garder la maison en ordre, et le prouver.
parcours-web = Servir le web
    .description = nginx, journaux, sauvegardes d'urgence, certificats, sites partagés, trafic et proxy.
parcours-reseau = Les réseaux
    .description = DNS, rebonds et tunnels SSH, VLAN, DHCP, pare-feu nftables, VPN WireGuard et DMZ.
parcours-sauvegardes = Sauvegarder et restaurer
    .description = rsync, archives, restic, rsnapshot, bases PostgreSQL, transferts : et toujours, vérifier qu'on sait restaurer.
parcours-deploiement = Conteneurs et déploiement
    .description = git, Docker et Compose, dépôts nus et crochets, retour arrière, bleu/vert, canari et migration.
parcours-production = Diagnostiquer en production
    .description = Un service qui ne redémarre pas, un disque plein, la mémoire, les inodes, l'heure, la supervision et le post-mortem.
parcours-identites = Comptes et identités
    .description = Groupes, départ d'un collègue, droits partagés, clés SSH, annuaire LDAP et Wi-Fi d'entreprise.
# { $faits } / { $total } : des nombres
parcours-avancee = { $faits } sur { $total } chapitres faits
parcours-fini = ✓ Parcours terminé
# { $histoire } : le titre de l'histoire
parcours-dans = dans « { $histoire } »
parcours-fait = ✓ Terminé
parcours-ouvert = À faire
parcours-prochain = ▶ Le prochain
# { $chapitre } : le titre du chapitre à finir d'abord
parcours-verrouille = 🔒 D'abord : { $chapitre }
parcours-sans-cle = 🔒 Histoire verrouillée
## L'astreinte et l'incident du jour (voir src/moteur/astreinte.ts)
astreinte-bouton = 🚨 Incident du jour
# { $chapitre } : titre du chapitre ; { $histoire } : titre de l'histoire
astreinte-aujourdhui = Aujourd'hui : « { $chapitre } » ({ $histoire })
astreinte-verrouille = 🔒 L'astreinte s'ouvre quand tu termines La Racine (L'Effaceur, chapitre 3).
# { $pourcent } : budget restant
astreinte-deja = Fait aujourd'hui : { $pourcent } % du budget gardé.
# { $date } : la date du jour, écrite en toutes lettres
astreinte-titre = Astreinte du { $date }
astreinte-intro = Le téléphone d'astreinte sonne : un incident à régler. Le même pour tout le monde aujourd'hui ; demain, un autre.
astreinte-regles = Tu as un budget d'erreur de 30 minutes, comme l'objectif de disponibilité (SLA) d'un service : il fond avec le temps, chaque indice en coûte 3 minutes, chaque commande en erreur 20 secondes. Pas de mode examen ; l'instantané de secours reste permis (le temps, lui, ne revient pas).
astreinte-prendre = Prendre l'astreinte
astreinte-annuler = Pas maintenant
astreinte-debut = 🚨 Astreinte : le budget d'erreur commence à fondre.
# { $temps } : « 24:10 » ; { $pourcent } : un nombre
astreinte-jauge = Budget : { $temps } ({ $pourcent } %)
astreinte-epuise = Budget épuisé : SLA dépassé. Termine quand même, l'incident doit être réglé.
astreinte-abandon = L'astreinte est abandonnée : tu as quitté l'incident.
astreinte-fin-titre = Fin d'astreinte
astreinte-fin-intro = L'incident est réglé. Voici ta carte de score, à partager (rien n'est envoyé : tu la copies où tu veux).
astreinte-copier = Copier la carte
astreinte-copiee = Carte copiée.
# La carte de score, comme une grille de mots partagée.
# { $date } (AAAA-MM-JJ), { $chapitre }, { $jauge } (cinq cases), { $pourcent }, { $temps }, { $indices }, { $erreurs }, { $adresse }
astreinte-carte =
    Quêtes de Sysadmin · astreinte du { $date }
    « { $chapitre } » réglé en { $temps }
    { $jauge } { $pourcent } % du budget
    { $indices ->
        [0] sans indice
        [one] un indice
       *[other] { $indices } indices
    } · { $erreurs ->
        [0] aucune erreur
        [one] une erreur
       *[other] { $erreurs } erreurs
    }
    { $adresse }
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

## L'affichage du terminal

affichage-theme = Thème du terminal
affichage-theme-phosphore = Phosphore
affichage-theme-ambre = Ambre
affichage-theme-contraste = Contraste élevé
affichage-theme-papier = Papier
affichage-plus-petit = Texte plus petit
affichage-plus-grand = Texte plus grand
affichage-couleurs = Couleurs
affichage-focus = Plein écran
affichage-quitter-focus = Quitter le plein écran (Échap)

## Difficulté d'un chapitre ou d'une histoire (de 1 à 5, voir difficulty.ts)
difficulty = Difficulté : { $level } sur 5
difficulty-range = Difficulté : de { $min } à { $max } sur 5
