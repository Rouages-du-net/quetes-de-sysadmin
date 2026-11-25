### Geschichte „Die Mapping-Party“, Kapitel „Drift“: Einträge, die während
### eines Vorfalls von Hand geändert wurden, ein vergessenes apply, das die
### Sperre des States hält, der Drift, den tofu plan zeigt, und tofu import.
### Befehle, Optionen, Pfade, Ressourcenadressen, Eintragsnamen und die
### Ausgaben von OpenTofu werden nicht übersetzt.

chapter-drift = Drift
    .summary = Eines Abends ist der Host der Website gestorben, und der ehrenamtliche Bereitschaftsdienst hat das DNS von Hand repariert, schnell und gut. Jetzt sagt der Code das eine, der DNS-Server das andere, und OpenTofu startet nicht einmal. Bring sie wieder in Einklang, ohne die Website kaputtzumachen.

## Files

drift-message-andile =
    Von: Andile
    Freitag, 25. Juni, 9:10

    Guten Morgen,

    Femi hat gestern unseren Abend gerettet: Der alte Webhost
    (198.51.100.40) ist um neun gestorben, und er hat die Website auf die
    Ersatzmaschine verlegt, 198.51.100.41. Der Hoster hat heute Morgen
    bestätigt, dass der alte endgültig weg ist: Die Website bleibt auf .41.

    Aber Femi hat es „auf die alte Art“ gemacht, von Hand, und Yusra erinnert
    uns daran, dass der Code sagen muss, was wahr ist. Und heute Morgen
    startet tofu plan bei mir nicht einmal: irgendwas mit einer Sperre.

    Kannst du wieder Ordnung schaffen? Die Website muss weiter
    funktionieren. Femi hat auch einen Eintrag für Malalais Statusseite
    hinzugefügt: Behalte ihn, aber unter OpenTofu wie die anderen. Seine
    Notiz liegt in deinem Home-Verzeichnis.

    Andile

drift-message-femi =
    Von: Femi
    Donnerstag, 24. Juni, 22:05

    Sorry, eine hastige Notiz, bevor ich schlafe.

    21:30: Die Website antwortete nicht mehr, ihr Host war tot. Malalai hat
    die Ersatzmaschine (198.51.100.41) gestartet und die Website darauf
    kopiert.

    21:41: Ich habe tofu apply in /srv/dns gestartet, um die Adresse zu
    ändern, aber der Plan wollte Dinge ändern, die ich nicht verstanden
    habe, also habe ich es bei seiner Frage warten lassen und nsupdate
    benutzt, das kenne ich, mit dem Schlüssel aus /etc/bind/tofu-key.key:
      update delete www.wayfinders.example A
      update add www.wayfinders.example 60 A 198.51.100.41
    (TTL 60, damit wir schnell zurückschalten können.)

    21:51: Malalais Statusseite läuft auf 198.51.100.42, also habe ich
    status.wayfinders.example genauso hinzugefügt, TTL 300.

    Den Code habe ich nicht angefasst. Der Akku meines Laptops war leer,
    bevor ich irgendetwas schließen konnte.

    Femi

## Events

drift-event-locked =
    OpenTofu sperrt den State, bevor es ihn liest, damit zwei Läufe ihn nicht
    gleichzeitig schreiben können. Der Lauf von jemand anderem hält die
    Sperre: Lock Info sagt, wer, welche Operation und seit wann. Lebt dieser
    Lauf noch?
drift-event-force-unlock =
    tofu force-unlock hilft bei einem lokalen State nicht: Die Sperre hält
    das Betriebssystem für den Prozess, der sie genommen hat, und nur dieser
    Prozess kann sie freigeben. Finde den Prozess (ps) und entscheide, was
    du mit ihm machst.
drift-event-no-lock =
    -lock=false, während Femis apply noch wartet: Wenn jemand in seiner
    Sitzung yes antwortet, wendet es seinen alten Plan an und schreibt seinen
    eigenen State über deinen. Genau das verhindert die Sperre; beende
    stattdessen seinen Lauf.
drift-event-freed =
    Femis apply hat das Signal empfangen, seine Operation abgebrochen und
    die Sperre beim Beenden freigegeben (seine .terraform.tfstate.lock.info
    ist weg). Der State ist frei.
drift-event-freed-kill =
    Femis apply ist tot, getötet ohne Gelegenheit zum Aufräumen: Das
    Betriebssystem hat die Sperre mit dem Prozess freigegeben, aber seine
    Lock-Datei (.terraform.tfstate.lock.info) ist liegen geblieben. Das ist
    harmlos, der nächste Lauf ersetzt sie; ein einfaches kill (TERM) lässt
    OpenTofu sauber anhalten.
drift-event-drift =
    „Objects have changed outside of OpenTofu“: Der Refresh hat www neu
    gelesen und Femis Änderungen gefunden, die der State nicht kannte. Lies
    den Plan darunter: Den Code anzuwenden, wie er ist, würde www zurück auf
    198.51.100.40 setzen, den toten Host. Die Entscheidung liegt bei dir:
    Hier ist die Änderung von Hand die Wahrheit, also muss der Code folgen.
drift-event-reverted =
    www zeigt wieder auf 198.51.100.40, den Host, der gestorben ist: Die
    Website ist für alle down, deren Resolver jetzt fragt. Der Code hatte
    noch die alte Adresse, und der Plan hat es gesagt. Korrigiere records.tf
    und wende noch einmal an.
drift-event-hand-edit =
    terraform.tfstate wurde von Hand bearbeitet. Der State ist das
    Gedächtnis von OpenTofu über die echten Objekte, mit einer serial und
    einer lineage, und eine falsche Bearbeitung lässt ihn lügen. Um
    festzuhalten, was sich außerhalb geändert hat, macht tofu apply
    -refresh-only es richtig; um etwas zu vergessen oder umzubenennen, tofu
    state rm und tofu state mv. Die vorherige Version liegt in
    terraform.tfstate.backup.
drift-event-state-rm =
    tofu state rm hat OpenTofu einen Eintrag vergessen lassen, nicht das
    DNS: Der Eintrag ist noch in named, und noch im Code, also will der
    nächste Plan ihn anlegen. Der Unterschied ist nicht verschwunden, er hat
    nur die Form gewechselt. Hol ihn mit tofu import zurück.
drift-event-code =
    records.tf sagt jetzt, was wahr ist: www auf 198.51.100.41. Lies den
    nächsten Plan: Was ist mit der TTL, die Femi auf 60 gesenkt hat? Behalte
    60 im Code, oder geh zurück auf 300 (ttl erzwingt das Ersetzen des
    Record Sets: Der Plan sagt es).
drift-event-created-over =
    status.wayfinders.example wurde über den Eintrag „angelegt“, den Femi
    gemacht hatte: Der dns-Provider fügt Adressen eine nach der anderen
    hinzu, also ging es durch. Bei den meisten Providern scheitert das
    Anlegen von etwas, das existiert („already exists“), und der Weg, ein
    Objekt zu übernehmen, ist tofu import.
drift-event-imported =
    status.wayfinders.example ist jetzt im State von OpenTofu, mit den
    Werten, die es wirklich hat. Ab jetzt geht eine Änderung daran über den
    Code wie bei den anderen.
drift-event-end =
    Andile: „tofu plan sagt No changes. Das ist der schönste Satz der
    Woche.“ Femi: „Nächstes Mal ändere ich den Code, auch nachts.“

    Gut gemacht! Du hast „Drift“ abgeschlossen.

    WAS PASSIERT IST
    Während des Vorfalls hat Femi ein tofu apply auf sein „yes“ warten
    lassen, das die Sperre des States hielt, und www mit nsupdate geändert
    und status hinzugefügt. Du hast seinen Lauf beendet (OpenTofu hat die
    Sperre freigegeben), und tofu plan hat den Drift gezeigt: Das echte www
    unterschied sich vom State, und das Anwenden des alten Codes hätte die
    Website zurück auf den toten Host gesetzt. Du hast den Code der echten
    Änderung folgen lassen, angewendet und status mit tofu import
    übernommen, bis OpenTofu nichts mehr zu tun fand.

    GUTE PRAXIS
    - Drift ist nicht automatisch falsch: Entscheide, welche Seite wahr ist.
      Wenn die Änderung von Hand richtig ist, aktualisiere den Code; wenn
      nicht, wende den Code an.
    - Lies den Plan vor jedem apply, vor allem wenn er zerstört oder
      ersetzt: -auto-approve ist für Pipelines, die schon geprüft wurden.
    - Eine Sperre heißt, ein Lauf ist (oder war) im Gang: Finde ihn, erzwinge
      nichts. Nie -lock=false auf einem geteilten State.
    - Übernimm, was von Hand gemacht wurde, mit tofu import (oder einem
      import-Block), dann bring den Code in Einklang, bis plan No changes
      sagt.
    - Bearbeite terraform.tfstate nicht, und benutze state rm nicht, um einen
      Unterschied zu verstecken; erkenne Drift regelmäßig mit tofu plan
      -detailed-exitcode (Rückgabewert 2, wenn sich etwas unterscheidet).

    EIN ANDERER WEG
    Ein import-Block im Code (import mit to und id) tut dasselbe wie tofu
    import, geht aber wie jede Änderung durch plan und apply und kann
    geprüft werden. tofu apply -refresh-only hält Änderungen von außen im
    State fest, ohne etwas anzufassen, wenn der Code ihnen schon folgt.

    DOKUMENTATION
    - Sperren des States: https://opentofu.org/docs/language/state/locking/
    - tofu force-unlock: https://opentofu.org/docs/cli/commands/force-unlock/
    - Planungsmodi (refresh-only): https://opentofu.org/docs/cli/commands/plan/
    - Importieren: https://opentofu.org/docs/cli/import/ und https://opentofu.org/docs/language/import/
    - BIND, dynamische Updates: https://bind9.readthedocs.io/en/stable/reference.html#dynamic-update-policies
