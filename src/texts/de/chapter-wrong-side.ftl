### Story "The Health Centre", chapter "The Wrong Side": a guest on
### libvirt's NAT network is unreachable from the office; a copy made by
### hand shares its original's MAC address and machine-id. virsh domiflist,
### net-dhcp-leases, edit, attach-interface, domifaddr, virt-clone,
### systemd-machine-id-setup. Commands, options, paths and outputs are not
### translated.

chapter-wrong-side = Die falsche Seite
    .summary = Das neue Patientenportal funktioniert auf dem Hypervisor, und nirgends sonst. Und seit gestern zeigt das Terminbuch des Empfangs manchmal eine Schulungskopie statt der echten Termine. Finde heraus, auf welcher Seite der Bridge jede virtuelle Maschine steht, und gib einer von Hand gemachten Kopie eine eigene Identität.

## Files

wrong-side-message-grace =
    Von: Grace (Praxisleitung)
    Dienstag, 26. März, 9:10
    
    Zwei Probleme heute Morgen, fürchte ich.
    
    1. Hamid hat letzte Woche portal eingerichtet, die virtuelle Maschine
    für das Terminportal der Patientinnen und Patienten. Er sagt, es
    funktioniert „auf herd“, aber am Empfang öffnet sich nichts. Er hat
    eine Notiz auf dem PC des Empfangs hinterlassen (ssh reception).
    
    2. Seit gestern Nachmittag zeigt das Terminbuch des Empfangs (agenda)
    manchmal „TRAINING COPY“ und Beispielpatienten statt der Termine von
    heute, dann wieder die echten. Hamid hat gestern eine Kopie von agenda
    gemacht, um am Donnerstag die zwei neuen Empfangskräfte zu schulen: sie
    brauchen sie noch, aber nicht statt der echten!
    
    Grace
wrong-side-note-hamid =
    Notiz von Hamid (Empfang)
    
    Das Portal: ich habe es auf herd mit virt-install installiert, alle
    Optionen auf Standard. Auf herd zeigt curl http://192.168.122.47/ das
    Portal. Hier, im Browser des Empfangs, nichts.
    
    Die Schulungskopie: ich habe agenda.qcow2 nach agenda-training.qcow2
    kopiert, virsh dumpxml agenda > training.xml gemacht, den Namen und die
    Platte geändert, und virsh define sagte, die uuid gibt es schon, also
    habe ich die uuid-Zeile gelöscht. Dann virsh start, und drinnen habe ich
    ihren Hostnamen in agenda-training geändert. Es funktioniert!
    
    Hamid

## Events

wrong-side-event-nat-seen =
    Die Schnittstelle von portal hängt am Netzwerk namens „default“: dem
    NAT-Netzwerk von libvirt, einer privaten Bridge (virbr0,
    192.168.122.0/24), die nur innerhalb von herd existiert. Seine Gäste
    können hinaus (herd maskiert sie), aber keine Maschine des Büros kann
    herein: es gibt nirgends eine Route nach 192.168.122.0/24 außer auf
    herd. Prüfe es vom PC des Empfangs aus: ssh reception.
wrong-side-event-unreachable =
    Vom Empfang aus gesehen: nichts. Seine Pakete für 192.168.122.47 gehen
    an den Router des Büros, der von diesem Netzwerk nie gehört hat. Die
    anderen Gäste (agenda, ledger, records) haben eine Adresse im Netzwerk
    des Büros: wie sind sie angeschlossen? virsh domiflist agenda, und
    /etc/network/interfaces auf herd.
wrong-side-event-nat-hack =
    Eine DNAT-Regel auf herd würde einen Port an portal weiterleiten… bis
    libvirt seine eigenen Regeln neu schreibt (das tut es, wenn sein
    Netzwerk neu startet), und portal wäre für alles andere immer noch
    unsichtbar (ssh, die Überwachung). Der Gast braucht keine Tür in herd:
    er muss selbst im Netzwerk des Büros sein, wie agenda.
wrong-side-event-promisc =
    Der Promiscuous-Modus lässt eine Schnittstelle jeden Frame empfangen,
    auch die, die nicht an sie adressiert sind. Eine Bridge tut schon, was
    sie muss: br0 ist nicht das Problem, portal ist einfach nicht daran
    angeschlossen.
wrong-side-event-config-bridge =
    Die Definition von portal legt ihre Schnittstelle jetzt auf br0. Der
    laufende Gast hat sich nicht geändert: QEMU läuft noch mit seiner alten
    Definition (virsh dumpxml portal zeigt die laufende, --inactive die
    nächste). Eine Änderung der Definition greift, wenn die Domain wieder
    startet: ein vollständiger Stopp, dann ein Start.
wrong-side-event-reboot-only =
    virsh reboot startet den Gast im selben QEMU-Prozess neu: dieselbe
    laufende Definition, dasselbe NAT-Netzwerk. Um eine neue Definition
    anzuwenden, muss die Domain stoppen und wieder starten (virsh shutdown,
    auf „shut off“ warten, virsh start). Oder ändere den laufenden Gast
    auch, mit detach-interface und attach-interface --live --config.
wrong-side-event-bridged =
    portal ist auf br0, und das DHCP des Büros hat ihm eine Adresse
    gegeben: { $address }. Jetzt probiere es dort, wo es zählt: am PC des
    Empfangs.
wrong-side-event-reception-ok =
    Der Empfang erreicht portal: im Netzwerk des Büros ist es eine Maschine
    wie die anderen, mit seinem Namen im DNS des Büros (portal.internal).
wrong-side-event-clash-seen =
    agenda-training hat genau die MAC-Adresse von agenda, an derselben
    Bridge. Zwei Maschinen, die für eine MAC antworten: die Bridge und die
    Tabellen der Nachbarn folgen dem, der zuletzt gesprochen hat, und der
    Empfang bekommt mal die eine, mal die andere. Das XML von Hand zu
    kopieren hat die MAC kopiert; die Platte zu kopieren hat auch alles
    darin kopiert. virt-clone gibt einem Klon eine neue MAC und eine neue
    uuid; drinnen braucht die Kopie trotzdem eine eigene Identität.
wrong-side-event-original-changed =
    Das ist agenda, die du geändert hast, das echte Terminbuch: ihre MAC
    oder ihre machine-id. Der Empfang und das DHCP des Büros kennen agenda
    daran (192.0.2.90). Die Kopie muss sich ändern, nicht das Original: setz
    agenda wieder so, wie sie war.
wrong-side-event-new-mac =
    agenda-training hat eine eigene MAC-Adresse in ihrer Definition. Eine
    Identität bleibt zu reparieren: was in der Platte steckt. Vorsicht: ssh
    landet auf der Maschine, die gerade antwortet; lies den Prompt.
wrong-side-event-same-ip =
    Eine neue MAC, und immer noch dieselbe Adresse: 192.0.2.90 für beide.
    Das DHCP des Büros kennt einen Client an seinem Client Identifier, und
    systemd-networkd leitet ihn aus /etc/machine-id ab, die sich die
    kopierte Platte mit agenda teilt. Gib der Kopie ihre eigene machine-id
    (man machine-id, man systemd-machine-id-setup), dann einen Neustart.
wrong-side-event-new-id =
    agenda-training hat eine eigene machine-id. Bei ihrem nächsten Start
    fragt sie das DHCP unter ihrem eigenen Namen nach einer Adresse.
wrong-side-event-separate =
    agenda-training ist eine eigene Maschine: ihre MAC, ihre machine-id,
    ihre Adresse ({ $address }). agenda behält 192.0.2.90.
wrong-side-event-end =
    Grace: „Der Empfang kann Patientinnen und Patienten über das Portal
    buchen, und das Terminbuch bleibt das Terminbuch. Hamid will jetzt
    virt-clone lernen!“
    
    Gut gemacht! Du hast „Die falsche Seite“ abgeschlossen.
    
    WAS PASSIERT IST
    portal wurde mit dem Standardnetzwerk von virt-install installiert: dem
    NAT-Netzwerk von libvirt, das nur innerhalb von herd existiert. Du
    hast seine Schnittstelle auf die Bridge br0 des Hosts verlegt, es
    gestoppt und gestartet, und das DHCP des Büros hat ihm eine Adresse
    gegeben, die alle erreichen. agenda-training, von Hand kopiert, hatte
    die MAC-Adresse von agenda und, in ihrer Platte, die machine-id von
    agenda: dieselbe MAC an der Bridge, derselbe DHCP Client Identifier,
    dieselbe Adresse. Du hast der Kopie ihre eigene MAC und ihre eigene
    machine-id gegeben und das Original in Ruhe gelassen.
    
    GUTE PRAXIS
    - NAT (das Standardnetzwerk) für einen Gast, den niemand erreichen muss;
      eine Bridge ins LAN für einen Server. virsh domiflist sagt dir,
      welches.
    - Eine Änderung in der Definition einer Domain greift bei ihrem
      nächsten Start, nicht bei einem Neustart des Gasts. virsh dumpxml
      zeigt, was läuft, --inactive, was laufen wird.
    - Mit virt-clone klonen (neue uuid, neue MAC, die Platte kopiert), die
      Quelle ausgeschaltet; dann das Innere vorbereiten: virt-sysprep, oder
      zumindest eine leere /etc/machine-id und ein neuer Hostname.
    - Zwei Maschinen mit einer MAC-Adresse oder einer machine-id: Symptome,
      die kommen und gehen. Zuerst nach Duplikaten suchen.
    - Keine Löcher in den Hypervisor bohren (DNAT), um einen Gast zu
      erreichen, der ins LAN gehört.
    
    DOKUMENTATION
    - Domain-XML, Netzwerkschnittstellen: https://libvirt.org/formatdomain.html#network-interfaces
    - Netzwerke in libvirt: https://wiki.libvirt.org/Networking.html
    - Eine Bridge unter Debian: https://wiki.debian.org/KVM#Setting_up_bridge_networking
    - machine-id: https://www.freedesktop.org/software/systemd/man/latest/machine-id.html
    - virt-clone: https://github.com/virt-manager/virt-manager/blob/main/man/virt-clone.rst
