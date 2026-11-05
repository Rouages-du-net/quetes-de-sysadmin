### Story "The Huts", chapter 1 "Gathering the Logs": rsyslog as a
### central server (imudp), the firewall, one file per hut, stop.
### Configuration, paths and the tools' outputs are not translated.

chapter-central-logs = Gathering the Logs
    .summary = The three mountain huts send their logs to the valley's server, and nothing arrives. Make the valley listen, let the huts in, and give each hut its own file.

## Files

central-logs-message-lou =
    From:     Lou
    To:       you
    Subject:  The huts' logs

    Hello,

    This spring, I set up the three huts' little machines (hut-lake,
    hut-pass, hut-ridge) to send all their logs to this valley server,
    with one line in their rsyslog: *.* @valley.internal:514 (UDP).

    The idea: read everything here, without climbing to each hut. But
    nothing arrives on valley. Could you see why?

    And when it works, I'd like one file per hut, in /var/log/remote/,
    not everything mixed in the valley's own /var/log/syslog.

    Your sudo password: summit-2028.

    Lou

## Events

central-logs-event-silent =
    Nothing listens on UDP 514 here: in /etc/rsyslog.conf, the module
    that receives syslog over UDP (imudp) and its input are commented
    out, as Debian installs it. A server only receives what it was told to
    listen to.
central-logs-event-restart-needed =
    The configuration file is right, but the running rsyslog read it when
    it started: restart it (sudo systemctl restart rsyslog). Before that,
    sudo rsyslogd -N1 checks the configuration without touching the
    running service.
central-logs-event-listening =
    rsyslog listens on UDP 514 now (ss -ulnp shows it). Are the huts'
    messages getting in, though? Look at what arrives, and at what stands
    between the huts and the port.
central-logs-event-firewall =
    rsyslog listens, but nothing from the huts comes in: ufw only lets SSH
    in, and UDP 514 is dropped before rsyslog sees anything. Let the huts
    in, and only them if you can (man ufw: from … to any port … proto
    udp).
central-logs-event-mixed =
    The huts' messages arrive… in the valley's /var/log/syslog, mixed with
    its own. rsyslog applies every rule that matches, in order: a rule for
    the huts (one file per hut: a template with %HOSTNAME%) must come
    first, and end with stop, so that the default rules don't get them
    too. The files of /etc/rsyslog.d are read before the rules of
    rsyslog.conf.
central-logs-event-config-error =
    rsyslog started with errors in its configuration: its journal says
    which (journalctl -u rsyslog), and so does sudo rsyslogd -N1. The
    faulty rules are ignored.
central-logs-event-end =
    Each hut has its own file now ({ $file }…), and the valley's syslog
    stays the valley's. Lou: "I can see the lake hut's fridge from here.
    Magic."

    Well done! You have finished the chapter "Gathering the Logs".

    WHAT HAPPENED
    The huts sent their logs to valley over UDP, but valley's rsyslog
    didn't listen (imudp commented out), and its firewall dropped UDP 514
    anyway. UDP never complains: the huts had no idea nothing arrived.

    THE CENTRAL SERVER
    - module(load="imudp") and input(type="imudp" port="514") in
      rsyslog.conf (or TCP: imtcp, more reliable).
    - The firewall opened for the senders only.
    - A template with %HOSTNAME% (or %FROMHOST-IP%) for one file per
      machine, and stop so the messages go nowhere else.

    GOOD PRACTICE
    - sudo rsyslogd -N1 after each change, before restarting.
    - Test from the sender: logger "test from the lake hut", then look
      for it on the server.
    - UDP loses messages without saying so: TCP (imtcp, @@server in the
      senders), with a queue, is better for logs that matter.

    DOCUMENTATION
    - imudp: https://www.rsyslog.com/doc/configuration/modules/imudp.html
    - Templates: https://www.rsyslog.com/doc/configuration/templates.html
    - Filters: https://www.rsyslog.com/doc/configuration/filters.html
