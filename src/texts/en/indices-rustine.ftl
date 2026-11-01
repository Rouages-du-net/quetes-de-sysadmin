### The graduated hints of the story "The Patch": a lead, then almost the
### answer, for each step (see indices.ts).

## Chapter 1 — The Padlock

indice-padlock-adresse =
    .piste = What does Caddy say about its HTTPS? journalctl -u caddy. Then reread the comment at the top of /etc/caddy/Caddyfile, and the site's address (man caddy).
    .solution = In /etc/caddy/Caddyfile, replace ":80 {"{"}" with "cycles.example {"{"}", then sudo systemctl reload caddy
indice-padlock-pare-feu =
    .piste = Caddy's journal says why Let's Encrypt couldn't validate the name (journalctl -u caddy). What does the firewall let in? (sudo ufw status, man ufw)
    .solution = sudo ufw allow 80/tcp then sudo ufw allow 443/tcp; Caddy tries again by itself (journalctl -u caddy)
indice-padlock-certificat =
    .piste = Has Caddy got its certificate since the firewall was opened? journalctl -u caddy, then curl -I https://cycles.example
    .solution = Wait for the line "certificate obtained successfully" (or sudo systemctl reload caddy), then curl https://cycles.example
indice-padlock-fin =
    .piste = www.cycles.example is another name: Caddy only serves it if it's in an address of the Caddyfile (man caddy, redir).
    .solution = Add a block "www.cycles.example {"{"} redir https://cycles.example{"{"}uri{"}"} permanent {"}"}" (or write "cycles.example, www.cycles.example {"{"}"), then sudo systemctl reload caddy
