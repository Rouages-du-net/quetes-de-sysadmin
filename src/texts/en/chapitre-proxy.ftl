### Story "The Co-op", chapter "The proxy": the app behind nginx only
### sees 127.0.0.1 (X-Forwarded-For, trust proxy). nginx directives,
### variables and paths are not translated.

chapitre-proxy = The proxy
    .resume = A bot gets everyone locked out: behind nginx, the till sees every client as 127.0.0.1. X-Forwarded-For, and whom to trust.

## Files

proxy-courriel-awa =
    From:     Awa
    To:       you
    Subject:  Nobody can log in to the till anymore

    Since this morning, the till answers "Too many attempts, try again in 15
    minutes" to everyone: Lina, Karim, me… We try again, it starts over.

    Karim thinks a bot is trying passwords (the till locks an address
    after 5 failures). But why us? Compare the till's log
    (/var/log/till/app.log) and nginx's log
    (/var/log/nginx/access.log): they don't see the same addresses.

    The app is a Node app (Express): look at its TRUST_PROXY setting
    in /srv/till/app/.env (and the Express guide, "behind proxies").
    On the nginx side: the documentation of proxy_set_header.

    For sudo: radish-2027

## Events

proxy-evenement-tout-le-monde =
    Five minutes later: the bot got 127.0.0.1 locked again… and Lina
    with it. For the till, every request comes from nginx (127.0.0.1):
    nginx has to pass on the real client's address (an X-Forwarded-For
    header), AND the till has to agree to read it (TRUST_PROXY), then
    both need restarting.
# { $robot }: the bot's address
proxy-evenement-usurpe =
    Lina can get in… but the bot ({ $robot }) is never locked: it writes
    a fake X-Forwarded-For itself, different on each try, and the till
    believes it. Look at /var/log/till/app.log: 10.1.0.4, 10.2.7.5…

    An app should only believe X-Forwarded-For for what ITS proxy added
    to it: TRUST_PROXY=true takes the first address in the list (the one
    the client wrote). Read the Express guide again: loopback only
    trusts 127.0.0.1. And on the nginx side, this header must be written
    or appended to by nginx, not just passed on.
# { $robot }: the bot's address
proxy-evenement-fin =
    Five minutes later: the bot ({ $robot }) is locked, and Lina gets in
    without trouble. Awa: "We can open the tills again!"

    Well done! You have finished the chapter "The proxy".

    WHAT HAPPENED
    Behind a proxy (nginx), an app receives all its connections from the
    proxy itself. To know the real client, it needs the X-Forwarded-For
    header, which the proxy fills in. But a client can also write it
    itself: the app must only trust the addresses added by the proxies
    it knows, reading the list from the right.

    GOOD PRACTICE
    - In nginx: proxy_set_header X-Forwarded-For
      $proxy_add_x_forwarded_for (and often X-Real-IP $remote_addr,
      X-Forwarded-Proto $scheme).
    - In the app: trust only the proxy (loopback, or its address),
      never "everyone" (true).
    - Compare the proxy's and the app's logs when an address looks
      odd: 127.0.0.1 everywhere in the app is that symptom.
    - A per-address lock protects poorly behind a misconfigured proxy:
      it punishes everyone, or no one.

    DOCUMENTATION
    - proxy_set_header: https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_set_header
    - Express behind proxies: https://expressjs.com/en/guide/behind-proxies.html
