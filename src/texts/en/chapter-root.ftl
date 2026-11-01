### The Eraser, chapter 3 — The Root. Permissions and administration:
### ls -l, chmod, whoami, sudo. The tree is that of a real Linux
### (/home, /etc, /var/log, /root): those system paths are not
### translated. The other place and file names (memories, eraser.conf,
### /Kingdom/Bin…), and the account names (you, and the daemon's user
### "eraser"), come from names.ftl.

chapter-root = The Root
    .summary = Permissions and administration: ls -l, chmod, whoami, sudo.
root-arrival =
    You whizz down the slide and land… in a room that feels
    familiar. On the door, a plate: /home/you.

    Your home. The real one. At the very bottom of the kingdom, at the Root ("/"), places
    finally have their real Linux names: /home for the users'
    homes, /etc for settings, /var/log for logs, /root
    for the administrator.

    Read the manual lying on the table:  cat admin_manual.txt
root-manual-admin =
    THE ADMINISTRATOR'S MANUAL

    Every object and every place has an OWNER and PERMISSIONS.
    To see them:  ls -l

      d rwx r-x r-x   you   you   4096  memories/
      │  │   │   │     └─ owner
      │  │   │   └─ others: r-x
      │  │   └─ the group: r-x
      │  └─ the owner: rwx
      └─ d = a place (directory), - = an object (file)

    (ls -l writes the three groups stuck together: drwxr-xr-x.)

      r  read
      w  write              for a place: create, delete, rename inside it
      x  execute            for a place: enter it, go through it

    chmod changes permissions (only the owner can do it):
      chmod o-w place   takes away from others (o) the right to write (w)
      chmod 755 place   rwx for the owner, r-x for everyone else

    whoami tells you who you are. root has ALL the rights. To act as
    root, you put sudo in front of the command. sudo asks for YOUR password.

    Your password? The Eraser made you forget it, along with everything else.
    Maybe you wrote it down somewhere at home… Your journal.txt is long: grep is
    made for that. (Quotes keep the spaces: grep "my password" …)
root-journal =
    JOURNAL

    Year 98: I'm entrusted with administering the kingdom. A great responsibility.
    Year 99: installed the clock in the Village. The gears turn nicely.
    Year 100: the Bin is overflowing. It's just a folder where everyone drops what they want to throw away: we need a program to empty it for good.
    Year 101: I'm writing the Eraser, a little daemon that will empty the Bin.
    Year 102: wrote the Eraser's configuration in /etc. No time to proofread it.
    Year 102: my password changes. I'm writing it down here (very bad idea!): sunflower
    Year 102: Started the Eraser. It runs as its own user, "eraser".
    Year 103: disaster. The Bakery's sourdough disappears. Then the gears.
    Year 103: I found the mistake in the configuration. I prepared a fixed version, here, in my home.
    Year 103: it must be installed with sudo before the Eraser reaches me.
# Configuration file: keep the line "target = /Kingdom/Bin"
# as is (the game checks it: nom-cible = /nom-Royaume/nom-Corbeille in names.ftl).
root-eraser-conf-fixed =
    # The Eraser's configuration — fixed version (year 103)
    # On every pass, the daemon deletes everything found in the target.
    target = /Kingdom/Bin
root-memory-school = A classroom. Someone is teaching you to count in binary on your fingers: up to 31 with just one hand.
root-memory-first-program = Your very first program. It printed "Hello" and you shouted with joy.
root-memory-garden = A garden full of sunflowers. You loved their colour.
root-memory-song = A song you used to hum while fixing servers.
root-memory-journey = A train journey, your nose pressed against the window.
root-memory-friend = A friend who used to tell you: "Always read it again before pressing Enter."
root-memory-library = A huge library, where you learned the word "Unix".
root-memory-first-server = The first server you were in charge of. It purred like a cat.
root-journal-private-root =
    You could read it: root has all the rights. But it's Nour's private diary. You close it without reading it.
    (#1: respect the privacy of others.)
# Faulty configuration: keep the line "target = /Kingdom /Bin" (with the space).
root-eraser-conf =
    # The Eraser's configuration — written by: you (year 102)
    # On every pass, the daemon deletes everything found in the target.
    target = /Kingdom /Bin
root-sudoers =
    # Who is allowed to use sudo, and for what.
    root    ALL=(ALL:ALL) ALL
    you     ALL=(ALL:ALL) ALL   # you: administrator of the kingdom
# Daemon log: one entry per line (read with grep).
root-eraser-log =
    {"["}year 102] starting the eraser daemon (user: eraser)
    {"["}year 102] reading /etc/eraser.conf
    {"["}year 102] target = /Kingdom /Bin
    {"["}year 102] 2 targets found: "/Kingdom" and "/Bin"
    {"["}year 102] deleting /Kingdom/Bin/old_papers
    {"["}year 102] deleting /Kingdom/Village/Bakery/sourdough_4
    {"["}year 103] deleting /Kingdom/Village/Bakery/sourdough_5
    {"["}year 103] deleting /Kingdom/Village/Workshop/gear_12
    {"["}year 104] deleting /Kingdom/Island/Lighthouse/bulb
    {"["}year 131] new target reachable: /home/you/memories (permissions: rwxrwxrwx)
root-notes-root =
    If you're reading this, you are root (or you used sudo).

    root can read everything, change everything, delete everything, including
    the system itself. That's why you never work as root day to day:
    you use sudo, for a single command, when it's needed.
root-event-alert =
    Suddenly, a crackling sound from the memories place… The Eraser is here! With
    each of your commands, it will delete one of your memories.

    Look at the permissions:  ls -l
    The memories place is rwxrwxrwx: everyone, including the user
    "eraser", is allowed to write in it, and so to delete in it. Take that
    right away from others (o), quick:

      chmod o-w memories
root-event-conf-erased =
    The daemon looks for its configuration… and can't find it anymore. It stops.
    That's better than nothing, but now nobody empties the Bin. A correct
    configuration is missing in /etc: the daemon only reads the file
    /etc/eraser.conf, under that exact name.

# { $souvenir }: name of the deleted file (technical identifier)
root-memory-erases = ✗ A memory fades away: { $souvenir }
# { $sauves }: memories saved; { $total }: number of memories at the start
root-event-protected =
    The Eraser keeps attacking your memories… "Permission denied". It
    backs off. On Linux, deleting a file means changing the place that
    contains it: without the right to write in that place, nothing can be deleted there.

    You saved { $sauves ->
        [one] { $sauves } memory
       *[other] { $sauves } memories
    } out of { $total }. But the Eraser carries on elsewhere, throughout
    the kingdom. Where do its orders come from? Daemons write what they do
    in a log:

      cat /var/log/eraser.log
# { $perte }: "oui" if memories were deleted, otherwise "non"
root-event-fixed =
    The daemon rereads its configuration: "target = /Kingdom/Bin". Just one
    target, this time. The Eraser stops dead… then starts emptying the
    Bin, just like on the first day.

    And it all comes back to you. You were the administrator of the kingdom. You
    were the one who wrote this configuration, with one space too many: "/Kingdom
    /Bin" instead of "/Kingdom/Bin". For the Eraser, that
    made two targets, one of them the whole kingdom. It wasn't evil: it
    did exactly what it had been told.

    You saved { $sauves ->
        [one] { $sauves } memory
       *[other] { $sauves } memories
    } out of { $total }.{ $perte ->
        [oui] {" "}The ones that are gone won't come back: rm goes through no bin… unless you made backups. But that's another story.
       *[non] {""}
    }

    THE KINGDOM IS SAVED. (One last chapter awaits you: The Backup,
    so that nothing gets lost ever again.)

    You now know about permissions (ls -l, chmod), the difference between
    a user and root, and sudo — with its three rules. The second one is
    the most important: think before you type.
