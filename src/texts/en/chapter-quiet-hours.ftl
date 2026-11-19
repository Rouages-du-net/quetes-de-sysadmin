### Story "The Bike Share", chapter "Quiet Hours": the Alertmanager's
### routing, grouping and repeat interval, and a silence for a planned
### maintenance. amtool, alertmanager.yml, the relay's log. Commands,
### options, labels, paths and outputs are not translated.

chapter-quiet-hours = Quiet Hours
    .summary = The alerts reach the chat, but to the wrong people, over and over, and a planned maintenance is about to page whoever is on call for nothing. Route the alerts, calm them down, and silence what you know about, without silencing everything.

## Files

quiet-hours-message-ngozi =
    From: Ngozi (bike share cooperative)
    Saturday 19 May, 9:35

    Hello,

    Two things, and one is urgent.

    1. The alerts reach the chat (the relay on gauge posts what the
       Alertmanager sends it: /var/log/alert-relay/relay.log), but badly.
       #team gets the same warning about saddle's disk every five minutes
       (Tomás will clean it up on Monday, it can wait). And on Tuesday
       night saddle went down for four minutes: the alert went to #team,
       and nobody on call was paged. Pages go to #on-call, warnings to
       #team, and not more than once an hour, please.

    2. At 10:00 I replace hub's disk. It will be down until about 11:30.
       I don't want whoever is on call to be woken up by something we
       already know about. But I do want to know if saddle or anything
       else breaks meanwhile!

    amtool is installed (it reads /etc/amtool/config.yml).

    Ngozi

## Events

quiet-hours-event-repeats =
    The same warning, every five minutes: repeat_interval: 1m in
    /etc/prometheus/alertmanager.yml. The Alertmanager sends a firing alert
    again after repeat_interval (4h by default), but only looks at a group
    every group_interval (here 5m): that is as often as it can repeat.
    group_by decides what goes together.
quiet-hours-event-routes =
    The routing tree: under the default route, a single route, for
    severity="critical". Your rules say page or warning: critical matches
    nothing, so everything falls to the default receiver, team. (amtool
    config routes test severity=page shows where an alert would go.)
quiet-hours-event-am-invalid =
    amtool refuses the file, and says why. The Alertmanager would refuse it
    too, and keep its old configuration.
quiet-hours-event-am-check =
    amtool check-config: the file is valid. The Alertmanager still runs the
    configuration it read before, until it rereads the file.
quiet-hours-event-am-not-reloaded =
    The file is right, but the Alertmanager hasn't reread it: sudo
    systemctl reload prometheus-alertmanager (or a POST on /-/reload).
quiet-hours-event-am-bad-reload =
    The reload failed: the Alertmanager keeps its old configuration, and its
    journal says why (sudo journalctl -u prometheus-alertmanager -n 20).
quiet-hours-event-routing =
    The routing works: a page goes to on-call, a warning to team.
quiet-hours-event-repeat-interval =
    No more than one reminder an hour: the channel can breathe. A resolved
    alert is still announced (send_resolved, true by default for a
    webhook).
quiet-hours-event-stopped =
    Prometheus or the Alertmanager is stopped: nothing will be noticed,
    during the maintenance or after it, and saddle could go down unseen.
    Ngozi asked the opposite. Start it again, and silence only what you
    know about.
quiet-hours-event-rule-removed =
    The NodeDown rule is gone: hub's maintenance won't page, but neither
    will saddle's next fall, nor hub if it doesn't come back at 11:30. A
    silence is for a known, limited time; removing a rule is for ever.
quiet-hours-event-too-broad =
    This silence also covers other machines' alerts (or every page): if
    saddle goes down during the maintenance, nobody will know. Narrow it to
    hub (its instance), and expire the broad one (amtool silence expire
    with its ID).
quiet-hours-event-too-short =
    This silence doesn't cover the whole maintenance, from 10:00 to 11:30:
    it starts too late, or its end would page someone. --duration counts
    from now (or from --start). A silence can't be stretched, but it can be
    replaced: add a new one, expire the old one.
quiet-hours-event-silenced =
    hub's alerts are silenced for the maintenance: the Alertmanager still
    receives them (amtool alert query --silenced), but sends nothing. The
    silence ends by itself.
quiet-hours-event-paged =
    The on-call phone rang: hub's NodeDown, during a maintenance everybody
    knew about. A silence set beforehand would have kept it quiet.
quiet-hours-event-end =
    Ngozi: "Perfect. I'm going down to the cellar with the new disk. If
    saddle so much as blinks, I'll know." (You can watch the morning go by:
    sleep 1800, then amtool alert query --silenced.)

    Well done! You finished Quiet Hours, and The Bike Share.

    WHAT HAPPENED
    Prometheus decides that an alert fires; the Alertmanager decides who
    hears about it, how often, and when not. Its only route matched
    severity="critical", a label no rule set: every alert fell to the
    default receiver (#team), and repeat_interval: 1m repeated it at each
    group_interval, every five minutes. You fixed the matcher (page goes to on-call), set a sensible
    repeat interval, checked the file (amtool check-config), reloaded, and
    silenced hub for its maintenance with amtool, without touching the
    rules or stopping anything.

    GOOD PRACTICE
    - Route on the labels the rules really set; amtool config routes test
      shows where an alert goes.
    - Group what belongs together (group_by), and repeat in hours, not in
      minutes.
    - A planned maintenance is a silence: narrow matchers (instance=…), a
      start and an end that cover the window with a margin, a comment, an
      author. Never delete the rule, never stop the monitoring.
    - Inhibition (inhibit_rules) can mute the alerts of a machine's
      services while the machine itself is down.
    - Check a configuration before reloading it (amtool check-config,
      promtool check config).

    DOCUMENTATION
    - Alertmanager, route: https://prometheus.io/docs/alerting/latest/configuration/#route
    - Grouping, inhibition, silences: https://prometheus.io/docs/alerting/latest/alertmanager/
    - amtool: https://github.com/prometheus/alertmanager#amtool
