### Story "The Co-op", chapter "The departure": remove all access from a
### volunteer who is leaving, without breaking anything. Commands,
### paths and account names are not translated.

chapitre-depart = The departure
    .resume = Marc is leaving: close his account (for real), remove his key everywhere, his sudo, his session, and keep the backup he was running.

## Files

depart-courriel-awa =
    From:    Awa (coordinator of the grocery co-op)
    To:      you
    Subject: Marc is leaving

    As you know, Marc is moving to Brest at the end of the week.
    He's the one who has looked after the server from the start: thanks for
    taking over! He agrees that we close his access today (he has
    handed everything back, it's just good practice).

    What needs doing, according to him:
    1. his account must no longer let anyone in, in any way (he
       logged in with an SSH key, man usermod);
    2. he must no longer have sudo;
    3. his key is also on the shared deploy account (the one used for
       releases): remove HIS key, but not the others';
    4. he may still be logged in (who);
    5. and above all: he was running "some stuff" under his account. I
       know there's the nightly backup of the till: it must
       keep running! (crontab -l -u marc, as root)

    For sudo, your password is: radish-2027

depart-notes-marc =
    My notes (Marc)

    - The till runs as a service (till.service), under the till account.
    - Releases: through the deploy account (keys in
      /home/deploy/.ssh/authorized_keys: the CI, Lina and me).
    - Backup: my script ~/bin/till-backup.sh, every night at
      2:30 am, in my crontab. Should be redone properly some day…

## Events

depart-evenement-verrou-seul =
    marc's password is locked… but he logged in with an SSH
    key, and usermod -L changes nothing about that. Read man usermod again: to really
    close an account, you also have to expire it (or take away its
    login shell, or its keys).
# { $fichier }: the deploy account's key file
depart-evenement-deploy-vide =
    Watch out: keys are missing from { $fichier }! The CI and Lina
    won't be able to release the till anymore. Only remove Marc's
    line (his key ends with marc@portable). Put the others back: nano, keeping
    the deploy@ci and lina@atelier lines.
depart-evenement-script-perdu =
    Marc's directory is gone, and with it his backup script… and
    tonight's backup won't run (cron ignores the crontab of a
    deleted account).

    Luckily, yesterday's backup contains /home: look in
    /srv/backups (as root). Next time: first look at what
    an account runs, then delete it.
depart-evenement-tache-personnelle =
    The backup is in YOUR crontab. It runs… until the day you, too,
    hand over: that's exactly Marc's trap. A
    co-op task goes in root's crontab (sudo crontab -e), or
    in a file in /etc/cron.d, and its script outside any home
    directory (for example /usr/local/bin).
depart-evenement-sauvegarde =
    The till backup no longer depends on Marc's account: its script
    is outside /home/marc, and it's run by an account that stays.
depart-evenement-ferme =
    Marc can no longer get in: not through his account, not through deploy, no more
    sudo, no more open session.
depart-evenement-fin =
    Everything is closed, nothing is broken. Awa: "Marc says thank you… and
    welcome to the team!"

    Well done! You have finished the chapter "The departure".

    WHAT HAPPENED
    Closing an account isn't a single action. usermod -L only locks
    the password: an SSH key still gets through. You have to expire
    the account (usermod -e 1, or chage -E 0), or take away its shell, or
    delete it. And access also lives elsewhere: a key in a shared
    account, a seat in the sudo group, a session still open,
    scheduled tasks the team depends on.

    GOOD PRACTICE
    - A departure checklist: account (expired or deleted), keys (everywhere,
      including shared accounts), groups (sudo!), sessions (who,
      pkill -u), the account's crontab and services.
    - Look at what an account runs BEFORE deleting it
      (crontab -l -u, ps -u, find / -user).
    - Team tasks don't live in a personal account: the crontab
      of root or of a service account, /etc/cron.d, systemd timers.
    - Even better: one key per person and no shared account, so you
      know who did what, and can remove access without disturbing the others.

    DOCUMENTATION
    - usermod: https://man7.org/linux/man-pages/man8/usermod.8.html
    - userdel: https://man7.org/linux/man-pages/man8/userdel.8.html
    - chage: https://man7.org/linux/man-pages/man1/chage.1.html
