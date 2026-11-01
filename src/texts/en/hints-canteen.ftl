### The graduated hints of the story "The Canteen": a lead, then almost the
### answer, for each step (see src/engine/hints.ts).

## Chapter 1 — The Boot Order

hint-boot-order-refused =
    .lead = Why did the app fail this morning? systemctl status menu, then journalctl -b -u menu (man journalctl).
    .solution = journalctl -b -u menu shows "connect ECONNREFUSED 127.0.0.1:5432": PostgreSQL wasn't ready yet.
hint-boot-order-order =
    .lead = What does the unit file say about the database? systemctl cat menu. And how do you tell systemd "after PostgreSQL"? (man systemd.unit: After=, Requires=)
    .solution = sudo systemctl edit menu, then write [Unit] After=postgresql.service Requires=postgresql.service (two lines); systemctl edit reloads by itself.
hint-boot-order-end =
    .lead = The only proof: a reboot. Then look at the services (man reboot, man systemctl).
    .solution = sudo reboot, then ssh canteen and systemctl status menu (or systemctl --failed).

## Chapter 2 — The Restart Loop

hint-restart-loop-limit =
    .lead = What did systemd do last night? systemctl status menu, journalctl -u menu: look at the times of the restarts.
    .solution = The status says Result: start-limit-hit: five restarts 100 ms apart, while PostgreSQL was restarting.
hint-restart-loop-end =
    .lead = Make the app stop and restart with PostgreSQL, or wait long enough (man systemd.unit: PartOf=; man systemd.service: RestartSec=). Then test like the updates do.
    .solution = sudo systemctl edit menu: [Unit] PartOf=postgresql.service; then sudo systemctl reset-failed menu, sudo systemctl start menu, and sudo systemctl restart postgresql; systemctl status menu.

## Chapter 3 — The Slow Boot

hint-slow-boot-blame =
    .lead = What took so long during the boot? (man systemd-analyze: time, blame, critical-chain)
    .solution = systemd-analyze blame: systemd-networkd-wait-online.service, more than 2 min.
hint-slow-boot-no-carrier =
    .lead = What is wait-online waiting for? Look at the links and their state (man networkctl).
    .solution = networkctl: eth1 is no-carrier (no cable) but configured by /etc/systemd/network/20-eth1.network.
hint-slow-boot-end =
    .lead = Tell wait-online not to wait for eth1 (man systemd.network: RequiredForOnline=), then reboot and measure again.
    .solution = In /etc/systemd/network/20-eth1.network add [Link] then RequiredForOnline=no; sudo reboot, then systemd-analyze time.
