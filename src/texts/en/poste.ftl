### The workstation: the starting machine, from which you connect with ssh
### to the machines of the stories. And the welcome message (motd) of each machine.

poste-bienvenue =
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
poste-config-commentaire =
    The machines you know. "ssh kingdom" connects to kingdom.internal
    as the user you with the key ~/.ssh/id_kingdom.
    Manual: man ssh
# Comment at the top of the workstation's /etc/hosts (each line becomes a "#" comment)
poste-hosts-commentaire =
    The machines in this game are fictional.
    Names ending in .internal are reserved for private networks (ICANN, 2024);
    names ending in .example, for examples (RFC 6761). The addresses 192.0.2.x,
    198.51.100.x and 203.0.113.x are reserved for documentation (RFC 5737).
    None of these names or addresses leads to anyone real.
poste-exit = (You are on your own workstation: exit would close your terminal. To connect to a machine: ssh name, for example ssh kingdom.)
# { $cles }: the list of new keys, separated by commas
poste-cles-recues =
    🔑 The kingdom thanks you: new SSH keys are waiting for you on your
    workstation ({ $cles }). Go back there (exit), look at ~/.ssh/config, and
    connect to the machine of your choice.
poste-cles-recues-suite =
    🔑 Another milestone: more stories open up, their keys are waiting on
    your workstation ({ $cles }).

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
machine-radio-motd = Radio Quartier — the station's server. On call: one eye on the stream, the other on the logs.
machine-community-motd = Community Centre — the gateway. Behind it: the wiki and the archives.
machine-coop-motd = The neighbourhood food co-op — the till's server. Here, we share everything except passwords.
machine-hive-motd = The Hive — the community space's router. eth0: the ISP box; eth1: the switch.
machine-bakery-motd = The Bakery — the bakery's server: the website, the orders app and its database. An audit has been through here.
machine-lab-motd = The Lab — the photo club's server: the gallery and the members' archives. Two disks in RAID 1.
machine-garden-motd = The Community Gardens — the association's website and mail (gardens.example). Please look after the seedlings and the server alike!
machine-pilot-motd = The neighbourhood centres — the control machine: from here, Ansible looks after the three centres' servers.
machine-patch-motd = The Patch — the community bike workshop (cycles.example). A brand-new server, with Caddy. Remember to pump up your tyres!
machine-petrin-motd = The Bakery — new server (migration), six months after the audit. The security watch, now without Salomé.

# When reconnecting to a machine whose chapter is in progress.
# { $fichier }: the chapter's welcome file (e.g. welcome.txt)
reprise-chapitre = You are resuming this chapter where you left it. To read again what awaits you:   cat { $fichier }
