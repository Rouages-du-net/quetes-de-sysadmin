### The dialog of "Where do I start?" (src/engine/start-here.ts), loaded
### when it first opens (src/texts/plugin.mjs: dialog-*.ftl). Its button,
### the first visit's card and the tour's bubble are in start-here.ftl.

start-here-title = Wo fange ich an?
start-here-intro = Vier kurze Fragen, und das Spiel schlägt dir einen Lernpfad und ein erstes Kapitel vor. Deine Antworten bleiben in diesem Browser, und du kannst sie jederzeit ändern.

## The questions (each one a group of choices)
start-here-experience = Hast du schon einmal ein Terminal benutzt?
start-here-experience-never = Nie
start-here-experience-little = Ein bisschen
start-here-experience-daily = Jeden Tag
start-here-goal = Was führt dich hierher?
start-here-goal-curiosity = Neugier
start-here-goal-studies = Ausbildung, Studium oder eine Zertifizierung
start-here-goal-job = Ein Job als Sysadmin oder im DevOps-Bereich
start-here-goal-teacher = Ich unterrichte
start-here-systems = Was interessiert dich am meisten?
start-here-systems-linux = Linux
start-here-systems-windows = Windows
start-here-systems-both = Linux und Windows zusammen
start-here-systems-network = Netzwerke
start-here-systems-security = Sicherheit
start-here-systems-vintage = Alte Unix-Systeme und Großrechner
start-here-time = Wie lang ist eine Sitzung bei dir?
start-here-time-short = Etwa 10 Minuten
start-here-time-medium = Etwa 30 Minuten
start-here-time-long = Eine Stunde oder mehr

## The suggestion
start-here-incomplete = Beantworte die vier Fragen, um einen Vorschlag zu sehen.
start-here-result = Unser Vorschlag
# { $path }: the learning path's name
start-here-path = Lernpfad: { $path }
# { $chapter }: the chapter's title; { $story }: its story's title
start-here-chapter = { $chapter }, in „{ $story }“
# { $chapter }: the title of the path's first chapter, still locked; { $count }: the chapters to finish before it opens
start-here-locked =
    { $count ->
        [one] { $chapter } öffnet sich nach einem weiteren Kapitel: Fang mit diesem an.
       *[other] { $chapter } öffnet sich nach { $count } weiteren Kapiteln: Fang mit diesem an.
    }
start-here-alternatives = Andere Einstiege
start-here-teachers = Für deinen Unterricht geben die Steckbriefe der Quests für jedes Kapitel das Ziel, die Voraussetzungen, die neuen Befehle und die Dauer an.
start-here-teachers-link = Die Steckbriefe der Quests öffnen
start-here-all-done = Du hast alle Lernpfade abgeschlossen. Spiel ein Kapitel im Prüfungsmodus noch einmal oder nimm den Vorfall des Tages an.
start-here-close = Schließen

## Reasons (one sentence each)
start-here-reason-beginner = Du hast noch nie ein Terminal benutzt: Dieser Pfad beginnt beim allerersten Befehl, Schritt für Schritt.
start-here-reason-teacher = Spiel die ersten Schritte selbst: Sie sind das, was deine Lernenden zuerst sehen.
start-here-why-start = Die ersten Schritte decken die Alltagsbefehle ab, auf denen alle anderen Kapitel aufbauen.
start-here-why-security = Du schließt die Türen eines Servers, beobachtest, wer anklopft, und reagierst auf einen Einbruch.
start-here-why-web = Du betreibst eine Website: nginx, Logs, Zertifikate und der Verkehr, der dazugehört.
start-here-why-network = Du folgst Paketen: DNS, SSH-Tunnel, VLANs, DHCP, Firewalls und VPNs.
start-here-why-backups = Sichern und Wiederherstellen sind Grundlagen, die jede Prüfung und jeder Job verlangt.
start-here-why-deployment = Du deployst wie ein Team bei der Arbeit: git, Docker, Compose, Rollbacks und Kubernetes.
start-here-why-production = Echte Vorfälle: volle Platten, hängende Dienste, alte Unix-Systeme und Großrechner, Windows-Server.
start-here-why-identities = Konten und Rechte, von Linux-Gruppen bis zu Windows-Freigaben und Active Directory.

## The time per session
start-here-note-short = Ein Kapitel dauert etwa zehn bis zwanzig Minuten, und das Spiel merkt sich, wo du bist, wenn du mittendrin aufhörst.
start-here-note-medium = Eine halbe Stunde reicht für ein oder zwei Kapitel, und das Spiel merkt sich, wo du bist, wenn du mittendrin aufhörst.
start-here-note-long = Mit einer Stunde oder mehr kannst du eine ganze Geschichte von Anfang bis Ende spielen.

## For screen readers
# { $chapter }: the suggested chapter's title; { $path }: its path's name
start-here-announce = Vorschlag: „{ $chapter }“, im Lernpfad „{ $path }“.
