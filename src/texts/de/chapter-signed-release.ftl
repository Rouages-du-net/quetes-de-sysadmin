### Story "The Tool Library", chapter "Signed and Sealed": SSH-signed
### commits and tags, a forge that requires them, a release whose checksums
### are signed, and a check as a downstream user would make it.
### Commands, options, paths and outputs are not translated.

chapter-signed-release = Signiert und versiegelt
    .summary = Ein gefälschtes Release von Lendshed ist im Umlauf, mit einer Prüfsumme, die es „beweist“. Mach jeden Schritt des nächsten Release überprüfbar, von den Commits bis zum Tarball: signiert mit den Schlüsseln der Maintainer, von der Forge verlangt und so geprüft, wie eine Werkzeugbibliothek am anderen Ende der Welt es prüfen wird.

## Files

signed-release-message-aroha =
    Von: Aroha (Werkzeugbibliothek Wellington)
    Sonntag, 24. November
    
    Kia ora! Ich betreibe Lendshed für unsere Werkzeugbibliothek. Letzte
    Woche hat jemand eine „lendshed-2.3.1.tar.gz“ im Forum der
    Werkzeugbibliotheken gepostet, mit einer Prüfsummendatei daneben, und
    behauptet, sie repariere die Erinnerungen. Auf eurer Site gibt es keine
    2.3.1. Die Prüfsumme passte natürlich zur Datei, sie kam ja mit ihr.
    
    Wie kann ich wissen, dass ein Release von euch kommt? Ich würde gern
    eine Signatur prüfen, wenn ihr mir sagt, wie. Ich installiere 2.4.0,
    sobald sie draußen ist.
    
    Aroha
signed-release-note-wanjiru =
    Von: Wanjiru
    Montag, 25. November, 9:30
    
    Aroha hat recht, und nach dem Oktober will ich, dass wir weiter gehen:
    jeder Commit auf main von einer Maintainerin oder einem Maintainer
    signiert, die Forge lehnt die anderen ab, der Release-Tag signiert, und
    die Prüfsummen der Tarballs auch signiert.
    
    Nehmen wir SSH-Schlüssel, die haben wir schon: deiner ist
    ~/.ssh/id_ed25519 (nicht der alte von deinem vorigen Laptop, der war nie
    auf der Forge). Unsere öffentlichen Schlüssel liegen auch auf der
    Forge: die Schlüssel jedes Kontos stehen unter
    https://forge.lendshed.example/NAME.keys.
    
    Der Plan für 2.4.0:
    - eine Datei allowed_signers in der Wurzel des Repositorys, mit unseren
      drei Schlüsseln, damit alle unsere Signaturen prüfen können;
    - deine Commits signiert (die Versionserhöhung in lendshed/__init__.py
      ist die einzige verbleibende Änderung);
    - main verlangt signierte Commits;
    - der Tag v2.4.0, signiert;
    - lendshed-2.4.0.tar.gz in /srv/www/downloads, aus dem Tag gebaut
      (Präfix lendshed-2.4.0/), mit SHA256SUMS und seiner Signatur;
    - und alles so prüfen, wie Aroha es tun wird, bevor wir es ankündigen.
    
    Wanjiru

## Events

signed-release-event-signing =
    git signiert jetzt mit SSH (gpg.format = ssh) und weiß, mit welchem
    Schlüssel (user.signingKey): git commit -S signiert einen Commit,
    commit.gpgsign = true signiert alle.
signed-release-event-old-key =
    Dieser Commit ist mit dem alten Schlüssel von deinem vorigen Laptop
    signiert. Er signiert gut genug, aber niemand kennt ihn: er steht nicht
    in allowed_signers, und die Forge hat ihn nicht in deinem Konto. Eine
    Signatur beweist nur etwas mit einem Schlüssel, dem andere schon
    vertrauen. Signiere noch einmal mit ~/.ssh/id_ed25519 (git commit
    --amend -S --no-edit).
signed-release-event-signed-commit =
    Dein letzter Commit trägt eine mit deinem Schlüssel gemachte Signatur.
    Kann git sie prüfen? Es muss wissen, wessen Schlüsseln vertraut wird.
signed-release-event-no-allowed =
    Um eine SSH-Signatur zu prüfen, liest git eine Datei allowed_signers:
    eine Zeile pro signierender Person, „Principal Schlüssel“, wobei der
    Principal die Adresse der Person ist, die den Commit verfasst hat. git
    config gpg.ssh.allowedSignersFile sagt ihm, wo die Datei liegt.
signed-release-event-allowed = git kennt die erlaubten Signierenden, und deinen Schlüssel darunter.
signed-release-event-verified =
    Good "git" signature für deine Adresse: der Commit wurde mit einem
    Schlüssel signiert, den allowed_signers seiner Verfasserin oder seinem
    Verfasser zuordnet.
signed-release-event-require =
    main verlangt jetzt signierte Commits: Forgejo prüft die Signatur jedes
    gepushten Commits gegen die Schlüssel des Kontos, dessen Adresse ihn
    signiert hat.
signed-release-event-unsigned-refused =
    Die Forge hat den Push abgelehnt: ein Commit ist nicht verifiziert,
    entweder unsigniert oder mit einem Schlüssel signiert, den kein Konto
    mit dieser Adresse hat. Signiere die Commits (git commit --amend -S
    --no-edit für den letzten), dann pushe noch einmal.
signed-release-event-not-in-repo =
    Dein signierter Commit ist auf main, aber das Repository hat noch keine
    Datei allowed_signers mit deinem Schlüssel: wer es klont, kann unsere
    Signaturen nicht prüfen. Füge sie in der Wurzel hinzu, committe, pushe.
signed-release-event-pushed =
    Der Head von main ist signiert, von der Forge verifiziert, und das
    Repository trägt allowed_signers: alle können es mit git verify-commit
    prüfen.
signed-release-event-lightweight =
    v2.4.0 ist ein leichtgewichtiger Tag: ein bloßer Name für einen Commit,
    ohne Tagger, ohne Nachricht, ohne Signatur. git verify-tag hat nichts zu
    prüfen. Mach an seiner Stelle einen annotierten, signierten Tag (git tag
    -s -f), und wenn der leichtgewichtige gepusht wurde, pushe den neuen mit
    --force.
signed-release-event-tag =
    Der Tag v2.4.0 ist auf der Forge, annotiert und mit deinem Schlüssel
    signiert, auf main: git verify-tag v2.4.0 prüft ihn.
signed-release-event-tarball =
    Der Tarball stammt aus dem Tag (git archive): derselbe Tag ergibt immer
    dieselben Bytes, sodass alle ihn neu bauen und vergleichen können.
signed-release-event-sums =
    SHA256SUMS passt zum Tarball. Eine Prüfsumme schützt allerdings nur vor
    einem beschädigten Download: wer den Tarball ersetzt, ersetzt auch die
    Prüfsumme daneben, wie es der Fälscher von 2.3.1 getan hat.
signed-release-event-sum-only =
    sha256sum -c sagt OK, aber das hatte Aroha mit der gefälschten 2.3.1
    auch schon. Ohne Signatur auf SHA256SUMS beweist die Prüfsumme nichts
    darüber, wer die Datei gemacht hat. Signiere sie: ssh-keygen -Y sign -n
    file.
signed-release-event-sum-checked =
    Die Prüfsumme passt, und die Datei der Prüfsummen ist signiert: noch
    eine Prüfung, und das Release ist bewiesen.
signed-release-event-sig =
    SHA256SUMS.sig: SHA256SUMS mit deinem Schlüssel signiert, im Namespace
    „file“ (eine für git gemachte Signatur lässt sich nicht als Signatur
    einer Datei ausgeben, und umgekehrt).
signed-release-event-sig-checked =
    Good "file" signature: SHA256SUMS wurde mit deinem Schlüssel signiert,
    den allowed_signers deiner Adresse zuordnet.
signed-release-event-end =
    Wanjiru: „Signiert vom ersten Commit bis zum letzten Byte. Ich habe die
    zwei Befehle in VERIFYING.md für Aroha und die anderen geschrieben.“
    Aroha: „Geprüft! Beide Antworten sind gut. Danke.“
    
    Gut gemacht! Du hast „Signiert und versiegelt“ abgeschlossen.
    
    WAS PASSIERT IST
    Ein gefälschtes Release war im Umlauf, mit einer Prüfsumme, die nichts
    bewies, da sie mit der Datei kam. Du hast git so eingestellt, dass es
    mit deinem SSH-Schlüssel signiert, die Schlüssel der Maintainer in
    allowed_signers veröffentlicht, deinen Commit signiert, die Forge
    verifizierte Commits auf main verlangen lassen, den Tag v2.4.0
    signiert, den Tarball daraus mit git archive gebaut, SHA256SUMS
    geschrieben und signiert und das Release so geprüft, wie es ein
    Benutzer täte: sha256sum -c, dann ssh-keygen -Y verify gegen
    allowed_signers.
    
    GUTE PRAXIS
    - Eine Prüfsumme erkennt eine beschädigte Datei; nur eine Signatur sagt,
      wer sie gemacht hat.
    - Commits und Tags mit Schlüsseln signieren, denen andere schon
      vertrauen (allowed_signers im Repository, Schlüssel auf der Forge);
      die Forge den Rest ablehnen lassen.
    - Ein annotierter, signierter Tag für jedes Release; der Tarball daraus
      neu gebaut.
    - Den Benutzern sagen, wie sie prüfen, in zwei Befehlen.
    - SLSA und OpenSSF gehen weiter: Herkunftsnachweise der Builds,
      reproduzierbare Builds, Review durch zwei Personen.
    
    DOKUMENTATION
    - git, die eigene Arbeit signieren: https://git-scm.com/book/en/v2/Git-Tools-Signing-Your-Work
    - git-config, gpg.format und gpg.ssh.allowedSignersFile: https://git-scm.com/docs/git-config
    - ssh-keygen -Y und ALLOWED SIGNERS: https://man.openbsd.org/ssh-keygen
    - Forgejo, geschützte Branches: https://forgejo.org/docs/latest/user/protection/
    - SLSA, Bedrohungen der Lieferkette: https://slsa.dev/spec/v1.0/threats
