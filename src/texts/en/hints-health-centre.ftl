### Graded hints for The Health Centre (see src/engine/hints.ts): one message
### per step, hint-<chapter>-<event>, with .lead (a direction, without the
### exact command) and .solution (almost the answer).

## Chapter 1 — The Cold Start

hint-cold-start-list =
    .lead = Ask libvirt for every domain, the stopped ones too (man virsh, list).
    .solution = virsh list --all
hint-cold-start-autostart-off =
    .lead = Before starting it, look at the stopped domain's details: does it start with the host?
    .solution = virsh dominfo ledger
hint-cold-start-paused =
    .lead = Start the domain, and watch its state a few seconds later.
    .solution = virsh start ledger, then virsh list
hint-cold-start-no-space =
    .lead = Why is it paused? virsh can say the reason and the disk's error; and look at the host's file systems.
    .solution = virsh domstate ledger --reason; virsh domblkerror ledger; df -h /var
hint-cold-start-chain =
    .lead = Which images make up ledger's disk? qemu-img can follow a backing chain, and must not lock an image in use (man qemu-img, -U).
    .solution = sudo qemu-img info -U --backing-chain /var/lib/libvirt/images/ledger.before-upgrade; virsh snapshot-list ledger
hint-cold-start-room =
    .lead = Merging needs room. Ilse's note and Priya's message name an image nothing uses: check nothing uses it, then remove it.
    .solution = sudo ls -lh /var/lib/libvirt/images; sudo rm /var/lib/libvirt/images/ledger-test-clone.qcow2
hint-cold-start-merged =
    .lead = Merge the whole chain into its base while the guest is paused: a block commit of the active layer, pivoted (man virsh, blockcommit).
    .solution = virsh blockcommit ledger vda --active --pivot --verbose
hint-cold-start-cleaned =
    .lead = The overlays are out of the chain but still on disk, and libvirt still lists the snapshots: remove both (snapshot-delete has an option for metadata only).
    .solution = sudo rm /var/lib/libvirt/images/ledger.before-*; virsh snapshot-delete ledger before-upgrade --metadata (and the two others)
hint-cold-start-resumed =
    .lead = The guest is still paused: wake it up.
    .solution = virsh resume ledger
hint-cold-start-autostart =
    .lead = Make it come back with the host next time (man virsh, autostart).
    .solution = virsh autostart ledger
hint-cold-start-ssh =
    .lead = Check it from inside: connect to it.
    .solution = ssh ledger
hint-cold-start-end =
    .lead = Check the whole picture: ledger running, autostart, one image, /var with room.
    .solution = virsh list --all; virsh dominfo ledger; virsh domblklist ledger; df -h /var

## Chapter 2 — The Wrong Side

hint-wrong-side-nat-seen =
    .lead = On which network is portal's interface? (man virsh, domiflist)
    .solution = virsh domiflist portal
hint-wrong-side-unreachable =
    .lead = Try from where it matters: the reception PC (ssh reception), with the address Hamid gives.
    .solution = ssh reception, then curl http://192.168.122.47/
hint-wrong-side-config-bridge =
    .lead = The other guests are on the host's bridge (virsh domiflist agenda). Change portal's definition so that its interface is of type bridge, on br0 (man virsh, edit).
    .solution = virsh edit portal: <interface type='bridge'> and <source bridge='br0'/>
hint-wrong-side-bridged =
    .lead = A new definition applies when the domain starts again, not at a guest reboot.
    .solution = virsh shutdown portal; virsh list --all (shut off); virsh start portal
hint-wrong-side-reception-ok =
    .lead = Check from the reception PC, by its name in the office's DNS.
    .solution = ssh reception, then curl http://portal.internal/
hint-wrong-side-clash-seen =
    .lead = Compare the copy's interface with the original's.
    .solution = virsh domiflist agenda; virsh domiflist agenda-training
hint-wrong-side-new-mac =
    .lead = The copy needs a MAC of its own: stop it, and remove its mac line from its definition (libvirt makes a new one), or use virt-clone.
    .solution = virsh shutdown agenda-training; virsh edit agenda-training (delete the <mac address=…/> line); virsh start agenda-training
hint-wrong-side-new-id =
    .lead = Inside the copy, /etc/machine-id is agenda's: empty it and let systemd make a new one (man systemd-machine-id-setup). Check the prompt: ssh lands on whichever answers.
    .solution = ssh agenda-training; sudo rm /etc/machine-id; sudo systemd-machine-id-setup
hint-wrong-side-separate =
    .lead = The DHCP client asks for its address at boot.
    .solution = sudo reboot in the copy (or virsh reboot agenda-training); virsh domifaddr agenda-training --source arp
hint-wrong-side-end =
    .lead = Check from the reception: the appointment book should always be the real one.
    .solution = ssh reception; curl http://agenda.internal/ (twice)

## Chapter 3 — The Tight Fit

hint-tight-fit-swap =
    .lead = Is hearth short of memory? Look at its RAM and its swap.
    .solution = free -h
hint-tight-fit-memstat =
    .lead = What does each guest get, and what does it really use? (man virsh, dominfo, dommemstat)
    .solution = virsh dominfo records; virsh dommemstat records
hint-tight-fit-memory-fixed =
    .lead = Give records less memory, now and at its next start (man virsh, setmem: --live, --config).
    .solution = virsh setmem records 6G --live --config
hint-tight-fit-guest-full =
    .lead = Look at records' disk from inside.
    .solution = ssh records; df -h /
hint-tight-fit-snapshot =
    .lead = Grace wants a way back before you touch the disk (man virsh, snapshot-create-as).
    .solution = virsh snapshot-create-as records before-grow
hint-tight-fit-grown =
    .lead = Grow the image while records runs, through QEMU (man virsh, blockresize); or shut it down and use qemu-img resize.
    .solution = virsh blockresize records vda 40G
hint-tight-fit-partition =
    .lead = Inside records, the disk is bigger; its partition isn't (lsblk; man growpart).
    .solution = sudo growpart /dev/vda 1
hint-tight-fit-filesystem =
    .lead = The partition is bigger; now the file system (man resize2fs).
    .solution = sudo resize2fs /dev/vda1; df -h /
hint-tight-fit-cleaned =
    .lead = It worked: the safety net can go, and so can the old one nobody will use.
    .solution = virsh snapshot-list records; virsh snapshot-delete records before-grow; virsh snapshot-delete records before-trixie
hint-tight-fit-end =
    .lead = Check: no swap on hearth, room on records, no snapshot left.
    .solution = free -h; virsh snapshot-list records; ssh records, then df -h /
