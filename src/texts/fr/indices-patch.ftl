### Les indices gradués de l'histoire « La Rustine » : une piste, puis
### presque la réponse, pour chaque étape (voir indices.ts).

## Chapitre 1 — Le cadenas

indice-padlock-adresse =
    .piste = Que dit Caddy de son HTTPS ? journalctl -u caddy. Puis relis le commentaire en haut de /etc/caddy/Caddyfile, et l'adresse du site (man caddy).
    .solution = Dans /etc/caddy/Caddyfile, remplacer « :80 {"{"} » par « cycles.example {"{"} », puis sudo systemctl reload caddy
indice-padlock-pare-feu =
    .piste = Le journal de Caddy dit pourquoi Let's Encrypt n'a pas pu valider le nom (journalctl -u caddy). Qu'est-ce que le pare-feu laisse entrer ? (sudo ufw status, man ufw)
    .solution = sudo ufw allow 80/tcp puis sudo ufw allow 443/tcp ; Caddy réessaie tout seul (journalctl -u caddy)
indice-padlock-certificat =
    .piste = Caddy a-t-il obtenu son certificat depuis que le pare-feu est ouvert ? journalctl -u caddy, puis curl -I https://cycles.example
    .solution = Attendre la ligne « certificate obtained successfully » (ou sudo systemctl reload caddy), puis curl https://cycles.example
indice-padlock-fin =
    .piste = www.cycles.example est un autre nom : Caddy ne le sert que s'il est dans une adresse du Caddyfile (man caddy, redir).
    .solution = Ajouter un bloc « www.cycles.example {"{"} redir https://cycles.example{"{"}uri{"}"} permanent {"}"} » (ou écrire « cycles.example, www.cycles.example {"{"} »), puis sudo systemctl reload caddy
