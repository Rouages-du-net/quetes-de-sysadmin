### Das Handbuch: ein Eintrag pro Befehl, mit seiner Zusammenfassung (erster
### Satz, wiederverwendet von der Zeile BEZEICHNUNG und von whatis), seiner
### Beschreibung und seinen Attributen:
###   .synopsis     wie man ihn schreibt (technische Bezeichner werden nicht übersetzt)
###   .option-X     die Erklärung der Option -X
###   .example-N    die Erklärung des N-ten Beispiels (der Befehl steht im Code)
###   .command-N    der Befehl des N-ten Beispiels, wenn er Namen der Welt enthält
### Siehe src/engine/commands/manual.ts. Ein Entwurf übersetzt das Handbuch
### Seite für Seite (tests/texts.test.ts): Eine fehlende Seite erscheint auf Englisch.

man-apropos = sucht ein Wort in der Zusammenfassung jedes Befehls. Dasselbe wie man -k.
    .synopsis = apropos wort
man-cat = gibt den Inhalt von Dateien aus (concatenate: Es kann mehrere aneinanderhängen). Ohne Datei kopiert es, was durch eine Pipe hereinkommt. -A zeigt, was man nicht sieht: ein $ am Ende jeder Zeile, ^M für einen Wagenrücklauf (eine unter Windows geschriebene Datei), ^I für einen Tabulator.
    .synopsis = cat [-AEnTv] datei...
    .option-A = alles zeigen: dasselbe wie -vET.
    .option-E = ein $ am Ende jeder Zeile.
    .option-T = Tabulatoren als ^I angezeigt.
    .option-v = Steuerzeichen mit ^ angezeigt (ein Wagenrücklauf als ^M).
    .option-n = die Zeilen nummerieren.
    .example-1 = eine Datei ausgeben
    .example-2 = ihre unsichtbaren Zeichen sehen: ^M$ am Zeilenende bedeutet Windows-Zeilenenden (CR LF)
    .command-1 = cat nachricht.txt
man-cd = wechselt den Ort (change directory). „cd ..“ geht eine Ebene hoch, „cd ~“ oder einfach „cd“ bringt dich nach Hause, „cd /“ zur Wurzel, „cd -“ zum vorherigen Ort.
    .synopsis = cd ort
    .example-1 = den Ort Hafen betreten
    .example-2 = eine Ebene hochgehen
    .example-3 = nach Hause zurückkehren
    .example-4 = zur Wurzel gehen
    .example-5 = zum vorherigen Ort zurückkehren (und ihn ausgeben)
    .command-1 = cd Hafen
man-chmod = ändert Rechte (change mode). Z. B.: chmod o-w ort nimmt den anderen (o) das Recht zu schreiben (w); chmod 755 ort gibt rwx dem Besitzer, r-x den anderen. Nur der Besitzer (oder root) kann es tun. -R wirkt auch auf den ganzen Inhalt eines Verzeichnisses. g+s setzt das setgid-Bit auf ein Verzeichnis (ein s statt des x der Gruppe in ls -l): Was darin angelegt wird, bekommt die Gruppe des Verzeichnisses, nicht die der Person, die es anlegt; oktal ist es die führende 2 (2775). +t (sticky, die führende 1): In einem gemeinsamen Verzeichnis kann jede Person nur ihre eigenen Dateien löschen.
    .synopsis = chmod [-R] modus datei
    .option-R = wirkt auf das Verzeichnis und alles, was es enthält (rekursiv).
    .example-1 = den anderen das Recht zu schreiben nehmen
    .example-2 = rwx für den Besitzer, r-x für die anderen
    .example-3 = der Gruppe das Schreibrecht geben, in einem ganzen Verzeichnis
    .example-4 = ein gemeinsames Verzeichnis: Was darin angelegt wird, behält die Gruppe des Verzeichnisses
    .command-1 = chmod o-w erinnerungen
    .command-2 = chmod 755 ort
    .command-3 = sudo chmod -R g+w /srv/team
    .command-4 = sudo chmod g+s /srv/team
man-clear = leert den Bildschirm.
    .synopsis = clear
man-cp = kopiert eine Datei (copy). Das Original bleibt an seinem Platz. -r kopiert einen ganzen Ort mit seinem gesamten Inhalt; -a ebenfalls und behält dabei Rechte und Datumsangaben (der richtige Reflex, bevor man eine Konfiguration bearbeitet: cp -a /etc/nginx /etc/nginx.bak). Bei mehreren Quellen ist das Ziel ein Ort. -i fragt, bevor eine Datei ersetzt wird, -n ersetzt nie eine, -v sagt, was es kopiert.
    .synopsis = cp [-r|-a] [-p] [-i|-n] [-v] quelle… ziel
    .option-r = kopiert einen ganzen Ort mit allem, was er enthält (rekursiv).
    .option-R = dasselbe wie -r.
    .option-a = Archiv: wie -r -p (alles, mit Rechten und Datumsangaben).
    .option-p = behält die Rechte und die Datumsangaben (preserve); root behält auch den Besitzer.
    .option-i = fragt, bevor eine bestehende Datei ersetzt wird (interaktiv): j oder y zum Ersetzen.
    .option-n = ersetzt nie eine bestehende Datei (no clobber).
    .option-u = kopiert nur, wenn die Quelle neuer als das Ziel ist oder das Ziel fehlt (update).
    .option-v = sagt, was kopiert wird (verbose).
    .option-f = ersetzt, ohne zu fragen (force).
    .example-1 = eine Kopie daneben anlegen
    .example-2 = eine Datei von anderswo hierher (.) kopieren
    .example-3 = die Konfiguration von nginx sichern, bevor man sie anfasst
    .example-4 = kopieren, vor dem Ersetzen fragen und es sagen
    .command-1 = cp sauerteig sauerteig_2
    .command-2 = cp ~/Markt/kaese .
    .command-4 = cp -iv notizen.txt sicherung/
man-exit = verlässt die Shell. In einer ssh-Sitzung schließt es die Verbindung und bringt dich zurück zu der Maschine, von der du gekommen bist (hier dein Rechner).
    .synopsis = exit
man-grep = gibt die Zeilen aus, die das Muster enthalten. Das Muster ist ein regulärer Ausdruck: . bedeutet „ein beliebiges Zeichen“, ^ den Zeilenanfang, $ das Zeilenende, [abc] ein Zeichen aus a, b, c, und * „beliebig oft“ für das, was davor steht; um nach einem echten Punkt zu suchen, schreib \. (in einfachen Anführungszeichen). -E erlaubt außerdem + ? | und Klammern (erweiterte Ausdrücke), -P die von Perl (\d für eine Ziffer…, nur GNU grep), -F sucht den Text, wie er ist. -i ignoriert Groß- und Kleinschreibung, -v behält die Zeilen, die ihn NICHT enthalten, -c zählt die Zeilen, -q gibt nichts aus (nur der Rückgabewert zählt: Erfolg, wenn das Muster gefunden wird, nützlich in einem Skript). Ohne Datei durchsucht es, was durch eine Pipe hereinkommt. „grep wort *“ durchsucht alle Dateien des Ortes. Auf dem Bildschirm wird, was passt, rot hervorgehoben (--color=auto, wie der Alias von Debian); --color=never schaltet das ab. -n nummeriert die Zeilen, -o gibt nur aus, was passt, -m NUM hört nach NUM Zeilen auf. Rund um jede gefundene Zeile gibt -A NUM auch die NUM Zeilen danach aus, -B NUM die davor, -C NUM (oder -NUM) beide: Diese Kontextzeilen haben ein „-“ nach Name und Nummer (datei-12-text), wo die gefundenen Zeilen ein „:“ haben (datei:13:text), und „--“ trennt Gruppen, die nicht aufeinander folgen (--group-separator=SEP ändert es, --no-group-separator entfernt es). -c ignoriert den Kontext. -r durchsucht einen ganzen Baum (ohne Datei das aktuelle Verzeichnis; --include=GLOB, --exclude=GLOB und --exclude-dir=GLOB wählen die Dateien), -l listet nur die Namen der Dateien, die passen, -L die, die nicht passen. -w will ganze Wörter, -x ganze Zeilen; -e gibt ein Muster an (mehrere -e: eines davon), -f liest die Muster aus einer Datei. -s verschweigt die Meldungen über fehlende oder unlesbare Dateien. Der Rückgabewert ist 0, wenn eine Zeile gefunden wird, 1, wenn keine, 2 nach einem Fehler.
    .synopsis = grep [-i] [-v] [-c] [-q] [-n] [-o] [-w|-x] [-l|-L] [-r|-R] [-s] [-E|-F] [-h|-H] [-m NUM] [-A NUM] [-B NUM] [-C NUM] [--include=GLOB] [--exclude=GLOB] [--exclude-dir=GLOB] [--color[=WANN]] {"{"}muster | -e muster... | -f datei{"}"} [datei...]
    .option-i = ignoriert den Unterschied zwischen Groß- und Kleinbuchstaben.
    .option-v = kehrt die Suche um: behält die Zeilen, die das Muster NICHT enthalten.
    .option-c = zählt die passenden Zeilen, statt sie auszugeben.
    .option-q = still (quiet): gibt nichts aus, Erfolg, wenn das Muster gefunden wird, sonst Fehlschlag.
    .option-E = erweiterte reguläre Ausdrücke: + ? | ( ) haben ihre besondere Bedeutung.
    .option-P = Perl-kompatible reguläre Ausdrücke (\d, \w, Lookarounds): nur GNU grep.
    .option-F = sucht das Muster, wie es ist, ohne reguläre Ausdrücke (feste Zeichenketten).
    .option-h = gibt nie den Dateinamen vor den Zeilen aus (standardmäßig schon, bei mehreren Dateien).
    .option-H = gibt immer den Dateinamen vor den Zeilen aus, auch bei einer einzigen Datei.
    .option-n = gibt vor jeder Zeile ihre Nummer aus (--line-number).
    .option-e = MUSTER: das zu suchende Muster (--regexp); wiederhole es, um nach mehreren zu suchen, auch für ein Muster, das mit - beginnt.
    .option-f = DATEI: liest die Muster aus der Datei, eines pro Zeile (--file).
    .option-w = passt nur auf ganze Wörter: nicht innerhalb eines längeren Worts (--word-regexp).
    .option-x = passt nur auf ganze Zeilen (--line-regexp).
    .option-l = gibt nur die Namen der Dateien aus, die eine passende Zeile enthalten (--files-with-matches).
    .option-L = gibt nur die Namen der Dateien aus, die keine enthalten (--files-without-match).
    .option-r = durchsucht jede Datei der Verzeichnisse, rekursiv; ohne Datei das aktuelle Verzeichnis (--recursive). Überspringt symbolische Verknüpfungen unterwegs.
    .option-R = wie -r, folgt aber symbolischen Verknüpfungen (--dereference-recursive).
    .option-s = keine Meldung über fehlende oder unlesbare Dateien (--no-messages); der Rückgabewert sagt trotzdem 2.
    .option-o = gibt nur die passenden Teile aus, einen pro Zeile (--only-matching).
    .option-m = NUM: hört nach NUM gefundenen Zeilen auf (--max-count); der nachfolgende Kontext folgt trotzdem.
    .option-A = NUM: gibt auch die NUM Zeilen nach jeder gefundenen Zeile aus (--after-context).
    .option-B = NUM: gibt auch die NUM Zeilen vor jeder gefundenen Zeile aus (--before-context).
    .option-C = NUM: die NUM Zeilen davor und danach (--context); -NUM ist dasselbe.
    .example-1 = die Zeilen, die den Radierer erwähnen
    .example-2 = in allen Dateien hier, groß oder klein geschrieben
    .example-3 = ein Muster mit Leerzeichen, in Anführungszeichen
    .example-4 = die Zeilen, die „.env“ enthalten (der Punkt maskiert)
    .example-5 = die GET- oder POST-Anfragen an die Kassen-App
    .example-6 = jeder Fehler mit seiner Zeilennummer und den zwei Zeilen drumherum
    .example-7 = der erste Fehlschlag und die drei Zeilen danach
    .example-8 = jede .conf-Datei unter /etc, die sudo ohne Passwort gewährt, mit der Zeilennummer
    .example-9 = die Zeilen, die das Wort root oder admin enthalten
    .command-1 = grep Radierer chronik.txt
    .command-2 = grep -i radierer *
    .command-3 = grep "mein Passwort" tagebuch.txt
man-less = zeigt eine Datei Seite für Seite. Hier sind die Dateien kurz: less tut dasselbe wie cat.
    .synopsis = less datei
man-ls = listet den Inhalt eines Ortes (list). -a zeigt auch versteckte Dateien, deren Name mit einem Punkt beginnt. -l (long) zeigt die Rechte, die Zahl der Verknüpfungen, den Besitzer, die Gruppe, die Größe und das Datum der letzten Änderung (die Uhrzeit innerhalb von sechs Monaten, darüber hinaus das Jahr), nach einer Summe der belegten Blöcke (in KiB); -h schreibt Größen in K, M, G; -n zeigt die Nummern (uid, gid) statt der Namen. Die Namen kommen in alphabetischer Reihenfolge: -t sortiert nach Datum (das neueste zuerst: ls -ltr setzt die zuletzt geänderte Datei nach unten), -S nach Größe (die größte zuerst), -r kehrt die Reihenfolge um; -R listet auch jeden Ort darunter. Auf dem Bildschirm sind die Namen farbig (--color=auto, wie der Alias in der ~/.bashrc von Debian): Orte in Blau, Verknüpfungen in Cyan, Programme in Grün; --color=never schaltet die Farben ab, --color=always behält sie auch in einer Pipe.
    .synopsis = ls [-aAlhndiF1] [-t|-S|-U|-X] [-r] [-R] [--sort=WORT] [--color[=WANN]] [ort…]
    .option-a = zeigt alles (all), auch versteckte Dateien, deren Name mit einem Punkt beginnt, und die Orte . und ..
    .option-A = wie -a, ohne . und .. (almost all).
    .option-l = langes Format: Typ, Rechte, Verknüpfungen, Besitzer, Gruppe, Größe, Datum und Name, ein Eintrag pro Zeile.
    .option-F = hängt die Art jedes Eintrags an seinen Namen: / ein Ort, @ eine Verknüpfung, * ein Programm (classify).
    .option-h = mit -l: schreibt Größen gut lesbar (human-readable): 1,2K, 34M, 5G.
    .option-n = wie -l, aber mit den Nummern des Besitzers (uid) und der Gruppe (gid) statt ihrer Namen (numerisch).
    .option-i = zeigt die Inode-Nummer jeder Datei: Zwei Namen mit derselben Nummer sind dieselbe Datei (eine harte Verknüpfung).
    .option-d = zeigt den Ort selbst, nicht seinen Inhalt (directory): mit -l seine eigenen Rechte.
    .option-t = sortiert nach Änderungszeit, die neueste zuerst (--sort=time).
    .option-r = kehrt die Reihenfolge um (reverse).
    .option-S = sortiert nach Größe, die größte zuerst (--sort=size).
    .option-R = listet auch die Orte darunter, jeden unter seinem Namen (rekursiv).
    .option-U = sortiert nicht: die Reihenfolge, in der der Ort sie hält (--sort=none).
    .option-X = sortiert nach Endung (--sort=extension).
    .option-1 = ein Name pro Zeile, auch auf dem Bildschirm.
    .option-Z = jeder Name mit seinem SELinux-Kontext (user:role:type:level; mit -l nach der Gruppe). Ohne SELinux: ?.
    .example-1 = was hier ist
    .example-2 = alles, auch das Versteckte
    .example-3 = die Rechte des Ortes erinnerungen
    .example-4 = die Rechte des Verzeichnisses /srv/till selbst
    .example-5 = die Logs, das zuletzt geschriebene unten
    .example-6 = die größten Logs zuerst
    .example-7 = die Konfiguration von nginx, jede Ebene
    .command-3 = ls -l ~/erinnerungen
man-man = zeigt das Handbuch eines Befehls an (manual). Es ist der erste Reflex, wenn du nicht mehr weißt, wie ein Befehl funktioniert: seine Syntax, seine Optionen, Beispiele. Auf einem echten Linux öffnet sich die Seite im Vollbild: Du blätterst mit den Pfeiltasten, suchst mit /wort und beendest mit q.
    .synopsis = man [-k wort] befehl
    .option-k = sucht ein Wort in der Zusammenfassung jedes Befehls (wie apropos), um den Befehl zu finden, der tut, was du willst.
    .example-1 = das Handbuch von ls
    .example-2 = welche Befehle sprechen vom Kopieren?
    .example-3 = eine schnelle Kurzübersicht, ohne das Handbuch zu öffnen
    .command-2 = man -k kopiert
man-mkdir = legt einen neuen Ort an, also ein Verzeichnis (make directory). -p legt auch die fehlenden übergeordneten Orte an und sagt nichts, wenn der Ort schon existiert.
    .synopsis = mkdir [-p] ort
    .option-p = legt auch die übergeordneten Orte an (parents), ohne Fehler, wenn sie existieren.
    .example-1 = einen Ort anlegen
    .example-2 = einen Ort und alle seine übergeordneten auf einmal anlegen
    .command-1 = mkdir Klassenzimmer
man-mv = verschiebt eine Datei in einen Ort (move) oder benennt sie um, wenn das Ziel ein neuer Name ist. Bei mehreren Quellen ist das Ziel ein Ort. -i fragt, bevor eine Datei ersetzt wird, -n ersetzt nie eine, -v sagt, was es verschiebt.
    .synopsis = mv [-i|-n|-f] [-v] quelle… ziel
    .option-i = fragt, bevor eine bestehende Datei ersetzt wird (interaktiv): j oder y zum Ersetzen.
    .option-n = ersetzt nie eine bestehende Datei (no clobber).
    .option-v = sagt, was verschoben wird (verbose).
    .option-f = ersetzt, ohne zu fragen (force).
    .example-1 = krabbe in den Ort Eimer verschieben
    .example-2 = umbenennen
    .example-3 = auf einmal verschieben und umbenennen
    .example-4 = die Logs nach old/ verschieben und vor dem Ersetzen fragen
    .command-1 = mv krabbe Eimer
    .command-2 = mv entwurf.txt brief.txt
    .command-3 = mv entwurf.txt ~/Hafen/brief.txt
man-pwd = zeigt den vollständigen Pfad des Ortes an, an dem du bist (print working directory).
    .synopsis = pwd
man-rm = löscht eine Datei (remove). Vorsicht: rm geht über keinen Papierkorb, es ist endgültig. (Der Papierkorb grafischer Oberflächen, ~/.local/share/Trash, ist nur ein Verzeichnis: Eine Datei kommt mit gio trash dorthin, nie mit rm.) -i fragt bei jeder Datei, -f sagt nichts zu einer fehlenden Datei und fragt nie, -v sagt, was es löscht, -d löscht einen leeren Ort (wie rmdir).
    .synopsis = rm [-f|-i] [-v] [-d] datei…
    .option-f = kein Fehler bei einer fehlenden Datei, keine Frage (force).
    .option-i = fragt vor jedem Löschen: j oder y zum Löschen.
    .option-v = sagt, was gelöscht wird (verbose).
    .option-r = löscht ganze Orte mit allem, was sie enthalten (rekursiv): in diesem Spiel verweigert.
    .option-R = dasselbe wie -r.
    .option-d = löscht einen leeren Ort (dir).
    .example-1 = eine Datei löschen, für immer
    .example-2 = die .tmp-Dateien löschen, mit einer Frage für jede
    .example-3 = kein Fehler, wenn sie nicht da ist
    .command-1 = rm barrikade
    .command-3 = rm -f fehlt.txt
man-ssh = verbindet sich verschlüsselt mit einer anderen Maschine (Secure Shell). ssh liest ~/.ssh/config, um den echten Namen der Maschine, den Benutzer und den zu benutzenden Schlüssel zu finden, und prüft dann die Identität der Maschine in ~/.ssh/known_hosts. Beim ersten Mal bittet es dich, ihren Fingerabdruck zu bestätigen (yes). Du authentifizierst dich mit einem privaten Schlüssel, der nur für dich lesbar sein darf (chmod 600) und dessen öffentlicher Schlüssel in ~/.ssh/authorized_keys des entfernten Kontos steht; sonst, wenn der Server es erlaubt, mit einem Passwort. exit schließt die Verbindung. -J geht über eine Zwischenmaschine (eine Bastion oder ein Gateway), um eine interne Maschine zu erreichen, die du nicht direkt erreichst; ProxyJump tut dasselbe in ~/.ssh/config. -L port:maschine:port öffnet einen Tunnel: Der Port auf deiner Maschine führt zu dem Dienst, wie ihn die entfernte Maschine sieht (localhost: die entfernte Maschine selbst); mit -f -N hält ssh ihn im Hintergrund offen, ohne eine Sitzung zu öffnen. Ein Befehl nach dem Namen der Maschine läuft dort und gibt die Kontrolle zurück.
    .synopsis = ssh [-G] [-i schlüssel] [-p port] [-J gateway] [-L port:maschine:port] [-f] [-N] [benutzer@]maschine [befehl]
    .option-i = benutzt diese Datei mit dem privaten Schlüssel (identity file).
    .option-p = zu kontaktierender Port (standardmäßig 22).
    .option-J = geht über diese Maschine, um das Ziel zu erreichen (jump host).
    .option-L = Tunnel: Ein lokaler Port führt zu einem Dienst auf der anderen Seite (local forwarding).
    .option-N = keine Sitzung und kein Befehl: nur die Tunnel.
    .option-f = geht nach dem Verbinden in den Hintergrund (mit -N, für einen Tunnel).
    .option-G = zeigt die Konfiguration, die gelten würde (aus ~/.ssh/config), ohne sich zu verbinden.
    .example-1 = sich mit der Maschine koenigreich verbinden (Name in ~/.ssh/config festgelegt)
    .example-2 = dasselbe ohne ~/.ssh/config: Benutzer, vollständiger Name und Schlüssel
    .example-3 = die Maschinen sehen, die du kennst
    .example-4 = eine interne Maschine über das Gateway erreichen
    .example-5 = ein Tunnel zur Admin-Seite einer internen Maschine
    .example-6 = einen Befehl auf der entfernten Maschine ausführen
man-sudo = führt einen Befehl als root aus, der Administratorin mit allen Rechten (superuser do). Fragt nach DEINEM Passwort, nicht nach dem von root. Mit -u konto läuft der Befehl unter einem anderen Konto als root (zum Beispiel postgres für die Datenbank). sudo -i öffnet eine Shell als root (eine Login-Shell: in /root, mit der Umgebung von root, ihr Prompt endet mit #), sudo -s eine root-Shell, die bleibt, wo du bist; sudo su und sudo su - tun dasselbe über su. Tippe exit (oder Strg-D), um zu deiner eigenen Shell zurückzukehren: Eine root-Shell ist praktisch für eine Reihe von Befehlen und gefährlich, wenn man sie vergisst. sudo !! führt deinen letzten Befehl noch einmal mit sudo aus. Wer was darf, steht in /etc/sudoers und /etc/sudoers.d (man sudoers); sudo -l listet, was du tun darfst, sudo -l -U konto, was ein anderes Konto darf.
    .synopsis = sudo [-u konto] befehl ; sudo -i | -s ; sudo -l [-U konto]
    .option-i = eine Login-Shell als root (oder als das Konto von -u): in seinem Home, mit seiner Umgebung.
    .option-s = eine Shell als root, hier, wo du bist.
    .option-l = listet, was du mit sudo ausführen darfst.
    .option-U = mit -l: die Rechte eines anderen Kontos.
    .option-u = führt den Befehl als dieses Konto statt als root aus.
    .option-E = behält deine Umgebung (deine exportierten Variablen).
    .example-1 = eine Datei lesen, die root vorbehalten ist
    .example-2 = die Datenbanken auflisten, als postgres
    .example-3 = was du mit sudo tun darfst
    .example-4 = was lina mit sudo tun darf
    .example-5 = eine Weile root werden (exit, um zurückzukommen)
    .example-6 = der letzte Befehl noch einmal, mit sudo
man-touch = legt eine leere Datei an (oder aktualisiert ihr Datum, wenn sie schon existiert).
    .synopsis = touch datei
    .example-1 = eine leere Datei anlegen
    .command-1 = touch zahnrad
man-whatis = zeigt in einer Zeile, wofür ein Befehl da ist.
    .synopsis = whatis befehl
man-whoami = zeigt, unter welchem Benutzernamen du handelst (who am I).
    .synopsis = whoami
man-history = zeigt den Verlauf an: die auf dieser Maschine getippten Befehle, nummeriert. Die Shell kann sie erneut ausführen, ohne dass du sie neu tippst: !! führt den letzten noch einmal aus (sudo !! führt ihn mit sudo noch einmal aus, wenn du sudo vergessen hast), !12 den Befehl Nummer 12, !-2 den vorletzten, !cat den letzten, der mit cat beginnt. Die erweiterte Zeile wird angezeigt, bevor sie läuft. Die Pfeiltasten ↑ und ↓ und Strg-R gehen durch denselben Verlauf. Eine Zeile, die mit einem Leerzeichen beginnt, wird nicht behalten. Ein eingebauter Befehl der Shell (help history, auf einem echten Linux).
    .synopsis = history [N] | history -c
    .option-c = leert den Verlauf.
    .example-1 = alle getippten Befehle, nummeriert
    .example-2 = die letzten 5
    .example-3 = einen früher getippten ssh-Befehl finden
    .example-4 = den letzten Befehl noch einmal ausführen
    .example-5 = ihn mit sudo noch einmal ausführen („Keine Berechtigung“? sudo !!)
    .example-6 = den Befehl Nummer 12 noch einmal ausführen
man-nano = ein einfacher Texteditor im Terminal. Du tippst direkt in die Datei; die Tastenkürzel stehen unten auf dem Bildschirm, ^ bedeutet Strg: ^O (Strg+O) schreibt die Datei, ^X (Strg+X) beendet und bietet an, die Änderungen zu speichern. Um eine Datei zu bearbeiten, die root gehört, öffne nano mit sudo. (Im Spiel sind die Tastenkürzel auf dem Handy auch Schaltflächen.)
    .synopsis = nano datei
    .example-1 = Notizen schreiben (die Datei wird angelegt, wenn sie nicht existiert)
    .example-2 = eine Konfigurationsdatei bearbeiten, die root gehört
    .command-1 = nano notizen.txt

man-rsync = kopiert Dateien und Verzeichnisse und kopiert dabei nur, was sich geändert hat: das klassische Backup-Werkzeug. -a (Archiv) kopiert ein ganzes Verzeichnis und behält die Rechte; -v zeigt, was kopiert wird; -n (--dry-run) zeigt, was getan WÜRDE, ohne etwas anzufassen; --delete entfernt aus dem Ziel, was nicht mehr in der Quelle ist (ein exakter Spiegel: Vorsicht, es kopiert auch Löschungen). Achte auf den abschließenden Schrägstrich: „rsync -a erinnerungen/ ziel/“ kopiert den INHALT von erinnerungen nach ziel, „rsync -a erinnerungen ziel/“ legt ziel/erinnerungen an. Zu einer oder von einer anderen Maschine schreibst du maschine:pfad (rsync geht dann über ssh, mit denselben Schlüsseln).
    .synopsis = rsync [-a] [-v] [-n] [--delete] quelle... ziel ; rsync -a quelle... [konto@]maschine:ziel
    .option-a = Archivmodus: rekursiv, mit Rechten und Datumsangaben.
    .option-r = rekursiv: kopiert auch den Inhalt von Verzeichnissen.
    .option-v = gesprächig: listet, was kopiert wird (verbose).
    .option-n = Probelauf: zeigt, was getan würde, ohne etwas zu schreiben (dry run).
    .example-1 = den Inhalt eines Verzeichnisses in ein anderes sichern
    .example-2 = zuerst probieren, mit --delete: Nichts wird angefasst
    .example-3 = eine einzelne Datei aus dem Backup wiederherstellen
    .example-4 = eine Site auf eine andere Maschine veröffentlichen (über ssh)
    .command-1 = rsync -av ~/erinnerungen/ /mnt/sicherung/erinnerungen/
    .command-2 = rsync -avn --delete ~/erinnerungen/ /mnt/sicherung/erinnerungen/
    .command-3 = rsync -a /mnt/sicherung/erinnerungen/erster-brief.txt ~/erinnerungen/
man-crontab = verwaltet deine geplanten Aufgaben: Befehle, die cron von selbst zu festen Zeiten ausführt. crontab -e öffnet deine crontab im Editor; wenn du ihn schließt, wird sie geprüft und dann installiert. crontab -l zeigt sie an, crontab -r löscht sie. Eine Zeile = fünf Zeitfelder, dann der Befehl: Minute (0-59), Stunde (0-23), Tag des Monats (1-31), Monat (1-12), Wochentag (0-7, 0 und 7 = Sonntag). * bedeutet „jede“, 1-5 einen Bereich, 1,15 eine Liste, */10 „alle 10“. Oder eine Abkürzung: @daily (jede Nacht um Mitternacht), @hourly, @weekly, @reboot (beim Booten). Die Aufgaben laufen in deinem Home-Verzeichnis; was sie ausgeben, wird dir per Mail geschickt. root kann mit -u die crontab eines anderen Kontos ansehen und bearbeiten: sudo crontab -u malo -l.
    .synopsis = crontab [-u konto] -e | -l | -r | datei
    .example-1 = deine geplanten Aufgaben bearbeiten
    .example-2 = sie anzeigen
    .example-3 = eine crontab-Zeile: jede Nacht um 3:15
    .example-4 = die crontab eines anderen Kontos
    .command-3 = 15 3 * * * rsync -a ~/erinnerungen/ /mnt/sicherung/erinnerungen/

## Layout des Handbuchs und Meldungen von man-db und coreutils

# Kopf jeder Seite, zwischen "LS(1)" und "LS(1)"
manual-header = Handbuch des Spiels
manual-header-bsd = FreeBSD General Commands Manual
manual-header-solaris = User Commands (SunOS 5.10)
# Die CL-Befehle der IBM i (WRKACTJOB…): Ihre Seiten sagen (CL) und listen Parameter statt Optionen.
manual-header-cl = IBM i Control Language (CL)
manual-header-ps = Windows PowerShell Help (cmdlet)
# Die Windows-Programme (icacls, net, sc.exe…): Ihre Seiten sagen (CMD) und listen /Optionen.
manual-header-cmd = Windows-Befehle (cmd und Programme)
manual-section-parameters = OPTIONEN (PARAMETER)
manual-section-name = BEZEICHNUNG
manual-section-synopsis = ÜBERSICHT
manual-section-description = BESCHREIBUNG
manual-section-options = OPTIONEN
manual-section-examples = BEISPIELE
manual-section-see-also = SIEHE AUCH
# Erste Zeile von „befehl --help“
manual-use = Aufruf: { $synopsis }
manual-complete = Vollständiges Handbuch: man { $command }
manual-option-invalid =
    { $command }: Ungültige Option -- '{ $letter }'
    „{ $command } --help“ liefert weitere Informationen.
# Eine unbekannte lange Option (--frobnicate), wie getopt sie in coreutils ausgibt. { $option }: die getippte Option
manual-option-long-unknown =
    { $command }: Unbekannte Option '{ $option }'
    „{ $command } --help“ liefert weitere Informationen.
