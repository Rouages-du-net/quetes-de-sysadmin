### Story "The Bike Share", chapter "The Threshold": two alerting rules,
### a full disk and an error rate. PromQL (a gauge compared, rate() on
### counters, sum before dividing), rule files, for:, labels and
### annotations, promtool check rules, the alerts' states. Commands,
### options, metric names, PromQL, paths and outputs are not translated.

chapter-threshold = The Threshold
    .summary = Prometheus sees every machine now, but nobody looks at it. Write the two alerts the cooperative needs, a disk filling up and an app answering errors, so that they fire when something is really wrong, and stay quiet the rest of the time.

## Files

threshold-message-ngozi =
    From: Ngozi (bike share cooperative)
    Tuesday 15 May, 9:00

    Good morning,

    Prometheus sees everything now, but nobody looks at it all day long.
    Two alerts, please, in /etc/prometheus/rules/ (prometheus.yml already
    reads rules/*.yml):

    1. A disk with less than 10 % free space, on any of our machines.
       Severity: warning.
    2. The rental app answering errors (5xx) to more than 5 % of its
       requests. Severity: page: that one wakes up whoever is on call.

    Each with a summary: one sentence saying what is wrong, and where.

    Careful: Tomás says the app has short bursts of errors a few times an
    hour (a station reconnecting). They are normal, and must not wake
    anybody up.

    To test your alerts, two things are wrong right now. hub's disk has
    been almost full since last week's backup
    (/var/backups/docks-2029-04.tar.gz, already copied elsewhere: delete
    it once your alert has fired). And see Tomás's note.

    Ngozi

threshold-note-tomas =
    Note from Tomás

    Since this morning's release (2.4.0), about one return in two fails
    with a 500 error (a bug with the docks' battery codes). The fix, 2.4.1,
    is already on saddle (/srv/rental/VERSION); it takes effect when the
    service restarts (on saddle: sudo systemctl restart rental).

    Restart it only once your alert has fired: we want to know that it
    works.

    Tomás

threshold-release-notes =
    rental 2.4.1

    - Fixes the 500 errors on POST /returns when a dock sends a battery
      code (2.4.0).

## Events

threshold-event-disk-query =
    Each file system, with its share of free space. Which one is low? (A
    tmpfs like /run lives in memory: leave it out, with fstype!="tmpfs" or
    mountpoint="/".)
threshold-event-error-query =
    rate() turns a counter into a rate per second, averaged over its window
    ([5m]). To compare the errors with all the requests, divide one rate by
    the other. But which series by which? Look at the labels on each side.
threshold-event-rate-gauge =
    rate() is meant for counters, which only grow (their names end in
    _total). On a gauge like node_filesystem_avail_bytes, it takes every
    drop for a counter reset: nonsense, and Prometheus warns about it
    ("metric might not be a counter"). Compare a gauge's value directly; to
    see where it is heading, deriv() or predict_linear().
threshold-event-raw-counter =
    A rule on a counter's raw value: http_requests_total only grows, from
    the app's start. Once over the threshold, it never comes back down: the
    alert would fire for ever, until the next restart sets it back to zero.
    Alert on its rate().
threshold-event-unsummed =
    This rule divides each series by itself: the 500 series of /returns by
    that same series, so 1, a hundred percent of errors, all the time.
    Add up first, then divide: sum by (job) of the 5xx rate, divided by
    sum by (job) of the rate of every request.
threshold-event-not-errors =
    status!="200" also counts 201 (a rental created) and 404 (an unknown
    station): not the app's errors. Server errors are the 5xx:
    status=~"5..".
threshold-event-no-for =
    Without for:, an alert fires as soon as its expression is true, at a
    single evaluation: each burst of errors (two minutes, a few times an
    hour) would page someone, resolve, then page again. for: 10m asks the
    condition to last before firing; meanwhile the alert is "pending".
threshold-event-disk-rule =
    The disk rule is loaded. Tried on made-up days, it warns for any
    machine with 7 % free, and stays quiet at 12 %. Watch /api/v1/alerts:
    hub's alert should be pending, then firing once its for: has passed
    (sleep makes time pass).
threshold-event-error-rule =
    The error rule is loaded, and holds on made-up days: it fires during a
    lasting incident, and stays quiet through a normal day's bursts.
threshold-event-labels =
    A rule without a severity label or a summary annotation: the
    Alertmanager routes alerts on their labels (severity), and whoever
    receives one reads its summary first. Add both.
threshold-event-pending =
    "pending": the expression is true, and the alert waits for its for: to
    pass before firing. If the condition stops meanwhile, it goes back to
    inactive, and nobody hears about it.
threshold-event-disk-firing =
    hub's disk alert is firing. As Ngozi said, the old backup can go now
    (on hub: /var/backups/docks-2029-04.tar.gz).
threshold-event-photos =
    Ngozi: "The stations' photos! They prove each bike's state when it was
    returned... I've put them back from the off-site copy." The file to
    delete was the old backup, in /var/backups.
threshold-event-disk-resolved =
    Space freed: at the next evaluation the expression is false, and the
    alert resolves (Prometheus keeps telling the Alertmanager for a while,
    so that the "resolved" reaches everyone).
threshold-event-restart-early =
    Tomás: "The errors have stopped, thanks! But we never saw the alert
    fire. Is the rule ready for next time?" It still has to hold on
    made-up days: /api/v1/rules shows what is loaded.
threshold-event-error-firing =
    The error alert is firing: the errors have lasted longer than its for:.
    Now the fix: restart rental on saddle.
threshold-event-error-resolved =
    The app runs 2.4.1; its error rate is back to normal, and the alert
    resolves once the bad minutes have left its window.
threshold-event-end =
    Ngozi: "Both alerts work, and they know when to keep quiet. Next week:
    making sure they reach someone, at the right time."

    Well done! You finished The Threshold.

    WHAT HAPPENED
    You turned two questions into PromQL. The disk:
    node_filesystem_avail_bytes / node_filesystem_size_bytes < 0.10, a gauge
    compared directly. The errors: the rate of the 5xx over the rate of all
    requests, each added up first, > 0.05. In a rule file, with a for: (how
    long the condition must hold), a severity label and a summary; then
    promtool check rules, a reload, and you watched the alerts go pending,
    firing, and resolve after each fix.

    GOOD PRACTICE
    - Alert on what users feel (errors, a full disk), with a threshold and
      a duration.
    - rate() for counters (…_total), never their raw value; never rate()
      on a gauge.
    - Add up before dividing (sum by (job)): a ratio of two sums.
    - for: absorbs short bursts: too short pages for nothing, too long
      arrives late.
    - Test an alert: see it fire once (here, real faults; elsewhere,
      promtool test rules with made-up series).
    - Labels route the alert (severity), annotations explain it (summary,
      description, runbook_url).

    DOCUMENTATION
    - Alerting rules: https://prometheus.io/docs/prometheus/latest/configuration/alerting_rules/
    - rate(): https://prometheus.io/docs/prometheus/latest/querying/functions/#rate
    - Operators and vector matching: https://prometheus.io/docs/prometheus/latest/querying/operators/
    - Alerting, good practice: https://prometheus.io/docs/practices/alerting/
