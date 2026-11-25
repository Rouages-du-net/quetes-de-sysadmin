### Geschichte „Die Kletterhalle“, Kapitel „Der Reihe nach“: Das NAS an
### derselben USV wird secondary von upsmon. upsd.conf (LISTEN, ein
### Neustart), upsd.users (upsmon secondary), ufw, upsmon.conf und nut.conf
### des secondary, HOSTSYNC, offdelay und ondelay in ups.conf, eine Übung.
### Befehle, Optionen, Pfade, Konfigurationszeilen und Ausgaben werden nicht
### übersetzt.

chapter-down-in-order = Der Reihe nach
    .summary = Das NAS mit den Fotos und unterschriebenen Haftungsverzichten der Halle hängt jetzt an der USV des Servers, aber niemand sagt ihm, wann es aufhören soll. Mach es über das Netz zum secondary der USV, ohne die USV dem ganzen Internet zu öffnen, und sorge dafür, dass es angehalten ist, bevor die USV den Strom abschaltet.

## Files

down-in-order-message-akosua =
    Von: Akosua (Fotoarchiv und Haftungsverzichte, Overhang)
    Freitag, 26. November, 21:45

    Hallo! Nkechi hat mir von der Übung letzte Woche erzählt: sicherung
    fährt jetzt sauber herunter. Großartig.

    Seit dem Sturm hängt harness (das NAS, 198.51.100.142) an derselben USV
    wie sicherung, im Büroschrank. Aber es weiß nichts von der USV: Am
    Dienstag ist es mit dem Strom gestorben, und seine Platten haben die
    Nacht damit verbracht, sich selbst zu prüfen. Die Haftungsverzichte
    liegen darauf, wir müssen sie fünf Jahre aufbewahren.

    Haruto hat mal gesagt, das NAS könnte auf sicherung hören: sicherung
    spricht über USB mit der USV und könnte die Neuigkeiten übers Netz
    weitergeben. Ich weiß nicht, wie. Auf harness ist nut-client installiert,
    nichts konfiguriert. Du kannst mit deinem Schlüssel per ssh von
    sicherung auf harness; sudo geht dort auch.

    Eins weiß ich: harness braucht lange zum Anhalten. Erst Samba, dann
    leert es den Cache seiner Platten. Rechne mit zweieinhalb Minuten.

    Die Halle ist geschlossen: Du darfst heute Abend wieder üben.

    Akosua

## Events

down-in-order-event-listen-restart =
    upsd.conf hat seine neue LISTEN-Zeile, aber upsd lauscht immer noch, wo
    er vorher lauschte (ss -tlnp): upsd liest LISTEN nur beim Start. Ein
    reload liest upsd.users und ups.conf neu, das hier nicht: Starte
    nut-server neu.

down-in-order-event-listen =
    upsd lauscht jetzt auch im Büronetz: harness kann ihn auf Port 3493
    erreichen, wenn die Firewall von sicherung es durchlässt.

down-in-order-event-exposed =
    Vorsicht: Aus dem Internet antwortet jetzt Port 3493 auf der öffentlichen
    Adresse von sicherung. upsd verrät allen den Zustand der USV, und mit
    einem erratenen Passwort könnte jemand ein erzwungenes Herunterfahren
    verlangen. Lausche nur auf der Büroadresse, oder lass nur harness durch
    die Firewall.

down-in-order-event-secondary-user =
    harness hat ein Konto in upsd.users. „upsmon secondary“ gibt ihm, was
    ein secondary braucht: sich anmelden und die USV verfolgen, mehr nicht.

down-in-order-event-too-much =
    Ein zweiter „primary“: Ein primary darf FSD setzen und jede Maschine an
    der USV herunterfahren. Nur sicherung, das die USV steuert und sie
    zuletzt abschaltet, darf primary sein; harness folgt als secondary (in
    upsd.users und in der MONITOR-Zeile von harness).

down-in-order-event-firewall =
    Die Firewall von sicherung lässt harness auf 3493 herein.

down-in-order-event-blocked =
    Die Verbindung läuft in einen Timeout: ufw auf sicherung verwirft, was
    nicht erlaubt ist. Erlaube 3493/tcp von harness (man ufw: allow from
    ADRESSE to any port PORT).

down-in-order-event-secondary =
    upsmon auf harness ist auf sicherung bei hallups als secondary
    angemeldet (upsc -c hallups auf sicherung listet zwei Clients). Wenn die
    Batterie zur Neige geht, setzt sicherung FSD, harness sieht es und fährt
    herunter, sicherung wartet, bis es sich abmeldet (HOSTSYNC), bevor es
    selbst herunterfährt.

down-in-order-event-drill-crash =
    Während der Übung hat harness den Strom verloren, als es noch beim
    Herunterfahren war (sein Journal: Der vorherige Boot endet mitten im
    Anhalten; dieser beginnt mit einer Plattenprüfung). Es hat sich sofort
    abgemeldet, also machte sicherung weiter; sicherung hielt in einer
    halben Minute an und sagte dann der USV, ihre Steckdosen nach offdelay
    Sekunden abzuschalten: standardmäßig 20, während harness 150 braucht.
    Gib der USV eine längere Frist, bevor sie abschaltet (man usbhid-ups:
    offdelay, ondelay).

down-in-order-event-ondelay =
    In ups.conf ist ondelay nicht größer als offdelay. usbhid-ups(8): ondelay
    „must be greater“ als offdelay, sonst gibt die USV den Strom nach einer
    Abschaltung vielleicht nicht zurück.

down-in-order-event-not-enabled =
    Nach der Übung ist upsmon auf harness nicht zurückgekommen: nut-monitor
    ist auf harness gestartet, aber nicht aktiviert, also startet ein Boot
    ihn nicht. Bis es jemand merkt, ist harness wieder ungeschützt.

down-in-order-event-end =
    Akosua: „Ich habe während der Übung die Lämpchen des NAS beobachtet: Es
    ging eine gute Minute vor dem Klicken der USV aus, und beide kamen von
    selbst wieder. Die Haftungsverzichte danken dir.“

    Gut gemacht! Du hast „Der Reihe nach“ abgeschlossen.

    WAS PASSIERT IST
    harness teilte sich die USV von sicherung, ohne es zu wissen. Du hast
    upsd auf sicherung im Büronetz lauschen lassen (LISTEN, nur beim Start
    gelesen), harness ein secondary-Konto und eine eigene MONITOR-Zeile
    gegeben, 3493 nur für harness geöffnet und seinen nut-monitor aktiviert.
    Die erste Übung zeigte die letzte Falle: sicherung wartete, bis harness
    sich abmeldete, aber harness meldet sich ab, sobald es mit dem
    Herunterfahren beginnt, und braucht zweieinhalb Minuten; die USV schaltete
    ihre Steckdosen 20 Sekunden nach dem Anhalten von sicherung ab. Ein
    längeres offdelay (und ein noch größeres ondelay) gibt jeder Maschine
    Zeit zum Anhalten.

    GUTE PRAXIS
    - Ein primary pro USV: die Maschine, die mit ihr verkabelt ist, zuletzt
      anhält und der USV sagt, dass sie abschalten soll. Die anderen sind
      secondaries über das Netz.
    - Öffne upsd für die Maschinen, die ihn brauchen, nicht für die Welt:
      LISTEN auf der internen Adresse und eine Firewall-Regel von jedem
      secondary.
    - Miss die Zeit, die die langsamste Maschine zum Herunterfahren braucht,
      und setze offdelay darüber, mit Reserve; prüfe, dass die Batterie bei
      schwacher Ladung so lange hält (battery.runtime.low,
      battery.charge.low).
    - Aktiviere die Dienste und beweise es dann mit einer Übung: Was beim
      Booten nicht gestartet wird, schützt nach dem ersten Ausfall nichts.

    EIN ANDERER WEG
    Ein secondary kann sich früher als bei schwacher Batterie selbst
    herunterfahren, mit upssched (ein Timer nach ONBATT): Langsame Maschinen
    gehen dann zuerst, und die Batterie bleibt für die anderen.

    DOKUMENTATION
    - upsd.conf(5): https://networkupstools.org/docs/man/upsd.conf.html
    - upsd.users(5): https://networkupstools.org/docs/man/upsd.users.html
    - upsmon(8), der Ablauf des Herunterfahrens: https://networkupstools.org/docs/man/upsmon.html
    - usbhid-ups(8), offdelay und ondelay: https://networkupstools.org/docs/man/usbhid-ups.html
    - nut.conf(5): https://networkupstools.org/docs/man/nut.conf.html
