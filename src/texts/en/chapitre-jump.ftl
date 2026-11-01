### Story "The Community Centre", chapter "The Jump": reach an internal
### machine by going through the gateway (ssh -J, ProxyJump).
### The ssh_config options, the commands, the paths and OpenSSH's
### messages (in English) are not translated.

chapitre-jump = The Jump
    .resume = The wiki can only be reached through the gateway: ssh -J, then a ProxyJump shortcut in ~/.ssh/config.

## Files

jump-courriel-yasmine =
    From:     Yasmine
    To:       you
    Subject:  The wiki

    Well done with the gateway! Next step: the associations' wiki.
    It's the "wiki" machine (wiki.community.internal, 10.20.0.11), on our
    internal network: it can't be reached from the internet, only
    from community. Look at /etc/hosts here: those are the names community
    knows.

    Gaspard used to do it like this: ssh community, then, once on community,
    ssh wiki. But for the second ssh to work, he had copied his PRIVATE
    key onto community. I deleted it: if someone got into the
    gateway, they would walk away with the key to the whole network.

    Apparently ssh can "jump" through a machine, straight from
    your workstation, without your private key leaving it (man ssh, option -J). And so
    you don't have to type that every time, you can write it once and for all in
    ~/.ssh/config, on your workstation (man ssh_config, ProxyJump): I'd like
    a simple "ssh wiki" to be enough.

    I've already added your public key on our machines, along with mine.

jump-note-gaspard =
    Note from Gaspard (March 2019)

    The wiki runs here, in /srv/wiki. The pages are plain Markdown
    files; they are edited from the browser.

    To get here: ssh community, then ssh wiki. (I put my key in
    ~/.ssh on community, it's more convenient.)

jump-wiki-accueil =
    # Associations' wiki

    Welcome to the wiki of the Community Centre! Each association
    has its page: opening hours, contacts, booked rooms.

    - The Shared Gardens
    - The Tuesday choir
    - The chess club
    - The bike workshop

## Events

jump-evenement-cle-privee =
    WARNING: there is a private key in ~/.ssh on community (a line
    "BEGIN OPENSSH PRIVATE KEY"). That's exactly what Yasmine wanted to
    avoid: the gateway is the most exposed machine on the network.

    Delete it (rm), and jump from your workstation instead: man ssh, option -J.
jump-evenement-au-wiki =
    Here you are on the wiki! Your connection went through community, but your private
    key stayed on your workstation: community only relayed a
    tunnel encrypted end to end between your workstation and the wiki.

    (Look at your prompt: you@wiki. hostname confirms it.)

    One thing left, the shortcut: on your workstation, a block in ~/.ssh/config so that a
    simple "ssh wiki" is enough (man ssh_config, ProxyJump).
jump-evenement-raccourci =
    The shortcut is in your workstation's ~/.ssh/config: ssh finds there the
    way to the wiki, through community. (To see what ssh makes of it:
    ssh -G wiki.)
jump-evenement-fin =
    A simple "ssh wiki" from your workstation, and no private key on the
    gateway. Yasmine: "That's cleaner than in Gaspard's day… but
    don't tell him!"

    Well done! You have finished the chapter "The Jump".

    WHAT HAPPENED
    With -J (or ProxyJump), ssh first connects to the gateway and asks
    it to open a simple pipe to the wiki. Through this pipe, your
    workstation talks directly to the wiki: checking its host key and your
    authentication happen end to end. The gateway only sees
    encrypted traffic go by, and your private key never leaves your workstation.

    GOOD PRACTICE
    - Never copy a private key onto a server, least of all onto the
      gateway (the "bastion"), the most exposed machine.
    - Jump with ssh -J or ProxyJump rather than with two ssh in a row
      (or the ForwardAgent option, which exposes your agent to the gateway).
    - Write your shortcuts in ~/.ssh/config (Host, HostName, User,
      ProxyJump); check with ssh -G.
    - HostName is understood from the gateway's point of view: it is the gateway that
      looks up "wiki" in its /etc/hosts (or its DNS).

    DOCUMENTATION
    - ssh, option -J: https://man.openbsd.org/ssh#J
    - ssh_config, ProxyJump: https://man.openbsd.org/ssh_config#ProxyJump
