### Die gestuften Hinweise der Geschichte „Die Kantine“: eine Spur, dann
### fast die Antwort, für jeden Schritt (siehe src/engine/hints.ts).

## Kapitel 1 — Die Startreihenfolge

hint-boot-order-refused =
    .lead = Warum ist die App heute Morgen gescheitert? systemctl status menu, dann journalctl -b -u menu (man journalctl).
    .solution = journalctl -b -u menu zeigt „connect ECONNREFUSED 127.0.0.1:5432“: PostgreSQL war noch nicht bereit.
hint-boot-order-order =
    .lead = Was sagt die Unit-Datei über die Datenbank? systemctl cat menu. Und wie sagt man systemd „nach PostgreSQL“? (man systemd.unit: After=, Requires=)
    .solution = sudo systemctl edit menu, dann [Unit] After=postgresql.service Requires=postgresql.service schreiben (zwei Zeilen); systemctl edit lädt von selbst neu.
hint-boot-order-end =
    .lead = Der einzige Beweis: ein Neustart. Dann schau dir die Dienste an (man reboot, man systemctl).
    .solution = sudo reboot, dann ssh kantine und systemctl status menu (oder systemctl --failed).

## Kapitel 2 — Die Neustart-Schleife

hint-restart-loop-limit =
    .lead = Was hat systemd letzte Nacht gemacht? systemctl status menu, journalctl -u menu: Schau dir die Zeiten der Neustarts an.
    .solution = Der Status sagt Result: start-limit-hit: fünf Neustarts im Abstand von 100 ms, während PostgreSQL neu startete.
hint-restart-loop-end =
    .lead = Lass die App mit PostgreSQL stoppen und neu starten, oder lange genug warten (man systemd.unit: PartOf=; man systemd.service: RestartSec=). Teste dann so, wie es die Updates tun.
    .solution = sudo systemctl edit menu: [Unit] PartOf=postgresql.service; dann sudo systemctl reset-failed menu, sudo systemctl start menu und sudo systemctl restart postgresql; systemctl status menu.

## Kapitel 3 — Der langsame Start

hint-slow-boot-blame =
    .lead = Was hat beim Booten so lange gedauert? (man systemd-analyze: time, blame, critical-chain)
    .solution = systemd-analyze blame: systemd-networkd-wait-online.service, mehr als 2 min.
hint-slow-boot-no-carrier =
    .lead = Worauf wartet wait-online? Schau dir die Links und ihren Zustand an (man networkctl).
    .solution = networkctl: eth1 ist no-carrier (kein Kabel), aber von /etc/systemd/network/20-eth1.network konfiguriert.
hint-slow-boot-end =
    .lead = Sag wait-online, dass es nicht auf eth1 warten soll (man systemd.network: RequiredForOnline=), starte dann neu und miss noch einmal.
    .solution = Füge in /etc/systemd/network/20-eth1.network [Link] und dann RequiredForOnline=no hinzu; sudo reboot, dann systemd-analyze time.

## Kapitel 4 — Die verspätete Platte

hint-late-disk-hidden =
    .lead = Wann wurde /srv/data eingehängt, und wann ist die App gestartet? (journalctl -b, findmnt /srv/data). Dann: Was enthält /srv/data ohne seine Platte? (man umount)
    .solution = sudo umount /srv/data, dann ls /srv/data/bookings: Die Datei von heute ist da, auf der Systemplatte.
hint-late-disk-recovered =
    .lead = Kopier die Datei an einen sicheren Ort, häng die Platte wieder ein (man mount: mount /srv/data liest /etc/fstab), und kopier sie dann auf die Platte.
    .solution = sudo cp /srv/data/bookings/2027-11-29.csv /root/, sudo mount /srv/data, sudo cp /root/2027-11-29.csv /srv/data/bookings/
hint-late-disk-end =
    .lead = Sag systemd, dass die App /srv/data braucht (man systemd.unit: RequiresMountsFor=), und starte dann neu.
    .solution = sudo systemctl edit menu: {"["}Unit] und dann RequiresMountsFor=/srv/data; sudo reboot, dann systemctl status menu.
