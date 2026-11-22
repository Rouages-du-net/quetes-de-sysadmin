### Story "The Blood Drive", chapter "The Failover That Didn't Happen":
### haproxy died on lb1 but keepalived kept the virtual address there.
### keepalived.conf, vrrp_script, track_script, weight, nopreempt,
### systemctl reload, ip a, journalctl. Commands, options, paths and outputs
### are not translated.

chapter-no-failover = The Failover That Didn't Happen
    .summary = Two load balancers, one virtual address, and still the donors' booking site has been down since dawn. Find out why the spare didn't take over, teach keepalived what it should watch, and prove the failover really works.

## Files

no-failover-message-zainab =
    From: Zainab (donor services)
    Monday 13 May, 7:40

    Good morning, and welcome to the Lindenvale Blood Service!

    Our donors book their appointments on donate.lindenvale.example, and
    since about seven this morning nobody can: the page doesn't even load.
    Monday morning is our busiest time, and the platelet stocks are low.

    Bastien always told us the site couldn't go down: there are two load
    balancers, lb1 and lb2, "and if one dies, the other takes over in a
    second". Clearly something is wrong with that. He left us in March;
    his notes are in your home directory.

    You are on lb1; you can reach lb2 and the web servers (web1, web2,
    web3) with ssh from here, and sudo works with your password.

    Please get the bookings back, and make sure this can't happen again.

    Zainab

no-failover-note-bastien =
    Notes from Bastien (load balancers)

    - lb1 (192.0.2.104) and lb2 (192.0.2.105) share 192.0.2.108, the
      address donate.lindenvale.example points to. keepalived (VRRP) puts
      it on the master; lb1 is the master, lb2 the backup.
      /etc/keepalived/keepalived.conf on each.
    - Behind the address, HAProxy on each load balancer sends the
      requests to web1, web2 and web3 (/etc/haproxy/haproxy.cfg, the same
      file on both).
    - If lb1 dies, lb2 takes the address within three or four seconds.
      Tested it in 2029 by pulling lb1's power cable. Works great.
    - ip a shows who holds the address. journalctl -u keepalived says
      why.

    Bastien

## Events

no-failover-event-haproxy-dead =
    haproxy is dead on lb1: its worker aborted at 6:58, systemd restarted
    it four times, and after five failures in ten seconds it gave up
    ("Start request repeated too quickly"). So why didn't lb2 take over?
    Look at who holds 192.0.2.108.
no-failover-event-vip-on-lb1 =
    lb1 still holds 192.0.2.108 (the "secondary" address on eth0), and lb1
    has no haproxy: the donors' requests reach a machine where nothing
    listens on port 80. Compare with lb2 (ssh lb2), then read lb1's
    keepalived.conf: what does keepalived watch?
no-failover-event-no-tracking =
    keepalived only watches keepalived. Bastien's test (pulling the power
    cable) worked because the whole machine went silent; but here lb1 is
    alive and keeps sending its VRRP advertisements, so lb2 has no reason
    to take over. keepalived must know about haproxy: a vrrp_script that
    checks it, and a track_script in the instance (man keepalived.conf).
no-failover-event-restart-only =
    haproxy runs again on lb1 and the donors can book. But nothing has
    changed in the design: the next time haproxy dies, the address stays
    on lb1 again, and the site goes down with a perfectly healthy lb2 next
    to it. Teach keepalived to watch haproxy.
no-failover-event-both-master =
    "state MASTER" on both nodes with the same priority doesn't make two
    masters, nor a better failover: the state is only where an instance
    starts. The election uses the priority, and a tie goes to the higher
    address. And it still says nothing about haproxy.
no-failover-event-edited-not-loaded =
    The file has a track_script, but the running keepalived still uses the
    configuration it read when it started: reload it (systemctl reload
    keepalived) so that it reads it again.
no-failover-event-tracking =
    lb1's keepalived now runs your check. With haproxy dead, the check
    fails: watch journalctl -u keepalived on lb1 ("VRRP_Script(…) failed",
    then the priority or the FAULT state), and ip a on both nodes.
no-failover-event-stuck =
    lb1's check fails, its priority dropped, but it is still the master:
    lb2 hears lb1's advertisements with a lower priority and doesn't take
    over. Is lb2 allowed to preempt? With nopreempt, a backup never takes
    the address from a master that still advertises, whatever its
    priority. Either let lb2 preempt, or give the check a weight of 0 (a
    failed check puts the node in FAULT: it stops advertising).
no-failover-event-failed-over =
    The address moved: lb2 holds 192.0.2.108 and its haproxy serves the
    donors (look at curl on the site, and at lb2's /var/log/haproxy.log).
    That is the failover the design should have done at 6:58. Now bring
    haproxy back on lb1.
no-failover-event-haproxy-back-preempt =
    haproxy runs again on lb1, its check succeeds, its priority is back
    above lb2's, and lb1 took the address back (preemption, the default).
    A second switch, a few lost connections: some prefer nopreempt (state
    BACKUP on both) so that the address stays where it is until the next
    failure. Both are valid; choose knowingly.
no-failover-event-haproxy-back-stays =
    haproxy runs again on lb1, but the address stays on lb2 (nopreempt):
    no second switch, no connections lost for nothing. It will move again
    at the next failure. Both choices are valid; choose knowingly.
no-failover-event-lb2-tracked =
    lb2 watches its own haproxy too: a failover works in both directions,
    whichever node is the master.
no-failover-event-end =
    Zainab: "The bookings are pouring in, and Teodor says the morning's
    donors already got their confirmation emails. Thank you!"

    Well done! You finished The Failover That Didn't Happen.

    WHAT HAPPENED
    haproxy died on lb1 at 6:58 (a crash systemd couldn't restart). lb1
    itself was fine, and keepalived only watches whether its peer is alive:
    lb1 kept advertising, lb2 kept waiting, and the address stayed on a
    machine that served nothing. You gave keepalived a vrrp_script that
    checks haproxy, tracked by the instance on both nodes, reloaded it,
    watched the address move to lb2, brought haproxy back on lb1, and
    checked the whole thing works.

    GOOD PRACTICE
    - Redundancy covers what is watched. A VRRP pair only knows the other
      node is alive: tell keepalived what the service needs (vrrp_script,
      track_script).
    - The weight must change the outcome: the failing master's priority
      must fall below the backup's (101 - 20 < 100), or use weight 0 (FAULT).
    - nopreempt on a backup and a weighted check don't go together: a
      master that still advertises is never preempted.
    - Test the failure you fear (the service stopping), not only the one
      that is easy to simulate (a power cable).
    - Restarting the service fixes today; the design fixes the next time.

    DOCUMENTATION
    - keepalived.conf(5): https://www.keepalived.org/manpage.html
    - keepalived's documentation: https://keepalived.readthedocs.io/en/latest/
    - VRRP (RFC 3768): https://www.rfc-editor.org/rfc/rfc3768
