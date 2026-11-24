### Historia «La Escuela de Música», capítulo «La copia silenciosa»: la tarea
### de copia nocturna muestra Ready pero lleva semanas sin copiar nada, y
### antes su script ocultaba sus errores. Los comandos, cmdlets, rutas,
### contraseñas y salidas no se traducen.

chapter-silent-backup = La copia silenciosa
    .summary = Un archivo que restaurar, y la copia no tiene nada reciente: la tarea nocturna dice Ready, pero falla cada noche. Averigua por qué en su resultado y en los registros, arregla su cuenta y haz que su script informe de los fallos en lugar de ocultarlos.

## Files

silent-backup-email-mariam =
    De:    Mariam (directora)
    Para:  tú

    Buenos días:

    El viernes, Beatriz borró por error el extracto bancario de
    noviembre, del recurso Office (Office\Bank). ¿Podrías recuperarlo de
    la copia? El traspaso de Gabriel dice que la tarea «Nightly Backup»
    copia los recursos compartidos a D:\Backup cada noche a la 1:30, y
    escribe lo que hizo en D:\Logs\Backup\backup.log.

    Y ya que estás, ¿podrías comprobar que la copia funciona de verdad?
    Dormiría más tranquila.

    La entrada del gestor de contraseñas de la cuenta de copia está
    exportada en Documents\caja-fuerte-svc_backup.txt (bórrala cuando
    termines).

    Mariam

# { $password }: la contraseña de la cuenta (no se traduce).
silent-backup-vault =
    Gestor de contraseñas - una entrada, exportada por Mariam (14 de enero
    de 2030)

    Título:     pentagrama - svc_backup
    Usuario:    svc_backup
    Contraseña: { $password }
    Modificada: 8 de noviembre de 2029, 15:00 (Gabriel)
    Notas:      Cuenta local de la tarea Nightly Backup en pentagrama.
                Política de la escuela para las cuentas de servicio: la
                contraseña nunca caduca; se cambia a mano una vez al año
                (auditoría de la aseguradora, punto 4.2), y la tarea la
                recibe el mismo día.

## Events

silent-backup-event-ready =
    State: Ready. Eso solo significa que la tarea está activada y espera
    su próximo desencadenador; no dice nada de cómo fue su última
    ejecución. Pregúntaselo al Programador de tareas
    (Get-ScheduledTaskInfo).
silent-backup-event-result =
    LastTaskResult: 2147943730, es decir 0x80070532 en hexadecimal
    ('{"{"}0:X{"}"}' -f 2147943730): «The password for this account has
    expired.» La ejecución de anoche ni siquiera empezó. ¿Desde cuándo? El
    propio registro del script, D:\Logs\Backup\backup.log, dirá cuándo
    copió por última vez.
silent-backup-event-own-log =
    El último «copy done» es del 20 de diciembre. Casi cuatro semanas sin
    copia, y nadie se dio cuenta: la tarea falla sin hacer ruido.
silent-backup-event-history-off =
    El historial del Programador de tareas está desactivado, como en todo
    Windows Server por defecto: no se registró nada. Actívalo (wevtutil sl
    Microsoft-Windows-TaskScheduler/Operational /e:true), y las próximas
    ejecuciones sí quedarán registradas. Mientras tanto, los inicios de
    sesión fallidos están en el registro Security (4625).
silent-backup-event-history-on =
    El historial del Programador de tareas está activado: a partir de
    ahora, cada ejecución deja sus eventos (100 iniciada, 101 no pudo
    iniciarse, 104 fallo de inicio de sesión, 201 acción completada y su
    código de retorno).
silent-backup-event-events =
    «The specified account's password has expired.»: la cuenta con la que
    se ejecuta la tarea no puede iniciar sesión. Mira svc_backup en sí
    (Get-LocalUser, o net user).
silent-backup-event-expired =
    PasswordExpires: 20 de diciembre de 2029. La contraseña se puso el 8 de
    noviembre y la política local da 42 días a las contraseñas: el 20
    caducó, y la tarea falla cada noche desde entonces. Y sin embargo la
    entrada del gestor de contraseñas dice que las cuentas de servicio de
    la escuela no caducan.
silent-backup-event-account-expires =
    /expires es la fecha de caducidad de la CUENTA, no de su contraseña: la
    cuenta svc_backup nunca caducó. La caducidad de la contraseña se ajusta
    con Set-LocalUser -PasswordNeverExpires.
silent-backup-event-task-password =
    La contraseña de svc_backup ha cambiado, pero la tarea sigue guardando
    la antigua: esta noche fallaría con 0x8007052E («The user name or
    password is incorrect»). Dale también la nueva a la tarea
    (Set-ScheduledTask -User -Password, o schtasks /change /ru /rp).
silent-backup-event-logon-fixed =
    La cuenta de la tarea vuelve a poder iniciar sesión, y su contraseña ya
    no caducará, como dice la política de la escuela. Ejecuta la tarea
    ahora en lugar de esperar a la 1:30 (Start-ScheduledTask), y comprueba
    lo que hizo.
silent-backup-event-will-expire =
    La cuenta de la tarea vuelve a poder iniciar sesión, pero su contraseña
    sigue caducando a los 42 días: el mismo fallo silencioso, dentro de
    seis semanas. La política de la escuela dice que las contraseñas de sus
    cuentas de servicio no caducan.
silent-backup-event-system =
    La tarea se ejecuta ahora como SYSTEM: puede leerlo todo, así que
    «funciona». Pero un script que puede cambiar cualquiera con acceso de
    escritura a C:\Scripts se ejecutaría con todos los permisos sobre el
    servidor. Devuélvesela a svc_backup.
silent-backup-event-admin-task =
    La tarea se ejecuta ahora como administrador: todos los permisos sobre
    el servidor para un script de copia, y tu propia contraseña que
    mantener al día. Devuélvesela a svc_backup.
silent-backup-event-admin =
    svc_backup está ahora en Administrators: una cuenta de copia necesita
    leer los recursos y escribir la copia, nada más. Sácala del grupo.
silent-backup-event-disabled =
    La tarea ya no se ejecuta sola: ya no hay fallo, pero tampoco copia.
    Debe ejecutarse cada noche (Enable-ScheduledTask, y su desencadenador
    diario).
silent-backup-event-ran =
    LastTaskResult: 0, y backup.log dice «copy done». Ahora el extracto de
    Beatriz: búscalo en D:\Backup\Shares\Office.
silent-backup-event-missing =
    No hay carpeta Bank en la copia, ni siquiera una antigua. Y sin
    embargo la tarea decía 0 y «copy done», cada noche hasta el 20 de
    diciembre. Algo falló en la copia, y el script no dijo nada. Léelo:
    C:\Scripts\backup.ps1.
silent-backup-event-by-hand =
    Has ejecutado el script tú: como administrador puedes leerlo todo, así
    que puede salir bien donde la tarea falla. La tarea se ejecuta como
    svc_backup: lo que cuenta es lo que puede hacer svc_backup
    (Start-ScheduledTask la ejecuta con su cuenta).
silent-backup-event-loud =
    Esta vez el resultado de la tarea no es 0: el script encontró un error
    y lo dijo. Eso es lo que puede ver una vigilancia, o tú. Ahora bien,
    ¿qué ha fallado?
silent-backup-event-bank-acl =
    Bank no hereda los permisos de su carpeta padre: Beatriz se los dio
    solo al grupo Office y a los administradores. svc_backup no puede
    leerla, así que Copy-Item se la saltó, con un error que nadie vio.
silent-backup-event-readable =
    svc_backup ya puede leer Bank. Vuelve a ejecutar la tarea y comprueba
    su resultado.
silent-backup-event-too-open =
    Ahora el profesorado puede leer los extractos bancarios de la escuela.
    Bank debe poder leerla la secretaría y la cuenta de copia, no todo el
    mundo.
silent-backup-event-quiet-script =
    Esta vez la copia lo ha copiado todo. Pero si mañana falla una carpeta,
    el script seguirá respondiendo 0. Haz que informe de los errores
    ($ErrorActionPreference = 'Stop', o try/catch con exit 1), para que
    LastTaskResult diga la verdad.
silent-backup-event-end =
    Mariam: «Así que el extracto de noviembre nunca estuvo en la copia… El
    banco nos enviará una copia. Pero ahora sé que si la copia falla, lo
    veremos. ¡Gracias!»

    ¡Bien hecho! Has terminado el capítulo «La copia silenciosa». Y la
    historia «La Escuela de Música» está completa.

    QUÉ HA PASADO
    Dos fallos se escondían uno detrás de otro. Desde el 20 de diciembre,
    la contraseña de svc_backup había caducado («la contraseña nunca
    caduca» estaba desactivado, en contra de la política de la escuela):
    el Programador de tareas no podía iniciar sesión, cada noche,
    LastTaskResult 0x80070532, mientras Get-ScheduledTask seguía diciendo
    Ready. Y antes, desde el 12 de diciembre, el script lo copiaba todo
    menos la carpeta Bank de Beatriz, que svc_backup no podía leer:
    Copy-Item escribía un error no terminante, el script seguía, y
    powershell.exe -File devolvía 0. «copy done», cada noche.

    BUENA PRÁCTICA
    - Ready no es un resultado: lee LastRunTime y LastTaskResult
      (Get-ScheduledTaskInfo), y activa el historial del Programador de
      tareas.
    - La contraseña de una cuenta de servicio: o nunca caduca y se cambia
      a mano, según un calendario, en todos los sitios donde está
      guardada; o caduca, y algo te avisa antes. Una caducidad que nadie
      conoce es una avería silenciosa.
    - Un script ejecutado por una tarea debe fallar ruidosamente:
      $ErrorActionPreference = 'Stop' o -ErrorAction Stop, try/catch, y
      exit 1 en caso de error; si no, los errores son solo líneas que
      nadie lee.
    - Prueba con la cuenta con la que se ejecuta la tarea
      (Start-ScheduledTask), no como administrador; dale a esa cuenta lo
      que necesita leer, nada más: ni SYSTEM, ni Administrators.
    - Una copia no está comprobada hasta que se restaura: busca en ella un
      archivo reciente de vez en cuando.

    OTRA MANERA
    En un dominio, una cuenta de servicio administrada de grupo (gMSA)
    cambia su propia contraseña y la tarea la sigue. robocopy /B, ejecutado
    por un miembro de Backup Operators, lee los archivos sean cuales sean
    sus permisos, con el privilegio de copia de seguridad; Windows Server
    Backup (wbadmin) guarda volúmenes enteros.

    DOCUMENTACIÓN
    - Get-ScheduledTaskInfo: https://learn.microsoft.com/powershell/module/scheduledtasks/get-scheduledtaskinfo
    - Constantes de error y de éxito del Programador de tareas: https://learn.microsoft.com/windows/win32/taskschd/task-scheduler-error-and-success-constants
    - about_Try_Catch_Finally: https://learn.microsoft.com/powershell/module/microsoft.powershell.core/about/about_try_catch_finally?view=powershell-5.1
    - about_Preference_Variables ($ErrorActionPreference): https://learn.microsoft.com/powershell/module/microsoft.powershell.core/about/about_preference_variables?view=powershell-5.1
    - Set-LocalUser: https://learn.microsoft.com/powershell/module/microsoft.powershell.localaccounts/set-localuser?view=powershell-5.1
    - Cuentas de servicio administradas de grupo: https://learn.microsoft.com/windows-server/security/group-managed-service-accounts/group-managed-service-accounts-overview
