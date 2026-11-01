### sudo -l and visudo: sudo's original English messages
### (plugins/sudoers). { $fichier }, { $compte } and { $hote } are
### technical identifiers.

visudo-usage = usage: visudo [-chqsV] [[-f] sudoers ]
visudo-permission = visudo: unable to open { $fichier }: Permission denied
visudo-missing = visudo: unable to open { $fichier }: No such file or directory
visudo-analysis-succeeded = { $fichier }: parsed OK
visudo-and-now = What now?
visudo-options =
    Options are:
      (e)dit sudoers file again
      e(x)it without saving changes to sudoers file
      (Q)uit and save changes to sudoers file (DANGER!)
sudoers-error-syntax = syntax error
sudoers-error-path = expected a fully-qualified path name
sudo-sources-invalid = sudo: no valid sudoers sources found, quitting
# { $defauts }: the Defaults options; { $regles }: one rule per line, already indented
sudo =
    Matching Defaults entries for { $compte } on { $hote }:
        { $defauts }

    User { $compte } may run the following commands on { $hote }:
    { $regles }
sudo-none = User { $compte } is not allowed to run sudo on { $hote }.
