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
