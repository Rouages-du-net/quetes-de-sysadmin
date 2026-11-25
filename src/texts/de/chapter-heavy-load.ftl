### Geschichte „Die Sternwarte“, Kapitel 1 „Hohe Last“: die
### Durchschnittslast, top, nice und renice. Befehle, Pfade und die
### Ausgaben der Werkzeuge werden nicht übersetzt.

chapter-heavy-load = Hohe Last
    .summary = Die Galerie des Vereins braucht fünf Sekunden pro Seite, seit Jules angefangen hat, die Fotos der letzten Nacht zu stacken. Mach sie wieder schnell, ohne seine Arbeit zu stoppen.

## Dateien

heavy-load-message-amara =
    Von:     Amara
    An:      dich
    Betreff: Die Galerie kriecht

    Hallo,

    Ich bin bis Sonntag weg (endlich klarer Himmel!), und die Mitglieder
    des Vereins schreiben mir, dass die Galerie heute Morgen ewig zum
    Öffnen braucht. Letzte Nacht war das Maximum der Geminiden: Jules hat
    um 6 Uhr das Stacking seiner Fotos auf dem Server gestartet, aus
    seiner Sitzung heraus.

    Bitte stopp sein Stacking nicht: Es läuft seit drei Stunden und würde
    wieder bei null anfangen. Mach die Galerie einfach wieder benutzbar,
    während es fertig wird.

    Um die Galerie zu messen, mache ich:
      curl -s -o /dev/null -w '%{"{"}time_total{"}"}\n' http://localhost:8080/
    Normalerweise antwortet sie in etwa 0,25 s.

    Dein sudo-Passwort: nebel-2028.

    Amara

## Ereignisse

heavy-load-event-load =
    Die Durchschnittslast (load average): wie viele Prozesse im Schnitt
    über 1, 5 und 15 Minuten laufen oder auf eine CPU warten. Vergleich
    sie mit der Anzahl der CPUs (nproc): Darüber warten einige, bis sie
    dran sind.
heavy-load-event-workers =
    stack-worker, achtmal, jeder bei etwa 22 % einer CPU: Das Stacking von
    Jules (stack-night) hat acht Worker-Prozesse gestartet, auf einer
    Maschine mit zwei CPUs. Die Galerie (node) bekommt denselben Anteil wie
    jeder von ihnen: ein Neuntel der Maschine, wo sie eine ganze CPU
    braucht.
heavy-load-event-parent-only =
    Der Elternprozess, stack-night, hat jetzt einen nice-Wert; seine acht
    Worker haben ihren behalten (schau dir die Spalte NI von top an, oder
    ps -o pid,ni,comm). Ein nice-Wert gehört zu jedem einzelnen Prozess:
    Die schon gestarteten Kindprozesse folgen nicht. Und der Elternprozess
    wartet nur: Rechnen tun die Worker.
heavy-load-event-some-workers =
    Einige Worker haben einen nice-Wert, nicht alle: Die noch bei 0
    behalten ihren vollen Anteil, und die Galerie wartet immer noch.
    renice nimmt mehrere PIDs, oder alle Prozesse eines Kontos (man renice:
    -u).
heavy-load-event-killed =
    Ein Teil des Stackings ist weg. Jules: „Drei Stunden Rechenzeit… das
    muss heute Nacht wieder bei null anfangen.“ Genau das wollte Amara
    vermeiden: Um es noch einmal zu versuchen, nimm „Dieses Kapitel neu
    starten“ unter dem Terminal.
heavy-load-event-gallery-stopped =
    Die Galerie ist gestoppt: Die Mitglieder bekommen jetzt gar keine Seite
    mehr. Starte sie wieder (sudo systemctl start gallery).
heavy-load-event-end =
    Die Galerie antwortet wieder in einer Viertelsekunde, und das Stacking
    läuft weiter. Jules: „Ah, es hat etwas länger gedauert, aber niemand
    hat es gemerkt!“

    Gut gemacht! Du hast das Kapitel „Hohe Last“ abgeschlossen.

    WAS PASSIERT IST
    Die Maschine hat zwei CPUs. Das Stacking von Jules hat acht Worker
    gestartet, die jeder eine CPU wollten: mit der Galerie neun Prozesse
    für zwei CPUs. Die Durchschnittslast hat es gesagt (etwa 9 für
    2 CPUs), und der Scheduler gab jedem denselben Anteil: Die Galerie
    bekam 0,2 CPU statt 1, und ihre Anfragen stauten sich.

    WAS NICE ÄNDERT
    Der nice-Wert reicht von -20 (zuerst bedient) bis 19 (zuletzt
    bedient). Der Scheduler teilt die CPU im Verhältnis zu einem Gewicht,
    das pro Stufe um etwa 25 % sinkt: Bei nice 19 wiegt ein Prozess 15
    gegen 1024 bei 0. Die Worker bekommen trotzdem alles, was sonst niemand
    will: Das Stacking wird nur langsamer, solange die Galerie beschäftigt
    ist. Die Durchschnittslast ist nicht gesunken: Sie zählt die Prozesse,
    die laufen wollen, egal mit welcher Priorität. Eine hohe Last ist an
    sich kein Problem; ein Dienst, der auf eine CPU wartet, schon.

    GUTE PRAXIS
    - Vergleich die Last mit nproc, und finde dann, wer die CPU nimmt: top
      (nach %CPU sortiert), ps -eo pid,ni,%cpu,comm --sort=-%cpu.
    - Lange Jobs gleich mit nice starten: nice -n 19 stack-night…
    - renice -n 19 -u KONTO erreicht alle Prozesse eines Kontos; auf eine
      PID nur diesen Prozess (seine Kinder behalten ihren Wert).
    - Nur root darf einen nice-Wert senken (mehr Priorität geben).

    DOKUMENTATION
    - renice: https://man7.org/linux/man-pages/man1/renice.1.html
    - Der Scheduler und nice: https://man7.org/linux/man-pages/man7/sched.7.html
    - Die Durchschnittslast: https://man7.org/linux/man-pages/man5/proc_loadavg.5.html
heavy-load-event-end-gallery =
    Die Galerie antwortet wieder in einer Viertelsekunde, und das Stacking
    läuft weiter: Du hast der Galerie eine höhere Priorität gegeben (einen
    negativen nice-Wert, den nur root setzen darf). Das funktioniert; der
    übliche Weg ist der andere: die Priorität des Batch-Jobs senken
    (renice -n 19 auf die Worker), sodass jeder Dienst der Maschine vor ihm
    drankommt.

    Gut gemacht! Du hast das Kapitel „Hohe Last“ abgeschlossen.

    WAS PASSIERT IST
    Die Maschine hat zwei CPUs. Das Stacking von Jules hat acht Worker
    gestartet, die jeder eine CPU wollten: mit der Galerie neun Prozesse
    für zwei CPUs. Die Durchschnittslast hat es gesagt (etwa 9 für
    2 CPUs), und der Scheduler gab jedem denselben Anteil: Die Galerie
    bekam 0,2 CPU statt 1.

    WAS NICE ÄNDERT
    Der nice-Wert reicht von -20 (zuerst bedient) bis 19 (zuletzt
    bedient). Der Scheduler teilt die CPU im Verhältnis zu einem Gewicht,
    das sich pro Stufe um etwa 25 % ändert. Die Durchschnittslast ist nicht
    gesunken: Sie zählt die Prozesse, die laufen wollen, egal mit welcher
    Priorität.

    GUTE PRAXIS
    - Vergleich die Last mit nproc, und finde dann, wer die CPU nimmt: top,
      ps -eo pid,ni,%cpu,comm --sort=-%cpu.
    - Lange Jobs gleich mit nice starten: nice -n 19 stack-night…
    - renice -n 19 -u KONTO erreicht alle Prozesse eines Kontos.

    DOKUMENTATION
    - renice: https://man7.org/linux/man-pages/man1/renice.1.html
    - Der Scheduler und nice: https://man7.org/linux/man-pages/man7/sched.7.html
