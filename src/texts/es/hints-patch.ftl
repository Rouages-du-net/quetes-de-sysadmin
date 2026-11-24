### Las pistas graduadas de la historia «El Parche»: una dirección, y luego
### casi la respuesta, para cada paso (ver src/engine/hints.ts).

## Capítulo 1 — El candado

hint-padlock-address =
    .lead = ¿Qué dice Caddy de su HTTPS? journalctl -u caddy. Luego vuelve a leer el comentario del principio de /etc/caddy/Caddyfile, y la dirección del sitio (man caddy).
    .solution = En /etc/caddy/Caddyfile, sustituye «:80 {"{"}» por «cycles.example {"{"}», y luego sudo systemctl reload caddy
hint-padlock-firewall =
    .lead = El journal de Caddy dice por qué Let's Encrypt no ha podido validar el nombre (journalctl -u caddy). ¿Qué deja entrar el cortafuegos? (sudo ufw status, man ufw)
    .solution = sudo ufw allow 80/tcp y luego sudo ufw allow 443/tcp; Caddy vuelve a intentarlo solo (journalctl -u caddy)
hint-padlock-certificate =
    .lead = ¿Ha conseguido Caddy su certificado desde que se abrió el cortafuegos? journalctl -u caddy, y luego curl -I https://cycles.example
    .solution = Espera la línea «certificate obtained successfully» (o sudo systemctl reload caddy), y luego curl https://cycles.example
hint-padlock-end =
    .lead = www.cycles.example es otro nombre: Caddy solo lo sirve si está en una dirección del Caddyfile (man caddy, redir).
    .solution = Añade un bloque «www.cycles.example {"{"} redir https://cycles.example{"{"}uri{"}"} permanent {"}"}» (o escribe «cycles.example, www.cycles.example {"{"}»), y luego sudo systemctl reload caddy
