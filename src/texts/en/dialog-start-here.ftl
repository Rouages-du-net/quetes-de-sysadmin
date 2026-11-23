### The dialog of "Where do I start?" (src/engine/start-here.ts), loaded
### when it first opens (src/texts/plugin.mjs: dialog-*.ftl). Its button,
### the first visit's card and the tour's bubble are in start-here.ftl.

start-here-title = Where do I start?
start-here-intro = Four quick questions, and the game suggests a learning path and a first chapter. Your answers stay in this browser, and you can change them at any time.

## The questions (each one a group of choices)
start-here-experience = Have you used a terminal before?
start-here-experience-never = Never
start-here-experience-little = A little
start-here-experience-daily = Every day
start-here-goal = What brings you here?
start-here-goal-curiosity = Curiosity
start-here-goal-studies = Studies or a certification
start-here-goal-job = A job as a sysadmin or in DevOps
start-here-goal-teacher = I teach
start-here-systems = What interests you most?
start-here-systems-linux = Linux
start-here-systems-windows = Windows
start-here-systems-both = Linux and Windows together
start-here-systems-network = Networks
start-here-systems-security = Security
start-here-systems-vintage = Old Unix systems and mainframes
start-here-time = How long is a session for you?
start-here-time-short = About 10 minutes
start-here-time-medium = About 30 minutes
start-here-time-long = An hour or more

## The suggestion
start-here-incomplete = Answer the four questions to see a suggestion.
start-here-result = Our suggestion
# { $path }: the learning path's name
start-here-path = Path: { $path }
# { $chapter }: the chapter's title; { $story }: its story's title
start-here-chapter = { $chapter }, in "{ $story }"
# { $chapter }: the title of the path's first chapter, still locked; { $count }: the chapters to finish before it opens
start-here-locked =
    { $count ->
        [one] { $chapter } opens after one more chapter: start with this one.
       *[other] { $chapter } opens after { $count } more chapters: start with this one.
    }
start-here-alternatives = Other ways in
start-here-teachers = For your classes, the quest sheets give each chapter's goal, prerequisites, new commands and time.
start-here-teachers-link = Open the quest sheets
start-here-all-done = You have finished every learning path. Replay a chapter in exam mode, or take the incident of the day.
start-here-close = Close

## Reasons (one sentence each)
start-here-reason-beginner = You have never used a terminal: this path starts from the very first command, one step at a time.
start-here-reason-teacher = Play the first steps yourself: they are what your students will see first.
start-here-why-start = The first steps cover the everyday commands every other chapter builds on.
start-here-why-security = You will close the doors of a server, watch who knocks, and answer an intrusion.
start-here-why-web = You will run a website: nginx, logs, certificates and the traffic that goes with them.
start-here-why-network = You will follow packets: DNS, SSH tunnels, VLANs, DHCP, firewalls and VPNs.
start-here-why-backups = Backing up and restoring are basics every exam and every job asks for.
start-here-why-deployment = You will deploy like a team at work: git, Docker, Compose, rollbacks and Kubernetes.
start-here-why-production = Real incidents: full disks, stuck services, old Unix systems and mainframes, Windows servers.
start-here-why-identities = Accounts and permissions, from Linux groups to Windows shares and Active Directory.

## The time per session
start-here-note-short = A chapter takes about ten to twenty minutes, and the game keeps your place if you stop in the middle.
start-here-note-medium = Half an hour is enough for one or two chapters, and the game keeps your place if you stop in the middle.
start-here-note-long = With an hour or more, you can play a whole story from start to finish.

## For screen readers
# { $chapter }: the suggested chapter's title; { $path }: its path's name
start-here-announce = Suggestion: "{ $chapter }", in the path "{ $path }".
