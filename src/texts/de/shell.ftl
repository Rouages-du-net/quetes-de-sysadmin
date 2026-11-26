### Die Shell: Prompt, sudo, Pipes und Umleitungen, man, und die
### Fehlermeldungen, die mehrere Befehle teilen (aus coreutils, glibc und
### bash auf Deutsch, vom Translation Project: https://translationproject.org/team/de.html).
### { $command }: Name des Befehls; { $target }: Pfad.

## Gemeinsame Meldungen

error-missing = { $command }: { $target }: Datei oder Verzeichnis nicht gefunden
error-is-one-directory = { $command }: { $target }: Ist ein Verzeichnis
error-permission = { $command }: { $target }: Keine Berechtigung
error-binary = { $command }: { $target }: Binärdatei (ein Archiv: Um zu sehen, was es enthält, tar -tf { $target })
error-creation-permission = { $command }: '{ $target }' kann nicht angelegt werden: Keine Berechtigung
error-space = { $command }: Schreibfehler: Auf dem Gerät ist kein Speicherplatz mehr verfügbar

## sudo

# Die Meldung, die sudo beim ersten Mal zeigt (Übersetzung von sudoers).
sudo-lecture =
    Wir gehen davon aus, dass Sie die üblichen Hinweise von Ihrem lokalen Systemadministrator gehört haben. Normalerweise läuft es auf diese drei Regeln hinaus:

        #1) Respektieren Sie die Privatsphäre anderer.
        #2) Denken Sie nach, bevor Sie tippen.
        #3) Mit großer Macht kommt große Verantwortung.
# { $user }: Name des Kontos (technischer Bezeichner)
sudo-prompt = [sudo] Passwort für { $user }:
sudo-bad-password = Sorry, versuchen Sie es noch einmal.
sudo-three-failures = sudo: 3 Fehlversuche bei der Passwort-Eingabe
sudo-not-still = sudo: Diesen Befehl hast du in diesem Kapitel noch nicht.
sudo-cd =
    sudo: cd: Befehl nicht gefunden
    (cd ist ein Teil der Shell selbst, deshalb kann sudo es nicht ausführen. Mit sudo schaust und handelst du aus der Ferne: sudo ls ort, sudo cat datei…)

## Befehlszeilen, Pipes und Umleitungen

# { $operator }: > oder >>
syntax-redirection = Syntaxfehler: Dateiname fehlt nach { $operator }
syntax-pipe = Syntaxfehler beim unerwarteten Symbol »|«
syntax-token = Syntaxfehler beim unerwarteten Symbol »{ $token }«
syntax-end = Syntaxfehler: Unerwartetes Dateiende.
syntax-eof = Syntaxfehler: Unerwartetes Dateiende.
# { $line }: die Zeilennummer der Eingabe; { $delimiter }: das Wort des Here-Dokuments (EOF)
heredoc-eof = Warnung: Das in der Zeile { $line } beginnende Here-Dokument geht bis zum Dateiende (erwartet wird »{ $delimiter }«).
# { $command }: break oder continue, außerhalb einer Schleife getippt
shell-loop-only = -bash: { $command }: Nur in einer for-, while- oder until-Schleife sinnvoll.
# { $count }: die Zahl der Durchläufe, nach denen das Spiel eine Schleife stoppt
shell-loop-limit = (Das Spiel hat diese Schleife nach { $count } Durchläufen gestoppt: Eine Schleife ohne Ende würde die Seite einfrieren. Auf einer echten Maschine stoppt Strg-C sie.)
redirection-is-one-directory = { $target }: Ist ein Verzeichnis
redirection-permission = { $target }: Keine Berechtigung
redirection-sudo = (Die Umleitung > macht deine eigene Shell, nicht sudo. Tipp: Schick den Text an „sudo tee -a datei“, das als root schreibt.)
command-not-still = { $command }: Diesen Befehl hast du in diesem Kapitel noch nicht. Tippe „hilfe“ für die Liste.
command-missing = { $command }: Befehl nicht gefunden. Tippe „hilfe“ für die Liste.
command-replaced = { $command }: Befehl nicht gefunden. (Debian 13 hat { $command } nicht mehr: Versuch es mit { $replacement }.)
# { $commands }: list of commands, separated by commas
# Der Name des Befehls, der die anderen auflistet, in der Sprache (hilfe, help)
command-help = hilfe
help-commands = Bekannte Befehle: { $commands }.
# { $commands }: die Befehle, die dieses Kapitel aus den vorausgesetzten Kapiteln hat, durch Kommas getrennt
help-inherited = In früheren Kapiteln gelernt: { $commands }.
help-more = Mehr erfahren: „man befehl“ (das ganze Handbuch), „befehl --help“ (eine Kurzübersicht), „man -k wort“ (einen Befehl per Stichwort finden).

## man, apropos, whatis (Meldungen von man-db)

manual-not-still = (Diesen Befehl hast du in diesem Kapitel noch nicht.)
manual-what-search = { $command } was?
manual-nothing = { $word }: nichts Passendes.
manual-which-page =
    Welche Handbuchseite wollen Sie?
    Versuchen Sie zum Beispiel 'man man'.
manual-not-page = Kein Handbucheintrag für { $command } vorhanden

## Skripte (/bin/sh): Git-Hooks, Deployment-Skripte (src/engine/script.ts)

# { $operator }: was test bekommen hat (dash ist nicht übersetzt)
test-operator = { $operator }: unexpected operator
test-too-arguments = too many arguments
# { $file }: das verlangte Skript
sh-missing = sh: 0: cannot open { $file }: No such file
sh-interactive = (In diesem Spiel führt sh ein Skript aus: sh datei. Die interaktive Shell ist die, in der du schon tippst.)
# { $argument }: was nicht verstanden wurde
date-invalid = date: ungültiges Datum '{ $argument }'
# Das Datumsformat ohne Argument, wie date mit LANG=de_DE.UTF-8
date-format = %a %e. %b %H:%M:%S %Z %Y
readlink-operand =
    readlink: Fehlender Operand
    „readlink --help“ liefert weitere Informationen.
# ./skript ausführen: { $command } ist der getippte Pfad
script-missing = bash: { $command }: Datei oder Verzeichnis nicht gefunden
script-directory = bash: { $command }: Ist ein Verzeichnis
script-permission = bash: { $command }: Keine Berechtigung

## Platten (mount, umount)

mount-usage =
    Usage:
     mount [-lhV]
     mount -a [options]
     mount [options] [--source] <source> | [--target] <directory>
     mount [options] <source> <directory>
    (Hier: mount, oder sudo mount [-o ro] gerät einhängepunkt; siehe man mount)
# sfdisk ohne Skript: Das echte sfdisk würde einen Dialog öffnen (Unterschied des Spiels)
sfdisk-interactive =
    sfdisk: Den interaktiven Modus gibt es in diesem Spiel nicht. Gib ihm ein Skript
    auf seiner Standardeingabe: zum Beispiel die Tabelle einer anderen Platte,
    sfdisk -d /dev/sda | sudo sfdisk /dev/sdb (siehe man sfdisk).
# mdadm --create mit einem anderen Level als RAID 1 (Unterschied des Spiels)
# { $level }: das verlangte Level
mdadm-level = mdadm: In diesem Spiel wird nur RAID 1 (--level=1) simuliert, nicht „{ $level }“.
update-initramfs-usage =
    Usage: update-initramfs {"{"} -c | -d | -u {"}"} [-k version] [-v] [-b directory]
umount-usage =
    Usage:
     umount [-hV]
     umount <source> | <directory> [options]
# { $command }: der Befehl; { $target }: der Pfad
error-read-only = { $command }: { $target }: Das Dateisystem ist nur lesbar

# sudo -u mit einem Konto, das es nicht gibt; { $account }: der angegebene Name
sudo-account-unknown = sudo: Unbekannter Benutzer { $account }

# Ein Platzhalter, der zu viele Namen ergibt: die Grenze für die Argumente eines Programms (ARG_MAX).
# { $program }: der Pfad des Programms, z. B. /usr/bin/rm
list-arguments-too-long = bash: { $program }: Die Argumentliste ist zu lang
sudo-list-arguments-too-long = sudo: { $program } kann nicht ausgeführt werden: Die Argumentliste ist zu lang
date-option-argument =
    date: Option erfordert ein Argument -- 's'
    „date --help“ liefert weitere Informationen.
date-setting-refuse = date: Datum kann nicht gesetzt werden: Die Operation ist nicht erlaubt

## Easter Eggs (siehe EGGS in src/engine/shell.ts): auf Englisch, wie ihre Originale

egg-xyzzy = Nothing happens.
egg-sandwich-refusal = What? Make it yourself.
egg-sandwich = Okay.
egg-sl =
          ====        ________                ___________
      _D _|  |_______/        \__I_I_____===__|_________|
       |(_)---  |   H\________/ |   |        =|___ ___|
       /     |  |   H  |  |     |   |         ||_| |_||
      |      |  |   H  |__--------------------| (___) |
      | ________|___H__/__|_____/(__)~\_______|       |
      |/ |   |-----------I_____I (__) (__)  D |=======|__
    __/ =| o |=-~~\  /~~\  /~~\  /~~\ ____Y___________|__
     |/-=|___|=    ||    ||    ||    |_____/~\___/
      \_/      \O=====O=====O=====O_/      \_/

# Unbekanntes --color=WANN (ls, grep, diff), wie coreutils es auf Deutsch sagt.
colour-argument-invalid =
    { $command }: ungültiges Argument '{ $value }' für '--color'
    Gültige Argumente sind:
      - 'always', 'yes', 'force'
      - 'never', 'no', 'none'
      - 'auto', 'tty', 'if-tty'
    „{ $command } --help“ liefert weitere Informationen.

# vim, vi, emacs…: nicht simuliert; das Spiel verweist auf seinen Editor.
editor-only-nano = { $command }: Befehl nicht gefunden. Der Editor dieses Spiels ist nano: nano { $file } (Strg-O zum Speichern, Strg-X zum Beenden).
editor-file = datei
