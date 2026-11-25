### Story "The Tool Library", chapter "The Leaky Pipeline": a CI workflow
### that hands the deploy key to a fork's pull request and prints it.
### Commands, options, paths, API routes and outputs are not translated.

chapter-leaky-pipeline = Die undichte Pipeline
    .summary = Die CI, die die Pull Requests von Lendshed testet und seine Dokumentation veröffentlicht, hat den Deploy-Schlüssel in ein öffentliches Log geschrieben und ihn dem Code jedes Forks gegeben. Finde das Leck, rotiere den Schlüssel und bau die Pipeline so um, dass der Code von Beitragenden getestet wird, ohne je ein Geheimnis zu berühren.

## Files

leaky-pipeline-message-rosa =
    Von: Rosa (Maintainerin)
    Mittwoch, 13. November, 13:40
    
    Hallo! Etwas Seltsames in der CI. Ich habe den Lauf von Kwames Pull
    Request gelesen (#57, seine Übersetzung ins Swahili), und der Job
    „test“ gibt unter einem Schritt namens „Show deploy configuration“ eine
    riesige Zeile aus Buchstaben und Zahlen aus. Tomasz hat diesen Schritt
    im Februar hinzugefügt, „um das Deployment zu debuggen“, und der
    Workflow ist seitdem so geblieben.
    
    Unser Repository ist öffentlich, und seine Läufe und deren Logs auch.
    
    Die CI ist .forgejo/workflows/ci.yml im Repository (dein Klon liegt in
    ~/lendshed). Die Läufe stehen in der API (man forgejo-api), und das Log
    jedes Jobs ist eine einfache Webseite. Die Dokumentation wird vom Job
    „deploy“ als Konto deploy auf amboss veröffentlicht
    (deploy@amboss.internal), mit dem Schlüssel aus dem Secret DEPLOY_KEY
    der Forge.
    
    Dein API-Token liegt noch in ~/.forgejo-token.
    
    Rosa

## Events

leaky-pipeline-kwame-sync = (Kwame hat seinen Pull Request #57 auf das neue main rebased: die CI ist wieder darauf gelaufen.)
leaky-pipeline-event-runs =
    Die Läufe der Forge: Pushes auf main und Kwames Pull Request #57,
    ausgeführt auf pull_request_target. Jeder Job hat sein Log (logs_url);
    bei einem öffentlichen Repository kann es jede Person lesen.
leaky-pipeline-event-log =
    Der Schritt „Show deploy configuration“ gibt eine lange Zeile aus:
    base64. Der Runner maskiert die Secrets, die er kennt, in den Logs (***
    an ihrer Stelle), aber nur ihren genauen Text: einmal kodiert, ist das
    Secret nur noch irgendeine Zeile. Was ist es? base64 -d liest es zurück.
leaky-pipeline-event-decoded =
    Es ist der Deploy-Schlüssel: ein privater OpenSSH-Schlüssel, seit
    Februar in einem öffentlichen Log, und obendrein dem Code jedes Pull
    Requests gegeben. Er muss als gestohlen gelten: das Log jetzt zu
    verstecken ändert nichts. Ein geleakter Schlüssel wird rotiert: ein
    neuer Schlüssel, der alte abgelehnt, das Secret aktualisiert. Und der
    Workflow, wie gibt er einem Fork den Schlüssel?
leaky-pipeline-event-workflow =
    Da ist das Muster, das das Security Lab von GitHub einen „pwn request“
    nennt: pull_request_target führt den Workflow des Basisbranches mit den
    Secrets des Repositorys aus, damit ein Workflow einen Pull Request
    kommentieren kann; aber dieser checkt den eigenen Code des Pull Requests
    aus (github.event.pull_request.head.sha) und führt ihn aus, mit
    DEPLOY_KEY in der Umgebung des ganzen Workflows. Das pip install oder
    eine Testdatei eines Forks könnte ihn lesen. Der Code eines Pull
    Requests muss mit pull_request getestet werden, das einem Fork keine
    Secrets gibt; der Schlüssel gehört nur in den Deploy-Schritt, bei einem
    Push auf main.
leaky-pipeline-event-old-key-gone =
    Der geleakte Schlüssel steht nicht mehr in den authorized_keys des
    Kontos deploy: wer ihn kopiert hat, bekommt „Permission denied“. Die
    Dokumentation kann nicht veröffentlicht werden, bis ein neuer Schlüssel
    an seinem Platz ist.
leaky-pipeline-event-unrestricted =
    Ein Schlüssel in authorized_keys ohne jede Option kann alles, was das
    Konto deploy kann: eine Shell, Port-Weiterleitung… Für den Schlüssel
    einer CI: einschränken: restrict, from="192.0.2.80" (die Adresse des
    Runners), und command="rrsync /srv/www/docs", das nur rsync in dieses
    Verzeichnis erlaubt (man authorized_keys im Handbuch von sshd, rrsync).
leaky-pipeline-event-new-key =
    Ein neuer, eingeschränkter Schlüssel für das Konto deploy. Seine private
    Hälfte muss jetzt in das Secret DEPLOY_KEY der Forge (PUT
    /repos/OWNER/REPO/actions/secrets/NAME, ein JSON-Body { "{" }"data": "…"{ "}" }),
    und dann weg von dieser Maschine.
leaky-pipeline-event-json-error =
    Forgejo kann das JSON nicht lesen: ein privater Schlüssel hat
    Zeilenumbrüche, und ein JSON-String darf keine rohen Zeilenumbrüche
    enthalten; sie müssen als \n geschrieben werden. jq baut das JSON
    richtig: jq -Rs '{ "{" }data: .{ "}" }' < SCHLUESSEL liest die Datei als einen
    einzigen String. Vorsicht auch: curl -d @DATEI entfernt die
    Zeilenumbrüche aus der Datei, die es schickt; --data-binary @DATEI
    behält sie.
leaky-pipeline-event-secret =
    Das Secret DEPLOY_KEY enthält jetzt den neuen Schlüssel (die Forge zeigt
    den Wert eines Secrets nie wieder: nur seinen Namen und sein Datum).
    Lösch deine lokale Kopie des privaten Schlüssels, sobald er gespeichert
    ist.
leaky-pipeline-event-pushed =
    main hat sich bewegt: die Forge hat den Push-Workflow ausgeführt, und
    Kwame wird seinen Pull Request darauf aktualisieren.
leaky-pipeline-event-no-ci =
    Auf main ist kein Workflow mehr: kein Leck mehr, aber auch keine Tests
    mehr auf Pull Requests und keine veröffentlichte Dokumentation. Die CI
    muss bleiben; sie muss nur aufhören, nicht vertrauenswürdigem Code
    Secrets zu geben.
leaky-pipeline-event-still-exposed =
    Kwames letzter Lauf gibt die Secrets immer noch dem Code des Forks, oder
    gibt immer noch eines aus. Schau dir die Läufe und ihre Logs noch
    einmal an: welches Event, welcher Code ausgecheckt wird, wo DEPLOY_KEY
    in der Umgebung steht.
leaky-pipeline-event-untested =
    Kwames Lauf berührt den Schlüssel nicht mehr, aber er testet auch seinen
    Code nicht mehr: pull_request_target mit dem Checkout des Basisbranches
    testet main, nicht den Pull Request. Teste Pull Requests auf
    pull_request: ihren eigenen Code, ohne Secrets.
leaky-pipeline-event-masked-only =
    Der Workflow ist jetzt sicher, aber der geleakte Schlüssel öffnet immer
    noch das Konto deploy: er war neun Monate lang öffentlich. Rotiere ihn.
leaky-pipeline-event-safe =
    Kwames letzter Lauf: sein Code auf pull_request getestet, ohne jedes
    Secret, nichts ausgegeben. Selbst ein bösartiger Fork könnte nur seinen
    eigenen Lauf kaputtmachen.
leaky-pipeline-event-stale-context =
    Der verlangte Status-Check auf main nennt noch „ci / test
    (pull_request_target)“: dieser Kontext wird nie wieder kommen, und kein
    Pull Request könnte gemergt werden. Aktualisiere den Schutz mit dem
    Kontext, den der Pull Request jetzt meldet.
leaky-pipeline-event-context =
    Der Schutz wartet jetzt auf den Kontext, den die CI auf Pull Requests
    wirklich meldet.
leaky-pipeline-event-deploy-failed =
    Der Deploy-Job des letzten Pushs ist gescheitert: schau dir sein Log an.
    Der Schlüssel im Secret, die Zeile in authorized_keys und ihre Optionen
    (from=, das Verzeichnis von rrsync) müssen übereinstimmen. Einmal
    repariert, führt ein neuer Push auf main ihn wieder aus (zum Beispiel
    git commit --allow-empty).
leaky-pipeline-event-deployed =
    Der letzte Push auf main hat die Dokumentation mit dem neuen Schlüssel
    deployt, dem einzigen, den das Konto deploy annimmt.
leaky-pipeline-event-end =
    Rosa: „Der Schlüssel war also neun Monate draußen… und jetzt ist er
    wertlos. Kwames Läufe sind grün, und nur unser eigener Code sieht je ein
    Secret. Danke!“
    
    Gut gemacht! Du hast „Die undichte Pipeline“ abgeschlossen.
    
    WAS PASSIERT IST
    Die CI führte Pull Requests auf pull_request_target aus, das dem
    Workflow die Secrets des Repositorys gibt, und checkte den Code des
    Forks aus; der Deploy-Schlüssel stand in der Umgebung jedes Jobs, und
    ein Debug-Schritt gab ihn in base64 aus, an der Maskierung der Logs
    vorbei. Der Schlüssel war in öffentlichen Logs geleakt. Du hast ihn
    dekodiert, um sicher zu sein, ihn rotiert (ein neuer Schlüssel,
    eingeschränkt mit rrsync und from=, der alte entfernt, das Secret der
    Forge über die API aktualisiert), den Workflow umgeschrieben (Pull
    Requests auf pull_request ohne Secrets getestet, das Deployment nur bei
    einem Push auf main, der Schlüssel nur in seinem Schritt) und die
    nächsten Läufe geprüft.
    
    GUTE PRAXIS
    - Nicht vertrauenswürdiger Code (der Pull Request eines Forks) läuft nie
      dort, wo ein Secret ist: pull_request, nicht pull_request_target mit
      ausgechecktem Head.
    - Ein Secret steht in der Umgebung des Schritts, der es braucht, und
      nirgends sonst; nie ausgegeben, nicht einmal kodiert: die Maskierung
      kennt nur seinen genauen Text.
    - Ein geleaktes Secret wird rotiert, nicht versteckt.
    - Der Deploy-Schlüssel einer CI wird auf dem Server eingeschränkt:
      restrict, from=, command= (rrsync für rsync).
    - Verlangte Status-Checks folgen den Kontexten des Workflows.
    
    DOKUMENTATION
    - Forgejo Actions, Events: https://forgejo.org/docs/latest/user/actions/reference/
    - Forgejo Actions, Sicherheit: https://forgejo.org/docs/latest/user/actions/security/
    - GitHub Security Lab, pwn requests verhindern: https://securitylab.github.com/resources/github-actions-preventing-pwn-requests/
    - sshd, AUTHORIZED_KEYS FILE FORMAT: https://man.openbsd.org/sshd#AUTHORIZED_KEYS_FILE_FORMAT
