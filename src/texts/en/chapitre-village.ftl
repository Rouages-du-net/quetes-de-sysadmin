### The Eraser, chapter 2 — The Village. Search, create, copy, delete:
### grep, touch, cp, mkdir, rm. The Town Hall notices are read line by
### line by grep: keep one sentence per line. The creature keeps its name,
### "the Eraser" (the hints suggest "grep Eraser"). Place and file names
### (Quay, Bakery, sourdough, gear…) come from noms.ftl.

chapitre-village = The Village
    .resume = Search, create, copy, delete: grep, touch, cp, mkdir, rm.
village-crieur =
    Captain Ana's boat drops you off on the Quay of a village. A town
    crier is waving his bell.

    "Hear ye! The Eraser has come through the Village! The bakery has no
    more sourdough starter, the clock has stopped, the school has no classroom,
    and little Nour has disappeared! Who will help us?"

    He hands you a scroll:  cat scroll_of_spells.txt
village-parchemin-des-sorts =
    THE SCROLL OF SPELLS — five new commands

      grep pattern file     finds the lines that contain a pattern
      touch name            creates an object (an empty file)
      cp source dest        copies an object (copy)
      mkdir Name            creates a place (make directory)
      rm object             deletes an object (remove) — forever!

    Reminder: "man grep" (or man cp, man rm…) gives the instructions, and
    "grep --help" a summary. Forgotten which command copies?
    "man -k copy" searches all the manuals.

    The people of the Village need you: the Bakery, the Workshop, the
    School, the TownHall… Start wherever you like.
village-marchande =
    "Nothing left to sell, the Eraser took everything! Well, almost: look
    at my stalls."

    She lowers her voice: "A word of advice. Before deleting anything with
    rm, think hard. rm puts nothing in a bin: what it deletes is gone for
    good. Our Bin, in the Kingdom, is just a folder where everyone drops
    what they want to throw away; the Eraser is the one who empties it, with
    rm, rm, rm, without ever looking back."
village-pomme = A slightly wrinkled apple.
village-pomme-2 = Another apple, just as wrinkled.
village-fromage = A wheel of very smelly cheese. "The only product the Eraser wouldn't touch," says the market trader.
village-fromage-protege-rm = "Don't touch my last cheese!" protests the market trader.
village-boulanger =
    The baker stares at his empty kneading trough.

    "The Eraser took everything. I only have one sourdough starter left, and
    I need three for the three morning batches. Ah, if only I had
    three!"

    (cp sourdough sourdough_2 creates a copy of the starter.)
village-levain = A jar of sourdough starter, gently bubbling. It's alive, it feeds… and it can be copied.
village-levain-protege-rm = "Not my last starter!" shouts the baker.
village-artisane =
    The craftswoman rummages through her empty drawers.

    "Ah, help! The Eraser erased all my gears, and without them,
    the Village clock no longer turns. Do you know how to make an object? It only
    takes one command:

      touch gear

    Then I'd need five in all. Making things takes a long time… copying
    is quick."
village-institutrice =
    The teacher is holding class… in the playground, for lack of a room.

    "The Eraser erased our Classroom! A classroom is a place.
    Do you know how to build one?"

    (mkdir Name creates a place.)
village-greffiere =
    The clerk is buried under posters.

    "Every resident has put up a notice since the Eraser came through. One
    of them says where it went, but which one? I don't have time to
    read them all. Neither do you.

    Use grep: it searches for a word in files and prints the lines
    that contain it. The star * means "all the files here":

      grep Eraser *
village-avis-bal =
    NOTICE: Saturday's dance is going ahead.
    Bring paper lanterns.
village-avis-chat =
    LOST: ginger cat, answers to the name Pixel.
    Reward: one cheese.
village-avis-egouts =
    NOTICE FROM THE SEWER WORKERS
    We saw the Eraser go down into the Sewer, at the far end of the Yard off the Alley.
    Little Nour followed it. The rats let nobody through.
    The key to the Archives is under the TownHall's doormat (a hidden object, of course).
village-avis-marche =
    MARKET: open on Thursdays.
    Cheeses, apples, and that's about it.
village-avis-horloge =
    NOTICE: the clock has stopped.
    As long as it isn't turning, the gate of the Alley stays closed.
village-paillasson = Under the doormat, a small key. You take it.
village-paillasson-lu = The door of the Archives is open.
village-archiviste =
    An archivist is working by candlelight.

    "You found the key! So you know how to use grep. I've been studying
    the Eraser for years. It's all in the chronicle, but it's
    long. Look for the lines that talk about it:

      grep Eraser chronicle.txt

    And if you're not sure whether it has a capital letter, add -i:

      grep -i eraser chronicle.txt
village-chronique =
    CHRONICLE OF THE KINGDOM

    Year 1: the Village is founded by the sea.
    Year 12: the quay is built, with stone from the island.
    Year 40: the Eraser is created at the Root to empty the Recycle Bin.
    Year 41: a great batch of bread for the sourdough festival.
    Year 77: the clockmaker's house is extended.
    Year 102: the Eraser now obeys only one order: erase everything.
    Year 103: it is said that only the person who started it can stop it.
    Year 104: the apple fair is cancelled (it's raining).
    Year 130: the island's lighthouse is lit to guide the boats.
    Year 131: the Eraser lives at the Root, at the very bottom, beneath the Village sewers.
village-archives-bloque = The door of the Archives is locked. The posters at the TownHall may tell you more.
village-barricade = A barricade of planks, barrels and broken chairs, put up in a hurry. Far too heavy to be moved.
village-barricade-protege-mv = You pull with all your might… nothing. The barricade is too heavy for mv. But you know a more radical spell.
village-mur = A paved courtyard. At the far end, a half-open manhole cover: the Sewer.
village-rats =
    An army of rats is blocking the way.

    "Squeak! Nobody gets through without paying. We want CHEESE, here,
    right now!"

    There is a cheese at the Market. To copy one here without going back,
    give its full path and . (the place where you are) as the destination:

      cp ~/Market/cheese .
village-nour =
    Nour is sitting at the edge of a big slide that plunges into the dark.

    "Thank you for coming! I followed the Eraser all the way here. It slid down
    this slide, towards the Root, muttering: "erase, erase, the order
    of the root…" Then the rats blocked my way."
village-galerie-bloque = "Squeak!" The rats block the Tunnel.
village-cour-bloque = A barricade blocks the entrance to the Yard.
village-ruelle-bloque = The gate of the Alley is closed. It opens at a set time… but the Village clock has stopped.
village-evenement-levain = "Three starters!" The baker can't believe it. "A copy is a new object, identical to the original. Thank you!"
village-evenement-engrenage = "A gear! Perfect. Only four more… with cp, it'll be quick."
village-evenement-engrenages = Tick, tock… The Village clock starts turning again! At the first stroke of noon, the gate of the Alley creaks open.
village-evenement-classe = A Classroom rises at the School. The children rush into it.
village-evenement-classe-sans-nour = A Classroom rises at the School. The children rush into it. "Only one pupil is missing," sighs the teacher: "Nour."
village-evenement-barricade =
    Poof! The barricade disappears. The Yard is accessible.
    (rm goes through no bin: it will never come back.)
village-evenement-rats = The rats pounce on the cheese and carry it off into a hole. The Tunnel is clear.
village-evenement-nour-sans-classe = "I'd like to go back," says Nour, "but the Eraser erased my Classroom. Can you rebuild it, at the School?" (mkdir)
village-evenement-nour =
    Nour runs to join her brand-new Classroom.

    Well done! You have finished chapter 2.

    You now know how to search (grep), create (touch, mkdir), copy (cp) and
    delete (rm) — carefully, since rm goes through no bin.

    The Eraser is hiding at the Root, at the bottom of the slide: chapter 3
    awaits you.
