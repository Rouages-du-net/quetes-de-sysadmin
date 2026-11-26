### Abgestufte Hinweise für „Die Herberge“ (siehe src/engine/hints.ts): eine
### Nachricht pro Schritt, hint-<kapitel>-<ereignis>, mit .lead (eine Spur,
### ohne den genauen Befehl) und .solution (fast die Antwort).

## Kapitel 1 — Versiegelt

hint-sealed-status =
    .lead = Frag OpenBao selbst, in welchem Zustand es ist, bevor du etwas anfasst (man bao).
    .solution = bao status
hint-sealed-first-share =
    .lead = Ein versiegelter Server wartet auf seine Schlüsselteile, ein Befehl pro Teil. Wo ist dein eigener Teil?
    .solution = bao operator unseal, dann den Teil aus /media/usb/unseal-share-3.txt an der Eingabeaufforderung einfügen
hint-sealed-unsealed =
    .lead = Es braucht drei verschiedene Teile. Welchem der vier, die du bekommen hast, kannst du trauen?
    .solution = bao operator unseal mit Hirokos Teil, dann mit Nnamdis (nicht mit Destas verschwommenem); bao status: Sealed false
hint-sealed-restarted =
    .lead = Der Tresor ist offen, aber läuft die Buchungsseite? Frag systemd, und lies ihr Journal.
    .solution = systemctl status bunks; journalctl -u bunks; sudo systemctl restart bunks
hint-sealed-checked =
    .lead = Prüf, dass Bunks wirklich antwortet (Ruslans Notizen erwähnen eine Health-Seite auf Port 8080).
    .solution = curl http://127.0.0.1:8080/health
hint-sealed-end =
    .lead = Prüfe jeden Teil: der Tresor entsiegelt, Bunks läuft, seine Health-Seite antwortet.
    .solution = bao status; systemctl status bunks; curl http://127.0.0.1:8080/health

## Kapitel 2 — Nur was nötig ist

hint-need-to-know-policy =
    .lead = Schreib die Regeln für Bunks in eine HCL-Datei: welche Pfade, welche Capabilities. Achte auf den echten API-Pfad eines Secrets in KV Version 2 (Ruslans Notizen, man bao).
    .solution = eine Datei bunks.hcl mit path "secret/data/bunks/*" und capabilities = ["read"], dann bao policy write bunks bunks.hcl
hint-need-to-know-token =
    .lead = Erstelle ein Token, das nur diese Policy trägt, mit deinem eigenen Admin-Token (nicht dem Root-Token).
    .solution = bao token create -policy=bunks -display-name=bunks -ttl=768h
hint-need-to-know-switched =
    .lead = Prüf, was das neue Token darf, dann gib es Bunks: Wo liest Bunks sein Token, und wann?
    .solution = bao token capabilities TOKEN secret/data/bunks/db; sudo nano /etc/bunks/bunks.env (BAO_TOKEN=das neue Token); sudo systemctl restart bunks
hint-need-to-know-checked =
    .lead = Antwortet Bunks mit seinem neuen Token?
    .solution = curl http://127.0.0.1:8080/health
hint-need-to-know-root-revoked =
    .lead = Das Root-Token des init ist noch gültig. Ein Token kann von allen widerrufen werden, die es dürfen (man bao: token revoke).
    .solution = bao token revoke, gefolgt vom alten Wert von BAO_TOKEN (dem Root-Token)
hint-need-to-know-end =
    .lead = Prüfe jeden Teil: das Token von Bunks und was es darf, das Root-Token weg, die Health-Seite.
    .solution = bao token capabilities TOKEN secret/data/treasurer/bank (deny); bao token lookup auf das Root-Token (bad token); curl http://127.0.0.1:8080/health

## Kapitel 3 — Durchgesickertes Token

hint-leaked-token-identified =
    .lead = Fang mit dem Token im Forumsbeitrag an: Frag OpenBao, was es ist (man bao: token lookup).
    .solution = bao token lookup, gefolgt vom Token aus forumsbeitrag.txt
hint-leaked-token-traced =
    .lead = Jede Anfrage steht im Audit-Log, aber Tokens sind als HMACs geschrieben. OpenBao kann den HMAC eines Werts für dich berechnen; oder such nach Anfragen, die nicht von 127.0.0.1 kamen.
    .solution = bao write sys/audit-hash/file input=TOKEN, dann sudo grep diesen Hash /var/log/openbao/audit.log (oder sudo jq auf remote_address)
hint-leaked-token-revoked =
    .lead = Das Token muss jetzt aufhören zu funktionieren, vor allem anderen.
    .solution = bao token revoke, gefolgt vom durchgesickerten Token
hint-leaked-token-rotated =
    .lead = Das Log zeigt, welches Secret gelesen wurde. Gib ihm seinen neuen Wert, ohne sein anderes Feld zu verlieren (man bao: kv patch).
    .solution = bao kv patch secret/bunks/payments api_key=, gefolgt vom neuen Schlüssel aus Destas Nachricht
hint-leaked-token-switched =
    .lead = Bunks braucht ein neues Token, mit seiner Policy, und muss neu starten, um es und den neuen Schlüssel zu lesen.
    .solution = bao token create -policy=bunks -display-name=bunks; sudo nano /etc/bunks/bunks.env; sudo systemctl restart bunks
hint-leaked-token-end =
    .lead = Prüfe jeden Teil: das durchgesickerte Token abgelehnt, der neue Schlüssel an seinem Platz, das Datenbank-Secret unangetastet, Bunks gesund.
    .solution = bao token lookup DURCHGESICKERTES_TOKEN (bad token); bao kv get secret/bunks/payments; curl http://127.0.0.1:8080/health
