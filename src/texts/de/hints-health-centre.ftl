### Graded hints for The Health Centre (see src/engine/hints.ts): one message
### per step, hint-<chapter>-<event>, with .lead (a direction, without the
### exact command) and .solution (almost the answer).


## Chapter 1 — The Cold Start

hint-cold-start-list =
    .lead = Frag libvirt nach jeder Domain, auch den gestoppten (man virsh, list).
    .solution = virsh list --all
hint-cold-start-autostart-off =
    .lead = Bevor du sie startest, schau dir die Details der gestoppten Domain an: startet sie mit dem Host?
    .solution = virsh dominfo ledger
hint-cold-start-paused =
    .lead = Starte die Domain und beobachte ihren Zustand ein paar Sekunden später.
    .solution = virsh start ledger, dann virsh list
hint-cold-start-no-space =
    .lead = Warum ist sie pausiert? virsh kann den Grund und den Fehler der Platte nennen; und schau dir die Dateisysteme des Hosts an.
    .solution = virsh domstate ledger --reason; virsh domblkerror ledger; df -h /var
hint-cold-start-chain =
    .lead = Aus welchen Images besteht die Platte von ledger? qemu-img kann einer Backing-Kette folgen und darf ein benutztes Image nicht sperren (man qemu-img, -U).
    .solution = sudo qemu-img info -U --backing-chain /var/lib/libvirt/images/ledger.before-upgrade; virsh snapshot-list ledger
hint-cold-start-room =
    .lead = Zusammenführen braucht Platz. Ilses Notiz und Priyas Nachricht nennen ein Image, das nichts benutzt: prüfe, dass nichts es benutzt, dann entferne es.
    .solution = sudo ls -lh /var/lib/libvirt/images; sudo rm /var/lib/libvirt/images/ledger-test-clone.qcow2
hint-cold-start-merged =
    .lead = Führe die ganze Kette in ihre Basis zusammen, während der Gast pausiert ist: ein Block Commit der aktiven Schicht, mit Pivot (man virsh, blockcommit).
    .solution = virsh blockcommit ledger vda --active --pivot --verbose
hint-cold-start-cleaned =
    .lead = Die Overlays sind aus der Kette, aber noch auf der Platte, und libvirt listet noch die Snapshots: entferne beides (snapshot-delete hat eine Option nur für die Metadaten).
    .solution = sudo rm /var/lib/libvirt/images/ledger.before-*; virsh snapshot-delete ledger before-upgrade --metadata (und die zwei anderen)
hint-cold-start-resumed =
    .lead = Der Gast ist noch pausiert: weck ihn auf.
    .solution = virsh resume ledger
hint-cold-start-autostart =
    .lead = Sorg dafür, dass sie nächstes Mal mit dem Host zurückkommt (man virsh, autostart).
    .solution = virsh autostart ledger
hint-cold-start-ssh =
    .lead = Prüfe sie von innen: verbinde dich mit ihr.
    .solution = ssh ledger
hint-cold-start-end =
    .lead = Prüfe das ganze Bild: ledger läuft, autostart, ein Image, /var mit Platz.
    .solution = virsh list --all; virsh dominfo ledger; virsh domblklist ledger; df -h /var

## Chapter 2 — The Wrong Side

hint-wrong-side-nat-seen =
    .lead = In welchem Netzwerk ist die Schnittstelle von portal? (man virsh, domiflist)
    .solution = virsh domiflist portal
hint-wrong-side-unreachable =
    .lead = Probiere es dort, wo es zählt: am PC des Empfangs (ssh reception), mit der Adresse, die Hamid angibt.
    .solution = ssh reception, dann curl http://192.168.122.47/
hint-wrong-side-config-bridge =
    .lead = Die anderen Gäste hängen an der Bridge des Hosts (virsh domiflist agenda). Ändere die Definition von portal so, dass ihre Schnittstelle vom Typ bridge ist, an br0 (man virsh, edit).
    .solution = virsh edit portal: <interface type='bridge'> und <source bridge='br0'/>
hint-wrong-side-bridged =
    .lead = Eine neue Definition greift, wenn die Domain wieder startet, nicht bei einem Neustart des Gasts.
    .solution = virsh shutdown portal; virsh list --all (shut off); virsh start portal
hint-wrong-side-reception-ok =
    .lead = Prüfe vom PC des Empfangs aus, über seinen Namen im DNS des Büros.
    .solution = ssh reception, dann curl http://portal.internal/
hint-wrong-side-clash-seen =
    .lead = Vergleiche die Schnittstelle der Kopie mit der des Originals.
    .solution = virsh domiflist agenda; virsh domiflist agenda-training
hint-wrong-side-new-mac =
    .lead = Die Kopie braucht eine eigene MAC: stoppe sie und entferne die mac-Zeile aus ihrer Definition (libvirt macht eine neue), oder nimm virt-clone.
    .solution = virsh shutdown agenda-training; virsh edit agenda-training (die Zeile <mac address=…/> löschen); virsh start agenda-training
hint-wrong-side-new-id =
    .lead = In der Kopie ist /etc/machine-id die von agenda: leere sie und lass systemd eine neue machen (man systemd-machine-id-setup). Prüfe den Prompt: ssh landet bei der Maschine, die antwortet.
    .solution = ssh agenda-training; sudo rm /etc/machine-id; sudo systemd-machine-id-setup
hint-wrong-side-separate =
    .lead = Der DHCP-Client fragt beim Start nach seiner Adresse.
    .solution = sudo reboot in der Kopie (oder virsh reboot agenda-training); virsh domifaddr agenda-training --source arp
hint-wrong-side-end =
    .lead = Prüfe vom Empfang aus: das Terminbuch sollte immer das echte sein.
    .solution = ssh reception; curl http://agenda.internal/ (zweimal)

## Chapter 3 — The Tight Fit

hint-tight-fit-swap =
    .lead = Fehlt herd Speicher? Schau dir sein RAM und seinen Swap an.
    .solution = free -h
hint-tight-fit-memstat =
    .lead = Was bekommt jeder Gast, und was braucht er wirklich? (man virsh, dominfo, dommemstat)
    .solution = virsh dominfo records; virsh dommemstat records
hint-tight-fit-memory-fixed =
    .lead = Gib records weniger Speicher, jetzt und bei seinem nächsten Start (man virsh, setmem: --live, --config).
    .solution = virsh setmem records 6G --live --config
hint-tight-fit-guest-full =
    .lead = Schau dir die Platte von records von innen an.
    .solution = ssh records; df -h /
hint-tight-fit-snapshot =
    .lead = Grace will einen Weg zurück, bevor du die Platte anfasst (man virsh, snapshot-create-as).
    .solution = virsh snapshot-create-as records before-grow
hint-tight-fit-grown =
    .lead = Vergrößere das Image, während records läuft, über QEMU (man virsh, blockresize); oder fahr es herunter und nimm qemu-img resize.
    .solution = virsh blockresize records vda 40G
hint-tight-fit-partition =
    .lead = In records ist die Platte größer; ihre Partition nicht (lsblk; man growpart).
    .solution = sudo growpart /dev/vda 1
hint-tight-fit-filesystem =
    .lead = Die Partition ist größer; jetzt das Dateisystem (man resize2fs).
    .solution = sudo resize2fs /dev/vda1; df -h /
hint-tight-fit-cleaned =
    .lead = Es hat funktioniert: das Sicherheitsnetz kann weg, und das alte, das niemand benutzen wird, auch.
    .solution = virsh snapshot-list records; virsh snapshot-delete records before-grow; virsh snapshot-delete records before-trixie
hint-tight-fit-end =
    .lead = Prüfe: kein Swap auf herd, Platz auf records, kein Snapshot mehr.
    .solution = free -h; virsh snapshot-list records; ssh records, dann df -h /
