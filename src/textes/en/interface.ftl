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
