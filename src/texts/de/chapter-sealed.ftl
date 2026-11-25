### Geschichte „Die Herberge“, Kapitel „Versiegelt“: OpenBao nach einem
### Stromausfall versiegelt (status, drei Schlüsselteile, die App neu
### gestartet, ihr Zustand geprüft). Befehle, Optionen, Pfade, Namen von
### Policys und Tokens, Schlüsselteile und die Ausgaben von OpenBao werden
### nicht übersetzt.

chapter-sealed = Versiegelt
    .summary = Ein Sturm hat in der Nacht den Strom abgeschaltet. Der Server der Herberge ist von selbst wiedergekommen, aber der Tresor für die Secrets kam versiegelt zurück, und die Buchungsseite hat aufgegeben. Um neun kommen Gäste: Bau den Schlüssel des Tresors aus den Teilen von drei Personen wieder auf und bring die Seite zurück.

## Files

sealed-message-desta =
    Von: Desta (Koordination der Herberge)
    Samstag, 6. März, 07:40

    Guten Morgen, und entschuldige die frühe Nachricht!

    Der Sturm hat um 03:12 den Strom abgeschaltet. schloss ist um 03:58 von
    selbst wiedergekommen, aber die Buchungsseite, Bunks, ist down, und
    zwölf Gäste kommen um neun zum Einchecken.

    Ruslan hat schloss letzten Monat eingerichtet. Bunks bewahrt seine
    Passwörter (die Datenbank, der Zahlungsanbieter) in OpenBao auf, einem
    Tresor für Secrets auf derselben Maschine. Er hat uns gesagt, dass
    OpenBao nach einem Neustart „versiegelt“ ist und dass drei von uns
    jeweils ihren „Schlüsselteil“ geben müssen, um es zu öffnen. Es gibt
    fünf Teile: meinen, Ruslans, deinen, Hirokos und Nnamdis.

    Ruslan ist bis Montag ohne Netz beim Trekking. Mein Teil liegt auf
    Papier im Safe der Herberge; ich sitze im Zug, aber ich habe letzte
    Woche ein Foto davon gemacht. Es ist etwas verschwommen, das hier lese
    ich:

        { $share }

    Ich bin mir nicht bei jedem Zeichen sicher. Hiroko und Nnamdi haben
    ihre geschickt (ihre Nachrichten liegen in deinem Home-Verzeichnis), und
    deiner sollte auf deinem USB-Stick sein.

    Kannst du den Tresor öffnen und Bunks vor neun zurückholen?

    Desta

sealed-message-hiroko =
    Von: Hiroko (Kasse)
    Samstag, 6. März, 07:22

    Desta hat mich angerufen. Ich bin bei meiner Schwester, zwei Stunden
    entfernt, also hier ist mein Teil, abgetippt von meinem Umschlag:

        { $share }

    Lösch diese Nachricht, sobald der Tresor offen ist: Ruslan hat gesagt,
    wenn ein Teil je auf Reisen geht, müssen wir neue machen.

    Hiroko

sealed-message-nnamdi =
    Von: Nnamdi
    Samstag, 6. März, 07:31

    Ausnahmsweise früh wach! Mein Teil, aus meinem Passwortmanager:

        { $share }

    Ich kann heute nicht kommen; sag mir, wenn die Seite etwas braucht.

    Nnamdi

sealed-usb-comment = Dein Schlüsselteil (Nummer 3 von 5), von Ruslan am 14. Februar ausgegeben. Offline aufbewahren.

## Events

sealed-event-status =
    OpenBao antwortet, ist aber versiegelt: Seine Daten liegen verschlüsselt
    auf der Platte, und es kann sie nicht entschlüsseln, bis es seinen
    Root-Key aus drei der fünf Teile wieder aufgebaut hat (Shamirs Secret
    Sharing). Unseal Progress 0/3: Noch niemand hat einen Teil gegeben. Jeder
    Start des Servers beginnt so.
sealed-event-init =
    bao operator init ist für einen ganz neuen Server: Es erzeugt den
    Root-Key, die Teile und das erste Root-Token. Dieser hier ist schon
    initialisiert (Initialized true): Er muss nur entsiegelt werden.
sealed-event-first-share =
    OpenBao hat einen Teil gezählt: Der Fortschritt hat sich bewegt, und
    eine Unseal Nonce benennt diesen Versuch. Die bisher gegebenen Teile
    bleiben im Speicher, bis die Schwelle erreicht ist. Einen Teil an der
    Eingabeaufforderung zu tippen (bao operator unseal ohne Argument) hält
    ihn aus der History der Shell heraus.
sealed-event-duplicate =
    Der Fortschritt hat sich nicht bewegt: Dieser Teil wurde schon gezählt.
    Drei Teile heißt drei verschiedene Personen; das ist der Sinn der
    Schwelle: Niemand allein kann den Tresor öffnen.
sealed-event-bad-format =
    OpenBao konnte diesen Teil nicht dekodieren: Ein Teil ist eine base64-
    (oder Hex-)Zeichenkette fester Länge. Kopier ihn ganz, ohne Leerzeichen
    oder die Kommentarzeile.
sealed-event-bad-share =
    Der dritte Teil hat die Schwelle erreicht, OpenBao hat die drei
    kombiniert... und das Ergebnis hat seinen Keyring nicht entschlüsselt:
    Einer davon war falsch. Der ganze Versuch ist verloren, und der
    Fortschritt steht wieder auf 0/3, weil OpenBao nicht sagen kann, welcher
    Teil falsch war. Wurde einer davon von einem verschwommenen Foto
    abgelesen?
sealed-event-restart-early =
    Bunks ist wieder gescheitert: OpenBao ist noch versiegelt, also lassen
    sich seine Secrets nicht lesen (journalctl -u bunks: „Vault is
    sealed“). Zuerst entsiegeln, dann die App neu starten.
sealed-event-openbao-restarted =
    OpenBao wurde neu gestartet: Es kommt versiegelt zurück, und die schon
    gegebenen Teile sind vergessen. Ein Neustart entsiegelt nie; nur die
    Teile tun es.
sealed-event-unsealed =
    Sealed false: OpenBao hat seinen Root-Key im Speicher wieder aufgebaut
    und seinen Keyring geöffnet. Es bleibt entsiegelt, bis es anhält (ein
    Neustart, ein Stromausfall, bao operator seal). Bunks hat allerdings in
    der Nacht aufgegeben: Nach fünf gescheiterten Starts hat systemd
    aufgehört, es zu versuchen (start-limit-hit).
sealed-event-restarted =
    Bunks läuft wieder: Beim Start hat es seine zwei Secrets aus OpenBao
    gelesen (journalctl -u bunks). Antwortet es wirklich?
sealed-event-checked =
    Die Health-Seite antwortet: Bunks erreicht OpenBao, seine Datenbank und
    den Zahlungsanbieter.
sealed-event-end =
    Desta: „Die ersten Gäste checken ein. Danke!“

    Gut gemacht! Du hast „Versiegelt“ abgeschlossen.

    WAS PASSIERT IST
    Der Stromausfall hat schloss neu gestartet, und OpenBao ist versiegelt
    gestartet, wie immer: Seine Daten sind mit einem Schlüssel
    verschlüsselt, der selbst vom Root-Key verschlüsselt ist, und der
    Root-Key wird nirgends aufgeschrieben. bao status zeigte Sealed true und
    Unseal Progress 0/3. Drei verschiedene Teile, an bao operator unseal
    gegeben, haben ihn wieder aufgebaut (Shamirs Secret Sharing: beliebige
    drei der fünf, nie weniger). Bunks hatte nach fünf gescheiterten Starts
    aufgegeben; neu gestartet hat es seine Secrets gelesen, und seine
    Health-Seite hat geantwortet.

    GUTE PRAXIS
    - Die Teile gehören verschiedenen Personen, getrennt und offline
      aufbewahrt; jede Person tippt ihren eigenen (bao operator unseal ohne
      Argument: Der Teil wird weder angezeigt noch in der History
      gespeichert).
    - Ein Teil, der gereist ist (eine Nachricht, ein Foto), ist geschwächt:
      Sobald der Tresor offen ist, erzeuge neue Teile (bao operator rekey)
      und vernichte die alten.
    - Das von bao operator init ausgegebene Root-Token ist nur für die
      erste Einrichtung. Die tägliche Arbeit benutzt Tokens, die durch
      Policys begrenzt sind; wenn wirklich ein Root-Token nötig ist, erzeugen
      drei Personen mit Teilen eines (bao operator generate-root), und es
      wird gleich danach widerrufen.
    - Eine App, die vom Tresor abhängt, muss geduldig neu versuchen
      (Restart=on-failure, ein ausreichend langes RestartSec=), und das
      Monitoring sollte „sealed“ sagen, bevor es die Gäste tun.

    EIN ANDERER WEG
    Auto-Unseal: Der Root-Key wird von einem Schlüsselverwaltungsdienst
    geschützt (ein Cloud-KMS, ein HSM über PKCS#11, die Transit-Engine eines
    anderen OpenBao), und der Server entsiegelt sich beim Start selbst; die
    Teile werden zu Wiederherstellungsschlüsseln. Keine frühen Anrufe mehr,
    aber das Vertrauen geht auf diesen Dienst über.

    DOKUMENTATION
    - Versiegeln und Entsiegeln: https://openbao.org/docs/concepts/seal/
    - bao operator unseal: https://openbao.org/docs/commands/operator/unseal/
    - bao status: https://openbao.org/docs/commands/status/
    - Root-Tokens: https://openbao.org/docs/concepts/tokens/#root-tokens
