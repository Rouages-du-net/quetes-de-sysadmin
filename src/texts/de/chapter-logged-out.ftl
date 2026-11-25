### Geschichte „Der Wanderverein“, Kapitel „Abgemeldet“: ein rootless
### Container, der mit der Sitzung seines Benutzers gestorben ist. Der
### Dienstmanager des Benutzers (user@UID.service), Linger (loginctl
### enable-linger), Quadlet (.container-Dateien, systemctl --user) und ein
### Neustart als Beweis. Befehle, Optionen, Pfade und Ausgaben werden nicht
### übersetzt.

chapter-logged-out = Abgemeldet
    .summary = Die App des Vereins lief rootless, bis sich die Ehrenamtliche, die sie gestartet hatte, abgemeldet hat: Die Website ist mit ihrer Sitzung untergegangen. Mach daraus einen Dienst ihres eigenen Kontos, der niemanden angemeldet braucht und einen Neustart übersteht.

## Files

logged-out-message-ayasha =
    Von: Ayasha
    Mittwoch, 14. April, 09:05

    Hallo!

    Danke für Montag! Gestern Nachmittag wollte ich es selbst ausprobieren.
    Ich habe mich von meinem PC aus als trailbook angemeldet (ssh
    trailbook@zaunstieg: mein Schlüssel ist in seinen authorized_keys),
    deinen Container entfernt und meinen gestartet, derselbe Befehl, mit dem
    Namen trailbook. Die Website hat funktioniert. Ich habe mich um 18:02
    abgemeldet, und um 18:02 ist die Website ausgefallen: nginx antwortet
    seitdem mit 502.

    Der Container lebt also nur, solange jemand als trailbook angemeldet
    ist? So kann man doch keine Dienste betreiben. Wir brauchen:
      - Trailbook läuft, ohne dass jemand angemeldet ist;
      - und kommt nach einem Neustart von selbst wieder. Das Kernel-Update
        wartet sowieso auf einen (/var/run/reboot-required): Bitte starte
        zaunstieg neu, wenn du fertig bist, damit wir es wissen.

    Die Podman-Leute scheinen etwas namens Quadlet zu empfehlen. Weiter als
    bis zum Namen bin ich nicht gekommen.

    Dein sudo-Passwort hat sich nicht geändert: serpentine-27.

    Ayasha

## Events

logged-out-event-logout =
    Da ist es, um 18:02: Ayashas Sitzung schließt sich, und logind hält
    user@997.service an, den eigenen Dienstmanager von trailbook, mit allem
    darin. Ein rootless Container, der aus einer Sitzung gestartet wird,
    lebt in diesem Manager (podman legt sein conmon in einen Scope darunter).
    Wenn die letzte Sitzung des Kontos endet, bleibt der Manager nur, wenn
    das Konto lingert (man loginctl). Und selbst dann: Wer würde den
    Container nach einem Neustart wieder starten?
logged-out-event-nohup =
    nohup schützt einen Prozess nur vor dem Hangup-Signal, wenn sich sein
    Terminal schließt. Das hat Trailbook nicht angehalten: logind hat den
    Manager von trailbook angehalten, und alles in seiner cgroup mit ihm.
    Und nach einem Neustart startet nichts den Container wieder. Ein
    Container, der laufen bleiben muss, ist ein Dienst: Der Weg von Podman
    ist Quadlet (man podman-systemd.unit).
logged-out-event-root-unit =
    Eine System-Unit, die podman für trailbook ausführt (sudo -u, oder
    User=), bringt den Starter als root zurück, und sie kämpft gegen
    Podman: keine Benutzersitzung, also kein cgroup-Manager von systemd (die
    Warnungen), conmon außer Sicht der Unit, kein sauberes Anhalten. Lass
    den eigenen Manager von trailbook ihn ausführen: eine Quadlet-Datei in
    seinem Home-Verzeichnis, und das Konto lingert. Dann entferne diese Unit
    (systemctl disable --now, dann die Datei).
logged-out-event-generate =
    podman generate systemd funktioniert noch, ist aber veraltet (es sagt
    es): Es schreibt eine Unit für einen Container, der schon existieren
    muss. Podman 5 empfiehlt Quadlet: Du beschreibst den Container in einer
    {"."}container-Datei, und der Generator von systemd schreibt die Unit bei
    jedem daemon-reload.
logged-out-event-quadlet-error =
    Quadlet hat die Datei abgelehnt: Seine Meldung nennt den Schlüssel und
    die Gruppe. Die Schlüssel von [Container] stehen alle in man
    podman-systemd.unit, und du kannst die Datei ohne systemd testen:
    /usr/libexec/podman/quadlet -dryrun -user (als trailbook).
logged-out-event-quadlet =
    Der Manager von trailbook hat aus der .container-Datei einen Dienst
    erzeugt (systemctl --user cat zeigt ihn: podman run mit --replace, --rm
    und --sdnotify=conmon, unter dem Namen der Unit). Ist er gestartet? Und
    wird er beim Booten mit dem Manager starten? Dafür ist ein
    {"["}Install]-Abschnitt mit WantedBy=default.target in der .container-Datei
    da.
logged-out-event-no-bus =
    systemctl --user spricht mit dem Manager des Kontos über seinen Bus,
    gefunden über $XDG_RUNTIME_DIR, das ein Login setzt (pam_systemd) und
    sudo nicht. Gib es an (export XDG_RUNTIME_DIR=/run/user/$(id -u)),
    sobald der Manager läuft, oder frag von deinem eigenen Konto aus: sudo
    systemctl --user -M trailbook@ …. Und der Manager muss laufen: Ohne
    Sitzung hält ihn nur Linger am Leben.
logged-out-event-generated =
    Eine Unit, die Quadlet erzeugt, lässt sich nicht aktivieren: Es gibt
    keine Datei zum Verlinken, sie wird bei jedem daemon-reload neu
    geschrieben. Ihr [Install]-Abschnitt gehört in die .container-Datei: Mit
    WantedBy=default.target lässt der Generator den Manager sie starten,
    wann immer der Manager startet.
logged-out-event-linger =
    trailbook lingert: Sein Manager (user@997.service) startet beim Booten
    und bleibt ohne jede Sitzung (/var/lib/systemd/linger/trailbook). Jetzt
    muss der Container eine seiner Units werden.
logged-out-event-not-wanted =
    Die Unit läuft, aber nichts wird sie beim nächsten Booten starten: Ihre
    {"."}container-Datei hat keinen [Install]-Abschnitt mit
    WantedBy=default.target.
logged-out-event-unit-running =
    Trailbook läuft als Dienst des Managers von trailbook. Ayasha hat um den
    Beweis gebeten: Starte zaunstieg neu (der Kernel wartet darauf),
    verbinde dich wieder und prüf die Website.
logged-out-event-rebooted =
    zaunstieg wurde neu gestartet, und die Website antwortet nicht. Schau
    dir an, was zurückgekommen ist: Läuft der Manager von trailbook
    (systemctl status user@997), hat er die Unit gestartet (journalctl -u
    user@997 -b), lingert das Konto, ist die Unit von default.target
    gewollt?
logged-out-event-end =
    Ayasha: „Ich habe mich angemeldet, abgemeldet, und die Wanderungen waren
    noch da. Dann der Neustart, und immer noch da. Der Samstag kann kommen!“

    Gut gemacht! Du hast „Abgemeldet“ abgeschlossen.

    WAS PASSIERT IST
    Ayasha hat Trailbook aus einer ssh-Sitzung als trailbook gestartet:
    podman hat den Container in den Dienstmanager des Kontos gelegt,
    user@997.service, den logind mit ihrer Sitzung gestartet und mit ihr
    angehalten hat, Container inbegriffen. Du hast den Container in einer
    Quadlet-Datei beschrieben,
    ~/.config/containers/systemd/trailbook.container; bei daemon-reload, und
    wann immer der Manager startet, macht der Generator von Podman daraus
    trailbook.service. Mit WantedBy=default.target in seinem
    {"["}Install]-Abschnitt startet der Manager ihn von selbst. loginctl
    enable-linger trailbook lässt logind den Manager beim Booten starten und
    ihn ohne jede Sitzung behalten. Der Neustart hat die ganze Kette
    bewiesen.

    GUTE PRAXIS
    - Ein rootless Dienst ist eine Benutzer-Unit seines Kontos: Quadlet, ein
      {"["}Install]-Abschnitt, und das Konto lingert.
    - Sprich mit dem Manager eines Benutzers über eine echte Sitzung, mit
      gesetztem $XDG_RUNTIME_DIR, oder von root aus mit systemctl --user -M
      KONTO@.
    - Sein Journal steht in dem des Systems (Systemkonten): journalctl -u
      user@997, oder journalctl --user-unit trailbook.
    - Teste eine .container-Datei mit /usr/libexec/podman/quadlet -dryrun
      -user.
    - Beweise es: Ein Neustart, den du gewählt hast, schlägt einen
      Stromausfall, den du nicht gewählt hast.

    EIN ANDERER WEG
    Eine von Hand geschriebene Benutzer-Unit (~/.config/systemd/user/) kann
    podman auch ausführen, und podman generate systemd hat früher eine
    geschrieben; beides ist schwerer richtig hinzubekommen (das Aufräumen
    des Containers, der Typ notify), und Podman 5 erklärt Letzteres für
    veraltet. Quadlet schreibt diese Details für dich.

    DOKUMENTATION
    - podman-systemd.unit(5): https://docs.podman.io/en/v5.4.2/markdown/podman-systemd.unit.5.html
    - loginctl(1), enable-linger: https://www.freedesktop.org/software/systemd/man/latest/loginctl.html
    - logind.conf(5), KillUserProcesses und UserStopDelaySec: https://www.freedesktop.org/software/systemd/man/latest/logind.conf.html
    - systemctl(1), --user und --machine: https://www.freedesktop.org/software/systemd/man/latest/systemctl.html
