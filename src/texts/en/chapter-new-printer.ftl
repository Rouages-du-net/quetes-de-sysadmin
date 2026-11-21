### Story "The Staff Room", chapter "The New Printer": a driverless queue
### for the staff room's MFP, the school's default, shared with the staff
### only; the reception's old LaserJet and its driver. lpadmin, lpinfo,
### driverless, cupsd.conf's Location blocks. Commands, options, paths and
### outputs are not translated.

chapter-new-printer = The New Printer
    .summary = The staff room's new multifunction printer has arrived, and the old reception LaserJet wants a second life. Add both to CUPS, the modern way when you can, the old way when you must, and make sure the pupils' Chromebooks stay on their side.

## Files

new-printer-message-ines =
    From: Ines (school office)
    Wednesday 28 November, 13:30

    Hello!

    The new multifunction printer for the staff room is plugged in (the
    delivery note is in your folder). Could you add it on chalk, and make
    it the default printer for everyone? The staff should print on it
    from their PCs and Macs, as they do on the office printer.

    But careful: it's for the staff only. The library's Chromebooks see
    the library printer, and that's all they should see. I don't want
    the pupils' "creations" coming out in the staff room.

    And the reception would like the old HP LaserJet 4250 back: it works
    perfectly, it's just old. It's plugged in too.

    Ines

new-printer-delivery-note =
    DELIVERY NOTE

    1 x RICOH IM C3010 multifunction printer (colour, A4/A3)
    Installed in: Staff room
    Network: staff VLAN, address 198.51.100.21 (mfp-staffroom.internal)
    Printing: IPP Everywhere / AirPrint / Mopria certified (driverless),
    port 631, path /ipp/print. No driver needed for recent systems.

    Old printer reconnected: HP LaserJet 4250, address 198.51.100.22
    (laserjet-reception.internal). Network printing: raw port 9100 (JetDirect).

## Events

new-printer-event-discover =
    The MFP announces itself on the network (DNS-SD, the .local names):
    IPP Everywhere, the standard behind driverless printing. CUPS asks it
    for its capabilities over IPP and makes the PPD itself: lpadmin's -m
    everywhere, no driver to install (man lpadmin).
new-printer-event-not-enabled =
    The queue exists but is disabled and rejects jobs: lpadmin creates a
    new queue that way, unless -E comes after -p (before -p, -E means
    "encrypt the connection"). cupsenable and cupsaccept work too.
new-printer-event-added =
    The { $queue } queue is ready, driverless. Is it the default the
    staff's computers will see (lpstat -d)? And who can reach it: a look
    at cupsd.conf's <Location /> would be wise.
new-printer-event-lpoptions-only =
    lpoptions -d set your own default printer, in ~/.cups/lpoptions: it
    changes nothing for the server, nor for the staff's computers. The
    server's default is lpadmin's -d.
new-printer-event-default =
    The MFP is the server's default destination: the staff's computers
    will offer it first.
new-printer-event-pupil-printed =
    Ines: "Thirty pages of game skins just came out in the staff room!"

    A Chromebook printed on the MFP. cupsd.conf shares everything with
    "Allow @LOCAL" in <Location />, and @LOCAL means every network chalk
    has an interface on: ip -br addr shows three, the pupils' VLAN among
    them, for the library's printer. New queues are shared by default
    (DefaultShared). Who sends what: /var/log/cups/access_log.
new-printer-event-remote-any =
    "Allow all": now anyone who can reach port 631 may print, from any
    network. That's the opposite of what Ines asked. A Location can name
    networks (Allow 198.51.100.0/24, Allow @IF(eth1)) and a queue can name
    its users (lpadmin -u allow:@staff).
new-printer-event-not-applied =
    cupsd.conf changed, but cupsd still runs with the configuration it
    read at start. cupsd -t checks the file; a restart (or cupsctl, which
    restarts it) applies it.
new-printer-event-staff-blocked =
    Now the staff can't print on the MFP either: a staff PC is refused
    (the access_log shows 403 or client-error-not-possible). Shared, open
    to the staff network: both are needed.
new-printer-event-library-broken =
    The library's Chromebooks can no longer print on the library printer:
    the restriction is too wide. Restrict the staff room's queue, not the
    whole server.
new-printer-event-printers-conf =
    printers.conf edited while cupsd runs: cupsd will write over it, and a
    queue without its PPD in /etc/cups/ppd prints raw. lpadmin is the tool
    for queues.
new-printer-event-restricted =
    The staff print on the MFP, the Chromebooks are refused (403 in the
    access_log, or client-error-not-authorized), and they still print in
    the library. Now the old LaserJet.
new-printer-event-everywhere-refused =
    "IPP Everywhere driver requires an IPP connection": the LaserJet 4250
    (2004) only knows raw port 9100, socket://. CUPS can't ask it anything:
    it needs a PPD, a description of the printer, and the filters behind
    it. lpinfo -m lists the drivers installed; HP's are in a Debian
    package (apt search hpcups).
new-printer-event-raw =
    A raw queue sends the document as it is: the LaserJet doesn't
    understand PDF. And CUPS says it: raw queues are deprecated. It needs
    a driver.
new-printer-event-hpcups =
    printer-driver-hpcups is installed: lpinfo -m now knows the LaserJet
    4250 (lpinfo -m | grep 4250).
new-printer-event-old-added =
    The reception's LaserJet has its queue, with { $model }. CUPS warns
    that printer drivers are deprecated: CUPS 3 will only print
    driverless, and old printers will need a Printer Application.
new-printer-event-end =
    Ines: "The staff room prints, the reception prints, and the library's
    Chromebooks only see the library. Perfect!"

    Well done! You finished The New Printer.

    WHAT HAPPENED
    The MFP speaks IPP Everywhere: the { $queue } queue is driverless (-m
    everywhere), enabled at creation (-E after -p), and the server's
    default (lpadmin -d). cupsd.conf shared everything with "Allow
    @LOCAL", and @LOCAL includes the pupils' VLAN, where chalk serves the
    library: you restricted the MFP to the staff, by network or by group,
    and checked who got in through the access_log. The LaserJet only
    speaks port 9100: the { $old } queue uses a PPD, HP's from
    printer-driver-hpcups or a generic one.

    GOOD PRACTICE
    - Driverless first (IPP Everywhere, AirPrint, Mopria): no driver to
      maintain, and the only way CUPS 3 will print.
    - lpadmin -p NAME -E -v URI -m everywhere: -E after -p.
    - @LOCAL means every network the server has an interface on: list
      them (ip -br addr) before you trust it.
    - Restrict by network in a <Location /printers/NAME> (who can connect),
      by user with lpadmin -u (who can print; the user name comes from the
      client, unless the server authenticates).
    - Never Allow all; never edit printers.conf while cupsd runs.
    - Old printers: the vendor's driver package, or a generic PPD, until a
      Printer Application replaces it.

    DOCUMENTATION
    - lpadmin: https://www.cups.org/doc/man-lpadmin.html
    - lpinfo: https://www.cups.org/doc/man-lpinfo.html
    - Printer sharing: https://www.cups.org/doc/sharing.html
    - cupsd.conf (Location, Allow, Order): https://www.cups.org/doc/man-cupsd.conf.html
    - Driverless printing on Debian: https://wiki.debian.org/CUPSDriverlessPrinting
