### Abgestufte Hinweise für „Die Mieterinitiative“ (siehe src/engine/hints.ts):
### eine Nachricht pro Schritt, hint-<kapitel>-<ereignis>, mit .lead (eine
### Spur, ohne den genauen Befehl) und .solution (fast die Antwort).

## Kapitel 1 — Raus aus dem Offenen

hint-out-of-the-open-history-seen =
    .lead = Bevor du etwas korrigierst, sieh, was die Besucher·innen der Forge sehen konnten: jede Version von .env, in der History des Repositorys (man git).
    .solution = cd /srv/repairline; git log -p
hint-out-of-the-open-key-made =
    .lead = Um für dich selbst zu verschlüsseln, brauchst du einen eigenen age-Schlüssel, an dem Ort, an dem sops ihn liest (man sops, man age-keygen).
    .solution = mkdir -p ~/.config/sops/age; age-keygen -o ~/.config/sops/age/keys.txt
hint-out-of-the-open-rule-written =
    .lead = Eine .sops.yaml an der Wurzel des Repositorys sagt, welche Dateien verschlüsselt werden, und für welche öffentlichen Schlüssel: den des Servers (in der README) und deinen.
    .solution = nano .sops.yaml: creation_rules:, dann - path_regex: \.env$ und age: SERVER_SCHLUESSEL,DEIN_SCHLUESSEL (age-keygen -y ~/.config/sops/age/keys.txt gibt deinen aus)
hint-out-of-the-open-encrypted =
    .lead = Verschlüssle die Datei an Ort und Stelle: sops findet die Regel in .sops.yaml von selbst.
    .solution = sops --encrypt --in-place .env; dann cat .env
hint-out-of-the-open-rotated =
    .lead = Das alte Passwort steht für immer in der History: Ändere es dort, wo es geprüft wird, in PostgreSQL, mit seinem Administratorkonto.
    .solution = sudo -u postgres psql -c "ALTER ROLE repairline PASSWORD 'ein-neues-langes-passwort'"
hint-out-of-the-open-deployed =
    .lead = Trag das neue Passwort mit sops in die verschlüsselte .env ein, dann lass deploy.sh .env mit dem Schlüssel des Servers entschlüsseln, und führ es aus.
    .solution = sops set .env '["DB_PASSWORD"]' '"ein-neues-langes-passwort"'; in deploy.sh: export SOPS_AGE_KEY_FILE=/etc/repairline/age.key und sops --decrypt .env > /etc/repairline/env; sudo ./deploy.sh
hint-out-of-the-open-committed =
    .lead = Committe, was die anderen brauchen: die verschlüsselte .env, .sops.yaml und deploy.sh. Nie das Passwort im Klartext.
    .solution = git add .env .sops.yaml deploy.sh; git commit -m "Encrypt .env with sops and age"
hint-out-of-the-open-pushed =
    .lead = Die Ehrenamtlichen klonen von origin.
    .solution = git push
hint-out-of-the-open-end =
    .lead = Prüfe jeden Teil: Die App läuft, die deployten Einstellungen gehören nur root, .env ist für den Server und für dich verschlüsselt, origin hat dasselbe.
    .solution = systemctl status repairline; ls -l /etc/repairline/env; sops -d .env; git log --stat -1; git status

## Kapitel 2 — Schlüssel wechseln die Hände

hint-keys-change-hands-config-updated =
    .lead = Wer neue Dateien bekommt, entscheidet .sops.yaml: Trag Ikennas öffentlichen Schlüssel ein (aus seiner Nachricht), nimm Makoas heraus.
    .solution = nano .sops.yaml: Makoas age1… durch Ikennas ersetzen
hint-keys-change-hands-keys-updated =
    .lead = Die schon verschlüsselten Dateien folgen der Regel nicht von selbst: sops kann jede einzeln mit ihr in Einklang bringen (man sops).
    .solution = sops updatekeys .env, mit y antworten; sops updatekeys mail.env, mit y antworten
hint-keys-change-hands-data-rotated =
    .lead = Makoas Schlüssel konnte den Datenschlüssel beider Dateien öffnen: Dieser Schlüssel muss sich auch ändern.
    .solution = sops rotate --in-place .env; sops rotate --in-place mail.env
hint-keys-change-hands-rotated =
    .lead = Makoa hat das Datenbankpasswort beim Deployen gelesen: Ändere es in PostgreSQL.
    .solution = sudo -u postgres psql -c "ALTER ROLE repairline PASSWORD 'noch-ein-langes-passwort'"
hint-keys-change-hands-deployed =
    .lead = Das neue Passwort kommt in die verschlüsselte .env, ohne sops je zu verlassen, dann das Deployment.
    .solution = sops edit .env (oder sops set .env '["DB_PASSWORD"]' '"noch-ein-langes-passwort"'); sudo /srv/repairline/deploy.sh
hint-keys-change-hands-committed =
    .lead = Committe die Regel und beide Dateien.
    .solution = git add .sops.yaml .env mail.env; git commit -m "Ikenna in, Makoa out, new keys"
hint-keys-change-hands-pushed =
    .lead = Ikenna wird von origin klonen.
    .solution = git push
hint-keys-change-hands-end =
    .lead = Prüfe, dass Makoas Schlüssel überall weg ist, und dass dein eigener Schlüssel deine keys.txt nie verlassen hat.
    .solution = grep age1 .sops.yaml; sops filestatus .env; systemctl status repairline; ls -l ~/.config/sops/age/keys.txt
