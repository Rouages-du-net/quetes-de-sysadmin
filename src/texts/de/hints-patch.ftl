### Die gestuften Hinweise der Geschichte „Der Flicken“: eine Spur, dann
### fast die Antwort, für jeden Schritt (siehe src/engine/hints.ts).

## Kapitel 1 — Das Schloss

hint-padlock-address =
    .lead = Was sagt Caddy über sein HTTPS? journalctl -u caddy. Lies dann den Kommentar oben in /etc/caddy/Caddyfile noch einmal, und die Adresse der Website (man caddy).
    .solution = Ersetze in /etc/caddy/Caddyfile „:80 {"{"}“ durch „cycles.example {"{"}“, dann sudo systemctl reload caddy
hint-padlock-firewall =
    .lead = Das Journal von Caddy sagt, warum Let's Encrypt den Namen nicht validieren konnte (journalctl -u caddy). Was lässt die Firewall herein? (sudo ufw status, man ufw)
    .solution = sudo ufw allow 80/tcp, dann sudo ufw allow 443/tcp; Caddy versucht es von selbst noch einmal (journalctl -u caddy)
hint-padlock-certificate =
    .lead = Hat Caddy sein Zertifikat bekommen, seit die Firewall offen ist? journalctl -u caddy, dann curl -I https://cycles.example
    .solution = Warte auf die Zeile „certificate obtained successfully“ (oder sudo systemctl reload caddy), dann curl https://cycles.example
hint-padlock-end =
    .lead = www.cycles.example ist ein anderer Name: Caddy liefert ihn nur aus, wenn er in einer Adresse des Caddyfiles steht (man caddy, redir).
    .solution = Füge einen Block „www.cycles.example {"{"} redir https://cycles.example{"{"}uri{"}"} permanent {"}"}“ hinzu (oder schreib „cycles.example, www.cycles.example {"{"}“), dann sudo systemctl reload caddy
