### Story "The Blood Drive", chapter "Split Brain": both load balancers
### hold the virtual address after a network change (a firewall that drops
### VRRP on lb2, new routers using the same virtual_router_id). ip a,
### journalctl, tcpdump, nft, virtual_router_id, unicast_peer. Commands,
### options, paths and outputs are not translated.

chapter-split-brain = Split Brain
    .summary = Nach einer Nacht voller Netzwerkarbeiten bricht die Hälfte der Verbindungen der Spender·innen ab. Beide Load Balancer glauben, sie seien zuständig: finde heraus, warum sie sich nicht mehr hören, und gib ihnen wieder eine einzige Stimme.

## Files

split-brain-message-kirsi =
    Von: Kirsi (Netzwerkteam)
    Mittwoch, 5. Juni, 9:20
    
    Hallo,
    
    Letzte Nacht (Dienstag, ab 21:30) haben wir die neuen Edge-Router
    installiert: ein Paar, edge-a (192.0.2.252) und edge-b (192.0.2.253),
    die sich das Gateway 192.0.2.254 mit VRRP teilen, damit das Gateway den
    Ausfall eines Routers übersteht.
    
    Heute Morgen ist das Log der Edge-Router voll mit Zeilen wie diesen:
      arp: 192.0.2.108 moved from 52:54:00:6c:01:04 to 52:54:00:6c:01:05 on vlan20
      arp: 192.0.2.108 moved from 52:54:00:6c:01:05 to 52:54:00:6c:01:04 on vlan20
    
    Zwei Maschinen antworten für 192.0.2.108. Ich bin sicher, es sind
    nicht die Router ;)
    
    Kirsi
split-brain-message-zainab =
    Von: Zainab (Spenderservice)
    
    Spender·innen schreiben, dass die Site „jedes zweite Mal kaputtgeht“:
    die Seite lädt, dann scheitert der nächste Klick, dann geht es wieder.
    Kannst du nachsehen?
    
    Zainab

## Events

split-brain-event-two-masters =
    lb2 hält 192.0.2.108 auch: zwei Master. Das Gateway lernt die MAC der
    Adresse von dem, der zuletzt geantwortet hat, und jeder Wechsel setzt
    die Verbindungen zurück, die auf dem anderen waren. Split Brain: jeder
    Node glaubt, der andere sei weg. Frag keepalived auf jedem, warum
    (journalctl -u keepalived).
split-brain-event-lower-priority =
    lb1 hört die Advertisements von lb2 (Priorität 100, niedriger als seine
    eigene 101) und sagt es ihm jede Sekunde („forcing new election“). Aber
    lb2 benimmt sich, als hätte es nichts gehört. Empfängt lb2 die
    Advertisements von lb1? tcpdump auf lb2 zeigt, was seine Netzwerkkarte
    erreicht (VRRP ist das IP-Protokoll 112).
split-brain-event-on-the-wire =
    Die Advertisements von lb1 erreichen die Netzwerkkarte von lb2: tcpdump
    sieht sie. Aber tcpdump schaut sich Pakete vor der Firewall an,
    keepalived danach. Etwas auf lb2 verwirft sie auf dem Weg hinein: schau
    dir seine Firewall an (nft list ruleset).
split-brain-event-ruleset =
    Die input-Chain der Baseline verwirft alles, was sie nicht erlaubt
    (policy drop), und nichts erlaubt VRRP: Protokoll 112, an 224.0.0.18
    geschickt. lb2 hört lb1 nie, also hat es die Adresse genommen. Lass
    VRRP herein (man nft: ip protocol, ip daddr), jetzt und in
    /etc/nftables.conf.
split-brain-event-stopped =
    Mit gestopptem keepalived auf einem Node gibt es nur einen Master, aber
    auch kein Backup: der nächste Ausfall legt die Site lahm. Der Node muss
    in der Gruppe bleiben und den anderen hören.
split-brain-event-priorities =
    Prioritäten zählen nur zwischen Nodes, die sich hören: solange die
    Firewall von lb2 die Advertisements von lb1 verwirft, ist jeder Node bei
    seiner Wahl allein, und jeder gewinnt sie.
split-brain-event-single-master =
    Wieder ein einziger Master: lb2 hört lb1, sieht eine höhere Priorität
    und ist zu BACKUP zurückgekehrt (es hat die Adresse entfernt). Die
    Verbindungen der Spender·innen brechen nicht mehr ab.
split-brain-event-persisted =
    Und die /etc/nftables.conf von lb2 lässt VRRP auch herein: der nächste
    Neustart der Maschine oder von nftables bringt das Split Brain nicht
    zurück. Sag es Kirsi, damit die Baseline v4 es für lb1 enthält.
split-brain-event-clash =
    Eine andere VRRP-Gruppe teilt sich den Link: edge-a kündigt VRID 51 an
    (Prio 120, Adresse 192.0.2.254), dieselbe virtual_router_id wie dein
    Paar. keepalived verwirft seine Advertisements als „bogus“ (eine andere
    Adressliste), und die Router loggen deine. Dieselbe VRID auf einem Link
    für zwei Gruppen ruft nach Ärger: eine von ihnen muss umziehen, und die
    VRID der Router gehört dem Netzwerkteam.
split-brain-event-vrid-half =
    lb1 und lb2 haben nicht mehr dieselbe virtual_router_id: sie sind jetzt
    in zwei verschiedenen VRRP-Gruppen, und jeder ist Master seiner eigenen.
    Beide Nodes müssen dieselbe VRID benutzen.
split-brain-event-vrid =
    Dein Paar trifft die Gruppe der Router nicht mehr: seine eigene
    virtual_router_id auf beiden Nodes (oder Unicast-Advertisements
    zwischen den beiden).
split-brain-event-end =
    Kirsi: „Das Log der Router ist ruhig, und die Baseline v4 wird VRRP auf
    beiden Load Balancern erlauben. Sorry wegen lb2!“ Zainab: „Die
    Spender·innen schreiben nicht mehr. Danke!“
    
    Gut gemacht! Du hast „Split Brain“ abgeschlossen.
    
    WAS PASSIERT IST
    In der Dienstagnacht hat die Härtungs-Baseline lb2 eine input-Chain
    gegeben, die alles verwarf, was sie nicht erlaubte, VRRP inklusive. lb2
    hörte lb1 nicht mehr und nahm die Adresse auch: zwei Master, ein
    Gateway, dessen ARP-Eintrag zwischen ihnen hin und her schwang, jede
    zweite Verbindung einer Spenderin oder eines Spenders zurückgesetzt. In
    derselben Nacht haben die neuen Edge-Router eine VRRP-Gruppe mit
    derselben VRID gestartet, 51. Du hast die zwei Master gefunden (ip a),
    gesehen, dass die Advertisements von lb1 die Karte von lb2 erreichten
    (tcpdump), aber nicht sein keepalived (nft), VRRP dauerhaft
    hereingelassen und dein Paar von VRID 51 wegbewegt.
    
    GUTE PRAXIS
    - Zwei Master bedeutet, dass die Nodes sich nicht hören: schau dir den
      Weg der Advertisements an (tcpdump auf der Empfangsseite, dann ihre
      Firewall), nicht die Prioritäten.
    - Eine Firewall auf einem VRRP-Node muss Protokoll 112 hereinlassen
      (vom Partner, an 224.0.0.18 oder an die Adresse des Partners mit
      unicast_peer). Dauerhaft speichern.
    - Eine VRID pro Gruppe auf einem Link. Die Nummern mit dem Netzwerkteam
      absprechen, oder unicast_peer benutzen.
    - „Beide Master“ (die Adresse auf beiden Nodes) als eigenen Alarm
      überwachen: Split Brain legt eine Site nicht lahm, es macht sie
      unzuverlässig.
    
    DOKUMENTATION
    - keepalived.conf(5): https://www.keepalived.org/manpage.html
    - nft(8): https://www.netfilter.org/projects/nftables/manpage.html
    - tcpdump(1): https://www.tcpdump.org/manpages/tcpdump.1.html
    - VRRP (RFC 3768): https://www.rfc-editor.org/rfc/rfc3768
