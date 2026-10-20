### Story "On Call", chapter 6 "The Post-Mortem": finding the facts in
### the logs (journalctl --since/--until, last, apt) and writing a
### blameless post-mortem. Commands, paths and tool messages are not
### translated. The section titles of the template (post-mortem-section-…)
### must stay the same as in the template.

chapitre-post-mortem = The Post-Mortem
    .resume = Sunday night, Théo was on call and the live broadcast cut out: write down what happened, with the facts from the logs and without looking for someone to blame.

## Files

post-mortem-message-de-zoe =
    A message from Zoé (Monday, 9:40 a.m.):

    "On Sunday night, Théo was on call: the live broadcast cut out, and he
    fixed it. For the association, we write a post-mortem: what
    happened, why, and what we change. Blameless: we're not looking for
    someone at fault, we're looking for what made the outage possible.

    Can you write it? The template is in postmortem.md (nano). Théo left
    his notes (notes_theo.txt), but he was half asleep: check the times
    in the logs. I'll reread it every time you save."
post-mortem-notes-theo =
    Théo's notes (Sunday, 3:10 a.m.):

    Woken by the phone, I don't remember what time, around 2:30?
    The relay had gone down, around 2:20 I think. journalctl said an unknown
    option in flux.conf, line 7 (bitrate_max). I commented it out,
    restarted it, and it came back.

    What I don't understand: why did the relay restart in the middle of
    the night? Nobody was logged in.
post-mortem-modele =
    # Post-mortem: live broadcast outage, night of 11 to 12 September 2027

    Blameless: we look for what made the outage possible, not for someone at fault.

    ## Summary
    (to be completed: two or three sentences)

    ## Timeline
    (to be completed: the times, checked in the logs)

    ## Impact
    (to be completed: how long, for whom)

    ## Causes
    (to be completed: what triggered the outage, and what made it possible)

    ## What went well
    (to be completed)

    ## Actions
    (to be completed: one "-" line per action)
post-mortem-conf-flux =
    # Radio Quartier: stream relay (the radio-flux service)
    port = 8000
    mount = /direct
    logfile = /var/log/radio/flux.log
    loglevel = info
    record_dir = /srv/radio/shows
    #bitrate_max = 192    # Théo, 12/09: unknown option, commented out
    stats_dir = /srv/radio/stats
post-mortem-unattended-conf =
    // Security updates, installed automatically every night
    // (apt-daily-upgrade.timer). needrestart then restarts the services
    // that use an updated library.
    Unattended-Upgrade::Origins-Pattern {"{"}
            "origin=Debian,codename=bookworm,label=Debian-Security";
    {"}"};
    Unattended-Upgrade::Automatic-Reboot "false";
post-mortem-apt-history =
    Start-Date: 2027-09-05  02:11:52
    Commandline: /usr/bin/unattended-upgrade
    Upgrade: tzdata:amd64 (2027a-0+deb12u1, 2027b-0+deb12u1)
    End-Date: 2027-09-05  02:11:58

    Start-Date: 2027-09-12  02:12:44
    Commandline: /usr/bin/unattended-upgrade
    Upgrade: libssl3:amd64 (3.0.15-1~deb12u1, 3.0.15-1~deb12u2), openssl:amd64 (3.0.15-1~deb12u1, 3.0.15-1~deb12u2)
    End-Date: 2027-09-12  02:13:04
post-mortem-unattended-dpkg =
    Log started: 2027-09-12  02:12:45
    (Reading database ... 41213 files and directories currently installed.)
    Preparing to unpack .../libssl3_3.0.15-1~deb12u2_amd64.deb ...
    Unpacking libssl3:amd64 (3.0.15-1~deb12u2) over (3.0.15-1~deb12u1) ...
    Setting up libssl3:amd64 (3.0.15-1~deb12u2) ...
    Processing triggers for libc-bin (2.36-9+deb12u9) ...

    Restarting services...
     systemctl restart radio-flux.service
    Log ended: 2027-09-12  02:13:04

## What the game checks in the post-mortem

# The section titles (as in the template, without "##").
post-mortem-section-resume = Summary
post-mortem-section-chronologie = Timeline
post-mortem-section-impact = Impact
post-mortem-section-causes = Causes
post-mortem-section-marche = What went well
post-mortem-section-actions = Actions
# The beginning of the template lines to replace.
post-mortem-a-completer = (to be completed
# Words, one of which must appear in "Causes" (comma-separated, lowercase).
post-mortem-mots-declencheur = unattended, upgrade, apt, needrestart, update, updating
post-mortem-mots-origine = august, aug 20, 20 aug, 20/08, 08/20, 2027-08-20
# Words that look for someone to blame (the post-mortem must avoid them).
# (Not "fault" or "blame" alone: they are inside "default" and "blameless".)
post-mortem-mots-reproche = at fault, to blame, guilty, negligence, negligent, careless, should have, incompetent, théo's mistake, theo's mistake, zoé's mistake, zoe's mistake, théo's fault, theo's fault, zoé's fault, zoe's fault

post-mortem-relecture = Zoé rereads your post-mortem:
# { $mot }: the word that looks for someone to blame
post-mortem-reproche = "{ $mot }": we're looking for what made the outage possible, not who caused it. Nobody acted wrongly; it's the system (the tools, the habits) that we improve. Could you rephrase?
post-mortem-manque-modele = There are still "(to be completed)" lines from the template.
post-mortem-manque-chronologie = The timeline must give, checked in the logs, the time of the outage, of the first alert and of the live broadcast's return (journalctl --since … --until …, the alert's mail).
post-mortem-manque-impact = The impact: how many minutes of silence for the listeners?
post-mortem-manque-cause = The causes: what restarted the relay in the middle of the night (apt's history, /var/log/unattended-upgrades), and the configuration error that stopped it from starting again.
post-mortem-manque-origine = And how long had that error been waiting in flux.conf? The log keeps a record of commands run with sudo.
post-mortem-manque-actions = At least two actions, one per "-" line.
post-mortem-manque-marche = The summary, and what went well (there are things!).

## Events

post-mortem-evenement-notes =
    Théo's notes give leads, not facts: "around 2:30?", "around 2:20 I
    think". The logs, on the other hand, are accurate to the second
    (journalctl --since "2027-09-12 02:00" --until "2027-09-12 03:30").
    And who logged in that night? (last)
post-mortem-evenement-redemarrage =
    Just before the relay went down, apt-daily-upgrade started: the
    night's automatic update. What did it install, and what did it do
    next? (/var/log/apt/history.log, /var/log/unattended-upgrades)
post-mortem-evenement-origine =
    On 20 August, Zoé changed flux.conf… without restarting the relay,
    which kept running with the old configuration. The error waited three
    weeks for the first restart. It's nobody's fault: nothing checked the
    configuration after a change.
post-mortem-evenement-fin =
    Zoé: "Perfect. I'll read it at Thursday's meeting, and we'll get
    started on the actions. Thank you for these nights; you've made this
    radio a place where outages teach us something."

    Well done! You have finished On Call.

    WHAT HAPPENED
    An automatic security update (unattended-upgrades) restarted the relay
    at 2:13 a.m. (needrestart). It couldn't start again: an unknown option
    (bitrate_max) had been waiting in its configuration since 20 August,
    never checked nor applied. The probe alerted at 2:15, Théo fixed it
    at 2:58: 45 minutes of silence.

    GOOD PRACTICE
    - Facts first: the logs (journalctl --since/--until, last, apt's
      history), not memories.
    - Blameless: look for the conditions that made the outage possible
      (a configuration never checked, a restart at night), not someone at
      fault; otherwise, nobody talks about their mistakes any more.
    - Concrete actions, with who and when: check the configuration before
      restarting (ExecStartPre=), restart after every change, wake the
      person on call more loudly…
    - Share the post-mortem: that's how the whole team learns.

    DOCUMENTATION
    - Postmortem culture (Google SRE): https://sre.google/sre-book/postmortem-culture/
    - journalctl: https://www.freedesktop.org/software/systemd/man/latest/journalctl.html
    - unattended-upgrades: https://wiki.debian.org/UnattendedUpgrades
