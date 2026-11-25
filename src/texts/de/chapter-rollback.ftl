### Geschichte „Die Zeitung“, Kapitel 2 „Zurückrollen“: eine Version pro
### Verzeichnis, ein Link current, zurückrollen mit ln -sfn, und Tests vor
### dem Livegang. Befehle, Pfade und die Meldungen von git, ln, nginx und
### sh werden nicht übersetzt.

chapter-rollback = Zurückrollen
    .summary = Ein Release, das die Website kaputtmacht: im Nu zur vorigen Version zurück, dann jede Veröffentlichung zuerst durch Tests schicken.

## Dateien

rollback-message-samia =
    Eine Nachricht von Samia, Montag 21:02 Uhr:

    „Hilfe! Die Website zeigt einen Fehler, seit Théo sein neues Layout
    gepusht hat, und der Newsletter geht morgen früh raus, mit einem Link
    zur Zeitung.

    Seit letzter Woche veröffentlicht der Hook des Servers
    (/srv/git/gazette.git/hooks/post-receive) jeden push in einem eigenen
    Verzeichnis, /srv/gazette/releases/, und lässt dann den Link
    /srv/gazette/current auf die neue Version zeigen. nginx liefert
    current aus. Die alten Versionen sind also alle noch da…

    Der Reihe nach:
      1. die Website wieder zum Laufen bringen, sofort;
      2. dafür sorgen, dass das nicht wieder passiert: Ich habe tests.sh
         geschrieben (im Repository), aber niemand führt es vor dem
         Veröffentlichen aus;
      3. dann Théos Layout veröffentlichen, korrigiert.

    Für sudo: gazette-2027.“
rollback-hook-comment = Veröffentlicht jeden push in einem neuen Verzeichnis unter releases/ und stellt dann den Link current um.
rollback-hook-echo = Version $VERSION live
rollback-tests =
    #!/bin/sh
    # Prüfungen vor dem Veröffentlichen (Samia).
    # Aus dem Verzeichnis der Website ausführen: sh tests.sh
    set -e
    echo "Prüfe die Startseite (index.html)..."
    test -f index.html
    grep -q "<title>" index.html
    echo "Prüfe den Kalender (agenda.html)..."
    test -f agenda.html
    echo "Tests OK"

## Die Website

rollback-site-index =
    <!DOCTYPE html>
    <html lang="de">
    <head><meta charset="utf-8"><title>Die Stadtteilzeitung</title><link rel="stylesheet" href="style.css"></head>
    <body>
    <h1>Die Stadtteilzeitung</h1>
    <p>Neues aus der Straße, von den Leuten, die dort wohnen.</p>
    <ul>
    <li><a href="strassenfest.html">Das Nachbarschaftsfest, hinter den Kulissen</a></li>
    <li><a href="agenda.html">Der Kalender des Monats</a></li>
    </ul>
    </body>
    </html>
rollback-site-welcome =
    <!DOCTYPE html>
    <html lang="de">
    <head><meta charset="utf-8"><title>Die Stadtteilzeitung</title><link rel="stylesheet" href="style.css"></head>
    <body>
    <header><h1>Die Stadtteilzeitung</h1><p>Neues aus der Straße, von den Leuten, die dort wohnen.</p></header>
    <section class="lead">
    <h2><a href="strassenfest.html">Aufmacher: das Nachbarschaftsfest, hinter den Kulissen</a></h2>
    </section>
    <nav><a href="agenda.html">Der Kalender des Monats</a></nav>
    </body>
    </html>
rollback-commit-3 = Titel: Zeitung, richtig geschrieben
rollback-commit-4 = Kalender: Der Flohmarkt ist am 12. Juni
rollback-commit-5 = tests.sh hinzugefügt: Prüfungen vor dem Veröffentlichen
rollback-commit-6 = Neues Layout der Startseite
# { $number }: die Nummer des Versuchs
rollback-commit-theo = Neues Layout, Versuch { $number }

## Ereignisse

# { $output }: was git Théo angezeigt hat (eingerückte Zeilen)
rollback-theo-push =
    Théo, von zu Hause: „Ich probiere mein Layout noch mal…“ Er pusht
    (immer noch ohne index.html). Das sagt ihm git:

    { $output }
rollback-event-failure =
    403 Forbidden: nginx liefert /srv/gazette/current aus, findet darin
    aber keine Startseite (index.html). Schau, worauf current zeigt (ls -l
    /srv/gazette, oder readlink), und was in jeder Version unter releases/
    liegt. Die vorige Version ist unversehrt: current muss nur wieder auf
    sie zeigen (man ln).
rollback-event-without-n =
    Der neue Link wurde IN der kaputten Version angelegt (ls -l
    /srv/gazette/releases/20270517203012): current zeigt auf ein
    Verzeichnis, also ist ln hineingegangen, statt den Link zu ersetzen.
    Die Option -n behandelt current wie eine einfache Datei:
    ln -sfn ziel current.
rollback-event-restored =
    Die Website antwortet wieder. Samia: „Puh! Und es hat eine Sekunde
    gedauert: Die alte Version war nie gelöscht worden, wir haben nur den
    Link geändert. Jetzt sorgen wir dafür, dass es nicht wieder passiert:
    Der Hook muss tests.sh auf der neuen Version ausführen und current
    nicht umstellen, wenn die Tests scheitern.“ (Schau dir den Hook an,
    und man sh.)
rollback-event-safeguard =
    Théos push hat den Server erreicht, aber seine Tests sind gescheitert,
    und der Hook hat angehalten, bevor er current umgestellt hat: Die
    Website hat sich nicht geändert. Dafür ist eine Sicherung da. Jetzt
    veröffentliche sein Layout wirklich: Hol seine Commits (git pull), gib
    der Seite den richtigen Namen, commit und push.
rollback-event-safeguard-pierced =
    Théos kaputter push ist trotzdem live gegangen: Der Hook hat die
    Veröffentlichung nicht gestoppt. Stell die Website wieder her und
    schau dir dann den Hook an: Werden die Tests ausgeführt, BEVOR current
    umgestellt wird, aus dem Verzeichnis der neuen Version, und hält ein
    Fehlschlag das Skript an (set -e, oder || exit 1)? Théo versucht es
    wieder, sobald sich der Hook ändert.
rollback-event-tests-elsewhere =
    Die neueste Version enthält zwar index.html, wurde aber nicht live
    geschaltet: Ihre Tests sind trotzdem gescheitert. tests.sh sucht
    index.html in dem Verzeichnis, aus dem es ausgeführt wird. Von wo
    führt der Hook es aus? (Ein Hook startet im Repository,
    /srv/git/gazette.git; cd wechselt das Verzeichnis.)
rollback-event-end =
    Das neue Layout ist live, veröffentlicht vom Hook nach seinen Tests.
    Samia: „Diesmal kann ein Fehler im Repository die Website nicht mehr
    kaputtmachen. Und wenn eine Version die Tests besteht, uns aber nicht
    gefällt, wissen wir, wie man in einer Sekunde zurückrollt.“

    Gut gemacht! Du hast Kapitel 2 von „Die Zeitung“ abgeschlossen. (Wie
    es weitergeht, erwartet dich: ssh zeitung.)

    WAS PASSIERT IST
    Jede Veröffentlichung kommt in ihr eigenes Verzeichnis; der Link
    current zeigt auf die, die live ist. Zurückrollen heißt, den Link zu
    ändern: ln -sfn ersetzt den Link in einem Schritt (ohne -n geht ln in
    das Verzeichnis, auf das er zeigt). Dann hat der Hook gelernt, die
    Tests auf der neuen Version VOR dem Umstellen auszuführen und
    anzuhalten, wenn sie scheitern: Eine kaputte Version erreicht den
    Server, geht aber nie live.

    GUTE PRAXIS
    - Die vorigen Versionen behalten; man stellt um, man kopiert nicht drüber.
    - Ein Rollback sollte ein einziger Befehl sein, im Voraus ausprobiert.
    - Vor dem Livegang testen (Continuous Integration), und beim ersten
      Fehlschlag alles anhalten: set -e, oder befehl || exit 1.
    - post-receive kann den push nicht mehr ablehnen (er ist schon
      empfangen); um die Commits selbst abzulehnen, nimmt man pre-receive.
    - Ab und zu alte Versionen aufräumen (ein paar behalten).

    DOKUMENTATION
    - ln (coreutils): https://www.gnu.org/software/coreutils/manual/html_node/ln-invocation.html
    - Git-Hooks: https://git-scm.com/docs/githooks
    - dash, das /bin/sh von Debian: https://manpages.debian.org/bookworm/dash/dash.1.en.html
