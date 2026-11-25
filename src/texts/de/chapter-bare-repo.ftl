### Geschichte „Die Zeitung“, Kapitel 1 „Das nackte Repository“: eine
### Website mit git push, einem Bare-Repository und einem Hook post-receive
### deployen. Befehle, Pfade und die Meldungen von git, nginx und diff
### werden nicht übersetzt.

chapter-bare-repo = Das nackte Repository
    .summary = Die Website der Zeitung mit git push veröffentlichen: ein Bare-Repository auf dem Server, ein Hook post-receive, und kein Bearbeiten von Hand mehr.

## Dateien

bare-repo-message-samia =
    Eine Nachricht von Samia, Chefredakteurin der Zeitung, des Blatts aus
    dem Viertel:

    „Willkommen bei der Zeitung! Unsere Website (curl http://gazette.example)
    wird von nginx aus /var/www/gazette ausgeliefert. Bisher hat jede und
    jeder die eigenen Dateien von Hand dorthin kopiert… und letzte Woche
    wurde ein Artikel von einer alten Version überschrieben.

    Die Website wird schon von git verfolgt, in ~/gazette. Ab jetzt
    veröffentlichen wir nur noch über git:
      - ein Repository auf dem Server: /srv/git/gazette.git (ein
        ‚Bare‘-Repository);
      - sobald Commits hineingeschoben werden (git push), aktualisiert
        sich die Website von selbst.

    Mein Artikel über das Straßenfest ist fertig in ~/gazette, aber noch
    nicht online. Alles steht in man git. Für sudo: gazette-2027.“
bare-repo-word-theo =
    Eine Notiz von Théo, dem Praktikanten:

    „Noch mal Entschuldigung wegen des überschriebenen Artikels! Übrigens:
    Ich habe einen Tippfehler im Titel der Website korrigiert, direkt in
    /var/www/gazette/index.html. Ich hatte keine Zeit, es in git zu packen…“

## Die Website (HTML; { $date }: JJJJ-MM-TT, { $day }: der Tag im Monat)

bare-repo-title-mistake = Die Stadtteilzeitunng
bare-repo-site-index-v1 =
    <!DOCTYPE html>
    <html lang="de">
    <head><meta charset="utf-8"><title>Die Stadtteilzeitunng</title><link rel="stylesheet" href="style.css"></head>
    <body>
    <h1>Die Stadtteilzeitunng</h1>
    <p>Neues aus der Straße, von den Leuten, die dort wohnen.</p>
    <ul>
    <li><a href="agenda.html">Der Kalender des Monats</a></li>
    </ul>
    </body>
    </html>
bare-repo-site-index-theo =
    <!DOCTYPE html>
    <html lang="de">
    <head><meta charset="utf-8"><title>Die Stadtteilzeitung</title><link rel="stylesheet" href="style.css"></head>
    <body>
    <h1>Die Stadtteilzeitung</h1>
    <p>Neues aus der Straße, von den Leuten, die dort wohnen.</p>
    <ul>
    <li><a href="agenda.html">Der Kalender des Monats</a></li>
    </ul>
    </body>
    </html>
bare-repo-site-index-v2 =
    <!DOCTYPE html>
    <html lang="de">
    <head><meta charset="utf-8"><title>Die Stadtteilzeitunng</title><link rel="stylesheet" href="style.css"></head>
    <body>
    <h1>Die Stadtteilzeitunng</h1>
    <p>Neues aus der Straße, von den Leuten, die dort wohnen.</p>
    <ul>
    <li><a href="strassenfest.html">Das Straßenfest, hofseitig</a></li>
    <li><a href="agenda.html">Der Kalender des Monats</a></li>
    </ul>
    </body>
    </html>
bare-repo-site-article =
    <!DOCTYPE html>
    <html lang="de">
    <head><meta charset="utf-8"><title>Das Straßenfest, hofseitig</title><link rel="stylesheet" href="style.css"></head>
    <body>
    <h1>Das Straßenfest, hofseitig</h1>
    <p>Drei Tische, zwei Gitarren und ein Pistazienkuchen: Am Freitagabend
    hat der Hof der Nummer 12 bis tief in die Nacht gefeiert. Von Samia.</p>
    </body>
    </html>
bare-repo-site-agenda =
    <!DOCTYPE html>
    <html lang="de">
    <head><meta charset="utf-8"><title>Der Kalender des Monats</title><link rel="stylesheet" href="style.css"></head>
    <body>
    <h1>Der Kalender des Monats</h1>
    <p>Flohmarkt in der Straße: Samstag, <time datetime="{ $date }">{ $day }. Juni</time>, von 8 bis 18 Uhr.</p>
    </body>
    </html>
bare-repo-commit-1 = Erste Version der Website
bare-repo-commit-2 = Artikel: das Straßenfest

## Ereignisse

bare-repo-event-drift =
    Da ist Théos Korrektur: Aus „Zeitunng“ wurde „Zeitung“, nur in der
    Kopie des Servers. Sie ist nicht in git: Wenn du ~/gazette so
    deployst, wie es ist, verschwindet sie. Übertrag sie lieber zuerst in
    ~/gazette/index.html, dann git commit.
bare-repo-event-rights =
    Das Repository wurde mit sudo angelegt: Es gehört root, und git push,
    unter deinem Namen ausgeführt, darf nicht hineinschreiben. Schau dir
    ls -l /srv/git an: Wem sollte es gehören? (man chown)
bare-repo-event-without-hook =
    Das Repository des Servers hat deine Commits zwar empfangen (git log
    --oneline in /srv/git/gazette.git), aber die Website hat sich nicht
    geändert: Nichts entpackt sie nach /var/www/gazette. Das ist die
    Aufgabe eines Hooks, hooks/post-receive, der nach jedem empfangenen
    push ausgeführt wird (man git).
bare-repo-event-hook-ignore =
    Der push ist durchgegangen, aber git hat den Hook nicht ausgeführt: Er
    ist nicht ausführbar (ls -l /srv/git/gazette.git/hooks). Ein Hook ist
    ein Programm; siehe man chmod.
bare-repo-event-not-tracked =
    git weigert sich, Dateien in /var/www/gazette zu überschreiben, die es
    nicht kennt: Sie wurden von Hand dort abgelegt, und es will nichts
    verlieren. Mit -f (force) ersetzt es sie. Bevor du erzwingst, schau
    dir an, was du verlieren würdest: diff -r ~/gazette /var/www/gazette.
bare-repo-event-correction-lost =
    Théos Korrektur ist von der Website verschwunden: Das Deployment hat
    index.html durch die aus git ersetzt, die sie nicht hatte. Ab jetzt
    existiert nicht, was nicht in git ist. Mach die Korrektur noch einmal
    in ~/gazette („Zeitunng“ wird zu „Zeitung“, zweimal in index.html),
    dann commit und push.
bare-repo-event-in-line =
    Samia: „Mein Artikel ist online, und der Tippfehler im Titel ist weg,
    danke! Eine Kleinigkeit: In agenda.html ist der Flohmarkt am Samstag,
    12. Juni, nicht am 21. Das Datum steht zweimal da: im Text und in
    datetime="2027-06-21". Kannst du es korrigieren und auf dem richtigen
    Weg veröffentlichen?“
bare-repo-event-by-hand =
    Das Datum ist auf dem Server korrigiert, aber nicht in git: Genau das
    wollten wir abstellen. Beim nächsten push würde die Korrektur
    überschrieben. Korrigiere es in ~/gazette, dann commit und push.
bare-repo-event-end =
    Die Website ist aktuell, und sie ändert sich nur noch über git push.
    Samia: „Niemand überschreibt mehr die Arbeit der anderen. Und wenn ein
    Release schiefgeht, ist die Historie da.“

    Gut gemacht! Du hast Kapitel 1 von „Die Zeitung“ abgeschlossen. (Wie
    es weitergeht, erwartet dich: ssh zeitung.)

    WAS PASSIERT IST
    Die Website lebte in einem Verzeichnis, das von Hand bearbeitet wurde:
    keine Möglichkeit zu wissen, wer was geändert hatte, und eine Kopie
    konnte eine andere überschreiben. Ein Bare-Repository (git init
    --bare) hat keine Arbeitskopie: Es ist nur dazu da, pushes zu
    empfangen. Sein Hook post-receive, ein Skript, das nach jedem
    empfangenen push läuft, entpackt den neuesten Commit ins Verzeichnis
    der Website (git --work-tree=… checkout -f). Was nur auf dem Server
    war (Théos Korrektur), musste zuerst in git.

    GUTE PRAXIS
    - Eine einzige Quelle: das Repository. Nie die Website auf dem Server
      bearbeiten; mit diff -r erkennen, was abgewichen ist, bevor man umstellt.
    - Das Repository des Servers gehört dem Konto, das pusht (oder einer
      Gruppe, mit git init --bare --shared=group).
    - Ein Hook ist ein Programm: chmod +x, und er beginnt mit #!/bin/sh.
    - Das Deployment muss reproduzierbar sein: Derselbe Commit ergibt
      dieselbe Website.

    DOKUMENTATION
    - Git auf dem Server: https://git-scm.com/book/de/v2/Git-auf-dem-Server-Einrichten-des-Servers
    - Git-Hooks: https://git-scm.com/docs/githooks
    - --work-tree: https://git-scm.com/docs/git
