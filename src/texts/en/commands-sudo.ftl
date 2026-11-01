### sudo -l and visudo: sudo's original English messages
### (plugins/sudoers). { $file }, { $account } and { $host } are
### technical identifiers.

visudo-usage = usage: visudo [-chqsV] [[-f] sudoers ]
visudo-permission = visudo: unable to open { $file }: Permission denied
visudo-missing = visudo: unable to open { $file }: No such file or directory
visudo-analysis-succeeded = { $file }: parsed OK
visudo-and-now = What now?
visudo-options =
    Options are:
      (e)dit sudoers file again
      e(x)it without saving changes to sudoers file
      (Q)uit and save changes to sudoers file (DANGER!)
sudoers-error-syntax = syntax error
sudoers-error-path = expected a fully-qualified path name
sudo-sources-invalid = sudo: no valid sudoers sources found, quitting
# { $defaults }: the Defaults options; { $rules }: one rule per line, already indented
sudo =
    Matching Defaults entries for { $account } on { $host }:
        { $defaults }

    User { $account } may run the following commands on { $host }:
    { $rules }
sudo-none = User { $account } is not allowed to run sudo on { $host }.
