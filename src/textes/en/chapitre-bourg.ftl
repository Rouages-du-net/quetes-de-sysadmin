### The Eraser, chapter 2 — The Village. Search, create, copy, delete:
### grep, touch, cp, mkdir, rm. The Town Hall notices are read line by
### line by grep: keep one sentence per line. The creature keeps its name,
### "the Effaceur", because the player types "grep Effaceur".

chapitre-bourg = The Village
    .resume = Search, create, copy, delete: grep, touch, cp, mkdir, rm.
bourg-crieur =
    Captain Ana's boat drops you off on the quay of a village. A town
    crier is waving his bell.

    "Hear ye! The Effaceur has come through the Village! The bakery has no
    more sourdough starter, the clock has stopped, the school has no classroom,
    and little Nour has disappeared! Who will help us?"

    He hands you a scroll:  cat parchemin_des_sorts.txt
bourg-parchemin-des-sorts =
    THE SCROLL OF SPELLS — five new commands

      grep pattern file     finds the lines that contain a pattern
      touch name            creates an object (an empty file)
      cp source dest        copies an object (copy)
      mkdir Name            creates a place (make directory)
      rm object             deletes an object (remove) — forever!

    Reminder: "man grep" (or man cp, man rm…) gives the instructions, and
    "grep --help" a summary. Forgotten which command copies?
    "man -k copy" searches all the manuals.

    The people of the Village need you: the Boulangerie, the Atelier, the Ecole,
    the Mairie… Start wherever you like.
bourg-marchande =
    "Nothing left to sell, the Effaceur took everything! Well, almost: look
    at my stalls."

    She lowers her voice: "A word of advice. Before deleting anything with
    rm, think hard. There is no recycle bin on Linux. That's how the
    Effaceur works: rm, rm, rm, without ever looking back."
bourg-pomme = A slightly wrinkled apple.
bourg-pomme-2 = Another apple, just as wrinkled.
bourg-fromage = A wheel of very smelly cheese. "The only product the Effaceur wouldn't touch," says the market trader.
bourg-fromage-protege-rm = "Don't touch my last cheese!" protests the market trader.
bourg-boulanger =
    The baker stares at his empty kneading trough.

    "The Effaceur took everything. I only have one sourdough starter left, and
    I need three for the three morning batches. Ah, if only I had
    three!"

    (cp levain levain_2 creates a copy of the starter.)
bourg-levain = A jar of sourdough starter, gently bubbling. It's alive, it feeds… and it can be copied.
bourg-levain-protege-rm = "Not my last starter!" shouts the baker.
bourg-artisane =
    The craftswoman rummages through her empty drawers.

    "Ah, help! The Effaceur erased all my gears, and without them,
    the Village clock no longer turns. Do you know how to make an object? It only
    takes one command:

      touch engrenage

    Then I'd need five in all. Making things takes a long time… copying
    is quick."
bourg-institutrice =
    The teacher is holding class… in the playground, for lack of a room.

    "The Effaceur erased our Classe! A classroom is a place.
    Do you know how to build one?"

    (mkdir Name creates a place.)
bourg-greffiere =
    The clerk is buried under posters.

    "Every resident has put up a notice since the Effaceur came through. One
    of them says where it went, but which one? I don't have time to
    read them all. Neither do you.

    Use grep: it searches for a word in files and prints the lines
    that contain it. The star * means "all the files here":

      grep Effaceur *
bourg-avis-bal =
    NOTICE: Saturday's dance is going ahead.
    Bring paper lanterns.
bourg-avis-chat =
    LOST: ginger cat, answers to the name Pixel.
    Reward: one cheese.
bourg-avis-egouts =
    NOTICE FROM THE SEWER WORKERS
    We saw the Effaceur go down into the Egout, at the far end of the Cour off the Ruelle.
    Little Nour followed it. The rats let nobody through.
    The key to the Archives is under the Mairie's doormat (a hidden object, of course).
bourg-avis-marche =
    MARKET: open on Thursdays.
    Cheeses, apples, and that's about it.
bourg-avis-horloge =
    NOTICE: the clock has stopped.
    As long as it isn't turning, the gate of the Ruelle stays closed.
bourg-paillasson = Under the doormat, a small key. You take it.
bourg-paillasson-lu = The door of the Archives is open.
bourg-archiviste =
    An archivist is working by candlelight.

    "You found the key! So you know how to use grep. I've been studying
    the Effaceur for years. It's all in the chronicle, but it's
    long. Look for the lines that talk about it:

      grep Effaceur chronique.txt

    And if you're not sure whether it has a capital letter, add -i:

      grep -i effaceur chronique.txt
bourg-chronique =
    CHRONICLE OF THE KINGDOM

    Year 1: the Village is founded by the sea.
    Year 12: the quay is built, with stone from the island.
    Year 40: the Effaceur is created at the Root to empty the Recycle Bin.
    Year 41: a great batch of bread for the sourdough festival.
    Year 77: the clockmaker's house is extended.
    Year 102: the Effaceur now obeys only one order: erase everything.
    Year 103: it is said that only the person who started it can stop it.
    Year 104: the apple fair is cancelled (it's raining).
    Year 130: the island's lighthouse is lit to guide the boats.
    Year 131: the Effaceur lives at the Root, at the very bottom, beneath the Village sewers.
bourg-archives-bloque = The door of the Archives is locked. The posters at the Mairie may tell you more.
bourg-barricade = A barricade of planks, barrels and broken chairs, put up in a hurry. Far too heavy to be moved.
bourg-barricade-protege-mv = You pull with all your might… nothing. The barricade is too heavy for mv. But you know a more radical spell.
bourg-mur = A paved courtyard. At the far end, a half-open manhole cover: the Egout.
bourg-rats =
    An army of rats is blocking the way.

    "Squeak! Nobody gets through without paying. We want CHEESE, here,
    right now!"

    There is a cheese at the Marche. To copy one here without going back,
    give its full path and . (the place where you are) as the destination:

      cp ~/Marche/fromage .
bourg-nour =
    Nour is sitting at the edge of a big Toboggan that plunges into the dark.

    "Thank you for coming! I followed the Effaceur all the way here. It slid down
    this Toboggan, towards the Root, muttering: "erase, erase, the order
    of the root…" Then the rats blocked my way."
bourg-galerie-bloque = "Squeak!" The rats block the Galerie.
bourg-cour-bloque = A barricade blocks the entrance to the Cour.
bourg-ruelle-bloque = The gate of the Ruelle is closed. It opens at a set time… but the Village clock has stopped.
bourg-evenement-levain = "Three starters!" The baker can't believe it. "A copy is a new object, identical to the original. Thank you!"
bourg-evenement-engrenage = "A gear! Perfect. Only four more… with cp, it'll be quick."
bourg-evenement-engrenages = Tick, tock… The Village clock starts turning again! At the first stroke of noon, the gate of the Ruelle creaks open.
bourg-evenement-classe = A Classe rises at the Ecole. The children rush into it.
bourg-evenement-classe-sans-nour = A Classe rises at the Ecole. The children rush into it. "Only one pupil is missing," sighs the teacher: "Nour."
bourg-evenement-barricade =
    Poof! The barricade disappears. The Cour is accessible.
    (No recycle bin: it will never come back.)
bourg-evenement-rats = The rats pounce on the cheese and carry it off into a hole. The Galerie is clear.
bourg-evenement-nour-sans-classe = "I'd like to go back," says Nour, "but the Effaceur erased my Classe. Can you rebuild it, at the Ecole?" (mkdir)
bourg-evenement-nour =
    Nour runs to join her brand-new Classe.

    Well done! You have finished chapter 2.

    You now know how to search (grep), create (touch, mkdir), copy (cp) and
    delete (rm) — carefully, since there is no recycle bin.

    The Effaceur is hiding at the Root, at the bottom of the Toboggan: chapter 3
    awaits you.
