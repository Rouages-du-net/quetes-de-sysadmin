### Abgestufte Hinweise für „Das verlorene Paket“ (siehe src/engine/hints.ts):
### eine Nachricht pro Schritt, hint-<kapitel>-<ereignis>, mit .lead (eine
### Spur, ohne den genauen Befehl) und .solution (fast die Antwort).
### Dateinamen wie in names.ftl.

## Kapitel 1 — Das verlorene Paket

hint-lost-packet-box =
    .lead = Schritt für Schritt testen, vom Nächsten zum Entferntesten (Kofis notizbuch.txt). Das Nächste ist der Router: Ein Befehl schickt eine kleine Nachricht und wartet, dass sie zurückkommt.
    .solution = ping 192.168.1.1 (der Router; 0% packet loss: Das lokale Netz funktioniert).
hint-lost-packet-internet =
    .lead = Der Router antwortet. Einen Schritt weiter: ein Server im Internet, über seine IP-Adresse (das Notizbuch nennt eine).
    .solution = ping 9.9.9.9 (der öffentliche DNS-Server von Quad9).
hint-lost-packet-name =
    .lead = Das Internet antwortet über die Adresse. Und über den Namen? Probier die Website selbst, über ihren Namen.
    .solution = ping letters.example
hint-lost-packet-dns-silent =
    .lead = Der Name wird nicht zu einer Adresse: Das ist die Aufgabe von DNS. Ein Befehl fragt den DNS-Server direkt (man dig).
    .solution = dig letters.example (dann cat /etc/resolv.conf: Welchen DNS-Server fragt der Rechner?).
hint-lost-packet-dns-other =
    .lead = Der eingestellte DNS-Server antwortet nicht. Existiert der Name wirklich? dig kann einen anderen Server fragen als den aus /etc/resolv.conf (man dig, das @).
    .solution = dig @9.9.9.9 letters.example
hint-lost-packet-dns-repaired =
    .lead = /etc/resolv.conf zeigt auf den alten Router, den es nicht mehr gibt. Die richtige Einstellung steht in einer Datei daneben. /etc gehört root: sudo (das Passwort steht in Kofis Notiz).
    .solution = sudo cp /etc/resolv.conf.box /etc/resolv.conf (Passwort: ameisenhaufen).
hint-lost-packet-ping-lost =
    .lead = DNS ist repariert: Versuch noch einmal, die Website über ihren Namen zu erreichen.
    .solution = ping letters.example
hint-lost-packet-route =
    .lead = Der Name wird übersetzt, aber der ping geht verloren. Wo bleiben die Pakete stehen? Ein Befehl zeigt ihren Weg, Router für Router.
    .solution = traceroute letters.example
hint-lost-packet-curl =
    .lead = Viele Server ignorieren ping absichtlich. Der einzig echte Test: die Seite selbst anfordern, über HTTPS (das Notizbuch, Schritt 5).
    .solution = curl -I https://letters.example (HTTP/2 200: Die Website antwortet).
