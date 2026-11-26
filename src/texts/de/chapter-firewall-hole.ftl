### Geschichte „Die Werkstatt“, Kapitel 3 „Das Loch in der Firewall“:
### Docker und ufw, und der Platz, den Docker belegt. Befehle, Pfade und
### die Meldungen von docker, ufw, ss und nc werden nicht übersetzt.

chapter-firewall-hole = Das Loch in der Firewall
    .summary = Die Datenbank des FabLabs trotz ufw offen für die Welt: von Docker veröffentlichte Ports, dann Platz schaffen, ohne Wichtiges wegzuwerfen.

## Dateien

firewall-hole-message-rania =
    Eine Nachricht von Rania, von den Nachbarschaftsbriefen:

    „Hallo! Gestern Abend habe ich aus Neugier von zu Hause aus die Ports
    des FabLab-Servers getestet. Überraschung: PostgreSQL antwortet auf
    Port 5432, offen für die ganze Welt. Dabei hat Yasmine mir ihre
    Firewall gezeigt: ufw erlaubt nur SSH, 8080 und 8081!

    Teste es selbst von deinem Rechner aus (exit, um dorthin zurückzukehren):
      nc -zv werkstatt 5432

    Eine im Internet offene Datenbank ist eine offene Tür für jeden Bot,
    der Passwörter ausprobiert…“
firewall-hole-word-yasmine =
    Eine Notiz von Yasmine:

    „Hoppla. Ich hatte der Datenbank in /srv/reservations/compose.yaml den
    Port 5432 hinzugefügt, um mich von meinem Laptop aus mit pgAdmin zu
    verbinden. Ich dachte, ufw blockiert ihn.

    Und noch ein Problem: Die Platte des Servers ist zu mehr als 90 % voll
    (df -h /). Ich glaube, es ist Docker. Kannst du Platz schaffen? Aber
    Vorsicht: Was auch immer du tust, rühr NICHT das Volume altes-wiki an.
    Es enthält die Seiten unseres alten Wikis, die wir noch retten müssen.
    Gerade benutzt es kein Container.

    Für sudo: fablab-2027.“

firewall-hole-compose-comment = Für pgAdmin, von meinem Laptop aus (Yasmine)

## Ereignisse

firewall-hole-event-ss =
    docker-proxy lauscht auf 0.0.0.0:5432: Docker veröffentlicht den Port
    der Datenbank, auf allen Adressen der Maschine. Und sudo ufw status
    sagt nichts über 5432… Docker schreibt seine eigenen Regeln in
    iptables, die der Kernel VOR den Regeln von ufw prüft: Ein von Docker
    veröffentlichter Port umgeht ufw.
firewall-hole-event-ufw-useless =
    Eine ufw-Regel für 5432 ändert nichts: Pakete an einen von Docker
    veröffentlichten Port werden zum Container umgeleitet, bevor sie die
    Regeln von ufw erreichen. Teste von deinem Rechner aus:
    nc -zv werkstatt 5432. Die Lösung steht in compose.yaml: Diesen Port
    nicht veröffentlichen, oder nur auf 127.0.0.1.
firewall-hole-event-closed =
    Port 5432 antwortet von außen nicht mehr, und die Buchungs-App
    funktioniert noch: Sie erreicht die Datenbank über das Netz des
    Projekts, ohne veröffentlichten Port. Für pgAdmin geht Yasmine über
    einen SSH-Tunnel: ssh -L 5432:127.0.0.1:5432 werkstatt (mit dem Port
    nur auf 127.0.0.1 veröffentlicht), oder docker compose exec db psql.
# { $volumes }: die gelöschten Volumes
firewall-hole-event-volume-lost =
    Das Volume { $volumes } ist weg, mit all seinen Daten: docker volume
    prune -a löscht jedes Volume, das kein Container benutzt, selbst wenn
    es einen Namen hat und wichtig ist. Auf einem echten Server wäre es
    verloren. Hier kannst du das Kapitel über das Menü neu starten. Vor
    einem prune: docker system df, docker volume ls, und die Warnung lesen.
# { $percent }: Belegung der Platte
firewall-hole-event-disk =
    Die Platte kann wieder atmen: { $percent } % belegt. Images, die kein
    Container benutzt (alte Versionen, vergessene Tests, namenlose Images),
    belegten fast den ganzen Platz.
firewall-hole-event-end =
    Die Datenbank ist aus dem Internet nicht mehr sichtbar, beide Apps
    laufen, die Platte hat Platz, und das Wiki wartet noch in seinem
    Volume. Rania wiederholt ihren Test: „Nichts mehr auf 5432. Gut gemacht!“

    Gut gemacht! Du hast Kapitel 3 von „Die Werkstatt“ abgeschlossen. (Wie
    es weitergeht: ssh werkstatt, für die Fotogalerie des FabLabs.)

    WAS PASSIERT IST
    „ports: - "5432:5432"“ veröffentlicht den Port auf allen Adressen der
    Maschine. Dafür schreibt Docker seine eigenen iptables-Regeln (Tabelle
    nat, Kette DOCKER), die der Kernel vor den Regeln von ufw anwendet: Die
    Firewall, die ufw status zeigt, sieht diese Pakete nie. Und Docker
    behält alles, was es heruntergeladen hat, bis man aufräumt.

    GUTE PRAXIS
    - Nur veröffentlichen, was öffentlich sein muss; zwischen Containern
      reicht das Netz des Projekts.
    - Ein Port nur für dich: "127.0.0.1:5432:5432", und ein SSH-Tunnel.
    - Von außen testen (nc -zv, nmap), nie nur ufw status.
    - docker system df, um den belegten Platz zu sehen; docker image
      prune -a und docker container prune, um ihn zurückzugewinnen.
    - docker volume prune -a löscht auch unbenutzte benannte Volumes:
      vorher prüfen, oder auf einem Server nie benutzen.

    DOKUMENTATION
    - Docker und ufw: https://docs.docker.com/engine/network/packet-filtering-firewalls/#docker-and-ufw
    - Einen Port veröffentlichen: https://docs.docker.com/engine/network/#published-ports
    - Aufräumen: https://docs.docker.com/engine/manage-resources/pruning/
