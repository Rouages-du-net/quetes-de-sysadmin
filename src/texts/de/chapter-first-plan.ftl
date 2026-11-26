### Geschichte „Die Mapping-Party“, Kapitel „Der erste Plan“: ein
### DNS-Eintrag als Code mit OpenTofu hinzugefügt (init, fmt, validate, eine
### Variable, plan, apply, dig). Befehle, Optionen, Pfade, Ressourcenadressen,
### Eintragsnamen und die Ausgaben von OpenTofu werden nicht übersetzt.

chapter-first-plan = Der erste Plan
    .summary = Die Mapping-Party am Samstag braucht einen Namen für ihren Kachelserver. Das DNS des Kollektivs wird als Code mit OpenTofu gepflegt, und die Koordinatorin hat den neuen Eintrag selbst geschrieben, in Eile. Lies die Konfiguration, bring sie zum Laufen, plane, wende an und prüfe, was der DNS-Server wirklich sagt.

## Files

first-plan-message-andile =
    Von: Andile (Koordination der Wayfinders)
    Donnerstag, 10. Juni, 18:30

    Hallo, und danke, dass du das DNS übernimmst!

    Am Samstag ist unsere Mapping-Party im Bürgerhaus: vierzig Leute, die
    mit Handys durch die Altstadt laufen und jeden Bordstein, jede Stufe und
    jede Rampe notieren. Malalai hat für die Karte des Abends einen
    Kachelserver eingerichtet, auf 192.0.2.180, und die Handys brauchen
    einen Namen dafür: tiles.wayfinders.example.

    Yusra hat mir beigebracht, dass wir die Zone nie von Hand anfassen: Die
    Einträge leben als Code in /srv/dns, und OpenTofu bringt den DNS-Server
    dazu, zum Code zu passen. Also habe ich gestern Abend den Eintrag selbst
    zu /srv/dns/records.tf hinzugefügt, abgeschrieben von dem für www. Ich
    habe mich noch nicht getraut, etwas auszuführen; ich habe den Befehl
    tofu auf steinmann noch nie benutzt.

    Ihre Notizen liegen in deinem Home-Verzeichnis. Kannst du
    tiles.wayfinders.example bis Samstag zum Laufen bringen?

    Andile

first-plan-notes-yusra =
    Notizen von Yusra (das DNS als Code, 2031)

    - Die Zone wayfinders.example wird von named auf dieser Maschine
      ausgeliefert. Sie ist eine dynamische Zone: Änderungen kommen als
      signierte Updates (RFC 2136) mit dem Schlüssel tofu-key an, und named
      bewahrt sie in seinem Journal auf. Bearbeite
      /var/lib/bind/db.wayfinders.example nicht: named würde es ignorieren.
    - Der Code liegt in /srv/dns (Gruppe dnsadmins): versions.tf (OpenTofu
      und der dns-Provider), provider.tf, variables.tf, records.tf,
      outputs.tf. Werte kommen in terraform.tfvars; das Secret des
      Schlüssels in secrets.auto.tfvars, nie committet.
    - OpenTofu merkt sich in terraform.tfstate, was es verwaltet. Nicht
      bearbeiten, nicht löschen.
    - Eine frische Kopie des Codes muss einmal initialisiert werden (tofu
      init): Es installiert den Provider aus dem lokalen Mirror (kein
      Internet auf steinmann, siehe ~/.tofurc) und schreibt die
      gewählten Versionen in .terraform.lock.hcl.
    - Dann jedes Mal: tofu fmt, tofu validate, tofu plan, den Plan lesen,
      tofu apply. Und mit dig prüfen.
    - man tofu.

## Events

first-plan-event-not-initialised =
    Diese Kopie des Codes wurde auf steinmann nie initialisiert: keine
    Lock-Datei (.terraform.lock.hcl), kein Provider in .terraform. OpenTofu
    braucht den dns-Provider, um die Ressourcen zu verstehen, und tofu init
    installiert ihn.
first-plan-event-initialised =
    Das Arbeitsverzeichnis ist initialisiert: Der Provider hashicorp/dns kam
    aus dem lokalen Mirror, und .terraform.lock.hcl hält seine Version und
    Prüfsumme fest. Diese Datei gehört in die Versionsverwaltung, damit alle
    denselben Provider bekommen; .terraform/ nicht (siehe .gitignore).
first-plan-event-formatted =
    tofu fmt hat die Dateien im Standardstil neu geschrieben: zwei
    Leerzeichen pro Ebene, die „=“ benachbarter Argumente ausgerichtet. Es
    ändert nur das Layout; ein Tippfehler bleibt ein Tippfehler.
first-plan-event-invalid =
    tofu validate prüft den Code gegen das Schema des Providers, ohne etwas
    anzufassen: In records.tf fehlt dem Block tiles „addresses“, und er hat
    ein Argument, das der Provider nicht kennt. OpenTofu schlägt sogar den
    richtigen Namen vor.
first-plan-event-valid =
    Die Konfiguration ist gültig. Gültig heißt nicht vollständig: Eine
    Variable braucht noch ihren Wert, bevor OpenTofu planen kann.
first-plan-event-no-value =
    Die Variable tiles_address ist in variables.tf deklariert, ohne
    Standardwert, und keine Datei gibt ihr einen Wert. -var gibt einen für
    einen einzelnen Befehl; terraform.tfvars bewahrt ihn für alle auf, die
    hier tofu ausführen.
first-plan-event-planned =
    Der Plan liest sich wie ein Diff: + legt an, ~ ändert an Ort und Stelle,
    - zerstört, -/+ ersetzt. Hier: ein Record Set hinzuzufügen, sonst nichts
    angefasst. www und wiki werden aufgefrischt, mit dem Code verglichen und
    in Ruhe gelassen.
first-plan-event-zone-by-hand =
    Die Zonendatei wurde von Hand bearbeitet. named liest die Datei einer
    dynamischen Zone nicht neu ein (rndc reload lehnt das ab): Ihre Wahrheit
    ist im Speicher und im Journal. Und OpenTofu wüsste es auch nicht. Setz
    die Datei zurück, wie sie war (Yusra lässt sie unangetastet), und ändere
    stattdessen den Code.
first-plan-event-state-gone =
    terraform.tfstate ist weg. Ohne die Datei vergisst OpenTofu, dass es www
    und wiki verwaltet, und würde sie neu anlegen wollen. Die vorherige
    Version liegt in terraform.tfstate.backup: Kopier sie zurück, vor allem
    anderen.
first-plan-event-applied =
    OpenTofu hat das Update an named geschickt und den neuen Eintrag in
    seinen State geschrieben: Es verwaltet jetzt tiles, wie www und wiki.
first-plan-event-cli-var =
    Der Eintrag ist da, aber der Wert von tiles_address lebte nur in deiner
    Kommandozeile: Das nächste tofu plan hier, von Andile oder sonst
    jemandem, bleibt bei „No value for required variable“ stehen. Bewahr den
    Wert in terraform.tfvars auf.
first-plan-event-checked =
    dig hat named direkt gefragt: tiles.wayfinders.example antwortet
    192.0.2.180. Der Code, der State von OpenTofu und der Server stimmen
    überein.
first-plan-event-end =
    Andile: „Malalai sieht die Kacheln auf ihrem Handy. Der Samstag ist
    gerettet!“

    Gut gemacht! Du hast „Der erste Plan“ abgeschlossen.

    WAS PASSIERT IST
    Der Eintrag war als Code geschrieben, aber der Code war auf steinmann
    nie gelaufen: tofu init hat den dns-Provider aus dem lokalen Mirror
    installiert und die Lock-Datei geschrieben. tofu fmt hat das Layout
    korrigiert, tofu validate hat den Tippfehler gefunden (adresses), und
    die neue Variable hat ihren Wert in terraform.tfvars bekommen. tofu plan
    zeigte eine einzige Hinzufügung, tofu apply hat sie nach deinem „yes“
    ausgeführt (ein mit dem TSIG-Schlüssel signiertes dynamisches Update),
    und dig hat bestätigt, was named ausliefert.

    GUTE PRAXIS
    - Jede Änderung geht über den Code: Der Zustand des Servers ist eine
      Folge, und der Code ist das Protokoll, wer was geändert hat (halte ihn
      in git, mit .terraform.lock.hcl).
    - init einmal pro Kopie, dann fmt, validate, plan, apply: Lies die
      Zusammenfassungszeile des Plans, bevor du yes sagst.
    - Werte, die alle brauchen, kommen in eine .tfvars-Datei; Secrets in
      eine Datei, die nie committet wird (oder in TF_VAR_-Variablen).
    - Bearbeite nie von Hand, was OpenTofu verwaltet, weder die Einträge noch
      terraform.tfstate.
    - Prüfe das Ergebnis dort, wo es zählt (dig @127.0.0.1
      tiles.wayfinders.example).

    EIN ANDERER WEG
    Terraform, von dem OpenTofu 2023 abgespalten wurde, liest dieselben
    Dateien und arbeitet genauso. Ansible (Modul nsupdate) oder einfach
    nsupdate können dieselbe Änderung machen, aber ohne einen Plan zum
    Lesen und ohne einen State, mit dem man beim nächsten Mal vergleichen
    kann.

    DOKUMENTATION
    - tofu init: https://opentofu.org/docs/cli/commands/init/
    - tofu plan und apply: https://opentofu.org/docs/cli/commands/plan/
    - Variablen: https://opentofu.org/docs/language/values/variables/
    - Die Lock-Datei der Abhängigkeiten: https://opentofu.org/docs/language/files/dependency-lock/
    - Der dns-Provider: https://search.opentofu.org/provider/hashicorp/dns/latest
