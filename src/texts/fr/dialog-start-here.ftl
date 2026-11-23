### La fenêtre de « Par où commencer ? » (src/engine/start-here.ts), chargée
### à sa première ouverture (src/texts/plugin.mjs : dialog-*.ftl). Son bouton,
### la carte de la première visite et la bulle de la visite sont dans start-here.ftl.

start-here-title = Par où commencer ?
start-here-intro = Quatre questions rapides, et le jeu te suggère un parcours et un premier chapitre. Tes réponses restent dans ce navigateur, et tu peux les changer à tout moment.

## Les questions (chacune un groupe de choix)
start-here-experience = As-tu déjà utilisé un terminal ?
start-here-experience-never = Jamais
start-here-experience-little = Un peu
start-here-experience-daily = Tous les jours
start-here-goal = Qu'est-ce qui t'amène ?
start-here-goal-curiosity = La curiosité
start-here-goal-studies = Des études ou une certification
start-here-goal-job = Un métier d'administrateur·rice système ou en DevOps
start-here-goal-teacher = J'enseigne
start-here-systems = Qu'est-ce qui t'intéresse le plus ?
start-here-systems-linux = Linux
start-here-systems-windows = Windows
start-here-systems-both = Linux et Windows ensemble
start-here-systems-network = Les réseaux
start-here-systems-security = La sécurité
start-here-systems-vintage = Les vieux Unix et les mainframes
start-here-time = Combien de temps dure une séance pour toi ?
start-here-time-short = Une dizaine de minutes
start-here-time-medium = Une demi-heure environ
start-here-time-long = Une heure ou plus

## La suggestion
start-here-incomplete = Réponds aux quatre questions pour voir une suggestion.
start-here-result = Notre suggestion
start-here-path = Parcours : { $path }
start-here-chapter = { $chapter }, dans « { $story } »
start-here-locked =
    { $count ->
        [one] { $chapter } s'ouvre après encore un chapitre : commence par celui-ci.
       *[other] { $chapter } s'ouvre après encore { $count } chapitres : commence par celui-ci.
    }
start-here-alternatives = Autres portes d'entrée
start-here-teachers = Pour tes classes, les fiches des quêtes donnent l'objectif, les prérequis, les commandes découvertes et la durée de chaque chapitre.
start-here-teachers-link = Ouvrir les fiches des quêtes
start-here-all-done = Tu as terminé tous les parcours. Rejoue un chapitre en mode examen, ou prends l'incident du jour.
start-here-close = Fermer

## Les raisons (une phrase chacune)
start-here-reason-beginner = Tu n'as jamais utilisé de terminal : ce parcours part de la toute première commande, pas à pas.
start-here-reason-teacher = Joue toi-même les premiers pas : c'est ce que tes élèves verront en premier.
start-here-why-start = Les premiers pas couvrent les commandes de tous les jours, sur lesquelles s'appuient tous les autres chapitres.
start-here-why-security = Tu fermeras les portes d'un serveur, surveilleras qui frappe, et répondras à une intrusion.
start-here-why-web = Tu feras tourner un site web : nginx, journaux, certificats et le trafic qui va avec.
start-here-why-network = Tu suivras les paquets : DNS, tunnels SSH, VLAN, DHCP, pare-feu et VPN.
start-here-why-backups = Sauvegarder et restaurer, ce sont les bases que demandent tous les examens et tous les métiers.
start-here-why-deployment = Tu déploieras comme une équipe au travail : git, Docker, Compose, retours arrière et Kubernetes.
start-here-why-production = De vrais incidents : disques pleins, services bloqués, vieux Unix et mainframes, serveurs Windows.
start-here-why-identities = Les comptes et les droits, des groupes Linux aux partages Windows et à Active Directory.

## Le temps d'une séance
start-here-note-short = Un chapitre prend dix à vingt minutes environ, et le jeu garde ta place si tu t'arrêtes au milieu.
start-here-note-medium = Une demi-heure suffit pour un ou deux chapitres, et le jeu garde ta place si tu t'arrêtes au milieu.
start-here-note-long = Avec une heure ou plus, tu peux jouer une histoire entière du début à la fin.

## Pour les lecteurs d'écran
start-here-announce = Suggestion : « { $chapter } », dans le parcours « { $path } ».
