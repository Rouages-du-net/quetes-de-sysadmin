### Geschichte „Die Mieterinitiative“, Kapitel „Raus aus dem Offenen“: eine
### im Klartext committete .env-Datei, mit sops und age verschlüsselt, ihr
### Passwort rotiert, beim Deployment entschlüsselt. Befehle, Optionen,
### Pfade, Schlüssel, Variablennamen und die Ausgaben der Werkzeuge werden
### nicht übersetzt.

chapter-out-of-the-open = Raus aus dem Offenen
    .summary = Die Reparatur-App der Mieterinitiative bewahrt ihr Datenbankpasswort in einer .env-Datei auf, im Klartext committet, und das Repository lag aus Versehen drei Tage auf einer öffentlichen Forge. Verschlüssle sie mit sops und age, damit sie in git bleiben kann, lass das Deployment sie entschlüsseln, und kümmere dich um das Passwort, das schon draußen ist.

## Shared by the story's chapters

tenants-union-readme =
    # Repairline

    Die Mieter·innen von Larkspur melden Reparaturen (ein Leck, die
    Heizung, Feuchtigkeit), und die Mieterinitiative Larkspur verfolgt sie
    beim Vermieter weiter.

    - app.py: die App (Flask), von gunicorn als Dienst repairline
      ausgeführt.
    - .env: ihre Einstellungen (die Datenbank und die Mail).
    - deploy.sh: legt die Einstellungen in /etc/repairline/env und startet
      die App neu. Als root auf riegel ausführen:
      sudo /srv/repairline/deploy.sh

    Der eigene age-Schlüssel des Servers (sein öffentlicher Schlüssel, für
    sops):
    { $key }

tenants-union-commit-1 = Repairline: Die Mieter·innen melden Reparaturen, die Initiative verfolgt sie weiter
tenants-union-commit-2 = Einstellungen des Servers, damit deploy.sh funktioniert
tenants-union-commit-3 = Fotos der Schäden: ein Limit von 8 MB
tenants-union-commit-4 = .env mit sops und age verschlüsseln, das Datenbankpasswort rotieren
tenants-union-commit-5 = Makoas age-Schlüssel hinzufügen
tenants-union-commit-6 = Einstellungen des Mail-Relays, verschlüsselt

## Files

out-of-the-open-message-taslima =
    Von: Taslima (Schriftführung, Mieterinitiative Larkspur)
    Dienstag, 8. März, 19:05

    Hallo, und willkommen im kleinen Technikteam der Initiative!

    Zuerst etwas Peinliches. Letzte Woche hat Makoa einen Spiegel des
    Repositorys von Repairline auf einer öffentlichen Forge eingerichtet,
    code.example, „damit andere Initiativen es wiederverwenden können“. Er
    war drei Tage öffentlich, bevor er es gemerkt und gelöscht hat. Das
    Repository hat eine .env-Datei mit dem Datenbankpasswort darin, im
    Klartext, seit Januar. Alle hätten es klonen können.

    Makoa sagt, die Lösung ist sops und age: Die .env bleibt in git, aber
    verschlüsselt, sodass nur die Personen (und der Server), die einen
    Schlüssel haben, sie lesen können. Der Server hat schon einen eigenen
    age-Schlüssel, den von root, in /etc/repairline/ (sein öffentlicher
    Schlüssel steht in der README). Ich hätte die .env gern für den Server
    und für dich verschlüsselt, und eine Regel, damit die nächste
    Secrets-Datei, die wir hinzufügen (das Mail-Relay kommt), genauso
    verschlüsselt wird. Und was auch immer wegen des Passworts getan werden
    muss, das draußen ist.

    Der Code liegt in /srv/repairline; die Ehrenamtlichen klonen ihn von
    /srv/git/repairline.git, also push bitte dorthin, wenn du fertig bist.
    Die App muss weiter funktionieren: Die Mieter·innen benutzen sie jeden
    Abend.

    Danke!
    Taslima

## Events

out-of-the-open-event-history-seen =
    Da ist es: git bewahrt jede Version jeder Datei auf. Das Passwort steht
    seit Makoas Commit vom 26. Januar in der History, und jeder Klon des
    Repositorys hat seine eigene Kopie dieser History, die der Besucher·innen
    der Forge eingeschlossen. Die Datei ab jetzt zu verschlüsseln schützt
    die nächsten Versionen, nicht die vergangenen.
out-of-the-open-event-base64 =
    base64 ist eine Kodierung, keine Verschlüsselung: Alle können sie mit
    base64 -d umkehren, ohne jeden Schlüssel. Ein Secret in base64 ist ein
    Secret im Klartext, das einen Befehl mehr zum Lesen braucht.
out-of-the-open-event-gitignore =
    Eine .gitignore-Datei hält nur nicht verfolgte Dateien aus git heraus:
    {"."}env wird schon verfolgt, also bleibt es verfolgt, und git rm --cached
    würde es nur aus den nächsten Commits entfernen. Das Passwort bleibt so
    oder so in der History, und das Deployment, das .env aus dem Repository
    liest, würde seine Einstellungen verlieren. Behalte .env in git, aber
    verschlüsselt.
out-of-the-open-event-key-made =
    Du hast einen eigenen age-Schlüssel: Der geheime Teil bleibt in
    ~/.config/sops/age/keys.txt (wo sops ihn sucht, nur für dich lesbar),
    der öffentliche Teil (age1…) ist, was du anderen gibst, damit sie für
    dich verschlüsseln können.
out-of-the-open-event-rule-written =
    Die Datei .sops.yaml hat eine Creation Rule: Jede Datei, deren Pfad zu
    path_regex passt, wird für die unter age aufgelisteten Schlüssel
    verschlüsselt, egal wer sops ausführt. .env und die mail.env des
    Mail-Relays werden beide passen.
out-of-the-open-event-wrong-recipient =
    Die Datei .env ist verschlüsselt, aber nicht für den Server: Sein
    Schlüssel ({ $key }) ist nicht unter den Empfängern, also kann root auf
    riegel sie beim Deployment nicht entschlüsseln. sops kann nur mit einem
    Schlüssel entschlüsseln, für den verschlüsselt wurde. Entschlüssle sie
    wieder, oder bau sie mit den richtigen Empfängern neu.
out-of-the-open-event-not-yours =
    Die Datei .env ist für den Server verschlüsselt, aber nicht für dich: Ab
    jetzt könntest du sie selbst nicht lesen oder bearbeiten. Füge deinen
    eigenen öffentlichen Schlüssel zu den Empfängern hinzu.
out-of-the-open-event-encrypted =
    Die Datei .env ist jetzt eine SOPS-Datei: Die Namen der Variablen sind
    noch lesbar (git diff bleibt nützlich), jeder Wert ist ein
    ENC[AES256_GCM,…]-Block, und die sops_-Zeilen am Ende enthalten den
    Datenschlüssel, einmal für jeden Empfänger verschlüsselt, und einen MAC
    über alle Werte.
out-of-the-open-event-rotated =
    Die Datenbank hat ein neues Passwort. Das alte ist jetzt wertlos für
    alle, die die History kopiert haben. Bis die App das neue bekommt, wird
    sie bei ihrem nächsten Neustart scheitern: Das Passwort muss in .env und
    in die deployten Einstellungen.
out-of-the-open-event-ciphertext-deployed =
    /etc/repairline/env enthält die verschlüsselten Werte: deploy.sh hat
    {"."}env so kopiert, wie es ist, ENC[…] inbegriffen, und die App würde das
    als ihr Passwort lesen. Das Deployment muss die Datei entschlüsseln,
    mit einem Schlüssel, den der Server hat.
out-of-the-open-event-root-without-key =
    sops lief als root und hat keinen age-Schlüssel gefunden: Es sucht in
    ~/.config/sops/age/keys.txt des Kontos, das es ausführt, und das von
    root hat keinen. Der Schlüssel des Servers liegt in
    /etc/repairline/age.key: Die Variable SOPS_AGE_KEY_FILE sagt sops, wo
    es suchen soll (man sops).
out-of-the-open-event-app-down =
    Repairline konnte nicht starten: Es kann sich nicht mit der Datenbank
    verbinden (journalctl -u repairline sagt, warum). Das Passwort in
    /etc/repairline/env und das der Datenbank müssen gleich sein.
out-of-the-open-event-env-readable =
    /etc/repairline/env, die entschlüsselten Einstellungen, kann jedes Konto
    auf riegel lesen. Nur root braucht sie (systemd liest sie, bevor es die
    App startet): chmod 600.
out-of-the-open-event-deployed =
    Das Deployment hat .env mit dem Schlüssel des Servers entschlüsselt und
    die App neu gestartet, die sich mit dem neuen Passwort verbindet.
out-of-the-open-event-clear-commit =
    Das neue Passwort steht in einem Commit, im Klartext: Es ist jetzt in der
    History, wie das alte. Wähl ein anderes, und committe .env nur noch,
    wenn es verschlüsselt ist.
out-of-the-open-event-committed-old =
    Die verschlüsselte .env ist committet, enthält aber noch das Passwort,
    das durchgesickert ist: Es zu verschlüsseln macht es nicht wieder
    geheim. Ändere es in der Datenbank, dann in .env.
out-of-the-open-event-committed =
    Der Commit enthält die verschlüsselte .env, .sops.yaml und das neue
    deploy.sh. git diff und git log bleiben lesbar: Die Namen der Variablen
    sind im Klartext, nur die Werte sind verschlüsselt.
out-of-the-open-event-pushed =
    origin hat es jetzt auch: Wer als Nächstes klont oder pullt, bekommt die
    verschlüsselte Datei, und die Regel, die die nächsten verschlüsseln
    wird.
out-of-the-open-event-end =
    Taslima: „Die App funktioniert, das durchgesickerte Passwort ist
    nutzlos, und ich kann die History ohne Angst lesen. Danke!“

    Gut gemacht! Du hast „Raus aus dem Offenen“ abgeschlossen.

    WAS PASSIERT IST
    Das Datenbankpasswort stand seit Januar im Repository, im Klartext, und
    das Repository war drei Tage öffentlich. Du hast einen age-Schlüssel
    angelegt, .sops.yaml geschrieben, damit jede .env-Datei für den
    Schlüssel des Servers und deinen verschlüsselt wird, und .env mit sops
    verschlüsselt. Da das alte Passwort in der History stand, und in jedem
    Klon, hast du es in PostgreSQL und in der verschlüsselten Datei
    geändert. deploy.sh entschlüsselt .env jetzt beim Deployment mit dem
    eigenen Schlüssel des Servers, und nur root kann das Ergebnis lesen.

    GUTE PRAXIS
    - Ein Secret, das je im Klartext committet wurde, ist kompromittiert:
      Rotiere es. Die History umzuschreiben (git filter-repo) hilft nur für
      danach und erreicht die schon gemachten Kopien nicht.
    - base64 ist keine Verschlüsselung, und .gitignore beendet weder die
      Verfolgung einer Datei noch bereinigt es die History.
    - Mit sops wird jeder Wert mit einem Datenschlüssel verschlüsselt, der
      selbst für jeden Empfänger verschlüsselt ist (öffentliche
      age-Schlüssel): .sops.yaml entscheidet, für wen, bei jeder neuen
      Datei.
    - Verschlüssle für die Maschinen, die deployen, genauso wie für die
      Personen, die bearbeiten: Der private Schlüssel des Servers verlässt
      ihn nie, deiner verlässt dich nie.
    - Entschlüssle beim Deployment, in eine Datei, die nur der Leser des
      Dienstes lesen kann.

    EIN ANDERER WEG
    git-crypt verschlüsselt ganze Dateien transparent in git, und
    ansible-vault verschlüsselt Dateien oder Werte für Ansible; ein
    Secrets-Manager (OpenBao, Vault) hält Secrets ganz aus git heraus, um
    den Preis eines Dienstes, den man betreiben muss. sops hält die
    Struktur lesbar und funktioniert mit age, PGP und den
    Schlüsseldiensten der Clouds.

    DOKUMENTATION
    - SOPS: https://getsops.io/docs/
    - Mit age verschlüsseln: https://getsops.io/docs/#encrypting-using-age
    - Die Creation Rules von .sops.yaml: https://getsops.io/docs/#using-sops-yaml-conf-to-select-kms-pgp-and-age-for-new-files
    - age: https://age-encryption.org/
    - gitignore: https://git-scm.com/docs/gitignore
