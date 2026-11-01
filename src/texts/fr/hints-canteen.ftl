### Les indices gradués de l'histoire « La Cantine » : une piste, puis
### presque la réponse, pour chaque étape (voir src/engine/hints.ts).

## Chapitre 1 — L'ordre de démarrage

hint-boot-order-refused =
    .lead = Pourquoi l'appli a-t-elle échoué ce matin ? systemctl status menu, puis journalctl -b -u menu (man journalctl).
    .solution = journalctl -b -u menu montre « connect ECONNREFUSED 127.0.0.1:5432 » : PostgreSQL n'était pas encore prêt.
hint-boot-order-order =
    .lead = Que dit le fichier d'unité au sujet de la base ? systemctl cat menu. Et comment dire à systemd « après PostgreSQL » ? (man systemd.unit : After=, Requires=)
    .solution = sudo systemctl edit menu, puis écrire {"["}Unit] After=postgresql.service Requires=postgresql.service (deux lignes) ; systemctl edit recharge tout seul.
hint-boot-order-end =
    .lead = La seule preuve : un redémarrage. Puis regarde les services (man reboot, man systemctl).
    .solution = sudo reboot, puis ssh cantine et systemctl status menu (ou systemctl --failed).

## Chapitre 2 — La boucle

hint-restart-loop-limit =
    .lead = Qu'a fait systemd cette nuit ? systemctl status menu, journalctl -u menu : regarde les heures des relances.
    .solution = Le statut dit Result: start-limit-hit : cinq relances à 100 ms d'écart, pendant que PostgreSQL redémarrait.
hint-restart-loop-end =
    .lead = Fais arrêter et redémarrer l'appli avec PostgreSQL, ou attendre assez longtemps (man systemd.unit : PartOf= ; man systemd.service : RestartSec=). Puis testez comme les mises à jour.
    .solution = sudo systemctl edit menu : {"["}Unit] PartOf=postgresql.service ; puis sudo systemctl reset-failed menu, sudo systemctl start menu, et sudo systemctl restart postgresql ; systemctl status menu.

## Chapitre 3 — Le démarrage lent

hint-slow-boot-blame =
    .lead = Qu'est-ce qui a pris si longtemps au démarrage ? (man systemd-analyze : time, blame, critical-chain)
    .solution = systemd-analyze blame : systemd-networkd-wait-online.service, plus de 2 min.
hint-slow-boot-no-carrier =
    .lead = Qu'attend wait-online ? Regarde les liens et leur état (man networkctl).
    .solution = networkctl : eth1 est no-carrier (pas de câble) mais configuré par /etc/systemd/network/20-eth1.network.
hint-slow-boot-end =
    .lead = Dis à wait-online de ne pas attendre eth1 (man systemd.network : RequiredForOnline=), puis redémarre et mesure à nouveau.
    .solution = Dans /etc/systemd/network/20-eth1.network, ajouter {"["}Link] puis RequiredForOnline=no ; sudo reboot, puis systemd-analyze time.

## Chapitre 4 — Le disque en retard

hint-late-disk-hidden =
    .lead = Quand /srv/data a-t-il été monté, et quand l'appli a-t-elle démarré ? (journalctl -b, findmnt /srv/data). Puis : que contient /srv/data sans son disque ? (man umount)
    .solution = sudo umount /srv/data, puis ls /srv/data/bookings : le fichier du jour est là, sur le disque système.
hint-late-disk-recovered =
    .lead = Copie le fichier à l'abri, remonte le disque (man mount : mount /srv/data lit /etc/fstab), puis copie-le sur le disque.
    .solution = sudo cp /srv/data/bookings/2027-11-29.csv /root/, sudo mount /srv/data, sudo cp /root/2027-11-29.csv /srv/data/bookings/
hint-late-disk-end =
    .lead = Dis à systemd que l'appli a besoin de /srv/data (man systemd.unit : RequiresMountsFor=), puis redémarre.
    .solution = sudo systemctl edit menu : {"["}Unit] puis RequiresMountsFor=/srv/data ; sudo reboot, puis systemctl status menu.
