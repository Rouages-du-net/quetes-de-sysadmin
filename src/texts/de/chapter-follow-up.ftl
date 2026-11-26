### Geschichte „Das Audit“, Kapitel „Die Nachprüfung“: den Scan wiederholen
### und Lynis laufen lassen, um zu beweisen, dass die Korrekturen halten,
### härten, was die Mühe wert ist, den Abschlussbericht schreiben. Die
### Befehle, Optionen, Pfade und die Ausgabe von nmap und Lynis werden
### nicht übersetzt. Die Abschnittstitel der Vorlage (follow-up-section-…)
### müssen die der Vorlage bleiben.

chapter-follow-up = Die Nachprüfung
    .summary = Beweisen, dass die Korrekturen halten: ein neuer Scan, ein Audit mit Lynis, begründete Härtung, und der Abschlussbericht.

## Dateien

follow-up-email-salome =
    Von:     Salomé (Auditorin)
    An:      dich
    Betreff: Audit der Bäckerei — die Nachprüfung

    Hallo,

    Die vier Teile des Berichts sind behandelt: gut gemacht. Bevor ich
    abschließe, mache ich, was ich immer mache: die Nachprüfung. Man sagt
    nicht „es ist behoben“, man zeigt es.

    Was ich erwarte, in dieser Reihenfolge:
    1. Wiederhole die Bestandsaufnahme, wie am ersten Tag: nmap -sV auf den
       Server (und nur auf ihn, denk an das Auftragsschreiben). Was sieht
       das Internet jetzt?
    2. Lass Lynis auf dem Server laufen (man lynis). Es behebt nichts: Es
       sagt, was es findet, und es ist an dir, zu entscheiden. Zuerst die
       Warnungen; unter den Vorschlägen die, die die Mühe wert sind (manche
       brauchen ein echtes Projekt: Die kommen in den Bericht, die
       installiert man nicht in Eile).
    3. Beheben, und beweisen: ein Härtungsindex von mindestens 70, ganz
       ohne Warnung, und ein neuer Scan, der aktuelle Versionen zeigt.
    4. Schreib den Abschlussbericht in abschlussbericht.md. Ich lese ihn
       bei jedem Speichern.

    Salomé
    (Für sudo ist dein Passwort immer noch: mehl-2028)

follow-up-template =
    # Abschlussbericht — Die Bäckerei

    ## Zusammenfassung
    (zu vervollständigen: in zwei Sätzen, wo die Sicherheit des Servers steht)

    ## Behobene Befunde
    (zu vervollständigen: ein Punkt pro Befund der Teile 1 bis 4: SSH, vergessenes Konto, sudo, Geheimnis, Exposition, Schlüssel und cron des Eindringlings)

    ## Beweise
    (zu vervollständigen: der neue nmap-Scan und der Härtungsindex von Lynis, mit ihren Zahlen)

    ## Noch zu tun
    (zu vervollständigen: was nicht behoben ist und warum, mit den Kennungen von Lynis)

follow-up-section-summary = Zusammenfassung
follow-up-section-findings = Behobene Befunde
follow-up-section-evidence = Beweise
follow-up-section-remaining = Noch zu tun
follow-up-a-complete = (zu vervollständigen

## Wörter, nach denen die Durchsicht sucht (durch Kommas getrennt, ohne Unterschied der Groß- und Kleinschreibung)

follow-up-words-hint = index, härtung, haertung, hardening
follow-up-words-ssh = ssh, root
follow-up-words-account = lucas, konto
follow-up-words-sudo = sudo, nopasswd
follow-up-words-secret = .env, geheimnis
follow-up-words-network = ufw, firewall, redis
follow-up-words-key = schlüssel, schluessel, cron

## Durchsicht

follow-up-review = Salomé liest deinen Bericht:
follow-up-missing-template = Einige Zeilen „(zu vervollständigen)“ der Vorlage sind noch da.
follow-up-missing-summary = Die Zusammenfassung soll zwei Sätze lang sein, und sie braucht etwas mehr als ein Wort.
follow-up-missing-findings = Unter „Behobene Befunde“ fehlen Befunde: Geh die Teile 1 bis 4 noch einmal durch (SSH, das vergessene Konto, sudo, das Geheimnis, die Netzwerk-Exposition, Schlüssel und cron-Aufgabe des Eindringlings), mindestens fünf von sechs.
follow-up-missing-lynis = Lass zuerst Lynis laufen: Ohne Audit gibt es keine Zahl zum Zitieren.
follow-up-missing-proofs = Zitiere unter „Beweise“ den Härtungsindex deines letzten Lynis-Audits (die genaue Zahl) und was dein letzter Scan zeigt (die Ports 22, 80 und 443).
follow-up-missing-rest = Zitiere unter „Noch zu tun“ mindestens einen noch offenen Befund von Lynis mit seiner Kennung (wie FINT-4350): Ein ehrlicher Bericht sagt, was nicht erledigt ist.

## Ereignisse

follow-up-event-error-ssh =
    In der SSH-Konfiguration ist ein Fehler! Vor dem Reload immer mit
    sudo sshd -t  prüfen: Es nennt die fehlerhafte Datei und Zeile.
follow-up-event-locked-out =
    ACHTUNG: Mit der Konfiguration, die sshd gerade geladen hat, würde eine
    neue Anmeldung mit deinem Konto abgelehnt. Deine Sitzung bleibt offen:
    Korrigiere es, BEVOR du dich abmeldest.
follow-up-event-outside-scope =
    Du hast eine Adresse außerhalb des Auftragsschreibens geprüft
    ({ $addresses }). Auch bei einer Nachprüfung bleibt man im Rahmen: { $neighbour ->
        [yes] Der Server des Nachbarn ist immer noch nicht unserer.
       *[no] Was darin nicht aufgeführt ist, ist nicht unseres.
    }
# { $outdated }: „yes“, wenn die angezeigte SSH-Version nicht aktuell ist
follow-up-event-scan =
    Das sieht das Internet jetzt. Vergleich mit dem ersten Tag: Die Ports
    5432 (PostgreSQL) und 6379 (Redis) antworten nicht mehr, SSH, die
    Website und ihr sicherer Port bleiben. Die Korrekturen an der Firewall
    halten.
    { $outdated ->
        [yes] Aber schau dir die SSH-Version an: Das ist nicht die einer aktuellen Maschine. Ein Sicherheitsupdate wartet (apt list --upgradable); genau die Art von Detail, die nmap -sV verrät und die sich niemand ansieht.
       *[no] Und die SSH-Version ist die einer aktuellen Maschine.
    }
follow-up-event-lynis =
    Da ist das Audit: ein Härtungsindex von { $hint }, und { $warnings }
    Warnung(en). Ein Index dient zum Vergleichen, nicht dazu, 100
    hinterherzujagen: Lies jeden Vorschlag, seine Kennung (SSH-7408…) und
    seine Erklärungsseite. Manche lassen sich hier beheben; andere
    (Dateiintegrität, Virenschutz, entfernte Logs, auditd) sind echte
    Projekte, die in den Bericht gehören.

    Das Audit wird in /var/log/lynis-report.dat aufbewahrt: Ein
    sudo grep suggestion  darauf gibt die Liste auf einen Schlag.
follow-up-event-update =
    Kein Sicherheitsupdate wartet mehr: Die Warnung von Lynis (PKGS-7392)
    ist weg, und die SSH-Version, die nmap zeigen wird, ist die neue. (Denk
    daran, nmap und Lynis erneut laufen zu lassen: Eine Korrektur, die
    nicht bewiesen ist, ist nur eine Absicht.)
follow-up-event-ssh-a-reload =
    Du hast die SSH-Konfiguration geändert, aber sshd läuft noch mit der
    alten: Ein Dienst liest seine Konfiguration neu, wenn man es ihm sagt
    (sudo sshd -t zum Prüfen, dann sudo systemctl reload ssh). Lynis liest
    die Datei: Sein neuer Index sagt dir nicht, was angewendet ist.
# { $target }: der zu erreichende Index
follow-up-event-hardened =
    Keine Warnung und ein Index von mindestens { $target }, mit angewendeter
    SSH-Konfiguration. Das ist ein gutes Niveau für diesen Server; der
    Rest ist ein Projekt, kein Notfall.

    Beweis es: Lass Lynis noch einmal laufen, und wiederhole den Scan.
follow-up-event-proof-lynis =
    Das letzte Lynis-Audit gibt den aktuellen Zustand der Maschine wieder:
    keine Warnung, und über dem Ziel. Notier die Zahl des Index: Der
    Bericht zitiert sie.
follow-up-event-nmap-own =
    Der letzte Scan sieht nur SSH, die Website und ihren sicheren Port, mit
    aktueller SSH-Version. Das ist der Beweis, von der Seite des Internets,
    dass alles hält. Bleibt der Abschlussbericht.
# { $mistake }: „yes“, wenn ein Scan über den Rahmen hinausging
follow-up-event-end =
    Salomé: „Er ist vollständig, und er ist ehrlich. Ich gebe ihn an Nadia
    und ihre Versicherung weiter. Ich komme in sechs Monaten wieder:
    Sicherheit wird nachgeprüft.“

    Gut gemacht! Du hast das Kapitel „Die Nachprüfung“ und die Geschichte
    „Das Audit“ abgeschlossen.

    WAS PASSIERT IST
    Du hast den Portscan wiederholt, Lynis laufen lassen, die Updates
    eingespielt und gehärtet, was die Mühe wert ist, und dann beides
    wiederholt, um es zu beweisen. Der neue Index und der neue Scan stehen
    in deinem Bericht, mit dem, was noch zu tun bleibt. Eine Nachprüfung
    versucht nicht, alles zu beheben: Sie zeigt, was behoben ist, und sagt
    offen, was nicht.
    { $mistake ->
        [yes] Dein Scan hat auch eine Adresse berührt, die nicht im Auftragsschreiben stand: Notier es dir für den nächsten Auftrag.
       *[no] Alle deine Scans sind im Rahmen geblieben.
    }

    GUTE PRAXIS
    - Beweisen, nicht behaupten: dasselbe Werkzeug, derselbe Befehl, vorher
      und nachher.
    - Lynis gibt einen Index, keine Note zum Maximieren: Manche Vorschläge
      sind einen Nachmittag wert, andere ein Projekt. Der Bericht setzt
      Prioritäten.
    - Eine Warnung wird vor den Vorschlägen behandelt.
    - Nach einer Änderung der Konfiguration anwenden (reload) UND prüfen
      (nmap, lynis, sshd -T): Die Datei ist nicht der Dienst.
    - Die Version, die ein Dienst anzeigt, ist ein Beweis (nmap -sV): Ein
      Sicherheitsupdate sieht man von außen.
    - Ein ehrlicher Bericht listet auf, was bleibt: Ein bekanntes,
      akzeptiertes Risiko ist besser als ein ignoriertes.

    EIN ANDERER WEG
    OpenSCAP oder die Benchmarks des CIS (Center for Internet Security)
    leisten eine ähnliche Arbeit wie Lynis mit einem genauen Prüfraster:
    Man benutzt sie, wenn ein Vertrag oder eine Norm verlangt, die
    Konformität zu beweisen. Ein Schwachstellenscanner (OpenVAS, Nessus)
    gleicht Versionen mit Datenbanken bekannter Schwachstellen ab, was
    nmap -sV nicht tut.

    DOKUMENTATION
    - Lynis: https://cisofy.com/documentation/lynis/
    - Prüfungen von Lynis: https://cisofy.com/lynis/controls/
    - nmap: https://nmap.org/book/man.html
    - sshd_config: https://man.openbsd.org/sshd_config
    - Leitfäden zu Grundschutz und Audit von nationalen Behörden: BSI (Deutschland, bsi.bund.de), NCSC (Schweiz, ncsc.admin.ch), ANSSI (Frankreich, cyber.gouv.fr), NCSC (Vereinigtes Königreich, ncsc.gov.uk), CCN-CERT (Spanien, ccn-cert.cni.es), CCB (Belgien, ccb.belgium.be), CISA (Vereinigte Staaten, cisa.gov)
