### Geschichte „Die Herberge“, Kapitel „Nur was nötig ist“: eine App, die
### ihre Secrets mit dem Root-Token liest; eine Policy nur für sie, ein Token
### mit dieser Policy, das Root-Token widerrufen. Befehle, Optionen, Pfade,
### Namen von Policys und Tokens und die Ausgaben von OpenBao werden nicht
### übersetzt.

chapter-need-to-know = Nur was nötig ist
    .summary = Die Buchungsseite liest ihre Passwörter mit dem Root-Token aus dem Tresor, dem allmächtigen, das bei der Installation ausgegeben wurde. Schreib eine Policy, die sie ihre eigenen Secrets lesen lässt und sonst nichts, gib ihr ein eigenes Token und werde das Root-Token los.

## Files

need-to-know-message-desta =
    Von: Desta
    Dienstag, 9. März, 10:15

    Hallo noch einmal!

    Ruslan ist von seinem Trekking zurück und hat seine
    Installationsnotizen geschickt (sie liegen in deinem
    Home-Verzeichnis). Eine Zeile hat mich beunruhigt: „bunks.env:
    Root-Token vorerst, zu ersetzen“. Er gibt zu, dass „vorerst“ heißt „bis
    es jemand macht“.

    Könntest du dieser Jemand sein? So wie ich es verstehe, sollte Bunks nur
    seine eigenen zwei Secrets lesen können: nicht Hirokos Bankdaten, nicht
    das WLAN der Gäste, und ändern sollte es schon gar nichts. Und dann soll
    das Root-Token weg: Ruslan sagt, niemand sollte eins herumliegen lassen.

    Desta

need-to-know-notes-ruslan =
    Notizen von Ruslan (schloss, OpenBao, Februar 2027)

    - OpenBao 2.7.3, aus dem eigenen .deb von OpenBao (es ist nicht im
      Archiv von Debian). Konfiguration: /etc/openbao/openbao.hcl; Daten in
      /opt/openbao/data; API auf Port 8200 (TLS, das selbstsignierte
      Zertifikat des Pakets); Audit-Log: /var/log/openbao/audit.log.
    - Am 14. Februar initialisiert: 5 Teile, Schwelle 3. Das Root-Token des
      init ist das in /etc/bunks/bunks.env (vorübergehend!).
    - Secrets: eine KV-Engine Version 2 unter secret/. Bunks: secret/bunks/db
      (username, password) und secret/bunks/payments (account, api_key).
      Außerdem secret/treasurer/bank (Hiroko) und secret/wifi/guests.
    - KV Version 2 bewahrt Versionen auf: Die CLI sagt bao kv get
      secret/bunks/db, aber die API, und damit die Policys, sehen
      secret/data/bunks/db (und die Metadaten unter secret/metadata/).
    - Jede Person mit Admin-Rechten hat ein Orphan-Token mit der Policy
      admin (bao policy read admin), in ~/.vault-token. Orphan: Es hängt
      nicht vom Root-Token ab.
    - Bunks liest BAO_TOKEN beim Start aus bunks.env (sudo systemctl
      restart bunks, damit es ihn neu liest). Sein Zustand:
      curl http://127.0.0.1:8080/health
    - man bao.

## Events

need-to-know-event-resealed =
    OpenBao wurde neu gestartet, also kam es versiegelt zurück. Desta,
    Hiroko und Nnamdi sind vorbeigekommen und haben ihre Teile getippt: Es
    ist wieder entsiegelt. Policys und Tokens wirken sofort; OpenBao braucht
    dafür nie einen Neustart.
need-to-know-event-no-data =
    Diese Policy hat eine Regel auf secret/... ohne data/: Sie passt auf
    keine der Anfragen von Bunks. Mit KV Version 2 ist der API-Pfad des
    Secrets bunks/db secret/data/bunks/db (und seine Metadaten
    secret/metadata/bunks/db). Die Befehle bao kv verstecken dieses Präfix;
    Policys nicht.
need-to-know-event-too-wide =
    Diese Policy gibt mehr, als Bunks braucht. Prüf es mit bao token
    capabilities: Bunks muss secret/data/bunks/* lesen, und sonst nichts:
    kein create, update oder delete, nichts unter treasurer oder wifi, keine
    Policys, keine Tokens.
need-to-know-event-policy =
    Die Policy ist in OpenBao gespeichert (bao policy list, bao policy
    read). Eine Policy tut von sich aus nichts: Sie gilt für die Tokens, die
    sie tragen.
need-to-know-event-from-root =
    Dieses Token wurde mit dem Root-Token erstellt: Es ist sein Kind, und
    das Widerrufen eines Tokens widerruft alle seine Kinder. Wenn das
    Root-Token geht, geht dieses mit. Erstelle das Token von Bunks mit
    deinem eigenen Admin-Token, das ein Orphan ist.
need-to-know-event-token =
    Ein Token, das die Policy trägt. bao token lookup zeigt seine Policys,
    seine Lebensdauer (creation_ttl, expire_time); bao token capabilities
    TOKEN PFAD zeigt, was es auf einem Pfad tun darf.
need-to-know-event-denied =
    Bunks konnte nicht starten: „permission denied“ auf sein Secret
    (journalctl -u bunks). Das Token in bunks.env darf diesen Pfad nicht
    lesen: Welche Policys trägt es, und was sagt bao token capabilities zu
    secret/data/bunks/db?
need-to-know-event-switched =
    Bunks ist mit seinem eigenen Token neu gestartet: Es liest seine zwei
    Secrets, und sonst nichts.
need-to-know-event-wide-app =
    Bunks läuft mit einem Token, das mehr kann, als seine zwei Secrets zu
    lesen (bao token capabilities). Wer es stiehlt, bekommt all das.
need-to-know-event-checked =
    Die Health-Seite antwortet, mit dem neuen Token.
need-to-know-event-early-revoke =
    Das Root-Token ist widerrufen, aber Bunks ist damit gestartet: Es
    behält seine Secrets im Speicher und merkt noch nichts, aber sein
    nächster Start wird scheitern. Gib ihm jetzt sein eigenes Token.
need-to-know-event-root-revoked =
    Das Root-Token ist widerrufen: bao token lookup darauf sagt jetzt „bad
    token“. Wenn je wieder eins gebraucht wird, können drei Personen mit
    Teilen ein neues erzeugen (bao operator generate-root), das gleich
    danach widerrufen wird.
need-to-know-event-end =
    Desta: „Ruslan hat deine Policy gelesen und gesagt: nur was nötig ist,
    wie es sein soll. Er streicht ‚vorerst‘ durch.“

    Gut gemacht! Du hast „Nur was nötig ist“ abgeschlossen.

    WAS PASSIERT IST
    Bunks startete mit dem Root-Token des init: unbegrenzt und ohne Ablauf.
    Du hast eine Policy nur für Bunks geschrieben (read auf
    secret/data/bunks/*: Die API von KV Version 2 setzt data/ in den Pfad),
    sie mit bao policy write geladen, ein Token erstellt, das sie trägt (mit
    deinem Orphan-Admin-Token, sodass es eine TTL hat und nicht von root
    abhängt), es in bunks.env eingetragen und Bunks neu gestartet; dann hast
    du das Root-Token widerrufen. bao token capabilities beweist, was ein
    Token darf und was nicht.

    GUTE PRAXIS
    - Eine Policy pro Anwendung, geringste Rechte: die Pfade, die sie liest,
      die Capabilities, die sie braucht (read), sonst nichts; alles andere
      ist standardmäßig verweigert.
    - Tokens laufen ab: Eine lang laufende App erneuert ihr Token
      (renew-self) oder holt sich vor dem Ende seiner TTL ein neues.
    - Achte auf die Hierarchie: Ein Kind-Token stirbt mit seinem
      Elternteil; Dienste bekommen Orphan-Tokens (oder eine Rolle).
    - Das Root-Token: erzeugt, wenn es gebraucht wird (bao operator
      generate-root), gleich danach widerrufen, nie in einer Datei
      aufbewahrt.
    - Die Token-Datei einer App ist nur für das Konto der App lesbar
      (bunks.env ist root:bunks, 0640).

    EIN ANDERER WEG
    Statt eines Tokens in einer Datei kann sich eine App selbst anmelden:
    AppRole (eine Role-ID und eine Secret-ID, getrennt ausgeliefert), oder
    eine Maschinenidentität (TLS-Zertifikat, JWT, Kubernetes); OpenBao
    Agent kann sich für die App anmelden und erneuern und ihre Secrets in
    eine Datei schreiben. Mehr bewegliche Teile, weniger langlebige
    Secrets.

    DOKUMENTATION
    - Policys: https://openbao.org/docs/concepts/policies/
    - Tokens: https://openbao.org/docs/concepts/tokens/
    - KV Version 2 und seine Pfade: https://openbao.org/docs/secrets/kv/kv-v2/
    - bao token create: https://openbao.org/docs/commands/token/create/
    - AppRole: https://openbao.org/docs/auth/approle/
