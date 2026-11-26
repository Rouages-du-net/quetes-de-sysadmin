### Story "The Tool Library", chapter "Who Can Push": a force-push with an
### ex-maintainer's credentials; collaborators, tokens, protected branches.
### Commands, options, paths, API routes and outputs are not translated.

chapter-who-can-push = Wer darf pushen
    .summary = Jemand hat mitten in der Nacht den Hauptbranch von Lendshed umgeschrieben, der Verleihsoftware von vierzig Werkzeugbibliotheken, mit den Zugangsdaten eines Maintainers, der im März gegangen ist. Finde heraus, was passiert ist, schließ die Türen, die er offen gelassen hat, und mach main zu einem Branch, den niemand umschreiben kann.

## Files

who-can-push-message-wanjiru =
    Von: Wanjiru (Lead-Maintainerin von Lendshed)
    Montag, 4. November, 8:50
    
    Willkommen im Team, und danke, dass du dich um unsere Forge kümmerst!
    
    Etwas lässt mir keine Ruhe. Am 16. Oktober hat Rosa festgestellt, dass
    ihre zwei Commits der Vorwoche aus main verschwunden waren: jemand hatte
    in der Nacht zum 14. einen Force-Push darauf gemacht. Sie hat ihre
    Commits am selben Tag zurückgebracht, aber wir haben nie verstanden,
    was passiert ist. Die Bare-Repositorys liegen in
    /var/lib/forgejo/data/forgejo-repositories (ich habe
    core.logAllRefUpdates nach einem Unfall letztes Jahr eingeschaltet),
    und Forgejo führt sein Log in /var/lib/forgejo/log.
    
    Tomasz sagt, er war es nicht (siehe seine Notiz). Er ist im März als
    Maintainer zurückgetreten: ich habe ihn aus dem Team der Maintainer
    genommen, also sollte er nicht mehr pushen können… oder?
    
    Bitte lösch sein Konto nicht: seine Issues und Reviews sind Jahre des
    Gedächtnisses unseres Projekts, und sie müssen seinen Namen behalten.
    
    Dein Konto auf der Forge heißt „du“, ein Admin, vorerst mit demselben
    Passwort wie auf amboss; ein API-Token für dich liegt in ~/.forgejo-token. Die API
    antwortet unter https://forge.lendshed.example/api/v1 (man
    forgejo-api). Dein Klon des Repositorys liegt in ~/lendshed.
    
    Wanjiru
who-can-push-note-tomasz =
    Von: Tomasz
    Sonntag, 3. November
    
    Hallo! Wanjiru hat mir von main erzählt. Ich war es nicht, versprochen:
    ich habe Lendshed seit März nicht angefasst, ich arbeite jetzt an den
    Fahrplänen eines Straßenbahnnetzes. Aber ich habe im September meinen
    alten Laptop verkauft… ich fürchte, ich habe ihn nur schnell gelöscht.
    Das Release-Skript, das ich 2029 geschrieben habe, hatte mein
    persönliches Zugriffstoken in seiner Konfiguration, ein Token mit allen
    Scopes, weil ich es eilig hatte. Bitte widerruft alles, was ich noch
    habe. Entschuldigung!
    
    Tomasz

## Events

who-can-push-event-history =
    Da: im Reflog des Bare-Repositorys, am 14. Oktober um 02:13, ist main
    auf einen Commit gesprungen, der nicht vom vorigen abstammt: ein
    erzwungener Push. Rosas zwei Commits blieben zurück (noch im
    Objektspeicher, über ihre ID auffindbar), und am 16. hat ein weiterer
    erzwungener Push sie zurückgebracht. Was hat der Commit jener Nacht
    geändert? git show sagt es dir.
who-can-push-event-typosquat =
    Der Commit hat requirements.txt eine Abhängigkeit hinzugefügt: requets,
    einen Buchstaben neben der bekannten Bibliothek requests. Ein
    Typosquatting-Paket, veröffentlicht, um aus Versehen installiert zu
    werden, ist ein klassischer Weg in die Lieferkette eines Projekts: jede
    Werkzeugbibliothek, die Lendshed zwischen dem 14. und dem 16.
    installiert hat, hat pip install darauf ausgeführt. Wer konnte auf main
    pushen? Frag die Forge, wer am Repository mitarbeitet.
who-can-push-event-collaborator =
    Tomasz ist noch direkter Collaborator von lendshed/lendshed, mit
    Schreibzugriff. Das Team der Maintainer zu verlassen hat ihm nur
    genommen, was das Team ihm gab; wer namentlich als Collaborator
    hinzugefügt wurde, behält seinen eigenen Zugriff. Jede Tür muss dort
    geschlossen werden, wo sie geöffnet wurde.
who-can-push-event-removed =
    Tomasz ist kein Collaborator mehr: sein Konto kann nicht mehr pushen.
    Aber ein persönliches Zugriffstoken trägt die Rechte seines Besitzers,
    und das in seinem alten Release-Skript hatte alle Scopes. Ist es noch
    gültig? Tokens werden pro Konto aufgelistet (GET /users/NAME/tokens),
    mit Basic-Authentifizierung.
who-can-push-event-delete-refused =
    Forgejo lehnt ab: Tomasz besitzt noch ein Repository (seinen alten
    Fork). Ein Konto zu löschen ist der harte Weg, und Wanjiru hat gebeten,
    seinen Namen an seinen Issues und Reviews zu behalten. Um zu verhindern,
    dass ein Konto benutzt wird, sperr seine Anmeldung (prohibit_login),
    oder entferne, was ihm Zugriff gibt.
who-can-push-event-purged =
    Das Konto ist weg, und mit --purge ging auch alles, was ihm gehörte:
    sein Fork, seine Kommentare, seine Reviews. In den Issues erscheinen
    Jahre seiner Arbeit jetzt als von „Ghost“ geschrieben. Die Tür ist zu,
    aber das Projekt hat einen Teil seines Gedächtnisses verloren;
    prohibit_login hätte sie geschlossen und seinen Namen behalten.
who-can-push-event-password-only =
    Ein neues Passwort ändert nichts für ein Token: ein persönliches
    Zugriffstoken authentifiziert für sich allein, ohne das Passwort. Das
    Token selbst muss weg (oder das Konto gesperrt werden).
who-can-push-event-tokens-basic =
    Forgejo listet und löscht Tokens nur mit Basic-Authentifizierung (curl
    -u benutzer:passwort): ein Token darf keine Tokens verwalten. Als Admin
    lässt dich der Header Sudo als ein anderes Konto handeln.
who-can-push-event-token-dead =
    Tomasz' altes Token öffnet nichts mehr: wer die Kopie von seinem Laptop
    hat, bekommt jetzt ein 401 oder 403. Jetzt der Branch selbst: main ist
    überhaupt nicht geschützt, deshalb konnte ein Force-Push ihn
    umschreiben.
who-can-push-event-private =
    Das Repository ist jetzt privat: Kwame und die vierzig
    Werkzeugbibliotheken, die daraus installieren, sehen es nicht mehr. Und
    es ändert nichts daran, wer pushen kann: Tomasz' Schreibzugriff und
    sein Token funktionieren auch auf einem privaten Repository. Mach es
    wieder öffentlich (PATCH auf das Repository mit "private": false).
who-can-push-event-rewritten =
    main führt nicht mehr zu Rosas letztem Commit: ein Force-Push hat seine
    Historie wieder umgeschrieben, diesmal von hier aus. Stell es wieder
    her: das Reflog deines Klons weiß noch, wo main war (git reflog), git
    reset --hard dorthin, dann ein Push. Dann schütze den Branch, bevor du
    irgendetwas anderes versuchst.
who-can-push-event-weak =
    Es gibt eine Regel für main, aber sie tut noch nicht alles. Forgejo
    lehnt einen Force-Push auf einen geschützten Branch immer ab; die Regel
    sollte außerdem nur die Maintainer direkt pushen lassen
    (enable_push_whitelist und push_whitelist_usernames, oder enable_push
    false) und vor dem Merge eines Pull Requests mindestens eine
    Freigabe (required_approvals) und den Status-Check der CI
    (enable_status_check, status_check_contexts) verlangen.
who-can-push-event-bad-context =
    Der verlangte Status-Check nennt einen Kontext, den die CI nie meldet:
    kein Pull Request könnte je gemergt werden. Die Kontexte sind „workflow
    / job (event)“: schau dir an, was die Forge für einen Commit
    aufgezeichnet hat (GET …/commits/REF/statuses).
who-can-push-event-protected =
    main ist geschützt: kein Force-Push, direkte Pushes nur für die
    Maintainer, eine Freigabe und eine grüne CI vor einem Merge. Prüfe es
    so, wie es gescheitert ist: versuch selbst, main umzuschreiben, und sieh
    zu, wie die Forge ablehnt.
who-can-push-event-refused =
    „branch main is protected from force push“: der pre-receive-Hook der
    Forge hat abgelehnt, bevor irgendetwas geschrieben wurde. Genau das hat
    in der Nacht zum 14. gefehlt.
who-can-push-event-end =
    Wanjiru: „Die Türen waren also der Collaborator und das Token, nicht das
    Team. Und jetzt kann main nicht einmal von einem Admin umgeschrieben
    werden. Danke. Ich schreibe den Werkzeugbibliotheken wegen requets.“
    
    Gut gemacht! Du hast „Wer darf pushen“ abgeschlossen.
    
    WAS PASSIERT IST
    Tomasz hat das Team der Maintainer im März verlassen, aber er war vor
    Jahren auch namentlich zum Repository hinzugefügt worden, und sein
    persönliches Zugriffstoken mit allen Scopes steckte in einem
    Release-Skript auf einem Laptop, den er verkauft hat. In der Nacht zum
    14. Oktober hat jemand es benutzt, um einen Force-Push auf main zu
    machen und zwei Commits durch einen zu ersetzen, der eine
    Typosquatting-Abhängigkeit hinzufügte. Du hast den erzwungenen Push im
    Reflog des Bare-Repositorys und im Log von Forgejo gefunden, den
    direkten Collaborator entfernt, das Token unbrauchbar gemacht und main
    geschützt: kein Force-Push, direkte Pushes für die Maintainer, Reviews
    und CI vor dem Merge; dann hast du einen Force-Push scheitern sehen.
    
    GUTE PRAXIS
    - Wenn jemand geht, jeden Zugang auflisten: Teams, direkte
      Collaborators, SSH-Schlüssel, Deploy-Schlüssel, Tokens. Das Konto
      sperren (prohibit_login) statt es zu löschen, um seine Historie zu
      behalten.
    - Tokens: die kleinsten Scopes, ein Ablaufdatum, nie in der
      Konfiguration eines Skripts auf einem Laptop; widerrufen, was nicht
      benutzt wird.
    - Den Standardbranch schützen: kein Force-Push, eingeschränkte Pushes,
      Reviews und verlangte Status-Checks; ein Reflog auf dem Server
      behalten.
    - Eine Abhängigkeit, die in einem Commit ohne Review hinzugefügt wurde,
      ist ein Lieferketten-Vorfall: informiere alle, die installiert haben.
    
    DOKUMENTATION
    - Forgejo, geschützte Branches: https://forgejo.org/docs/latest/user/protection/
    - Forgejo, Benutzung der API (Tokens, Sudo): https://forgejo.org/docs/latest/user/api-usage/
    - git reflog: https://git-scm.com/docs/git-reflog
    - OpenSSF, Best Practices für Quellcodeverwaltung: https://best.openssf.org/SCM-BestPractices/
who-can-push-event-end-purged =
    Wanjiru: „Die Türen sind zu, danke… aber Tomasz' Name ist aus vier
    Jahren Issues verschwunden. Ich versuche, sie aus dem Backup von letzter
    Woche wiederherzustellen.“
    
    Gut gemacht! Du hast „Wer darf pushen“ abgeschlossen, mit einem Preis.
    
    WAS PASSIERT IST
    Tomasz hat das Team der Maintainer im März verlassen, aber er war auch
    direkter Collaborator, und sein persönliches Zugriffstoken mit allen
    Scopes steckte in einem Release-Skript auf einem Laptop, den er
    verkauft hat. Jemand hat es am 14. Oktober für einen Force-Push auf main
    benutzt. Du hast den erzwungenen Push im Reflog gefunden, seinen Zugang
    geschlossen und main geschützt. Aber sein Konto mit --purge zu löschen
    hat die Urheberschaft seiner Beiträge mitgenommen: prohibit_login hätte
    das Konto gesperrt und das Gedächtnis des Projekts behalten.
    
    GUTE PRAXIS
    - Wenn jemand geht, jeden Zugang auflisten: Teams, direkte
      Collaborators, SSH-Schlüssel, Tokens. Sperren (prohibit_login), nicht
      löschen.
    - Tokens: die kleinsten Scopes, ein Ablaufdatum, nie in einem Skript
      auf einem Laptop.
    - Den Standardbranch schützen: kein Force-Push, eingeschränkte Pushes,
      Reviews und verlangte Status-Checks.
    
    DOKUMENTATION
    - Forgejo, geschützte Branches: https://forgejo.org/docs/latest/user/protection/
    - Forgejo, admin user delete: https://forgejo.org/docs/latest/admin/command-line/
    - git reflog: https://git-scm.com/docs/git-reflog
