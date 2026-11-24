### Historia «El Fichero», capítulo «La contraseña caducada»: una cuenta se
### bloquea cada mañana; los eventos del controlador de dominio señalan al
### servidor de archivos, donde una tarea programada guarda todavía la
### contraseña antigua. Los comandos, cmdlets, nombres de cuenta, rutas,
### contraseñas y salidas no se traducen.

chapter-stale-password = La contraseña caducada
    .summary = La cuenta de Rafael se bloquea cada mañana, y desbloquearla solo dura una hora. Encuentra qué equipo sigue probando su contraseña antigua, arregla lo que la guardó y luego desbloquéalo, sin debilitar la política de bloqueo.

## Files

stale-password-email-nandini =
    De:    Nandini Mukherjee (directora de la red)
    Para:  tú

    Buenos días:

    Rafael (archivo, Central) está bloqueado OTRA VEZ. Tercera mañana
    seguida. El lunes Windows le dijo que su contraseña había caducado, la
    cambió en su puesto, y desde entonces se bloquea en menos de una hora.
    Lo desbloqueé el lunes y ayer (Tomas me enseñó cómo): aguanta un rato,
    y luego vuelve.

    Jura que escribe la contraseña correcta, solo en su PC del mostrador
    de Central, y que no ha apuntado la antigua en ningún sitio.

    ¿Podrías averiguar qué pasa? He exportado la entrada del gestor que
    Tomas me dijo que necesitarías: Documents\caja-fuerte-svc_scans.txt.
    Bórrala cuando termines.

    Nandini

# { $password }: la contraseña de la cuenta (no se traduce).
stale-password-vault =
    Gestor de contraseñas - una entrada, exportada por Nandini (9 de enero
    de 2030)

    Título:     LENDING - svc_scans
    Usuario:    LENDING\svc_scans
    Contraseña: { $password }
    Modificada: 12 de diciembre de 2029 (Tomas)
    Notas:      Cuenta de servicio de la importación de escaneos en
                estantes (sustituye a la cuenta de Rafael en la tarea).
                OU=Service Accounts, la contraseña nunca caduca.

## Time passing

stale-password-relocked =
    Media hora después, el teléfono: Rafael vuelve a estar bloqueado.
    Desbloquear pone a cero el contador, no su causa: algo sigue probando
    su contraseña antigua, y cinco intentos fallidos bloquean la cuenta 30
    minutos.
stale-password-holds =
    Media hora después, Rafael sigue con la sesión iniciada, y ningún 4740
    nuevo en registro.

## Events

stale-password-event-locked =
    rsilva, LockedOut. Una cuenta bloqueada no es una cuenta desactivada:
    el dominio rechaza incluso la contraseña correcta durante 30 minutos
    (la Default Domain Policy), tras cinco erróneas. ¿Cuántas, y cuándo?
stale-password-event-bad-logons =
    PasswordLastSet: el lunes, 8:52. Contraseñas erróneas desde entonces,
    a un ritmo constante: una persona que se equivoca al teclear no
    mantiene ese ritmo. ¿Qué equipo las envía? El controlador de dominio lo
    escribe en su registro Security, en el evento de bloqueo: 4740.
stale-password-event-caller =
    «Caller Computer Name»: el equipo que pidió al controlador de dominio
    que comprobara la contraseña. No es el PC del mostrador de Rafael: es
    el servidor de archivos. Algo en ese servidor inicia sesión como
    Rafael. Desde registro, el propio cliente OpenSSH de Windows llega
    allí: ssh seguido de su nombre.
stale-password-event-on-stacks =
    Estás en el servidor de archivos, como Domain Admin. Su propio
    registro Security tiene los inicios de sesión fallidos (4625), con su
    tipo de inicio de sesión: 2 en el teclado, 3 desde la red, 4 un
    trabajo por lotes, 5 un servicio.
stale-password-event-logon-type =
    Logon Type 4: un inicio de sesión por lotes, el que hace una tarea
    programada. Una tarea que se ejecuta como Rafael, con una contraseña
    guardada cuando se registró.
stale-password-event-task =
    La importación de escaneos: Tomas la configuró en septiembre con la
    propia cuenta de Rafael, «Ejecutar tanto si el usuario inició sesión
    como si no», cada 5 minutos. El Programador de tareas guardó la
    contraseña que tenía entonces. El lunes Rafael la cambió; la tarea
    conservó la antigua, y la prueba doce veces por hora. Cinco intentos
    fallidos: bloqueado.
stale-password-event-policy =
    La política de bloqueo es ahora más débil. Ocultaría el síntoma para
    todas las cuentas del dominio, y dejaría vía libre a adivinar
    contraseñas en todas ellas; la tarea seguiría fallando. Déjala como
    estaba (5 intentos, 30 minutos): Set-ADDefaultDomainPasswordPolicy.
stale-password-event-reset =
    Has restablecido la contraseña de Rafael: él no conoce la nueva, un
    restablecimiento no desbloquea la cuenta, y la tarea sigue guardando
    la antigua, que ahora va dos contraseñas por detrás. Lo que hay que
    actualizar es lo que guarda una contraseña, no a la persona.
stale-password-event-system =
    La importación se ejecuta ahora como SYSTEM: ya no bloquea a nadie,
    pero puede hacer cualquier cosa en el servidor de archivos, en todos
    los recursos, en todos los archivos. La tarea solo necesita mover
    escaneos a Archives: para eso se creó svc_scans.
stale-password-event-person =
    La importación vuelve a ejecutarse con la cuenta de una persona (o la
    del administrador del controlador de dominio). La próxima vez que esa
    persona cambie una contraseña, o se vaya, la importación se romperá, o
    la bloqueará. Una tarea tiene su propia cuenta de servicio: svc_scans,
    con su contraseña en el gestor.
stale-password-event-task-off =
    La importación de escaneos ya no se ejecuta: Rafael no se bloqueará,
    pero los PDF del escáner del archivo se acumulan en D:\Scans y nunca
    llegan a Archives. Arregla la tarea en lugar de pararla: con
    svc_scans.
stale-password-event-fixed =
    La importación se ejecuta ahora como svc_scans, con su propia
    contraseña: ya nada en estantes prueba la contraseña de Rafael. Sin
    embargo, él sigue bloqueado: el bloqueo dura 30 minutos, o hasta que
    un administrador desbloquee la cuenta.
stale-password-event-fixed-unlocked =
    La importación se ejecuta ahora como svc_scans, con su propia
    contraseña: ya nada en estantes prueba la contraseña de Rafael.
stale-password-event-vault-deleted =
    La entrada exportada está borrada: la contraseña sigue en el gestor y
    en la tarea, en ningún otro sitio. Gracias, dice Nandini.
stale-password-event-end =
    Rafael: «¡Media hora, y sigo dentro! Y mis escaneos están en Archives.
    ¡Gracias!»

    ¡Bien hecho! Has terminado el capítulo «La contraseña caducada».

    QUÉ HA PASADO
    En septiembre, Tomas configuró la importación de escaneos en estantes
    como una tarea programada que se ejecutaba con la cuenta de Rafael; el
    Programador de tareas guardó su contraseña. El lunes, la contraseña de
    Rafael caducó y él la cambió; la tarea siguió probando la antigua cada
    5 minutos. Tras cinco intentos fallidos, el dominio bloquea una cuenta
    30 minutos: desbloqueado o no, Rafael volvía a estar bloqueado en menos
    de una hora. El evento 4740 del controlador de dominio nombró el
    equipo (ESTANTES), sus eventos 4625 el tipo de inicio de sesión (4,
    por lotes), y la tarea mostró su principal. Diste a la tarea su propia
    cuenta de servicio, y luego desbloqueaste a Rafael.

    BUENA PRÁCTICA
    - Un bloqueo que se repite tiene un origen: Search-ADAccount
      -LockedOut, Get-ADUser -Properties BadLogonCount,
      LastBadPasswordAttempt, luego el evento 4740 en el controlador de
      dominio (el emulador de PDC) para el equipo que llama, y el 4625 en
      ese equipo para el tipo de inicio de sesión.
    - Los orígenes habituales: tareas programadas, servicios, unidades
      asignadas con credenciales guardadas (cmdkey), un teléfono que sigue
      sincronizando el correo.
    - Arregla primero el origen, desbloquea después: el orden inverso solo
      da media hora.
    - Las tareas se ejecutan con cuentas de servicio, nunca con la de una
      persona: las personas cambian de contraseña y se van. En un dominio,
      una cuenta de servicio administrada de grupo (gMSA) incluso cambia
      su propia contraseña.
    - No debilites la política de bloqueo para silenciar un síntoma:
      protege todas las cuentas contra la adivinación de contraseñas.

    COMO EN «EL DIRECTORIO», EN ACTIVE DIRECTORY
    LockedOut, BadLogonCount y LastBadPasswordAttempt son atributos del
    directorio (lockoutTime, badPwdCount, badPasswordTime), que un filtro
    LDAP puede buscar, como con ldapsearch:
    Get-ADUser -LDAPFilter '(lockoutTime>=1)'.

    DOCUMENTACIÓN
    - Evento 4740: https://learn.microsoft.com/windows/security/threat-protection/auditing/event-4740
    - Evento 4625 y los tipos de inicio de sesión: https://learn.microsoft.com/windows/security/threat-protection/auditing/event-4625
    - Search-ADAccount: https://learn.microsoft.com/powershell/module/activedirectory/search-adaccount
    - Unlock-ADAccount: https://learn.microsoft.com/powershell/module/activedirectory/unlock-adaccount
    - Set-ScheduledTask: https://learn.microsoft.com/powershell/module/scheduledtasks/set-scheduledtask
    - Umbral de bloqueo de cuenta: https://learn.microsoft.com/windows/security/threat-protection/security-policy-settings/account-lockout-threshold
    - Cuentas de servicio administradas de grupo: https://learn.microsoft.com/windows-server/security/group-managed-service-accounts/group-managed-service-accounts-overview
