### Interface du jeu : choix des histoires et des chapitres, terminal,
### progression. Une phrase entière par message ; variables entre { }.

stories-title = Histoires
# { $story } : titre de l'histoire
chapters-title = Chapitres de « { $story } »
chapter-number = Chapitre { $number }
chapter-title-complete = { $story } — chapitre { $number } : { $title }
state-story-finished = ✓ Terminée
state-chapters-done =
    { $finished ->
        [one] { $finished } chapitre
       *[other] { $finished } chapitres
    } sur { $total }
state-chapter-finished = ✓ Terminé
state-locked = 🔒 Termine le chapitre précédent
state-key-missing = 🔒 Verrouillée
# { $chapters } : les titres des chapitres qui restent à finir (liste mise en forme)
state-key-after = 🔒 Après { $chapters }
# { $title } : le titre d'un chapitre, dans la liste ci-dessus
state-key-chapter = « { $title } »
key-help = 🔑 Les histoires grisées s'ouvrent peu à peu : chacune dit sous son nom les chapitres à finir avant d'en recevoir la clé. Les premières s'ouvrent après La Racine (L'Effaceur, chapitre 3).
button-next = Chapitre suivant →
button-restart = Recommencer ce chapitre
tips = Astuces : Tab complète les noms, ↑ rappelle les commandes, « aide » liste celles que tu connais, « man commande » ouvre le manuel, « exit » ramène à ton poste. Comme dans la plupart des terminaux Linux, sélectionner du texte le copie et le clic droit le colle. Ta progression est gardée dans ce navigateur.
# { $lines } : nombre de lignes non affichées
output-cut =
    { $lines ->
        [one] (… { $lines } ligne plus haut, non affichée)
       *[other] (… { $lines } lignes plus haut, non affichées)
    }
workstation-title = Ton poste
## Le menu des histoires : deux vues
view-title = Présentation des histoires
view-reseau = Carte du réseau
view-baies = Baies
view-internet = Internet
input-label = Commande
credit = Quêtes de Sysadmin, jeu libre (GPL v3, textes CC BY-SA 4.0), inspiré de Terminus, créé au MIT par Shawn Conrad et Michele Pratusevich.
credit-link-project = Le projet
credit-link-original = Terminus (en anglais)

## Le carnet du sysadmin

notebook-title = Le carnet du sysadmin
# { $count } : le nombre de commandes notées
notebook-account = { $count ->
    [0] (vide)
    [one] ({ $count } commande)
   *[other] ({ $count } commandes)
}
notebook-help = Chaque commande que tu lances pour la première fois s'ajoute ici, avec ce qu'elle fait et la ligne que tu as tapée. Ton aide-mémoire, à emporter.
notebook-empty = Rien encore : lance une commande (ls, par exemple), elle viendra s'inscrire ici.
notebook-export = Télécharger (Markdown)
notebook-copy-button = Copier
notebook-copy = Copié dans le presse-papiers.
notebook-copy-impossible = Ce navigateur refuse l'accès au presse-papiers : utilise plutôt le téléchargement.
# Le nom du fichier téléchargé : sans espace ni caractère difficile.
notebook-file = carnet-du-sysadmin.md
# En tête du fichier Markdown. { $count } : le nombre de commandes
notebook-markdown-intro = { $count ->
    [one] Une commande apprise en jouant à Quêtes de Sysadmin.
   *[other] { $count } commandes apprises en jouant à Quêtes de Sysadmin.
}
notebook-progress = Progression
notebook-progress-empty = Aucun chapitre terminé pour l'instant.
# { $story } : le titre de l'histoire ; { $finished } et { $total } : chapitres terminés et en tout
notebook-progress-story = { $story } : { $finished ->
    [one] { $finished } chapitre terminé
   *[other] { $finished } chapitres terminés
} sur { $total }
# { $chapter } : le titre du chapitre où la commande a servi la première fois
notebook-discovery = Découverte dans « { $chapter } ».
# { $command } : la commande qui ouvre le manuel (man ls)
notebook-manual = Pour aller plus loin : { $command }

## Liens vers Les rouages du net (après un chapitre)

rouages-intro = Pour comprendre ce qui se passe sous le capot, sur Les rouages du net :
rouages-link-entree-nom = « De l'Entrée à la page » : le nom devient une adresse (DNS)
rouages-link-entree-box = « De l'Entrée à la page » : ta box et ton réseau local
rouages-link-entree-liaison = « De l'Entrée à la page » : ouvrir la liaison (TCP, ports)
rouages-link-entree-cadenas = « De l'Entrée à la page » : le cadenas (TLS, certificats)
rouages-link-entree-voyage = « De l'Entrée à la page » : le voyage des paquets
rouages-link-entree-serveur = « De l'Entrée à la page » : le serveur répond
rouages-link-ordinateur-binaire = « Comment marche un ordinateur » : tout est nombre
rouages-link-ordinateur-memoire = « Comment marche un ordinateur » : la mémoire
rouages-link-glossaire-ttl = Glossaire : TTL
rouages-link-glossaire-port = Glossaire : port
rouages-link-glossaire-nat = Glossaire : NAT
rouages-link-glossaire-routeur = Glossaire : routeur
rouages-link-glossaire-commutateur = Glossaire : commutateur
rouages-link-glossaire-hebergeur = Glossaire : hébergeur
rouages-link-glossaire-chiffrement = Glossaire : chiffrement
rouages-link-glossaire-autorite-certification = Glossaire : autorité de certification
rouages-link-glossaire-code-http = Glossaire : code HTTP
rouages-link-glossaire-requete = Glossaire : requête
rouages-link-glossaire-datacenter = Glossaire : datacenter
rouages-link-glossaire-octet = Glossaire : octet

## Le mode examen

exam-case = Mode examen : sans indice, avec un chrono (le chapitre recommence)
# { $time } : le temps écoulé, en minutes:secondes
exam-timer = ⏱ { $time }
# La confirmation, quand un chapitre est en cours (le mode examen le fait recommencer).
exam-confirm-title = Passer en mode examen ?
exam-confirm-text = Le chapitre en cours va recommencer depuis le début, sur une machine neuve : ce que tu y as déjà fait sera perdu. Les chapitres terminés restent acquis.
exam-confirm = Recommencer en mode examen
exam-quit-title = Quitter le mode examen ?
exam-quit-text = Le chapitre en cours va recommencer depuis le début, avec les indices : ce que tu y as déjà fait sera perdu. Les chapitres terminés restent acquis.
exam-quit = Recommencer sans le mode examen
exam-cancel = Annuler
exam-start = Mode examen : aucun indice ne s'affichera, le chrono tourne. Ta mission est dans le message d'accueil (relis-le avec cat). Le débrief viendra à la fin. Pour repartir de zéro, machine et chrono : « Recommencer ce chapitre », sous le terminal.
# { $time } : le temps de cette partie ; { $record } : le meilleur temps de ce navigateur
exam-finished = Examen réussi en { $time }. Ton meilleur temps sur ce chapitre : { $record }.
exam-finished-record = Examen réussi en { $time } : c'est ton meilleur temps sur ce chapitre.

## La carte (un bouton à côté du terminal ; voir src/engine/map.ts)

map-button = Carte
# { $machine } : le nom de la machine où l'on est (royaume, poste…).
map-title = Carte de { $machine }
map-caption = Les lieux (dossiers) que tu connais sur cette machine : ceux où tu es entré·e, et en italique ceux que tu as seulement aperçus. Les fichiers n'y sont pas : pour eux, ls.
map-here = ← tu es ici
map-home = ta maison, ~
map-closed = fermé pour l'instant
map-preview = pas encore visité
map-close = Fermer

## Le plan du réseau (onglet « Réseau » de la carte ; voir src/engine/plan.ts)

map-tab-places = Lieux
map-tab-network = Réseau
plan-caption = Le réseau tel que l'équipe l'a prévu, comme sur le schéma affiché au mur : ce qui devrait être, pas forcément ce qui est. Pour le vérifier : ip a, ip route, ping, wg show… Les liens en pointillés passent par un tunnel WireGuard.
plan-version-text = Le plan en liste
plan-internet = Internet
plan-your-workstation = ton poste
plan-here = tu es ici
plan-visit = déjà connecté·e
plan-not-visit = pas encore connecté·e
plan-tunnel = par le tunnel WireGuard
plan-dhcp = DHCP
plan-network-internal = réseau interne
plan-note-gateway = passerelle
plan-note-wiki = wiki
plan-note-archives = sauvegardes
plan-note-host = hébergeur du site
plan-note-router = routeur
# { $id } : le numéro du VLAN ; { $name } : son nom dans la configuration (bureaux, invites…).
plan-vlan = VLAN { $id } · { $name }
plan-note-remote-work = télétravail
plan-annex = routeur de l'Annexe
plan-note-annex = second site
plan-network-annex = réseau de l'Annexe

## Ma progression (voir src/engine/progress.ts)

# Le titre du carnet quand on a donné son nom.
notebook-title-of = Le carnet de { $name }
progress-button = Ma progression
progress-title = Ma progression
progress-intro = Ta progression reste dans ce navigateur. Pour continuer sur une autre machine (une autre salle de TP, chez toi), emporte-la avec le code ou le fichier. Rien n'est envoyé nulle part.
progress-name = Ton nom (facultatif)
progress-name-help = Il s'inscrit en tête de ton carnet (« Le carnet de… ») et dans tes sauvegardes.
progress-code-title = Le code, à recopier
progress-code-help = Il contient les chapitres terminés, rien d'autre : ni le carnet, ni les clés que tu as créées. Note-le, puis tape-le sur l'autre machine.
progress-copy = Copier
progress-code-input = Reprendre avec un code :
progress-resume = Reprendre
progress-file-title = Le fichier, pour tout emporter
progress-file-help = Chapitres, carnet, clés créées, config ssh, records du mode examen. Garde-le sur une clé USB ou envoie-le-toi.
progress-download = Télécharger ma sauvegarde
progress-file-input = Reprendre avec un fichier :
progress-name-file = quetes-de-sysadmin.json
progress-downloaded = Sauvegarde téléchargée.
# { $count } : les chapitres terminés dans le fichier.
progress-confirm = Reprendre cette sauvegarde ({ $count ->
        [one] { $count } chapitre terminé
       *[other] { $count } chapitres terminés
    }) ? Elle remplacera tout ce qui est gardé dans ce navigateur.
progress-nothing-new = Ce code n'ajoute aucun chapitre à ceux que tu as déjà terminés ici.
progress-code-illisible = Ce n'est pas un code de progression : il commence par QDS, suivi de groupes de lettres et de chiffres.
progress-code-faute = Ce code contient une faute de frappe : vérifie-le, caractère par caractère.
progress-code-trop-recent = Ce code vient d'une version plus récente du jeu : recharge la page.
progress-fichier-illisible = Ce fichier n'est pas une sauvegarde lisible (JSON).
progress-fichier-autre = Ce fichier n'est pas une sauvegarde de Quêtes de Sysadmin.
progress-fichier-trop-recent = Cette sauvegarde vient d'une version plus récente du jeu : recharge la page.

## La mission, la barre de touches, Ctrl-R

mission-button = Mission
# { $chapter } : « Chapitre 2 » ; { $title } : son titre.
mission-title = { $chapter } : { $title }
mission-instructions = Les consignes
mission-journal = Ce qui s'est passé
mission-nothing = Rien encore : l'histoire avance à mesure que tu agis.
keys-title = Touches du terminal
# Pendant tail -f ou journalctl -f : le bouton qui fait Ctrl-C.
follow-stop = Arrêter (Ctrl-C)
key-haut = Commande précédente
key-bas = Commande suivante
# Ce qu'affiche bash pendant Ctrl-R (en anglais, comme readline).
search-history = (reverse-i-search)`{ $pattern }': { $command }

## Succès et grades (voir src/engine/achievements.ts)

achievements-title = Succès
# { $earned } sur { $total } : le compte affiché sur le lien.
achievements-button = Succès ({ $earned }/{ $total })
# Annoncé dans le terminal quand un succès est obtenu.
achievements-obtained = 🏆 Succès : { $name }
achievements-grade = Ton grade : { $grade }.
achievements-grade-next = Prochain grade, { $grade }, à { $chapters } chapitres terminés.
achievements = (le { $date })
achievements-cache = Succès caché
    .description = Un clin d'œil à la culture du terminal. À toi de le trouver.
notebook-grade = Grade : { $grade }.
grade-intern = Stagiaire
grade-apprentice = Apprenti·e sysadmin
grade-junior = Admin junior
grade-admin = Admin système
grade-confirmed = Admin confirmé·e
grade-senior = Admin senior
grade-sre = SRE (ingénieur·e fiabilité)
achievements-first-command = Premier pas
    .description = Lancer une première commande.
achievements-manual = Lire le manuel
    .description = Ouvrir le manuel (man ou apropos) : le premier réflexe des pros.
achievements-cache-ls = Ce qui est caché
    .description = Montrer les fichiers cachés (ls -a).
achievements-pipe = Premier tube
    .description = Relier deux commandes par un tube (|).
achievements-redirection = Dans le fichier
    .description = Envoyer la sortie d'une commande dans un fichier (> ou >>).
achievements-first-chapter = Premier chapitre
    .description = Terminer un chapitre.
achievements-eraser = L'Effaceur arrêté
    .description = Terminer l'histoire de l'Effaceur.
achievements-restore = Restauration testée
    .description = Restaurer une sauvegarde pour de vrai : une sauvegarde qu'on n'a jamais restaurée n'en est pas une.
achievements-network = Toute la Ruche
    .description = Terminer La Ruche : VLAN, DHCP, pare-feu, VPN, annuaire et Wi-Fi.
achievements-three-stories = Trois histoires
    .description = Terminer trois histoires.
achievements-all-stories = Le grand tour
    .description = Terminer toutes les histoires.
achievements-fifty-commands = Boîte à outils
    .description = Avoir 50 commandes dans son carnet.
achievements-exam = Examen passé
    .description = Terminer un chapitre en mode examen.
achievements-exam-lightning = Éclair
    .description = Terminer un chapitre en mode examen en moins de 5 minutes.
achievements-xyzzy = Mot magique
    .description = Le mot de passe de la Colossal Cave Adventure (1976), l'un des premiers jeux d'aventure en texte.
achievements-sandwich = Avec les droits
    .description = Avec sudo, on obtient tout, même un sandwich (xkcd 149).
achievements-sl = Locomotive
    .description = sl au lieu de ls : la faute de frappe la plus célèbre, punie par un train.

## Indices gradués (voir src/engine/hints.ts ; les indices eux-mêmes : hints-<story>.ftl)

hint-title = Besoin d'aide ?
hint-intro = Trois niveaux, à ouvrir l'un après l'autre : le manuel d'abord, comme au travail. Le débrief dira combien tu en as demandé.
hint-button-manuel = Le manuel
hint-button-piste = Une piste
hint-button-solution = Presque la réponse
# { $pages } : « man mv, man cp ».
hint-manual = Les pages à lire : { $pages }. Cherche aussi avec man -k et un mot-clé.
hint-more-nothing = Plus d'indice pour ce chapitre : relis les consignes et ce qui s'est passé.
## Le bilan de fin de chapitre (voir src/engine/summary.ts)
# { $time } : « 6:12 » ; { $commands }, { $errors }, { $hints } : des nombres
summary-summary = Bilan : { $time } · { $commands ->
        [one] une commande
       *[other] { $commands } commandes
    }{ $errors ->
        [0] {""}
       *[other] {" "}(dont { $errors } en erreur)
    } · { $hints ->
        [0] aucun indice
        [one] un indice
       *[other] { $hints } indices
    }
summary-button = Voir le détail
# { $chapter } : le titre du chapitre
summary-title = Bilan : { $chapter }
summary-intro = Ta commande à côté de la solution de référence, étape par étape. Le jeu vérifie l'état de la machine, pas la commande tapée : une autre façon de faire est tout aussi juste si elle arrive au même résultat.
summary-col-step = Étape
summary-col-you = Ta commande
summary-col-reference = La solution de référence
summary-otherwise = (passée autrement)
summary-encourage = { $hints ->
        [0] Sans indice : bravo. Rejoue-le en mode examen pour battre ton temps ?
       *[other] La prochaine fois, avec moins d'indices ?
    }
## L'instantané de secours (panneau Mission ; voir Console.restaurer)
rescue-title = Instantané de secours
rescue-intro = Comme l'instantané d'une machine virtuelle avant une opération risquée : prends-en un, tente ta manœuvre, et reviens-y si ça tourne mal. Le chapitre est rejoué jusqu'à ce point, sans rien perdre d'autre.
rescue-take = Prendre un instantané
rescue-go-back = Revenir à l'instantané
rescue-cancel = Annuler la dernière saisie
rescue-none = Pas encore d'instantané dans ce chapitre.
# { $steps } : le nombre de saisies (commandes, réponses, enregistrements de nano) depuis le début du chapitre
rescue-taken = { $steps ->
        [0] Instantané pris au début du chapitre.
        [one] Instantané pris après une saisie.
       *[other] Instantané pris après { $steps } saisies.
    }
rescue-impossible = Pas d'instantané possible ici : le chapitre a été repris ou on est passé par le poste. « Recommencer ce chapitre » repart de zéro.
rescue-exam = Pas d'instantané en mode examen.
rescue-restored = { $steps ->
        [0] ↺ Machine remise comme au début du chapitre.
        [one] ↺ Machine remise comme après la première saisie du chapitre.
       *[other] ↺ Machine remise comme après { $steps } saisies du chapitre.
    }
## Les parcours thématiques (menu « Parcours » ; voir src/engine/paths.ts)
view-parcours = Parcours
path-choice = Choisir un parcours
path-start = Premiers pas
    .description = Se déplacer, lire, chercher, ranger, puis le réseau, git et les archives : pour qui n'a jamais ouvert un terminal.
path-security = Protéger un serveur
    .description = SSH, pare-feu, fail2ban, comptes et droits, secrets, mises à jour, puis l'audit de clôture : fermer les portes, garder la maison en ordre, et le prouver.
path-web = Servir le web
    .description = nginx, journaux, sauvegardes d'urgence, certificats, sites partagés, trafic et proxy.
path-network = Les réseaux
    .description = DNS, rebonds et tunnels SSH, VLAN, DHCP, pare-feu nftables, VPN WireGuard et DMZ.
path-backups = Sauvegarder et restaurer
    .description = rsync, archives, restic, rsnapshot, bases PostgreSQL, transferts : et toujours, vérifier qu'on sait restaurer.
path-deployment = Conteneurs et déploiement
    .description = git, Docker et Compose, dépôts nus et crochets, retour arrière, bleu/vert, canari et migration.
path-production = Diagnostiquer en production
    .description = Un service qui ne redémarre pas, un disque plein, la mémoire, les inodes, l'heure, la supervision et le post-mortem.
path-identities = Comptes et identités
    .description = Groupes, départ d'un collègue, droits partagés, clés SSH, annuaire LDAP et Wi-Fi d'entreprise.
# { $finished } / { $total } : des nombres
path-progress = { $finished } sur { $total } chapitres faits
path-finished = ✓ Parcours terminé
# { $story } : le titre de l'histoire
path-in = dans « { $story } »
path-done = ✓ Terminé
path-open = À faire
path-next = ▶ Le prochain
# { $chapter } : le titre du chapitre à finir d'abord
path-locked = 🔒 D'abord : { $chapter }
path-without-key = 🔒 Histoire verrouillée
## L'astreinte et l'incident du jour (voir src/engine/on-call.ts)
on-call-button = 🚨 Incident du jour
# { $chapter } : titre du chapitre ; { $story } : titre de l'histoire
on-call-today = Aujourd'hui : « { $chapter } » ({ $story })
on-call-locked = 🔒 L'astreinte s'ouvre quand tu termines La Racine (L'Effaceur, chapitre 3).
# { $percent } : budget restant
on-call-already = Fait aujourd'hui : { $percent } % du budget gardé.
# { $date } : la date du jour, écrite en toutes lettres
on-call-title = Astreinte du { $date }
on-call-intro = Le téléphone d'astreinte sonne : un incident à régler. Le même pour tout le monde aujourd'hui ; demain, un autre.
on-call-rules = Tu as un budget d'erreur de 30 minutes, comme l'objectif de disponibilité (SLA) d'un service : il fond avec le temps, chaque indice en coûte 3 minutes, chaque commande en erreur 20 secondes. Pas de mode examen ; l'instantané de secours reste permis (le temps, lui, ne revient pas).
on-call-take = Prendre l'astreinte
on-call-cancel = Pas maintenant
on-call-start = 🚨 Astreinte : le budget d'erreur commence à fondre.
# { $time } : « 24:10 » ; { $percent } : un nombre
on-call-gauge = Budget : { $time } ({ $percent } %)
on-call-exhausted = Budget épuisé : SLA dépassé. Termine quand même, l'incident doit être réglé.
on-call-abandon = L'astreinte est abandonnée : tu as quitté l'incident.
on-call-end-title = Fin d'astreinte
on-call-end-intro = L'incident est réglé. Voici ta carte de score, à partager (rien n'est envoyé : tu la copies où tu veux).
on-call-copy = Copier la carte
on-call-copied = Carte copiée.
# La carte de score, comme une grille de mots partagée.
# { $date } (AAAA-MM-JJ), { $chapter }, { $gauge } (cinq cases), { $percent }, { $time }, { $hints }, { $errors }, { $address }
on-call-map =
    Quêtes de Sysadmin · astreinte du { $date }
    « { $chapter } » réglé en { $time }
    { $gauge } { $percent } % du budget
    { $hints ->
        [0] sans indice
        [one] un indice
       *[other] { $hints } indices
    } · { $errors ->
        [0] aucune erreur
        [one] une erreur
       *[other] { $errors } erreurs
    }
    { $address }
achievements-without-hint = Sans filet
    .description = Terminer un chapitre sans demander d'indice.

## Le tableau de classe (page des enseignant·es ; voir src/engine/classroom.ts)

class-files = Les fichiers de sauvegarde des élèves :
class-slide = Ou glisse-les ici, plusieurs à la fois.
class-codes = Ou leurs codes, un par ligne, précédés du nom :
class-codes-example = Lina QDS-047G-0000-000M-G
class-codes-add = Ajouter les codes
class-export = Télécharger le tableau (CSV)
class-empty = Vider le tableau
class-name-file = tableau-de-classe.csv
class-table = La classe
class-account = { $count ->
        [0] Aucun élève pour l'instant.
        [one] Un élève.
       *[other] { $count } élèves.
    }
# { $source } : le fichier ou la ligne ; { $reason } : ce qui ne va pas.
class-error = { $source } : { $reason }
class-col-student = Élève
class-col-chapters = Chapitres
class-col-grade = Grade
class-col-achievements = Succès
class-col-exam = Meilleur examen
class-col-date = Sauvegarde

## L'affichage du terminal

display-theme = Thème du terminal
display-theme-phosphore = Phosphore
display-theme-ambre = Ambre
display-theme-contraste = Contraste élevé
display-theme-papier = Papier
display-more-small = Texte plus petit
display-more-big = Texte plus grand
display-colours = Couleurs
display-focus = Plein écran
display-quit-focus = Quitter le plein écran (Échap)

## Difficulté d'un chapitre ou d'une histoire (de 1 à 5, voir difficulty.ts)
difficulty = Difficulté : { $level } sur 5
difficulty-tidy = Difficulté : de { $min } à { $max } sur 5
