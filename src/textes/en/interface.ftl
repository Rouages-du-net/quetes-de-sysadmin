### Game interface: choosing stories and chapters, terminal,
### progress. One whole sentence per message; variables between { }.

histoires-titre = Stories
# { $histoire }: title of the story
chapitres-titre = Chapters of "{ $histoire }"
chapitre-numero = Chapter { $numero }
chapitre-titre-complet = { $histoire } — chapter { $numero }: { $titre }
etat-histoire-terminee = ✓ Completed
etat-chapitres-faits =
    { $faits ->
        [one] { $faits } chapter
       *[other] { $faits } chapters
    } of { $total }
etat-chapitre-termine = ✓ Completed
etat-verrouille = 🔒 Finish the previous chapter
etat-cle-manquante = 🔒 Locked
cle-aide = 🔑 The greyed-out stories open once you finish The Root (The Eraser, chapter 3): you then receive the key to their machines.
bouton-suivant = Next chapter →
bouton-recommencer = Restart this chapter
astuces = Tips: Tab completes names, ↑ recalls commands, "aide" lists the ones you know, "man command" opens the manual, "exit" takes you back to your workstation. As in most Linux terminals, selecting text copies it and right-clicking pastes it. Your progress is saved in this browser.
# { $lignes }: number of lines not shown
sortie-coupee =
    { $lignes ->
        [one] (… { $lignes } line above, not shown)
       *[other] (… { $lignes } lines above, not shown)
    }
poste-titre = Your workstation
## The story menu: two views
vue-titre = How to show the stories
vue-reseau = Network map
vue-baies = Racks
vue-internet = Internet
saisie-etiquette = Command
credit = Quêtes de Sysadmin, a free game (GPL v3, texts CC BY-SA 4.0), inspired by Terminus, created at MIT by Shawn Conrad and Michele Pratusevich.
credit-lien-projet = The project
credit-lien-original = Terminus

## The sysadmin's notebook

carnet-titre = The sysadmin's notebook
# { $nombre }: the number of commands noted
carnet-compte = { $nombre ->
    [0] (empty)
    [one] ({ $nombre } command)
   *[other] ({ $nombre } commands)
}
carnet-aide = Every command you run for the first time is added here, with what it does and the line you typed. Your cheat sheet, to take with you.
carnet-vide = Nothing yet: run a command (ls, for example) and it will be written here.
carnet-exporter = Download (Markdown)
carnet-copier = Copy
carnet-copie = Copied to the clipboard.
carnet-copie-impossible = This browser refuses access to the clipboard: use the download instead.
# The name of the downloaded file: no spaces or hard-to-type characters.
carnet-fichier = sysadmin-notebook.md
# At the top of the Markdown file. { $nombre }: the number of commands
carnet-markdown-intro = { $nombre ->
    [one] One command learnt while playing Quêtes de Sysadmin.
   *[other] { $nombre } commands learnt while playing Quêtes de Sysadmin.
}
carnet-progression = Progress
carnet-progression-vide = No chapter completed yet.
# { $histoire }: the title of the story; { $faits } and { $total }: chapters completed and in total
carnet-progression-histoire = { $histoire }: { $faits ->
    [one] { $faits } chapter completed
   *[other] { $faits } chapters completed
} of { $total }
# { $chapitre }: the title of the chapter where the command was first used
carnet-decouverte = Discovered in "{ $chapitre }".
# { $commande }: the command that opens the manual (man ls)
carnet-manuel = To go further: { $commande }

## Links to Les rouages du net (after a chapter)

rouages-intro = To understand what happens under the hood, on Les rouages du net (in French):
rouages-lien-entree-nom = "From the Enter key to the page": the name becomes an address (DNS)
rouages-lien-entree-box = "From the Enter key to the page": your router and your local network
rouages-lien-entree-liaison = "From the Enter key to the page": opening the connection (TCP, ports)
rouages-lien-entree-cadenas = "From the Enter key to the page": the padlock (TLS, certificates)
rouages-lien-entree-voyage = "From the Enter key to the page": the journey of packets
rouages-lien-entree-serveur = "From the Enter key to the page": the server answers
rouages-lien-ordinateur-binaire = "How a computer works": everything is a number
rouages-lien-ordinateur-memoire = "How a computer works": memory
rouages-lien-glossaire-ttl = Glossary: TTL
rouages-lien-glossaire-port = Glossary: port
rouages-lien-glossaire-nat = Glossary: NAT
rouages-lien-glossaire-routeur = Glossary: router
rouages-lien-glossaire-commutateur = Glossary: switch
rouages-lien-glossaire-hebergeur = Glossary: hosting provider
rouages-lien-glossaire-chiffrement = Glossary: encryption
rouages-lien-glossaire-autorite-certification = Glossary: certificate authority
rouages-lien-glossaire-code-http = Glossary: HTTP status code
rouages-lien-glossaire-requete = Glossary: request
rouages-lien-glossaire-datacenter = Glossary: data centre
rouages-lien-glossaire-octet = Glossary: byte

## Exam mode

examen-case = Exam mode: no hints, with a timer (the chapter restarts)
# { $temps }: the elapsed time, in minutes:seconds
examen-chrono = ⏱ { $temps }
examen-debut = Exam mode: no hints will be shown, the timer is running. Your mission is in the welcome message (read it again with cat). The debrief will come at the end. To start from scratch, machine and timer: "Restart this chapter", below the terminal.
# { $temps }: the time of this game; { $record }: the best time in this browser
examen-fini = Exam passed in { $temps }. Your best time on this chapter: { $record }.
examen-fini-record = Exam passed in { $temps }: that's your best time on this chapter.

## The map (a button next to the terminal; see src/moteur/carte.ts)

carte-bouton = Map
# { $machine }: the name of the machine you are on (royaume, poste…).
carte-titre = Map of { $machine }
carte-legende = The places (directories) you know on this machine: the ones you have entered, and in italics the ones you have only glimpsed. Files are not shown: for those, use ls.
carte-ici = ← you are here
carte-maison = your home, ~
carte-ferme = locked for now
carte-apercu = not visited yet
carte-fermer = Close

## The network plan ("Network" tab of the map; see src/moteur/plan.ts)

carte-onglet-lieux = Places
carte-onglet-reseau = Network
plan-legende = The network as the team planned it, like the diagram on the wall: what should be, not necessarily what is. To check: ip a, ip route, ping, wg show… Dotted links go through a WireGuard tunnel.
plan-version-texte = The plan as a list
plan-internet = Internet
plan-ton-poste = your workstation
plan-ici = you are here
plan-visite = already connected
plan-pas-visite = not connected yet
plan-tunnel = through the WireGuard tunnel
plan-dhcp = DHCP
plan-reseau-interne = internal network
plan-note-passerelle = gateway
plan-note-wiki = wiki
plan-note-archives = backups
plan-note-hebergeur = website host
plan-note-routeur = router
# { $id }: the VLAN number; { $nom }: its name in the configuration (bureaux, invites…).
plan-vlan = VLAN { $id } · { $nom }
plan-note-teletravail = remote work
plan-annexe = Annexe router
plan-note-annexe = second site
plan-reseau-annexe = Annexe network

## My progress (see src/moteur/progression.ts)

# The notebook's title when a name is given.
carnet-titre-de = { $nom }'s notebook
progression-bouton = My progress
progression-titre = My progress
progression-intro = Your progress stays in this browser. To carry on on another machine (another lab room, at home), take it with you with the code or the file. Nothing is sent anywhere.
progression-nom = Your name (optional)
progression-nom-aide = It goes at the top of your notebook ("…'s notebook") and in your saves.
progression-code-titre = The code, to copy down
progression-code-aide = It holds the finished chapters, nothing else: not the notebook, not the keys you created. Write it down, then type it on the other machine.
progression-copier = Copy
progression-code-saisie = Resume with a code:
progression-reprendre = Resume
progression-fichier-titre = The file, to take everything
progression-fichier-aide = Chapters, notebook, keys you created, ssh config, exam mode records. Keep it on a USB stick or send it to yourself.
progression-telecharger = Download my save
progression-fichier-saisie = Resume from a file:
progression-nom-fichier = quetes-de-sysadmin.json
progression-telechargee = Save downloaded.
# { $nombre }: the finished chapters in the file.
progression-confirmer = Resume this save ({ $nombre ->
        [one] { $nombre } finished chapter
       *[other] { $nombre } finished chapters
    })? It will replace everything kept in this browser.
progression-rien-de-neuf = This code adds no chapter to the ones you have already finished here.
progression-code-illisible = This is not a progress code: it starts with QDS, followed by groups of letters and digits.
progression-code-faute = This code has a typo: check it, character by character.
progression-code-trop-recent = This code comes from a newer version of the game: reload the page.
progression-fichier-illisible = This file is not a readable save (JSON).
progression-fichier-autre = This file is not a Sysadmin Quests save.
progression-fichier-trop-recent = This save comes from a newer version of the game: reload the page.

## The mission, the key bar, Ctrl-R

mission-bouton = Mission
# { $chapitre }: "Chapter 2"; { $titre }: its title.
mission-titre = { $chapitre }: { $titre }
mission-consignes = The instructions
mission-journal = What has happened
mission-rien = Nothing yet: the story moves on as you act.
touches-titre = Terminal keys
touche-haut = Previous command
touche-bas = Next command
# What bash shows during Ctrl-R (readline).
recherche-historique = (reverse-i-search)`{ $motif }': { $commande }

## Achievements and ranks (see src/moteur/succes.ts)

succes-titre = Achievements
# { $obtenus } of { $total }: the count shown on the link.
succes-bouton = Achievements ({ $obtenus }/{ $total })
# Announced in the terminal when an achievement is earned.
succes-obtenu = 🏆 Achievement: { $nom }
succes-grade = Your rank: { $grade }.
succes-grade-suivant = Next rank, { $grade }, at { $chapitres } finished chapters.
succes-le = ({ $date })
succes-cache = Hidden achievement
    .description = A nod to terminal culture. Up to you to find it.
carnet-grade = Rank: { $grade }.
grade-stagiaire = Intern
grade-apprenti = Apprentice sysadmin
grade-junior = Junior admin
grade-admin = System administrator
grade-confirme = Experienced admin
grade-senior = Senior admin
grade-sre = SRE (site reliability engineer)
succes-premiere-commande = First step
    .description = Run a first command.
succes-manuel = Read the manual
    .description = Open the manual (man or apropos): the pros' first reflex.
succes-cache-ls = What is hidden
    .description = Show the hidden files (ls -a).
succes-tube = First pipe
    .description = Join two commands with a pipe (|).
succes-redirection = Into the file
    .description = Send a command's output into a file (> or >>).
succes-premier-chapitre = First chapter
    .description = Finish a chapter.
succes-effaceur = The Eraser stopped
    .description = Finish the Eraser's story.
succes-restauration = Restore tested
    .description = Restore a backup for real: a backup you have never restored is not a backup.
succes-reseau = The whole Hive
    .description = Finish The Hive: VLANs, DHCP, firewall, VPN, directory and Wi-Fi.
succes-trois-histoires = Three stories
    .description = Finish three stories.
succes-toutes-histoires = The grand tour
    .description = Finish every story.
succes-cinquante-commandes = Toolbox
    .description = Have 50 commands in your notebook.
succes-examen = Exam passed
    .description = Finish a chapter in exam mode.
succes-examen-eclair = Lightning
    .description = Finish a chapter in exam mode in under 5 minutes.
succes-xyzzy = Magic word
    .description = The password of Colossal Cave Adventure (1976), one of the first text adventure games.
succes-sandwich = With the rights
    .description = With sudo, you get everything, even a sandwich (xkcd 149).
succes-sl = Locomotive
    .description = sl instead of ls: the most famous typo, punished by a train.

## Graded hints (see src/moteur/indices.ts; the hints themselves: indices-<story>.ftl)

indice-titre = Need help?
indice-intro = Three levels, to open one after the other: the manual first, like at work. The debrief will say how many you asked for.
indice-bouton-manuel = The manual
indice-bouton-piste = A lead
indice-bouton-solution = Almost the answer
# { $pages }: "man mv, man cp".
indice-manuel = Pages to read: { $pages }. Also search with man -k and a keyword.
indice-plus-rien = No more hints for this chapter: reread the instructions and what has happened.
indice-debrief = { $nombre ->
        [one] One hint asked for this chapter. Next time, without?
       *[other] { $nombre } hints asked for this chapter. Next time, with fewer?
    }
succes-sans-indice = No safety net
    .description = Finish a chapter without asking for a hint.

## The class table (teachers' page; see src/moteur/classe.ts)

classe-fichiers = The students' save files:
classe-glisser = Or drop them here, several at once.
classe-codes = Or their codes, one per line, after the name:
classe-codes-exemple = Lina QDS-047G-0000-000M-G
classe-codes-ajouter = Add the codes
classe-exporter = Download the table (CSV)
classe-vider = Clear the table
classe-nom-fichier = class-table.csv
classe-tableau = The class
classe-compte = { $nombre ->
        [0] No student yet.
        [one] One student.
       *[other] { $nombre } students.
    }
# { $source }: the file or line; { $raison }: what is wrong.
classe-erreur = { $source }: { $raison }
classe-col-eleve = Student
classe-col-chapitres = Chapters
classe-col-grade = Rank
classe-col-succes = Achievements
classe-col-examen = Best exam
classe-col-date = Saved

## The terminal display

affichage-theme = Terminal theme
affichage-theme-phosphore = Phosphor
affichage-theme-ambre = Amber
affichage-theme-contraste = High contrast
affichage-theme-papier = Paper
affichage-plus-petit = Smaller text
affichage-plus-grand = Larger text
affichage-couleurs = Colours
affichage-focus = Full screen
affichage-quitter-focus = Leave full screen (Esc)
