### Story "The Patch", chapter 1 "The Padlock": Caddy and its automatic HTTPS
### (site address, ACME challenge, firewall, www redirection).
### Caddy's commands, paths, directives and messages are not translated.

chapter-padlock = The Padlock
    .resume = Caddy was supposed to do HTTPS by itself, but the bike workshop's site stays on HTTP: give it its name, let Let's Encrypt through, and don't forget www.

## Files

padlock-message-ines =
    From:     Inès
    To:       you
    Subject:  The padlock!

    Hi!

    The Patch finally has its own server, just for the workshop's
    website. I installed Caddy rather than nginx: apparently it does
    HTTPS by itself, no certbot, nothing. I put the site in
    /var/www/cycles and changed the directory in /etc/caddy/Caddyfile.

    On the server, curl http://localhost does show our page. But from
    outside, nothing: no padlock in the browser, https://cycles.example
    doesn't answer, and even http://cycles.example doesn't work from home.
    The DNS is right though: cycles.example and www.cycles.example both
    lead to 203.0.113.40, our server.

    What we need:
    - https://cycles.example shows the site, with a real certificate;
    - http://cycles.example sends people to https://;
    - https://www.cycles.example works too (it's the address printed on
      our posters!), showing the site or sending people to cycles.example.

    The firewall (ufw), I turned it on following a tutorial, for ssh.
    The service is called caddy (systemctl status caddy, journalctl -u caddy);
    there's also man caddy.

    Thanks, and see you Saturday at the workshop!
    Inès

padlock-site =
    <!DOCTYPE html>
    <html lang="en">
    <head><meta charset="utf-8"><title>The Patch — bike workshop</title></head>
    <body>
    <h1>The Patch</h1>
    <p>Community bike workshop: we teach you to fix your bike yourself.</p>
    <p>Every Saturday, 10 am to 5 pm. Tools and advice, pay what you can.</p>
    </body>
    </html>

## Events

padlock-event-http-only =
    Caddy only listens on port 80, over HTTP: the Caddyfile starts with
    ":80 {"{"}", the package's template. An address without a domain name, or
    one that gives port 80 (or http://), gets no certificate: Caddy
    wouldn't know which name to request it for. The comment at the top of
    the file says so: replace :80 with the site's name. Then
    sudo systemctl reload caddy, and look at what the journal says.
padlock-event-schema-http =
    http://cycles.example: with http://, the address asks for an HTTP-only
    site, so no certificate. For automatic HTTPS, the name alone is
    enough: cycles.example (or https://cycles.example).
padlock-event-address =
    Caddy took the name: it now listens on ports 80 and 443
    (sudo ss -tlnp), and it requests a certificate from Let's Encrypt by
    itself. Did it get it? It's all in its journal:
    journalctl -u caddy (the tls.obtain and acme_client lines).
padlock-event-firewall =
    "Timeout during connect (likely firewall problem)": to check that the
    server really answers for cycles.example, Let's Encrypt comes to look
    from the internet, on port 80 (HTTP-01 challenge) or 443 (TLS-ALPN-01).
    But ufw only lets ssh in: sudo ufw status. Visitors will use these
    ports too. Caddy will try again by itself, a little later.
padlock-event-alert =
    "tlsv1 alert internal error": Caddy answers on port 443, but it
    doesn't have a certificate for this name (yet), so the TLS handshake
    fails. The journal says where it's at: journalctl -u caddy.
padlock-event-format =
    Only a warning: the Caddyfile isn't written the way caddy fmt would
    like (tabs for indentation, one space between words).
    sudo caddy fmt --overwrite /etc/caddy/Caddyfile formats it.
padlock-event-certificate =
    The padlock! Caddy got its certificate ("certificate obtained
    successfully" in the journal), stored in /var/lib/caddy. Try
    curl -I http://cycles.example: the redirection to HTTPS, Caddy added
    it by itself. Still to do: the posters' address, www.cycles.example.
padlock-event-end =
    https://cycles.example and https://www.cycles.example answer, with
    their certificates, and HTTP sends people to HTTPS. Inès: "The padlock!
    I can print the new posters."

    Well done! You have finished the chapter "The Padlock".

    WHAT HAPPENED
    The Caddyfile started with :80, the package's template: a site with no
    name, served over HTTP only. With its domain name as address, Caddy
    handles HTTPS by itself: it requests a certificate from Let's Encrypt
    (ACME), stores it, will renew it, and redirects HTTP to HTTPS. But
    Let's Encrypt must be able to reach the machine on port 80 or 443 to
    check that it answers for this name: the firewall only let ssh
    through. Finally, www.cycles.example is another name: it needs its own
    block (or its place in the list of addresses), and its certificate.

    NGINX + CERTBOT AND CADDY, SIDE BY SIDE
      nginx + certbot                     Caddy
      server_name, listen 443 ssl          the site's address: cycles.example
      certbot --nginx or --webroot         nothing: Caddy does it on load
      ssl_certificate, ssl_certificate_key nothing (stored in /var/lib/caddy)
      return 301 https://…                 automatic (308)
      a timer for certbot renew            automatic
      nginx -t                             caddy validate, caddy fmt
      systemctl reload nginx               systemctl reload caddy (caddy reload)

    GOOD PRACTICE
    - For a public certificate, the name must lead to the machine (DNS) and
      ports 80 and 443 must be open: true for Caddy as for certbot.
    - Read the journal after each reload: a refused certificate doesn't
      stop Caddy from running, it only says so in the journal.
    - caddy validate before reloading; caddy fmt to keep a readable
      Caddyfile.
    - One name per address or per block: www is a separate name, which you
      serve too or redirect (redir https://cycles.example{"{"}uri{"}"} permanent).
    - To experiment without hitting Let's Encrypt's limits, Caddy can use
      the staging authority (acme_ca option, or tls internal on a private
      network).

    DOCUMENTATION
    - Automatic HTTPS: https://caddyserver.com/docs/automatic-https
    - Caddyfile addresses: https://caddyserver.com/docs/caddyfile/concepts#addresses
    - redir: https://caddyserver.com/docs/caddyfile/directives/redir
    - ACME challenge types: https://letsencrypt.org/docs/challenge-types/
