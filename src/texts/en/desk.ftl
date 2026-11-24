### The workstation: the starting machine, from which you connect with ssh
### to the machines of the stories. And the welcome message (motd) of each machine.

workstation-welcome =
    Welcome to your workstation.

    Each story takes place on a machine on the network. To connect to it,
    you use ssh (Secure Shell), as people who administer servers do every
    day. Start with the kingdom:

      ssh kingdom

    The first time, ssh will ask whether you trust this machine: answer
    yes. Once you are connected, the prompt changes (you@kingdom). To
    come back here:

      exit

    The machines you know are in ~/.ssh/config, and your keys are in the
    hidden directory ~/.ssh. For now, you only have the key to the kingdom;
    finish The Root (chapter 3 of The Eraser) to receive the others. To see them:

      ls -a ~/.ssh
# Comment at the top of ~/.ssh/config (each line becomes a "#" comment)
workstation-config-comment =
    The machines you know. "ssh kingdom" connects to kingdom.internal
    as the user you with the key ~/.ssh/id_kingdom.
    Manual: man ssh
# Comment at the top of the workstation's /etc/hosts (each line becomes a "#" comment)
workstation-hosts-comment =
    The machines in this game are fictional.
    Names ending in .internal are reserved for private networks (ICANN, 2024);
    names ending in .example, for examples (RFC 6761). The addresses 192.0.2.x,
    198.51.100.x and 203.0.113.x are reserved for documentation (RFC 5737).
    None of these names or addresses leads to anyone real.
workstation-exit = (You are on your own workstation: exit would close your terminal. To connect to a machine: ssh name, for example ssh kingdom.)
# { $keys }: the list of new keys, separated by commas
workstation-keys-received =
    🔑 The kingdom thanks you: new SSH keys are waiting for you on your
    workstation ({ $keys }). Go back there (exit), look at ~/.ssh/config, and
    connect to the machine of your choice.
workstation-keys-received-next =
    🔑 Another milestone: more stories open up, their keys are waiting on
    your workstation ({ $keys }).

## Welcome messages of the machines (motd), shown on login

machine-kingdom-motd = Kingdom — server of the lighthouse keeper. Access restricted to travellers carrying a key.
machine-datacenter-motd = Data centre — web server of the media library. Every intervention is logged.
machine-anthill-motd = The Anthill — the computer of the community café. "Thanks for coming to help us!" (Kofi)
machine-manuscript-motd = Manuscript — Inès's computer. Don't touch the novel without a backup!
machine-library-motd = Neighbourhood library — this server will be shut down tonight at midnight.
machine-letters-motd = The Neighbourhood Letters — the association's server. Please take good care of it!
machine-workshop-motd = The Workshop — the fablab's server. Here, we repair, we lend, we tinker.
machine-gazette-motd = The Neighbourhood Gazette — the newspaper's server. We publish with git push, not by hand.
machine-games-motd = The Neighbourhood Game Library — the volunteers' server. We play, we lend, we put the pieces away.
machine-radio-motd = Neighbourhood Radio — the station's server. On call: one eye on the stream, the other on the logs.
machine-community-motd = Community Centre — the gateway. Behind it: the wiki and the archives.
machine-coop-motd = The neighbourhood food co-op — the till's server. Here, we share everything except passwords.
machine-hive-motd = The Hive — the community space's router. eth0: the ISP box; eth1: the switch.
machine-bakery-motd = The Bakery — the bakery's server: the website, the orders app and its database. An audit has been through here.
machine-lab-motd = The Lab — the photo club's server: the gallery and the members' archives. Two disks in RAID 1.
machine-garden-motd = The Community Gardens — the association's website and mail (gardens.example). Please look after the seedlings and the server alike!
machine-pilot-motd = The neighbourhood centres — the control machine: from here, Ansible looks after the three centres' servers.
machine-patch-motd = The Patch — the community bike workshop (cycles.example). A brand-new server, with Caddy. Remember to pump up your tyres!
machine-canteen-motd = The Canteen — the solidarity canteen's server: today's menu and the bookings. Pay what you can, eat together.
machine-observatory-motd = The Observatory — the astronomy club's server: the photo gallery, and the stacking of the night's images. Clear skies!
machine-theatre-motd = The Theatre — the neighbourhood theatre's server: the ticket office and its database. Break a leg!
machine-valley-motd = The Huts — the valley's server: the logs of the mountain huts, gathered in one place.
machine-nas-motd = The Photo Club — the club's NAS: the photos of every album, shared with the darkroom.
machine-oven-motd = The Bastion — the Bakery's delivery server: the rounds, the drivers, the orders of the day.
machine-projector-motd = The Other Unix — the film club's server: the programme, the tickets, and Lucien's old FreeBSD.
machine-herbarium-motd = The Old Sun — the seed library's catalogue since 2009, on a Sun Fire V240. Please do not unplug.
machine-abacus-motd = The Night Batch — the Mutual's server: the nightly contributions batch, in COBOL, moved off the bureau's mainframe.
machine-mill-motd = The Order Book — the flour mill's IBM i (PASE, the Unix side). tn5250 mill from the workstation opens its green screen.
machine-kneader-motd = The Bakery — new server (migration), six months after the audit. The security watch, now without Salomé.

# When reconnecting to a machine whose chapter is in progress.
# { $file }: the chapter's welcome file (e.g. welcome.txt)
resumed-chapter = You are resuming this chapter where you left it. To read again what awaits you:   cat { $file }
machine-compass-motd = Next Door Windows — the Drawing Office's Linux server. Its neighbour, cabinet, is a Windows Server.
machine-stave-motd = The Music School — the school's file server, a Windows Server 2022 (OpenSSH lands in cmd.exe).
machine-register-motd = The Card Catalogue — the libraries' domain controller, a Windows Server 2022 (Active Directory, lending.internal).
machine-crate-motd = The Pantry — the community grocery's Debian server (its files, its app, and the backup disk that leaves on Fridays).
machine-quay-motd = The Ferry — the ferry cooperative's Debian server, in IPv4 and in IPv6 (its site, its booking app, its DNS zone ferry.example).
machine-gauge-motd = The Bike Share — the cooperative's monitoring server (Prometheus, its node exporter, the Alertmanager); saddle and hub are behind it.
machine-lane-motd = The Pool — the swimming pool's Debian server, a single-node k3s cluster (the booking app, namespace swim).

machine-chalk-motd = The Staff Room — the primary school's print server (CUPS): the office, the library, the staff room. Please don't print the yearbook twice.
machine-mast-motd = The Airwaves — the community radio federation's Debian server: the intranet, the archive, the contribution portal, and the federation's certificate authority in /srv/ca.
machine-anvil-motd = The Tool Library — Lendshed's forge: Forgejo (https://forge.lendshed.example), its Actions runner, and the documentation and downloads sites. Be kind to contributors.
machine-hearth-motd = The Health Centre — Millbrook Health Centre's hypervisor (KVM, libvirt): ledger, agenda, records and their friends live here. virsh list --all before anything else.
machine-lb1-motd = The Blood Drive — lb1, the Lindenvale Blood Service's first load balancer (keepalived, HAProxy) in front of donate.lindenvale.example. Its twin is lb2. ip a before anything else.
machine-baton-motd = The Choir — baton, the Riverside Community Choir's server: the site, the members' area and its database, and the members' data. The retention policy is in /srv/choir/docs.
machine-trowel-motd = The Allotments — trowel, the Greenholme Allotments Association's database server (MariaDB): Plotline's bookings, members and waiting list. sudo mariadb before anything else.
machine-slipway-motd = The Lifeboat — slipway, Seaholme Lifeboat's mail server: Postfix receives, rspamd scores, Dovecot stores in /var/vmail. sudo tail /var/log/mail.log before anything else.
machine-belay-motd = The Climbing Wall — belay, the server of Overhang, the community climbing hall: bookings, memberships, the door's badges. It sits on a UPS in the office rack (Network UPS Tools: upsc, upsmon).
machine-wings-motd = The Dance Troupe — wings, the Kestrel Dance Company's server and a node of its Garage cluster. sudo garage status before anything else; aws and rclone talk to s3.kestrel.example.
machine-meadow-motd = The Shelter — meadow, Hillside Animal Shelters' small server at a hosting cooperative: the restic repository (/srv/restic), the disaster recovery plan (/srv/drp), and the zone's hidden primary DNS. paddock, the main server, is in Hillside's cellar.
machine-kettle-motd = The Language Café — kettle, Common Tongue's small server in the café's back office: Rocky Linux 10 (not Debian: dnf, firewalld, SELinux). Its site shows on the café's screen, noticeboard.
machine-cairn-motd = The Mapping Party — cairn, the Wayfinders collective's DNS server (BIND, zone wayfinders.example), its records kept as code with OpenTofu in /srv/dns. tofu plan before anything else.
