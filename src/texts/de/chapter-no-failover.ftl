### Story "The Blood Drive", chapter "The Failover That Didn't Happen":
### haproxy died on lb1 but keepalived kept the virtual address there.
### keepalived.conf, vrrp_script, track_script, weight, nopreempt,
### systemctl reload, ip a, journalctl. Commands, options, paths and outputs
### are not translated.

chapter-no-failover = Die Umschaltung, die nicht stattfand
    .summary = Zwei Load Balancer, eine virtuelle Adresse, und trotzdem ist die Buchungs-Site für Spender·innen seit dem Morgengrauen tot. Finde heraus, warum der Ersatz nicht übernommen hat, bring keepalived bei, was es überwachen soll, und beweise, dass die Umschaltung wirklich funktioniert.

## Files

no-failover-message-zainab =
    Von: Zainab (Spenderservice)
    Montag, 13. Mai, 7:40
    
    Guten Morgen, und willkommen beim Blutspendedienst Lindental!
    
    Unsere Spenderinnen und Spender buchen ihre Termine auf
    donate.lindenvale.example, und seit etwa sieben Uhr heute Morgen kann es
    niemand: die Seite lädt nicht einmal. Montagmorgen ist unsere vollste
    Zeit, und die Thrombozytenvorräte sind knapp.
    
    Bastien hat uns immer gesagt, die Site könne nicht ausfallen: es gibt
    zwei Load Balancer, lb1 und lb2, „und wenn einer stirbt, übernimmt der
    andere in einer Sekunde“. Offensichtlich stimmt damit etwas nicht. Er
    hat uns im März verlassen; seine Notizen liegen in deinem
    Home-Verzeichnis.
    
    Du bist auf lb1; von hier aus erreichst du lb2 und die Webserver (web1,
    web2, web3) mit ssh, und sudo funktioniert mit deinem Passwort.
    
    Bitte bring die Buchungen zurück, und sorg dafür, dass das nicht wieder
    passieren kann.
    
    Zainab
no-failover-note-bastien =
    Notizen von Bastien (Load Balancer)
    
    - lb1 (192.0.2.104) und lb2 (192.0.2.105) teilen sich 192.0.2.108, die
      Adresse, auf die donate.lindenvale.example zeigt. keepalived (VRRP)
      legt sie auf den Master; lb1 ist der Master, lb2 das Backup.
      /etc/keepalived/keepalived.conf auf jedem.
    - Hinter der Adresse schickt HAProxy auf jedem Load Balancer die
      Anfragen an web1, web2 und web3 (/etc/haproxy/haproxy.cfg, dieselbe
      Datei auf beiden).
    - Wenn lb1 stirbt, nimmt lb2 die Adresse innerhalb von drei oder vier
      Sekunden. 2029 getestet, indem ich das Stromkabel von lb1 gezogen
      habe. Funktioniert super.
    - ip a zeigt, wer die Adresse hält. journalctl -u keepalived sagt
      warum.
    
    Bastien

## Events

no-failover-event-haproxy-dead =
    haproxy ist auf lb1 tot: sein Worker ist um 6:58 abgebrochen, systemd
    hat ihn viermal neu gestartet, und nach fünf Fehlschlägen in zehn
    Sekunden aufgegeben („Start request repeated too quickly“). Warum hat
    lb2 dann nicht übernommen? Schau, wer 192.0.2.108 hält.
no-failover-event-vip-on-lb1 =
    lb1 hält immer noch 192.0.2.108 (die „secondary“-Adresse auf eth0), und
    lb1 hat kein haproxy: die Anfragen der Spender·innen erreichen eine
    Maschine, auf der nichts auf Port 80 lauscht. Vergleiche mit lb2 (ssh
    lb2), dann lies die keepalived.conf von lb1: was überwacht keepalived?
no-failover-event-no-tracking =
    keepalived überwacht nur keepalived. Bastiens Test (das Stromkabel
    ziehen) funktionierte, weil die ganze Maschine verstummte; aber hier
    lebt lb1 und schickt weiter seine VRRP-Advertisements, also hat lb2
    keinen Grund zu übernehmen. keepalived muss von haproxy wissen: ein
    vrrp_script, das es prüft, und ein track_script in der Instanz (man
    keepalived.conf).
no-failover-event-restart-only =
    haproxy läuft wieder auf lb1, und die Spender·innen können buchen. Aber
    am Design hat sich nichts geändert: das nächste Mal, wenn haproxy
    stirbt, bleibt die Adresse wieder auf lb1, und die Site fällt aus, mit
    einem völlig gesunden lb2 daneben. Bring keepalived bei, haproxy zu
    überwachen.
no-failover-event-both-master =
    „state MASTER“ auf beiden Nodes mit derselben Priorität macht weder
    zwei Master noch eine bessere Umschaltung: der Zustand ist nur, wo eine
    Instanz startet. Die Wahl benutzt die Priorität, und bei Gleichstand
    gewinnt die höhere Adresse. Und es sagt immer noch nichts über haproxy.
no-failover-event-edited-not-loaded =
    Die Datei hat ein track_script, aber das laufende keepalived benutzt
    noch die Konfiguration, die es beim Start gelesen hat: lade es neu
    (systemctl reload keepalived), damit es sie neu liest.
no-failover-event-tracking =
    Das keepalived von lb1 führt jetzt deine Prüfung aus. Mit totem haproxy
    scheitert die Prüfung: beobachte journalctl -u keepalived auf lb1
    („VRRP_Script(…) failed“, dann die Priorität oder den Zustand FAULT),
    und ip a auf beiden Nodes.
no-failover-event-stuck =
    Die Prüfung von lb1 scheitert, seine Priorität ist gefallen, aber er ist
    immer noch der Master: lb2 hört die Advertisements von lb1 mit einer
    niedrigeren Priorität und übernimmt nicht. Darf lb2 präemptieren? Mit
    nopreempt nimmt ein Backup die Adresse nie einem Master weg, der noch
    Advertisements schickt, egal mit welcher Priorität. Lass lb2
    entweder präemptieren, oder gib der Prüfung ein Gewicht von 0 (eine
    gescheiterte Prüfung setzt den Node in FAULT: er hört auf, Advertisements
    zu schicken).
no-failover-event-failed-over =
    Die Adresse ist umgezogen: lb2 hält 192.0.2.108, und sein haproxy
    bedient die Spender·innen (schau dir curl auf die Site an, und
    /var/log/haproxy.log auf lb2). Das ist die Umschaltung, die das Design
    um 6:58 hätte machen sollen. Jetzt bring haproxy auf lb1 zurück.
no-failover-event-haproxy-back-preempt =
    haproxy läuft wieder auf lb1, seine Prüfung gelingt, seine Priorität
    liegt wieder über der von lb2, und lb1 hat die Adresse zurückgenommen
    (Präemption, der Standard). Eine zweite Umschaltung, ein paar verlorene
    Verbindungen: manche ziehen nopreempt vor (state BACKUP auf beiden),
    damit die Adresse bis zum nächsten Ausfall bleibt, wo sie ist. Beides
    ist gültig; wähle bewusst.
no-failover-event-haproxy-back-stays =
    haproxy läuft wieder auf lb1, aber die Adresse bleibt auf lb2
    (nopreempt): keine zweite Umschaltung, keine umsonst verlorenen
    Verbindungen. Sie zieht beim nächsten Ausfall wieder um. Beide
    Entscheidungen sind gültig; wähle bewusst.
no-failover-event-lb2-tracked =
    lb2 überwacht auch sein eigenes haproxy: eine Umschaltung funktioniert
    in beide Richtungen, egal welcher Node der Master ist.
no-failover-event-end =
    Zainab: „Die Buchungen strömen herein, und Teodor sagt, die Spender·innen
    vom Morgen haben schon ihre Bestätigungsmails bekommen. Danke!“
    
    Gut gemacht! Du hast „Die Umschaltung, die nicht stattfand“
    abgeschlossen.
    
    WAS PASSIERT IST
    haproxy ist auf lb1 um 6:58 gestorben (ein Absturz, den systemd nicht
    neu starten konnte). lb1 selbst ging es gut, und keepalived überwacht
    nur, ob sein Partner lebt: lb1 schickte weiter Advertisements, lb2
    wartete weiter, und die Adresse blieb auf einer Maschine, die nichts
    auslieferte. Du hast keepalived ein vrrp_script gegeben, das haproxy
    prüft, von der Instanz auf beiden Nodes verfolgt, es neu geladen,
    zugesehen, wie die Adresse zu lb2 zog, haproxy auf lb1 zurückgebracht
    und geprüft, dass das Ganze funktioniert.
    
    GUTE PRAXIS
    - Redundanz deckt ab, was überwacht wird. Ein VRRP-Paar weiß nur, dass
      der andere Node lebt: sag keepalived, was der Dienst braucht
      (vrrp_script, track_script).
    - Das Gewicht muss das Ergebnis ändern: die Priorität des scheiternden
      Masters muss unter die des Backups fallen (101 - 20 < 100), oder
      nimm Gewicht 0 (FAULT).
    - nopreempt auf einem Backup und eine gewichtete Prüfung passen nicht
      zusammen: ein Master, der noch Advertisements schickt, wird nie
      verdrängt.
    - Den Ausfall testen, den du fürchtest (der Dienst stoppt), nicht nur
      den, der leicht zu simulieren ist (ein Stromkabel).
    - Den Dienst neu zu starten repariert heute; das Design repariert das
      nächste Mal.
    
    DOKUMENTATION
    - keepalived.conf(5): https://www.keepalived.org/manpage.html
    - Die Dokumentation von keepalived: https://keepalived.readthedocs.io/en/latest/
    - VRRP (RFC 3768): https://www.rfc-editor.org/rfc/rfc3768
