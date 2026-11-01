### The Eraser, chapter 1 — Lighthouse Island. Finding your way and moving
### around: ls, cd, pwd, cat, less, mv, hidden files. Place and file names
### (Hut, Pier, .spare_bulb…) come from noms.ftl.

chapitre-lighthouse = Lighthouse Island
    .resume = Finding your way and moving around: ls, cd, pwd, cat, mv, hidden files.
lighthouse-bienvenue =
    You wake up in a fisher's Hut, on a small island. In front of
    you, a black screen and a blinking cursor.

    In this world, every PLACE is a directory and every OBJECT is a file.
    That's exactly how Linux organises everything.

    To look around, type:                 ls
    To move into a place, type:           cd PlaceName
    To read an object, type:              cat file_name

    And if you forget how a command works, ask the manual:
      man ls
    It's the first reflex of everyone who runs servers: look it up in the
    manual before asking.

    Start by reading the message:  cat message.txt
lighthouse-message =
    "If you are reading this, the Eraser has come to the island.

    A creature roams the kingdom and erases everything it touches. Last
    night, it erased the bulb of the Lighthouse. Without light, no boat can
    enter the Harbour, and nobody can leave the island to reach the
    Village, where help is needed.

    First climb up to the Signal School (SignalSchool), on the Hill: they
    will teach you the commands there. Then come and find me at the
    Lighthouse, at the end of the Pier.

                                  — Maëlle, lighthouse keeper"
lighthouse-panneau =
    "Pebble Beach."

    You can always go back: ".." means the parent place.
    Try:  cd ..

    And if you get lost, "pwd" (print working directory) tells you where
    you are.
lighthouse-ravaudeuse =
    A woman is mending nets next to an old ternary computer.

    "Hello, traveller. Me, I was programming before anyone said
    'software'. Two tips:

      - the Tab key completes names for you: type "cat me" then Tab;
      - the up arrow brings back your previous commands.

    And beware of the Eraser. It doesn't destroy out of malice: it obeys
    an order that someone gave it, a long time ago."
lighthouse-coquillage = A pearly seashell. If you hold it to your ear, you hear… a server fan.
lighthouse-vent = The wind blows hard on the Hill. Down below, the Pier and the dark Lighthouse.
lighthouse-directrice =
    The head of the Signal School welcomes you between two coloured
    flags.

    "Welcome! You already know how to look (ls), move (cd) and read (cat).
    You're missing one essential command: mv (move), which moves an object.

      mv object Place

    Go and practise in the PracticeRoom. The Lessons are open to all, and
    the Library keeps the Book of commands.

    And remember the School's motto: "When in doubt, read the manual."
    man mv will tell you everything about mv."
lighthouse-consigne =
    EXERCISE: a crab has escaped from the aquarium. Put it back in the
    Bucket.

      mv crab Bucket

    Then check with  ls  and  ls Bucket
lighthouse-crabe = A small green crab. It walks sideways, looking very busy.
lighthouse-cours-1-manuel =
    LESSON 1 — THE MANUAL

    Every command has its manual. Type  man  followed by the command name:

      man ls
      man mv

    A manual page always has the same parts: NAME (what it's for),
    SYNOPSIS (how to write it; what is in square brackets [ ] is optional),
    DESCRIPTION, OPTIONS (the letters after a dash, like -a), EXAMPLES, and
    SEE ALSO (related commands).

    Two shortcuts:
      ls --help        a quick summary of the command
      man -k hidden    which commands talk about "hidden"?

    On a real Linux, the manual opens full screen: you scroll through it
    with the arrows, search with /word, and quit with q.
lighthouse-cours-2-chemins =
    LESSON 2 — PATHS

    A path says where a place or an object is.

      {"."}.            the parent place (one level up)
      {"."}             the place where you are
      ~             your home
      /             the root, at the very top

    A RELATIVE path starts from where you are:  cd Lessons
    An ABSOLUTE path starts from the root:      cd /Hut/Beach
    You can chain places with /:                cat ../headteacher.txt
    And ~/ starts from your home:               ls ~/Harbour

    Try:  cd ~  then  pwd
lighthouse-cours-3-caches =
    LESSON 3 — WHAT YOU CAN'T SEE

    On Linux, a file whose name starts with a dot is HIDDEN: a plain "ls"
    doesn't show it. It's not a protection, just a way of storing settings
    so they don't get in the way.

    To see everything, ls has an option. Which one? I won't tell you: it's
    in the manual.  man ls

    There is a hidden file in this classroom. It's up to you to find it.
lighthouse-note-secrete =
    Well spotted! You found a hidden file.

    Remember this: on an island, precious things are stored safely out of
    sight. And things stored out of sight often get a name that starts
    with a dot.
lighthouse-cours-4-renommer =
    LESSON 4 — RENAMING

    mv isn't only for moving: if the destination isn't an existing place,
    mv RENAMES the object.

      mv draft.txt letter.txt     (draft.txt is now called letter.txt)

    You can even move AND rename in one go, by giving the new name at the
    end of the path:

      mv draft.txt ~/Harbour/letter.txt

    On Linux, moving and renaming are the same operation: changing a
    file's path.
lighthouse-livre-des-commandes =
    THE BOOK OF COMMANDS

      ls       lists what is here (list); ls -a also shows hidden ones
      cd       changes place (change directory)
      pwd      shows where you are (print working directory)
      cat      shows the content of a file (concatenate)
      less     the same, page by page (for long files)
      mv       moves or renames (move)
      man      the manual of a command, e.g.: man ls
      clear    clears the screen

    These commands have existed since the 1970s: they come from Unix, the
    ancestor of Linux and macOS. The people who run the internet's servers
    type them every day.
lighthouse-capitaine =
    Captain Ana is pacing up and down the quay.

    "My boat can take you to the Village. But without the Lighthouse,
    there's no way to get past the reefs after nightfall. Light it again,
    and we'll set off!"
lighthouse-inventaire = The Harbour's Boathouse: oars, buoys, an anchor. There's still room.
lighthouse-etiquette = The keeper's Storeroom. Crates of spare parts… almost all empty: the Eraser came through.
lighthouse-ampoule-de-secours = A big lighthouse bulb, stored safely. A label says: "For the Lantern."
lighthouse-filet = A huge, tangled fishing net blocking the door of the Lighthouse. It would be better stored in the Harbour's Boathouse.
lighthouse-indice =
    Carved on a stone post:

      "What clutters the Pier belongs in the Boathouse.
        ~ always takes you back home, where the path to the Harbour starts."

    (Try:  mv net ~/Harbour/Boathouse)
lighthouse-gardienne =
    Maëlle, the lighthouse keeper, is waiting for you at the foot of the
    stairs.

    "There you are! The Lantern only lights up with an object called
    exactly bulb, placed in the Lantern. The Eraser erased ours.

    I have a spare one left, stored safely in the Harbour's Storeroom. You won't
    see it with a plain ls: like everything stored out of sight, its name
    starts with a dot. (The ls manual says how to see everything.)

    Bring it back to the Lantern, under its proper name. mv can move and
    rename: look at the EXAMPLES in man mv."
lighthouse-marches = A hundred and twenty spiral steps. At the very top, the Lantern.
lighthouse-lanterne =
    The great lens of the lighthouse, all rings of glass. In the centre,
    the bulb holder is empty. A plate reads:

      "Bulb — exact name: bulb"
lighthouse-phare-bloque = A huge tangled net blocks the door of the Lighthouse. It should be moved (mv) somewhere else…
lighthouse-evenement-crabe = The crab is back in its bucket. The head of the school applauds: you know how to move an object with mv.
lighthouse-evenement-filet = The net is put away. The door of the Lighthouse is clear.
lighthouse-evenement-mauvais-nom = The bulb is in the Lantern all right… but the holder refuses any object that isn't called exactly bulb. Rename it with mv.
lighthouse-evenement-lumiere =
    The Lighthouse lights up! A beam sweeps across the sea, and at the Harbour,
    Captain Ana hoists the sail.

    Well done! You have finished chapter 1.

    You now know how to move around (cd, .., ~), look (ls, ls -a), read
    (cat, less), find where you are (pwd), move and rename (mv). These are
    the same commands as on the real servers that run the internet.

    The boat takes you to chapter 2, "The Village".
