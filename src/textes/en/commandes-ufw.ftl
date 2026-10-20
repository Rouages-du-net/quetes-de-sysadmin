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
ufw-absent = ERROR: ufw is not installed on this machine
ufw-syntaxe = ERROR: Invalid syntax
ufw-inactif = Status: inactive
ufw-statut-actif = Status: active
ufw-journalisation = Logging: on (low)
# { $entrant }, { $sortant }: allow, deny or reject (not translated)
ufw-defauts = Default: { $entrant } (incoming), { $sortant } (outgoing), disabled (routed)
ufw-profils = New profiles: skip
# Column headers of ufw status
ufw-vers = To
ufw-action = Action
ufw-de = From
ufw-partout = Anywhere
ufw-question = Command may disrupt existing ssh connections. Proceed with operation (y|n)?
# { $regle }: the rule, e.g. "allow 22/tcp"
ufw-question-suppression =
    Deleting:
     { $regle }
    Proceed with operation (y|n)?
ufw-abandon = Aborted
ufw-active = Firewall is active and enabled on system startup
ufw-deja-actif = Firewall is active and enabled on system startup
ufw-desactive = Firewall stopped and disabled on system startup
ufw-defaut-entrant =
    Default incoming policy changed to '{ $politique }'
    (be sure to update your rules accordingly)
ufw-defaut-sortant =
    Default outgoing policy changed to '{ $politique }'
    (be sure to update your rules accordingly)
ufw-regles-mises-a-jour = Rules updated
ufw-existante = Skipping adding existing rule
ufw-regle-supprimee = Rule deleted
ufw-inexistante = Could not delete non-existent rule
ufw-numero = ERROR: Could not find rule '{ $numero }'
ufw-applications = Available applications:
