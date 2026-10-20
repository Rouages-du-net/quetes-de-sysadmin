### Story "The Community Centre", chapter "The tunnel": reach a service
### that only listens on 127.0.0.1 of an internal machine (ssh -L).
### Commands, options, paths and the messages of OpenSSH and curl (in
### English) are not translated.

chapitre-tunnel = The tunnel
    .resume = The wiki's admin interface only listens on 127.0.0.1: an ssh -L tunnel, curl, then close the tunnel.

## Files

tunnel-courriel-yasmine =
    From:     Yasmine
    To:       you
    Subject:  Sign-ups waiting

    Three sign-ups are waiting to be approved on the wiki. There's
    Samir's (the bike workshop) and Léa's (the choir). The third one is
    surely advertising: whatever you do, don't approve it.

    The problem: the wiki's admin page isn't on the internet. Gaspard
    did it on purpose, it only listens on 127.0.0.1, port 8080, OF THE
    WIKI. There's no browser on the wiki (not even curl): he opened it
    from his workstation, with an ssh "tunnel" (man ssh, option -L;
    and -f -N so that it stays open without a session).

    On the page, each sign-up has its own address to approve or reject
    it.

    And when you're done, close the tunnel: a port open on your
    workstation into our internal network shouldn't be left lying
    around.

tunnel-note-gaspard =
    Note from Gaspard (June 2021)

    The wiki's admin interface runs here (service wiki-admin, port 8080).
    It only listens on 127.0.0.1: nobody can reach it from the
    outside, not even from maison. To check:

      ss -tln
      systemctl status wiki-admin

## The admin page (served by the wiki)

# { $lignes }: one line per sign-up (tunnel-admin-ligne)
tunnel-admin-page =
    Community wiki — administration

    Sign-ups:
    { $lignes }

    Approve:   /admin/valider/<account>
    Reject:    /admin/refuser/<account>
# { $nom }: the account; { $etat }: attente (pending), validee (approved) or refusee (rejected)
tunnel-admin-ligne = { $etat ->
        [validee] - { $nom }: approved
        [refusee] - { $nom }: rejected
       *[attente] - { $nom }: pending
    }
tunnel-admin-valider = Sign-up of { $nom } approved.
tunnel-admin-refuser = Sign-up of { $nom } rejected.
tunnel-admin-introuvable = Page not found.

## Events

# { $compte }: the advertising account
tunnel-evenement-publicite =
    Oops: the account { $compte } is approved. Yasmine: "It's going to fill
    the wiki with ads!" Reject it (the address is on the admin page).
tunnel-evenement-validees =
    Samir and Léa are signed up, and the advertising stays outside.

    All that's left is to close the tunnel: it's running in the
    background on your workstation. Find its process (ps), then stop it
    (kill).
tunnel-evenement-fin =
    Sign-ups approved, tunnel closed. Yasmine: "Samir has already created
    the bike workshop's page!"

    Well done! You have finished the chapter "The tunnel".

    WHAT HAPPENED
    With ssh -L 8080:localhost:8080 wiki, ssh opens port 8080 on your
    workstation. Everything that goes in travels, encrypted, inside the
    ssh connection, and comes out on the wiki side towards
    "localhost:8080". This localhost is seen from the WIKI's point of
    view: it's its own address 127.0.0.1, where the admin interface
    listens. The service was never exposed to the internet; only ssh was.

    GOOD PRACTICE
    - Keep admin interfaces on 127.0.0.1 and reach them through an ssh
      tunnel, rather than opening one more port in the firewall.
    - The name in -L is resolved by the machine at the other end: -L
      8080:localhost:8080 maison leads to maison, not to the wiki.
    - -f -N: a tunnel without a session; remember to close it (ps,
      kill), or keep it in the foreground and stop it with Ctrl+C.

    DOCUMENTATION
    - ssh, option -L: https://man.openbsd.org/ssh#L
    - ssh, options -f and -N: https://man.openbsd.org/ssh#f
