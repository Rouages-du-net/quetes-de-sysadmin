### Story "The Bastion", chapter "Hardening": turn password logins off for
### good (the drop-in that wins), a default-deny firewall that survives a
### reboot, and deploy given back by key. Commands, paths and options are
### not translated.

chapter-hardening = Hardening
    .summary = Turn password logins off for good, a firewall that denies by default and survives a reboot, and give Selma her account back, by key only.

## Files

hardening-email-nadia =
    From:     Nadia
    To:       you
    Subject:  Monday

    Selma would like to deploy this afternoon. Can she, safely? And how do
    we make sure this can't happen again? The host asks what we've changed.

    Nadia

hardening-incident =
    # Incident — oven (deliveries)

    ## Cleaned (14/04)
    Crontab, key, /tmp/.cache, server.js restored from the signed release.

    ## Why it was possible
    - Passwords accepted on ssh, yet sshd_config says "no".
    - No firewall: every port open, the app's 3000 too.

    ## Lessons (to do)
    - Passwords off, for real.
    - Firewall: deny by default, open only what's needed, and keep it
      after a reboot (/etc/iptables/rules.v4).
    - deploy back for Selma, by key only.

## Events

hardening-event-looked =
    sshd -T says "passwordauthentication yes", while sshd_config says no.
    sshd_config starts with an Include of sshd_config.d/*.conf, and for
    each keyword, the first value read wins: the drop-in, read first, wins.
hardening-event-not-reloaded =
    The files now say no, but sshd still applies the configuration it read
    at its last start or reload: reload ssh (systemctl).
hardening-event-passwords =
    Password logins are off in the configuration sshd applies: only keys
    open a session now.
hardening-event-locked-out =
    Careful: with these rules, your next ssh connection would be refused.
    Your current session is safe, but accept port 22 before you log out.
hardening-event-no-loopback =
    The policy drops by default, but nothing accepts the loopback (lo):
    nginx reaches the app on 127.0.0.1, and that would be dropped too. The
    first rule of a default-deny firewall usually lets lo through.
# { $port }: the app's port
hardening-event-firewall =
    Default-deny is in place: lo, the replies to the server's own
    connections, ssh, http and https are accepted; the rest is dropped,
    including { $port }, which was open to the world.
hardening-event-saved =
    The rules are saved in /etc/iptables/rules.v4: iptables-persistent
    loads them again at boot. Without it, a reboot would have given
    everything back to the world.
hardening-event-deploy =
    deploy is usable again, and with passwords off, only Selma's key opens
    it.
hardening-event-end =
    Nadia: "I've sent the host your notes. They say it's the first time
    someone answers them with a timeline."

    Well done! You have finished the chapter "Hardening" and the story "The
    Bastion".

    WHAT HAPPENED
    The way in was a drop-in left "for a while": a single line in
    sshd_config.d, read before sshd_config, that accepted passwords again.
    You turned them off for real, closed every port that didn't need to be
    open with a default-deny firewall saved for the next boot, and gave
    Selma her account back, by key only.

    GOOD PRACTICE
    - Check what applies, not what you believe: sshd -T for ssh, iptables
      -L or nmap from outside for the firewall.
    - A temporary exception needs an end date and someone to remove it:
      write it in the file itself, and in a reminder.
    - Default-deny, then open what's needed: lo, the replies (ESTABLISHED,
      RELATED), then each service. And save it, or the next reboot undoes
      it.
    - Close the incident with a write-up: what happened, when, what was
      done, what changes. incident.md is ready to send.

    ANOTHER WAY
    fail2ban (seen in "The sentinel") would have banned 203.0.113.66 after a
    few failures. ufw writes the same iptables rules with simpler commands,
    and nftables is their successor. And a review of the drop-ins
    (sshd_config.d, sudoers.d…) belongs in the weekly watch from "The
    Watch".

    DOCUMENTATION
    - sshd_config (Include, first value): https://man.openbsd.org/sshd_config
    - iptables: https://man7.org/linux/man-pages/man8/iptables.8.html
    - iptables-save: https://man7.org/linux/man-pages/man8/iptables-save.8.html
    - iptables on Debian (iptables-persistent): https://wiki.debian.org/iptables
    - NIST SP 800-61r2, post-incident activity: https://csrc.nist.gov/pubs/sp/800/61/r2/final
