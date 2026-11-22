### Indices gradués du Mur d'escalade (voir src/engine/hints.ts) : un
### message par étape, hint-<chapitre>-<événement>, avec .lead (une
### direction, sans la commande exacte) et .solution (presque la réponse).

## Chapitre 1 — La Dernière Coupure

hint-last-cut-blind =
    .lead = Qu'a écrit upsmon (le service nut-monitor) dans le journal, avant et après le plantage de mardi ? journalctl sait montrer une seule unité et un démarrage précédent.
    .solution = journalctl --list-boots ; sudo journalctl -u nut-monitor -b -1 | tail
hint-last-cut-renamed =
    .lead = Quels noms d'onduleurs upsd sert-il ? Demandez-le-lui (man upsc), ou lisez les sections d'ups.conf.
    .solution = upsc -l ; upsc hallups ; sudo cat /etc/nut/ups.conf
hint-last-cut-watching =
    .lead = Faites nommer à la ligne MONITOR d'upsmon l'onduleur que sert upsd, puis faites relire sa configuration à upsmon et vérifiez qu'il s'est connecté.
    .solution = sudo nano /etc/nut/upsmon.conf : MONITOR hallups@localhost 1 upsmon … primary ; sudo systemctl reload nut-monitor ; upsc -c hallups
hint-last-cut-drill =
    .lead = La salle est fermée : la documentation de NUT teste tout l'arrêt en envoyant à upsmon un arrêt forcé (man upsmon, -c). Ensuite reconnectez-vous et lisez la fin du démarrage précédent.
    .solution = sudo upsmon -c fsd ; puis de nouveau ssh relais et sudo journalctl -b -1 | tail -20
hint-last-cut-stayed-off =
    .lead = Que fait le micrologiciel de relais quand le courant revient ? Le BMC le sait (man ipmitool : chassis).
    .solution = sudo ipmitool chassis status ; sudo ipmitool chassis policy list
hint-last-cut-policy =
    .lead = Réglez la politique de remise sous tension pour que relais démarre chaque fois que son courant revient.
    .solution = sudo ipmitool chassis policy always-on
hint-last-cut-end =
    .lead = Tout est en place ? upsmon qui surveille hallups en primaire, MINSUPPLIES 1, un SHUTDOWNCMD qui arrête, always-on, et un exercice de plus où relais revient tout seul.
    .solution = upsc -c hallups ; grep -E 'MONITOR|MINSUPPLIES|SHUTDOWNCMD' /etc/nut/upsmon.conf ; sudo ipmitool chassis status ; sudo upsmon -c fsd

## Chapitre 2 — Chacun son tour

hint-down-in-order-listen =
    .lead = Où écoute upsd ? harness doit le joindre sur l'adresse de relais côté bureau (man upsd.conf : LISTEN ; lu seulement au démarrage).
    .solution = sudo ss -tlnp | grep 3493 ; sudo nano /etc/nut/upsd.conf : LISTEN 127.0.0.1 3493 et LISTEN 198.51.100.141 3493 ; sudo systemctl restart nut-server
hint-down-in-order-secondary-user =
    .lead = harness a besoin de son propre compte dans upsd.users, avec seulement ce qu'il faut à un upsmon secondaire (man upsd.users).
    .solution = sudo nano /etc/nut/upsd.users : [harness], password = …, upsmon secondary ; sudo systemctl reload nut-server
hint-down-in-order-firewall =
    .lead = Le pare-feu de relais jette ce qu'il n'autorise pas : laissez harness, et seulement harness, joindre le port 3493.
    .solution = sudo ufw allow from 198.51.100.142 to any port 3493 proto tcp
hint-down-in-order-secondary =
    .lead = Sur harness : dites quel onduleur suivre, sur quel serveur, à quel titre (man upsmon.conf : MONITOR) ; le mode dans nut.conf ; puis le service, démarré et activé.
    .solution = ssh harness ; sudo nano /etc/nut/upsmon.conf : MONITOR hallups@relais 1 harness … secondary ; nut.conf : MODE=netclient ; sudo systemctl enable --now nut-monitor ; upsc hallups@relais
hint-down-in-order-drill-crash =
    .lead = harness a besoin de 150 s pour s'arrêter, mais l'onduleur coupe ses prises peu après l'arrêt de relais. Quel délai est-ce, et où se règle-t-il (man usbhid-ups) ?
    .solution = sudo nano /etc/nut/ups.conf : sous [hallups], offdelay = 180 et ondelay = 240 ; puis un nouvel exercice : sudo upsmon -c fsd
hint-down-in-order-end =
    .lead = Un exercice de plus, une fois tout en place : les deux machines arrêtées avant la coupure, toutes deux revenues seules, l'upsmon de harness reconnecté.
    .solution = sudo upsmon -c fsd ; puis ssh relais, upsc -c hallups, et ssh harness : sudo journalctl -b -1 | tail

## Chapitre 3 — Vieille Batterie

hint-old-battery-runtime =
    .lead = Que dit l'onduleur de sa batterie : charge, autonomie, date, son dernier test (man upsc) ?
    .solution = upsc hallups | grep -E 'battery|test'
hint-old-battery-denied =
    .lead = Quel test l'onduleur sait-il faire, et lequel ne la vide pas ? Lancez-le ensuite avec un compte qu'upsd autorise (man upscmd, man upsd.users : instcmds).
    .solution = upscmd -l hallups ; sudo nano /etc/nut/upsd.users : sous [admin], instcmds = test.battery.start.quick ; sudo systemctl reload nut-server ; upscmd -u admin -p … hallups test.battery.start.quick
hint-old-battery-warning =
    .lead = Un test rapide dure quelques secondes : lisez son résultat.
    .solution = upsc hallups ups.test.result ; upsc hallups ups.status
hint-old-battery-date =
    .lead = Dites à l'onduleur quand sa batterie a été fabriquée : quelles variables s'écrivent (man upsrw) ?
    .solution = upsrw -l hallups ; upsrw -s battery.mfr.date=2032/12/02 -u admin -p … hallups (actions = SET y est déjà)
hint-old-battery-passed =
    .lead = Testez la batterie neuve comme l'ancienne.
    .solution = upscmd -u admin -p … hallups test.battery.start.quick ; puis upsc hallups ups.test.result
hint-old-battery-alerts =
    .lead = Laissez upsmon confier ONBATT et ONLINE à upssched, et qu'upssched n'écrive que si le courant est encore coupé après un moment (man upssched, man upssched.conf ; Haruto a laissé un CMDSCRIPT).
    .solution = upsmon.conf : NOTIFYCMD /usr/sbin/upssched ; upssched.conf : CMDSCRIPT /usr/local/bin/ups-alert, PIPEFN et LOCKFN décommentés, AT ONBATT * START-TIMER onbatt 60, AT ONLINE * CANCEL-TIMER onbatt online ; sudo systemctl reload nut-monitor
hint-old-battery-end =
    .lead = Tout : un test réussi après le changement, la nouvelle date, des alertes qui ignorent un clignement et préviennent d'une coupure, aucun test profond en cours.
    .solution = upsc hallups | grep -E 'mfr.date|test.result|status' ; sudo grep -v '^#' /etc/nut/upssched.conf | grep .
