### Story "The Hive", chapter "The Office Wi-Fi": 802.1X with
### FreeRADIUS and the LDAP directory. The commands, the file names and
### the RADIUS attribute names are not translated.

chapter-wifi = The Office Wi-Fi
    .resume = No more shared Wi-Fi password: everyone connects with their directory account, and the RADIUS server puts each person in their VLAN.

## Files

wifi-email-malik =
    From:     Malik
    To:       you
    Subject:  The office Wi-Fi

    The office Wi-Fi password has been on a sticky note for three
    years, and Camille still knows it. The electrician installed an
    "enterprise" access point (WPA2-Enterprise, 802.1X): everyone connects with
    their own directory account, and the access point puts the person in the
    VLAN the RADIUS server tells it. Its settings are in
    ap-offices.txt.

    The RADIUS server is FreeRADIUS, already installed on the router
    (/etc/freeradius/3.0, man freeradius). What we want:
    - members of the "bureaux" group (Malik, Inès, Sami): VLAN 10;
    - the other directory accounts (Léo, at the café): VLAN 20;
    - deleted accounts (Camille): out.

    To test without the access point: radtest (man radtest). And the
    server's log: journalctl -u freeradius.

    For sudo: bee-2027

# { $secret }: the access point's shared secret; { $adresse }: its address
wifi-bound =
    "BUREAUX" WI-FI ACCESS POINT — settings (the electrician, February 2028)

    Access point address   : { $adresse } (VLAN 30, equipment)
    Wi-Fi network (SSID)   : LaRuche-Bureaux
    Security               : WPA2-Enterprise (802.1X), EAP-TTLS / PAP
    RADIUS server          : 10.10.30.1, port 1812 (UDP)
    Shared secret          : { $secret }
    Dynamic VLAN           : yes (attribute Tunnel-Private-Group-Id)
    Switch port            : 22, trunk: VLAN 10, 20, 30

## Events

wifi-event-filter =
    The access point sends its requests to the router (UDP 1812)… and the input chain
    drops them: nothing lets them in from the equipment VLAN.
    freeradius's log stays silent: it doesn't even receive them.
wifi-event-not-reread =
    The configuration has changed on disk, but freeradius is still
    running with the old one: it only rereads its files at startup
    (sudo freeradius -XC to check, then systemctl restart freeradius).
wifi-event-unknown =
    The requests arrive, but freeradius doesn't answer (journalctl -u
    freeradius): the access point is not a client it knows, or its shared
    secret is wrong. Each access point is declared in clients.conf,
    with its address and the same secret as in its settings.
wifi-event-without-ldap =
    freeradius answers… no, to everyone: it doesn't know any
    password ("No known good password"). The accounts are in the directory,
    but the ldap module is not enabled: enabled modules are links
    in mods-enabled, pointing to mods-available.
wifi-event-anonymous =
    The ldap module does find the accounts… but not their passwords:
    it binds anonymously, and the directory only shows userPassword
    to accounts allowed to see it. The module needs an identity
    (identity, password). And its base (base_dn) must be The Hive's.
wifi-event-groups =
    Malik gets in, but doesn't get VLAN 10: Ldap-Group doesn't find him
    in any group. By default, the ldap module looks for the memberOf
    attribute in the person's entry… which this directory doesn't have: its
    posixGroup groups list their members in memberUid. The module can
    search another way (membership_filter).
wifi-event-order =
    Malik gets VLAN 20, like Léo. In the users file, the first
    matching entry wins: if the entry for everyone comes
    before the one for the bureaux group, nobody ever reaches the second.
wifi-event-in-place =
    The office Wi-Fi works… right now. At the next boot?
    The firewall rule must be in /etc/nftables.conf (freeradius,
    for its part, rereads its files).
wifi-event-end =
    Malik, Inès and Sami get into the office VLAN with their own
    accounts, Léo into the café's, and Camille stays out: all it took was
    deleting their account. Malik peels off the sticky note.

    Well done! You have finished the chapter "The Office Wi-Fi", and
    the story of The Hive.

    WHAT HAPPENED
    With 802.1X, the access point decides nothing: it asks the RADIUS server
    (Access-Request), which checks the account (here, in the LDAP directory) and
    answers yes or no, with attributes: Tunnel-Type = VLAN,
    Tunnel-Medium-Type = IEEE-802 and Tunnel-Private-Group-Id = 10 put
    the person in VLAN 10. The access point must be declared (clients.conf)
    and share a secret with the server.

    GOOD PRACTICE
    - One account per person: someone leaving is handled by deleting an account,
      not by changing everyone's password.
    - To read the directory, a dedicated service account, read-only,
      rather than the administrator (and slapd's permissions to match).
    - freeradius -XC before restarting, freeradius -X (service stopped)
      to understand a rejection, radtest to test.

    DOCUMENTATION
    - The ldap module: https://wiki.freeradius.org/modules/Rlm_ldap
    - The users file: https://wiki.freeradius.org/config/Users
    - VLAN through RADIUS (RFC 3580): https://www.rfc-editor.org/rfc/rfc3580
