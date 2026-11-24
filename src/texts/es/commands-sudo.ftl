### sudo -l y visudo: los mensajes de sudo (plugins/sudoers), en español
### cuando la traducción del Translation Project los tiene, en inglés si no.
### { $file }, { $account } y { $host } son identificadores técnicos.

visudo-usage = usage: visudo [-chqsV] [[-f] sudoers ]
visudo-permission = visudo: no se pudo abrir { $file }: Permiso denegado
visudo-missing = visudo: no se pudo abrir { $file }: No existe el fichero o el directorio
visudo-analysis-succeeded = { $file }: parsed OK
visudo-and-now = What now?
visudo-options =
    Options are:
      (e)dit sudoers file again
      e(x)it without saving changes to sudoers file
      (Q)uit and save changes to sudoers file (DANGER!)
sudoers-error-syntax = error de sintaxis
sudoers-error-path = expected a fully-qualified path name
sudo-sources-invalid = sudo: no valid sudoers sources found, quitting
# { $defaults }: las opciones Defaults; { $rules }: una regla por línea, ya sangrada
sudo =
    Matching Defaults entries for { $account } on { $host }:
        { $defaults }

    User { $account } may run the following commands on { $host }:
    { $rules }
sudo-none = User { $account } is not allowed to run sudo on { $host }.
# { $user }: quien juega; { $command }: la ruta de la shell; { $account }: root o la cuenta de sudo -u; { $host }: la máquina
sudo-not-allowed = Sorry, user { $user } is not allowed to execute '{ $command }' as { $account } on { $host }.
su-password = Contraseña:
