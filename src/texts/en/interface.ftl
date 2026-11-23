### Game interface: choosing stories and chapters, terminal,
### progress. One whole sentence per message; variables between { }.

stories-title = Stories
# { $story }: title of the story
chapters-title = Chapters of "{ $story }"
chapter-number = Chapter { $number }
chapter-title-complete = { $story } — chapter { $number }: { $title }
state-story-finished = ✓ Completed
state-chapters-done =
    { $finished ->
        [one] { $finished } chapter
       *[other] { $finished } chapters
    } of { $total }
state-chapter-finished = ✓ Completed
state-locked = 🔒 Finish the previous chapter
state-key-missing = 🔒 Locked
# { $chapters }: the titles of the chapters still to finish (formatted list)
state-key-after = 🔒 After { $chapters }
# { $title }: a chapter title, in the list above
state-key-chapter = “{ $title }”
key-help = 🔑 These stories open little by little: under each name, the chapters to finish before you receive its key. The first ones open after The Root (The Eraser, chapter 3).
stories-locked = { $count ->
    [one] 🔒 One story still locked
   *[other] 🔒 { $count } stories still locked
}
button-next = Next chapter →
button-restart = Restart this chapter
tips = Tips: Tab completes command, folder and file names, ↑ recalls commands, "help" lists the ones you know, "man command" opens the manual, "exit" takes you back to your workstation. As in most Linux terminals, selecting text copies it and right-clicking pastes it. Your progress is saved in this browser.
# { $lines }: number of lines not shown
output-cut =
    { $lines ->
        [one] (… { $lines } line above, not shown)
       *[other] (… { $lines } lines above, not shown)
    }
workstation-title = Your workstation
## The story menu: two views
view-title = How to show the stories
view-network = Network map
view-internet = Internet
input-label = Command
credit = Quêtes de Sysadmin, a free game (GPL v3, texts CC BY-SA 4.0), inspired by Terminus, created at MIT by Shawn Conrad and Michele Pratusevich.
credit-link-project = The project
credit-link-original = Terminus

## The sysadmin's notebook

notebook-title = The sysadmin's notebook
# { $count }: the number of commands noted
notebook-account = { $count ->
    [0] (empty)
    [one] ({ $count } command)
   *[other] ({ $count } commands)
}
notebook-help = Every command you run for the first time is added here, with what it does and the line you typed. Your cheat sheet, to take with you.
notebook-empty = Nothing yet: run a command (ls, for example) and it will be written here.
notebook-export = Download (Markdown)
notebook-copy-button = Copy
notebook-copy = Copied to the clipboard.
notebook-copy-impossible = This browser refuses access to the clipboard: use the download instead.
# The name of the downloaded file: no spaces or hard-to-type characters.
notebook-file = sysadmin-notebook.md
# At the top of the Markdown file. { $count }: the number of commands
notebook-markdown-intro = { $count ->
    [one] One command learnt while playing Quêtes de Sysadmin.
   *[other] { $count } commands learnt while playing Quêtes de Sysadmin.
}
notebook-progress = Progress
notebook-progress-empty = No chapter completed yet.
# { $story }: the title of the story; { $finished } and { $total }: chapters completed and in total
notebook-progress-story = { $story }: { $finished ->
    [one] { $finished } chapter completed
   *[other] { $finished } chapters completed
} of { $total }
# { $chapter }: the title of the chapter where the command was first used
notebook-discovery = Discovered in "{ $chapter }".
# { $command }: the command that opens the manual (man ls)
notebook-manual = To go further: { $command }

## Links to Les rouages du net (after a chapter)

rouages-intro = To understand what happens under the hood, on Les rouages du net (in French):
rouages-link-entree-nom = "From the Enter key to the page": the name becomes an address (DNS)
rouages-link-entree-box = "From the Enter key to the page": your router and your local network
rouages-link-entree-liaison = "From the Enter key to the page": opening the connection (TCP, ports)
rouages-link-entree-cadenas = "From the Enter key to the page": the padlock (TLS, certificates)
rouages-link-entree-voyage = "From the Enter key to the page": the journey of packets
rouages-link-entree-serveur = "From the Enter key to the page": the server answers
rouages-link-ordinateur-binaire = "How a computer works": everything is a number
rouages-link-ordinateur-memoire = "How a computer works": memory
rouages-link-glossaire-ttl = Glossary: TTL
rouages-link-glossaire-port = Glossary: port
rouages-link-glossaire-nat = Glossary: NAT
rouages-link-glossaire-routeur = Glossary: router
rouages-link-glossaire-commutateur = Glossary: switch
rouages-link-glossaire-hebergeur = Glossary: hosting provider
rouages-link-glossaire-chiffrement = Glossary: encryption
rouages-link-glossaire-autorite-certification = Glossary: certificate authority
rouages-link-glossaire-code-http = Glossary: HTTP status code
rouages-link-glossaire-requete = Glossary: request
rouages-link-glossaire-datacenter = Glossary: data centre
rouages-link-glossaire-octet = Glossary: byte

## Exam mode

exam-case = Exam mode: no hints, with a timer (the chapter restarts)
# { $time }: the elapsed time, in minutes:seconds
exam-timer = ⏱ { $time }
# The confirmation, when a chapter is in progress (exam mode restarts it).
exam-confirm-title = Switch to exam mode?
exam-confirm-text = The current chapter will restart from the beginning, on a fresh machine: what you have already done in it will be lost. Finished chapters stay finished.
exam-confirm = Restart in exam mode
exam-quit-title = Leave exam mode?
exam-quit-text = The current chapter will restart from the beginning, with hints: what you have already done in it will be lost. Finished chapters stay finished.
exam-quit = Restart without exam mode
exam-cancel = Cancel
exam-start = Exam mode: no hints will be shown, the timer is running. Your mission is in the welcome message (read it again with cat). The debrief will come at the end. To start from scratch, machine and timer: "Restart this chapter", below the terminal.
# { $time }: the time of this game; { $record }: the best time in this browser
exam-finished = Exam passed in { $time }. Your best time on this chapter: { $record }.
exam-finished-record = Exam passed in { $time }: that's your best time on this chapter.

## The map (a button next to the terminal; see src/engine/map.ts)

map-button = Map
# { $machine }: the name of the machine you are on (kingdom, desk…).
map-title = Map of { $machine }
map-caption = The places (directories) you know on this machine: the ones you have entered, and in italics the ones you have only glimpsed. Files are not shown: for those, use ls.
map-here = ← you are here
map-home = your home, ~
map-closed = locked for now
map-preview = not visited yet
map-close = Close

## The network plan ("Network" tab of the map; see src/engine/plan.ts)

map-tab-places = Places
map-tab-network = Network
plan-caption = The network as the team planned it, like the diagram on the wall: what should be, not necessarily what is. To check: ip a, ip route, ping, wg show… Dotted links go through a WireGuard tunnel.
plan-version-text = The plan as a list
plan-internet = Internet
plan-your-workstation = your workstation
plan-here = you are here
plan-visit = already connected
plan-not-visit = not connected yet
plan-tunnel = through the WireGuard tunnel
plan-dhcp = DHCP
plan-network-internal = internal network
plan-note-gateway = gateway
plan-note-wiki = wiki
plan-note-archives = backups
plan-note-host = website host
plan-note-router = router
# { $id }: the VLAN number; { $name }: its name in the configuration (offices, guests…).
plan-vlan = VLAN { $id } · { $name }
plan-note-remote-work = remote work
plan-annex = Annex router
plan-note-annex = second site
plan-network-annex = Annex network

## My progress (see src/engine/progress.ts)

# The notebook's title when a name is given.
notebook-title-of = { $name }'s notebook
progress-button = My progress
progress-title = My progress
progress-intro = Your progress stays in this browser. To carry on on another machine (another lab room, at home), take it with you with the code or the file. Nothing is sent anywhere.
progress-name = Your name (optional)
progress-name-help = It goes at the top of your notebook ("…'s notebook") and in your saves.
progress-code-title = The code, to copy down
progress-code-help = It holds the finished chapters, nothing else: not the notebook, not the keys you created. Write it down, then type it on the other machine.
progress-copy = Copy
progress-code-input = Resume with a code:
progress-resume = Resume
progress-file-title = The file, to take everything
progress-file-help = Chapters, notebook, keys you created, ssh config, exam mode records. Keep it on a USB stick or send it to yourself.
progress-download = Download my save
progress-file-input = Resume from a file:
progress-name-file = quetes-de-sysadmin.json
progress-downloaded = Save downloaded.
# { $count }: the finished chapters in the file.
progress-confirm = Resume this save ({ $count ->
        [one] { $count } finished chapter
       *[other] { $count } finished chapters
    })? It will replace everything kept in this browser.
progress-nothing-new = This code adds no chapter to the ones you have already finished here.
progress-code-unreadable = This is not a progress code: it starts with QDS, followed by groups of letters and digits.
progress-code-mistake = This code has a typo: check it, character by character.
progress-code-too-recent = This code comes from a newer version of the game: reload the page.
progress-file-unreadable = This file is not a readable save (JSON).
progress-file-other = This file is not a Sysadmin Quests save.
progress-file-too-recent = This save comes from a newer version of the game: reload the page.

## The mission, the key bar, Ctrl-R

mission-button = Mission
# { $chapter }: "Chapter 2"; { $title }: its title.
mission-title = { $chapter }: { $title }
mission-instructions = The instructions
mission-journal = What has happened
mission-nothing = Nothing yet: the story moves on as you act.
# During tail -f or journalctl -f: the button that does Ctrl-C.
follow-stop = Stop (Ctrl-C)
follow-suspend = Suspend (Ctrl-Z)
keys-title = Terminal keys
key-up = Previous command
key-down = Next command
# What bash shows during Ctrl-R (readline).
search-history = (reverse-i-search)`{ $pattern }': { $command }

## Achievements and ranks (see src/engine/achievements.ts)

achievements-title = Achievements
# { $earned } of { $total }: the count shown on the link.
achievements-button = Achievements ({ $earned }/{ $total })
# Announced in the terminal when an achievement is earned.
achievements-obtained = 🏆 Achievement: { $name }
achievements-grade = Your rank: { $grade }.
achievements-grade-next = Next rank, { $grade }, at { $chapters } finished chapters.
achievements = ({ $date })
achievements-cache = Hidden achievement
    .description = A nod to terminal culture. Up to you to find it.
notebook-grade = Rank: { $grade }.
grade-intern = Intern
grade-apprentice = Apprentice sysadmin
grade-junior = Junior admin
grade-admin = System administrator
grade-confirmed = Experienced admin
grade-senior = Senior admin
grade-sre = SRE (site reliability engineer)
achievements-first-command = First step
    .description = Run a first command.
achievements-manual = Read the manual
    .description = Open the manual (man or apropos): the pros' first reflex.
achievements-cache-ls = What is hidden
    .description = Show the hidden files (ls -a).
achievements-pipe = First pipe
    .description = Join two commands with a pipe (|).
achievements-redirection = Into the file
    .description = Send a command's output into a file (> or >>).
achievements-first-chapter = First chapter
    .description = Finish a chapter.
achievements-eraser = The Eraser stopped
    .description = Finish the Eraser's story.
achievements-restore = Restore tested
    .description = Restore a backup for real: a backup you have never restored is not a backup.
achievements-network = The whole Hive
    .description = Finish The Hive: VLANs, DHCP, firewall, VPN, directory and Wi-Fi.
achievements-three-stories = Three stories
    .description = Finish three stories.
achievements-all-stories = The grand tour
    .description = Finish every story.
achievements-fifty-commands = Toolbox
    .description = Have 50 commands in your notebook.
achievements-exam = Exam passed
    .description = Finish a chapter in exam mode.
achievements-exam-lightning = Lightning
    .description = Finish a chapter in exam mode in under 5 minutes.
achievements-xyzzy = Magic word
    .description = The password of Colossal Cave Adventure (1976), one of the first text adventure games.
achievements-sandwich = With the rights
    .description = With sudo, you get everything, even a sandwich (xkcd 149).
achievements-sl = Locomotive
    .description = sl instead of ls: the most famous typo, punished by a train.

## Graded hints (see src/engine/hints.ts; the hints themselves: hints-<story>.ftl)

hint-title = Need help?
hint-intro = Three levels, to open one after the other: the manual first, like at work. The debrief will say how many you asked for.
hint-button-manual = The manual
hint-button-lead = A lead
hint-button-solution = Almost the answer
# { $pages }: "man mv, man cp".
hint-manual = Pages to read: { $pages }. Also search with man -k and a keyword.
hint-more-nothing = No more hints for this chapter: reread the instructions and what has happened.
## The end-of-chapter summary (see src/engine/summary.ts)
# { $time }: "6:12"; { $commands }, { $errors }, { $hints }: numbers
summary-summary = Summary: { $time } · { $commands ->
        [one] one command
       *[other] { $commands } commands
    }{ $errors ->
        [0] {""}
       *[other] {" "}({ $errors } with an error)
    } · { $hints ->
        [0] no hints
        [one] one hint
       *[other] { $hints } hints
    }
summary-button = See the details
# { $chapter }: the chapter's title
summary-title = Summary: { $chapter }
summary-intro = Your command next to the reference solution, step by step. The game checks the state of the machine, not the command you typed: another way of doing it is just as right if it reaches the same result.
summary-col-step = Step
summary-col-you = Your command
summary-col-reference = The reference solution
summary-otherwise = (reached another way)
summary-encourage = { $hints ->
        [0] No hints: well done. Replay it in exam mode to beat your time?
       *[other] Next time, with fewer hints?
    }
# Replay and compare (see src/engine/runs.ts); the comparison itself is in dialog-compare.ftl.
replay-button = Replay this chapter
# { $before }: the commands of the previous run of this chapter
summary-compare = Last time: { $before ->
        [one] one command
       *[other] { $before } commands
    }. The details compare both runs.
## The restore point (Mission panel; see Console.restaurer)
rescue-title = Restore point
rescue-intro = Like a virtual machine snapshot before a risky operation: take one, try your move, and come back to it if things go wrong. The chapter is replayed up to that point, without losing anything else.
rescue-take = Take a snapshot
rescue-go-back = Go back to the snapshot
rescue-cancel = Undo the last input
rescue-none = No snapshot yet in this chapter.
# { $steps }: the number of inputs (commands, answers, nano saves) since the chapter started
rescue-taken = { $steps ->
        [0] Snapshot taken at the start of the chapter.
        [one] Snapshot taken after one input.
       *[other] Snapshot taken after { $steps } inputs.
    }
rescue-impossible = No snapshot possible here: the chapter was resumed or you went through your workstation. "Restart this chapter" starts from scratch.
rescue-exam = No snapshots in exam mode.
rescue-restored = { $steps ->
        [0] ↺ Machine put back as at the start of the chapter.
        [one] ↺ Machine put back as after the chapter's first input.
       *[other] ↺ Machine put back as after { $steps } inputs of the chapter.
    }
## The autosave inside a chapter (banner above the terminal; see src/engine/autosave.ts)
autosave-title = Chapter in progress
# { $chapter }: the chapter's title; { $story }: its story's; { $steps }: the inputs (commands, answers, nano saves) kept
autosave-text = { $steps ->
        [one] You left "{ $chapter }" ({ $story }) in progress, after one input. It was kept in this browser: resume it, and the machine comes back as you left it.
       *[other] You left "{ $chapter }" ({ $story }) in progress, after { $steps } inputs. They were kept in this browser: resume it, and the machine comes back as you left it.
    }
autosave-resume = { $steps ->
        [one] Resume where I left off (one input)
       *[other] Resume where I left off ({ $steps } inputs)
    }
autosave-restart = Start the chapter again
autosave-resumed = { $steps ->
        [one] ↺ Chapter resumed where you left off: one input replayed.
       *[other] ↺ Chapter resumed where you left off: { $steps } inputs replayed.
    }
# Above the end of the terminal shown after a resume
autosave-earlier = { $steps ->
        [one] (one earlier input not shown)
       *[other] ({ $steps } earlier inputs not shown)
    }
autosave-changed = The game has changed since your last visit: this chapter could not be resumed as you left it. It starts again from the beginning.
autosave-failed = This chapter could not be resumed. It starts again from the beginning.
## Themed paths ("Paths" menu; see src/engine/paths.ts)
view-paths = Paths
path-choice = Choose a path
path-start = First steps
    .description = Moving around, reading, searching, tidying up, then the network, git and archives: for anyone who has never opened a terminal.
path-security = Protecting a server
    .description = SSH, firewall, fail2ban, accounts and permissions, secrets, updates, then the closing audit: closing the doors, keeping the house in order, and proving it.
path-web = Serving the web
    .description = nginx, logs, emergency backups, certificates, shared sites, traffic and proxies.
path-network = Networks
    .description = DNS, SSH jumps and tunnels, VLANs, DHCP, nftables firewall, WireGuard VPN and DMZ.
path-backups = Backing up and restoring
    .description = rsync, archives, restic, rsnapshot, PostgreSQL databases, transfers: and always, checking you know how to restore.
path-deployment = Containers and deployment
    .description = git, Docker and Compose, bare repositories and hooks, rollback, blue/green, canary and migration.
path-production = Troubleshooting in production
    .description = A service that won't restart, a full disk, memory, inodes, time, monitoring and the post-mortem.
path-identities = Accounts and identities
    .description = Groups, a colleague leaving, shared permissions, SSH keys, LDAP directory and enterprise Wi-Fi.
# { $finished } / { $total }: numbers
path-progress = { $finished } of { $total } chapters done
path-finished = ✓ Path complete
# { $story }: the story's title
path-in = in "{ $story }"
path-done = ✓ Done
path-open = To do
path-next = ▶ Next
# { $chapter }: the title of the chapter to finish first
path-locked = 🔒 First: { $chapter }
path-without-key = 🔒 Story locked
## On-call and the incident of the day (see src/engine/on-call.ts)
on-call-button = 🚨 Incident of the day
# { $chapter }: chapter title; { $story }: story title
on-call-today = Today: "{ $chapter }" ({ $story })
# { $percent }: budget left
on-call-already = Done today: { $percent }% of the budget kept.
# { $date }: today's date, spelled out
on-call-title = On call, { $date }
on-call-intro = The on-call phone rings: an incident to fix. The same one for everyone today; tomorrow, another.
on-call-rules = You have an error budget of 30 minutes, like a service's availability objective (SLA): it melts with time, each hint costs 3 minutes, each command that fails 20 seconds. No exam mode; the restore point is still allowed (time, though, does not come back).
on-call-take = Take the call
on-call-cancel = Not now
on-call-start = 🚨 On call: the error budget starts melting.
# { $time }: "24:10"; { $percent }: a number
on-call-gauge = Budget: { $time } ({ $percent }%)
on-call-exhausted = Budget spent: SLA breached. Finish anyway, the incident must be fixed.
on-call-abandon = On-call abandoned: you left the incident.
on-call-end-title = End of on-call
on-call-end-intro = The incident is fixed. Here is your score card, to share (nothing is sent: you copy it wherever you like).
on-call-copy = Copy the card
on-call-copied = Card copied.
# The score card, like a shared word grid.
# { $date } (YYYY-MM-DD), { $chapter }, { $gauge } (five squares), { $percent }, { $time }, { $hints }, { $errors }, { $address }
on-call-map =
    Quêtes de Sysadmin · on call, { $date }
    "{ $chapter }" fixed in { $time }
    { $gauge } { $percent }% of the budget
    { $hints ->
        [0] no hints
        [one] one hint
       *[other] { $hints } hints
    } · { $errors ->
        [0] no errors
        [one] one error
       *[other] { $errors } errors
    }
    { $address }
# The daily reminder (see src/engine/reminder.ts): the menu's button; its dialog is in dialog-reminder.ftl.
reminder-button = 📅 Daily reminder
# A story released since the last visit (see src/engine/releases.ts): its badge in the menu.
story-new = New
## The on-call streak (see src/engine/streak.ts): kind, never a guilt trip.
# { $days }: the current streak, in days; { $best }: the best one
streak-today = 🔥 { $days ->
        [one] One day on call
       *[other] { $days } days on call in a row
    } (best: { $best }). See you tomorrow, if you feel like it.
streak-going = 🔥 { $days ->
        [one] One day on call
       *[other] { $days } days on call in a row
    } (best: { $best }). Today's incident keeps it going.
# Shown with streak-going when a missed day would not break the streak.
streak-rest-ready = No pressure: one rest day a week doesn't break it.
streak-rest-used = Yesterday was your rest day for the week.
streak-best = Best streak: { $best ->
        [one] one day
       *[other] { $best } days
    }. A new one starts with today's incident.
achievements-streak-3 = Three nights on call
    .description = Solve the incident of the day three days in a row (a rest day a week doesn't break the streak).
achievements-streak-7 = A week on call
    .description = Solve the incident of the day seven days in a row (a rest day a week doesn't break the streak).
achievements-streak-30 = A month on call
    .description = Solve the incident of the day thirty days in a row (a rest day a week doesn't break the streak).
achievements-without-hint = No safety net
    .description = Finish a chapter without asking for a hint.

## The class table (teachers' page; see src/engine/classroom.ts)

class-files = The students' save files:
class-slide = Or drop them here, several at once.
class-codes = Or their codes, one per line, after the name:
class-codes-example = Lina QDS-047G-0000-000M-G
class-codes-add = Add the codes
class-export = Download the table (CSV)
class-empty = Clear the table
class-name-file = class-table.csv
class-table = The class
class-account = { $count ->
        [0] No student yet.
        [one] One student.
       *[other] { $count } students.
    }
# { $source }: the file or line; { $reason }: what is wrong.
class-error = { $source }: { $reason }
class-col-student = Student
class-col-chapters = Chapters
class-col-grade = Rank
class-col-achievements = Achievements
class-col-exam = Best exam
class-col-date = Saved

## The terminal display

display-theme = Terminal theme
display-theme-phosphor = Phosphor
display-theme-amber = Amber
display-theme-contrast = High contrast
display-theme-paper = Paper
display-more-small = A− (smaller text)
display-more-big = A+ (larger text)
display-colours = Colours
display-focus = Full screen
display-quit-focus = Leave full screen (Esc)

## Difficulty of a chapter or a story (1 to 5, see difficulty.ts)
difficulty = Difficulty: { $level } out of 5
difficulty-tidy = Difficulty: { $min } to { $max } out of 5

## Tips: one-time advice, shown when a shortcut or a habit would help (see tips.ts)

tip-label = Tip
tip-silence = No message? On Linux, a command that succeeds usually says nothing. Check the result yourself: ls shows where things are now.
tip-up-twice = Going up several levels? cd ../.. goes up two in one go (and ../../.. three).
tip-cd-back = Back where you just were? cd - takes you to the previous folder, whatever its path.
tip-cd-home = Going home? cd alone, or cd ~, takes you there from anywhere.
tip-tab = Long names to type? Press Tab: it completes the name for you. Pressed twice, it lists the possible choices.
tip-net-tools = ifconfig, route and netstat belong to net-tools, no longer installed on Debian: ip a shows the addresses, ip r the routes, ss -tlnp who listens.
display-tips = Tips
display-tour = Tour
display-autosave = Autosave
display-autosave-title = Keep the chapter in progress in this browser, to resume it if the page closes

## The notebook's button and window

notebook-button = Notebook
notebook-close = Close

## The navigation cheat sheet, at the top of the notebook

shortcuts-title = Shortcuts worth knowing
shortcuts-home = your home folder (cd ~, or cd alone)
shortcuts-back = the previous folder (cd -)
shortcuts-up = the folder above (cd ..); two levels up: cd ../..
shortcuts-tab = completes a name; pressed twice, lists the choices
shortcuts-history = the previous commands; Ctrl-R searches them
shortcuts-cancel = abandons the line, or stops a command that keeps running

## The intro tour, on a first visit

tour-label = Getting started
tour-step = { $step } of { $total }
tour-next = Next
tour-done = Let's go
tour-skip = Skip the tour
tour-input = Type your commands here, then press Enter. It's a real terminal: the text above tells you what to type first.
tour-mission = Mission: what you have to do in this chapter, what has already happened, and hints if you are stuck.
tour-map = Map: the places you have already visited, to find your way back.
tour-notebook = Notebook: every command you run is written here, with what it does. Your cheat sheet.
tour-tab = Tab completes the names of commands, folders and files for you: type their first letters, then Tab. Pressed twice, it lists the choices.

# A story loads the first time it is opened (its chapters and texts).
loading-story = Loading {$story}…
loading-failed = This part of the game could not be loaded: check your connection, then try again.

## Screen readers (see docs/ACCESSIBILITY.md and src/engine/announce.ts)
# The name of the terminal's output (a log: each new output is read once)
output-label = Terminal output
# A heading for screen readers (visually hidden) before the terminal
terminal-heading = Terminal
# Read with the command line, after its name and the prompt
input-help = Tab completes; Escape then Tab leaves the line forward, Shift+Tab backward; Alt+R reads the last output again.
# A button shown when it has the focus, at the top of the terminal
reread-button = Read the last output again (Alt+R)
reread-empty = The last command printed nothing.
# Before a long output read again: only its end is read
reread-cut = { $lines } lines; here are the last { $shown }:
follow-announce-start = The command keeps running and shows new lines: a summary every ten seconds. Ctrl-C or Escape stops it.
follow-announce-watch = The screen refreshes on its own: Alt+R reads it. Ctrl-C or Escape stops it.
follow-announce-lines =
    { $count ->
        [one] One new line: { $line }
       *[other] { $count } new lines; the last one: { $line }
    }
follow-announce-screen = The screen changed: Alt+R reads it.
chapter-done-announce = Chapter finished: { $chapter }. Its summary is at the end of the terminal; Escape then Tab reaches the buttons that follow it.
continuation-announce = The command is not finished: type its next line, or Ctrl-C to drop it.
# The network diagram's box (it scrolls sideways on a narrow screen); its text version follows it
plan-diagram-label = Network diagram (its text version follows)
shortcuts-escape-tab = leaves the command line, to what follows the terminal (Tab alone completes)
shortcuts-shift-tab = leaves the command line, to what comes before it
shortcuts-reread = reads the last output again, for screen readers
