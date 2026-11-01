### ufw (firewall): its messages follow ufw's original English.
### Keywords (allow, deny, incoming…) and action names (ALLOW,
### DENY…) stay in English, as in the real ufw.

ufw-usage =
    Usage: ufw COMMAND (see man ufw)
      enable | disable                 turn the firewall on or off
      default allow|deny|reject        default policy (incoming)
      allow|deny|reject|limit RULE     add a rule (e.g. ufw allow 22/tcp)
      delete RULE|NUMBER               delete a rule
      status [verbose|numbered]        status and rules
      app list                         application profiles
ufw-root = ERROR: You need to be root to run this script
ufw-missing = ERROR: ufw is not installed on this machine
ufw-syntax = ERROR: Invalid syntax
ufw-idle = Status: inactive
ufw-status-active = Status: active
ufw-journalisation = Logging: on (low)
# { $entrant }, { $sortant }: allow, deny or reject (not translated)
ufw-defaults = Default: { $entrant } (incoming), { $sortant } (outgoing), disabled (routed)
ufw-profiles = New profiles: skip
# Column headers of ufw status
ufw-to = To
ufw-action = Action
ufw = From
ufw-everywhere = Anywhere
ufw-question = Command may disrupt existing ssh connections. Proceed with operation (y|n)?
# { $regle }: the rule, e.g. "allow 22/tcp"
ufw-question-deletion =
    Deleting:
     { $regle }
    Proceed with operation (y|n)?
ufw-abandon = Aborted
ufw-active = Firewall is active and enabled on system startup
ufw-already-active = Firewall is active and enabled on system startup
ufw-disabled = Firewall stopped and disabled on system startup
ufw-default-incoming =
    Default incoming policy changed to '{ $politique }'
    (be sure to update your rules accordingly)
ufw-default-outgoing =
    Default outgoing policy changed to '{ $politique }'
    (be sure to update your rules accordingly)
ufw-rules-updates = Rules updated
ufw-existing = Skipping adding existing rule
ufw-rule-deleted = Rule deleted
ufw-nonexistent = Could not delete non-existent rule
ufw-number = ERROR: Could not find rule '{ $numero }'
ufw-applications = Available applications:
