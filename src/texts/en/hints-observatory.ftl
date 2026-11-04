### The graduated hints of the story "The Observatory": a lead, then almost
### the answer, for each step (see src/engine/hints.ts).

## Chapter 1 — Heavy Load

hint-heavy-load-load =
    .lead = How busy is the machine? (man uptime: the load average; man nproc: how many CPUs)
    .solution = uptime gives a load of about 9; nproc says 2 CPUs: seven processes are waiting for a CPU at any moment.
hint-heavy-load-workers =
    .lead = Who is taking the CPU? (man top, man ps)
    .solution = top: eight stack-worker processes of jules, each at about 22 %, and the gallery (node) at the same share.
hint-heavy-load-end =
    .lead = Give the workers a lower priority, all of them, without stopping them (man renice: -n, -p, -u). Then time the gallery as Amara does.
    .solution = sudo renice -n 19 -u jules, then curl -s -o /dev/null -w '%{"{"}time_total{"}"}\n' http://localhost:8080/

## Chapter 2 — The Quota

hint-quota-measure =
    .lead = How much CPU does the stacking take this morning, nice or not? (man top, man systemd-cgtop)
    .solution = top: the eight workers at NI 19 take almost all of both CPUs; systemd-cgtop shows stacking.service near 200 %.
hint-quota-end =
    .lead = Nice doesn't cap: systemd can limit a service's CPU time (man systemd.resource-control: CPUQuota=). 40 % of two CPUs is how many percent of ONE?
    .solution = sudo systemctl set-property stacking CPUQuota=80% (applied at once, kept on disk), then systemd-cgtop.

## Chapter 3 — Too Many Open Files

hint-too-many-files-emfile =
    .lead = What does the gallery say when the archive fails? (man journalctl: -u)
    .solution = journalctl -u gallery: "Error: EMFILE: too many open files".
hint-too-many-files-limits =
    .lead = What is the limit of the gallery's process, not your shell's? (man proc: /proc/PID/limits; man prlimit)
    .solution = cat /proc/840/limits: Max open files 1024 (soft), 524288 (hard). Or sudo prlimit --pid 840 --nofile.
hint-too-many-files-end =
    .lead = A service gets its limits from systemd, when it starts (man systemd.exec: LimitNOFILE=).
    .solution = sudo systemctl edit gallery: {"["}Service] LimitNOFILE=4096; then sudo systemctl restart gallery, and curl -i http://localhost:8080/archive.

## Chapter 4 — The Stuck Process

hint-stuck-process-stuck =
    .lead = Which processes make up the copy, and who started whom? (man ps: -ef, the PPID column)
    .solution = ps -ef: /bin/bash /usr/local/bin/sync-photos (3301), and its child rsync (3302).
hint-stuck-process-ignored =
    .lead = kill sends TERM. Does the script accept it? Read it (cat /usr/local/bin/sync-photos), and look for the signals nothing can ignore (man 7 signal).
    .solution = The script has trap '' INT TERM HUP: sudo kill -KILL 3301 (or kill -9).
hint-stuck-process-end =
    .lead = After KILL: what's left of the copy, and what did the script not have time to clean up? (ps -ef, the script's LOCK)
    .solution = sudo kill on the remaining rsync, check with ps -p 3301 that the script is gone, then sudo rm /run/sync-photos.pid.
