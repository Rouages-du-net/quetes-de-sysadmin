### Historia «La Escuela de Música», capítulo «Sin poder entrar»: el servicio
### de la aplicación de reservas no arranca después de cambiar la contraseña
### de su cuenta y reiniciar el servidor. Los comandos, cmdlets, rutas,
### contraseñas y salidas no se traducen.

chapter-service-logon = Sin poder entrar
    .summary = La aplicación de reservas de la escuela está caída desde que se reinició el servidor: su servicio no arranca. Averigua por qué en el registro de eventos y luego dale al servicio la nueva contraseña de su cuenta, sin darle más permisos de los que necesita.

## Files

service-logon-email-mariam =
    De:    Mariam (directora)
    Para:  tú

    Buenos días:

    La Agenda no funciona: desde esta mañana, el profesorado y la
    secretaría reciben «No se puede acceder a este sitio» en
    http://pentagrama.internal:8080, y las familias no pueden reservar sus
    clases de prueba.

    El servidor se reinició el domingo por la noche por Windows Update.
    Gabriel, que se ocupaba de él, se fue el viernes; por si acaso, te he
    exportado las entradas del servidor del gestor de contraseñas, en
    Documents\caja-fuerte-cuentas-servicio.txt. Por favor, borra ese
    archivo cuando termines.

    ¿Podrías volver a poner en marcha la Agenda, sin romper nada más?

    Mariam

# { $agenda }, { $backup }, { $admin }: las contraseñas (no se traducen).
service-logon-vault =
    Gestor de contraseñas - carpeta «pentagrama», exportada por Mariam
    (10 de diciembre de 2029)

    Título:     pentagrama - svc_backup
    Usuario:    svc_backup
    Contraseña: { $backup }
    Modificada: 3 de junio de 2029 (Gabriel)
    Notas:      Cuenta local. Se cambia cada año (auditoría de la
                aseguradora, punto 4.2).

    Título:     pentagrama - svc_agenda
    Usuario:    svc_agenda
    Contraseña: { $agenda }
    Modificada: 7 de diciembre de 2029, 16:42 (Gabriel)
    Notas:      Cuenta local. Se cambia cada año (auditoría de la
                aseguradora, punto 4.2).

    Título:     Agenda - admin web
    Usuario:    admin
    Contraseña: { $admin }
    Modificada: 2 de septiembre de 2029 (Gabriel)
    Notas:      http://pentagrama.internal:8080/admin

## Events

service-logon-event-stopped =
    La Agenda está Stopped, aunque su tipo de inicio es Automatic: debería
    haber arrancado con el servidor el domingo por la noche. Intenta
    arrancarla y lee lo que responde Windows.
service-logon-event-start-failed =
    Rechazado. El error en sí dice poco; Windows escribe los detalles en su
    registro de eventos, bajo el Service Control Manager, la parte de
    Windows que arranca los servicios: el registro System (Get-WinEvent,
    Get-EventLog).
service-logon-event-events =
    Evento 7038: la Agenda «was unable to log on as .\svc_agenda with the
    currently configured password», y luego 7000: «logon failure». El
    servicio arranca con su propia cuenta, con una contraseña que Windows
    guardó cuando se configuró el servicio. ¿Qué cuenta, exactamente?
    (Get-CimInstance Win32_Service, o sc.exe qc)
service-logon-event-account =
    StartName: .\svc_agenda, la cuenta local (el punto significa este
    equipo). Windows guarda la contraseña de esa cuenta con el servicio:
    si alguien cambió la contraseña de la cuenta, la copia del servicio no
    la siguió. ¿Cuándo se estableció por última vez? (Get-LocalUser,
    PasswordLastSet)
service-logon-event-rotated =
    PasswordLastSet: el viernes, 16:42, el último día de Gabriel (la
    auditoría de la aseguradora pide contraseñas de servicio nuevas cada
    año). El servicio siguió funcionando con su sesión hasta el reinicio
    del domingo, y entonces probó la antigua. La nueva está en las
    entradas que exportó Mariam: la de la cuenta con la que inicia sesión
    el servicio.
service-logon-event-other-account =
    La Agenda inicia sesión ahora como { $account }: una cuenta hecha para
    otro trabajo, con derechos que la aplicación de reservas no necesita
    (svc_backup es Backup Operator: puede leer todos los archivos del
    servidor). La Agenda tiene su propia cuenta, la que daba su StartName:
    svc_agenda.
service-logon-event-sc-alias =
    En PowerShell, sc no es sc.exe: es un alias de Set-Content, que escribe
    en archivos, y no sabe qué hacer con obj=. Escribe sc.exe completo (en
    cmd.exe, basta con sc).
service-logon-event-local-system =
    La Agenda se ejecuta ahora como LocalSystem: arranca, pero con todos
    los permisos sobre el servidor, los archivos del sistema, los recursos
    compartidos, los demás servicios. Un fallo de la aplicación de reservas
    se volvería un fallo de todo el servidor. Vuelve a ponerla con su
    propia cuenta, svc_agenda, con su contraseña (sc.exe config … obj= …
    password= …).
service-logon-event-reset =
    Has vuelto a cambiar la contraseña de svc_agenda. El gestor de
    contraseñas tiene ahora una antigua, y el servicio una aún más antigua:
    todo lo que usa esta cuenta debe recibir la nueva contraseña (el
    servicio, el gestor de contraseñas), o el próximo arranque fallará
    igual.
service-logon-event-wrong-password =
    El servicio tiene ahora una contraseña que no es la de la cuenta: su
    próximo arranque fallará con el mismo 7038. Cópiala exactamente de la
    entrada del gestor de contraseñas.
service-logon-event-start-type =
    La Agenda ya no arranca con el servidor: volvería a caerse tras el
    próximo reinicio de Windows Update. Su tipo de inicio debería ser
    Automatic (Set-Service -StartupType, o sc.exe config … start= auto).
service-logon-event-admin =
    svc_agenda está ahora en Administrators: la aplicación de reservas
    tendría todos los permisos sobre el servidor. Una cuenta de servicio
    recibe los permisos que necesita su aplicación, no más. Sácala del
    grupo (Remove-LocalGroupMember).
service-logon-event-configured =
    El servicio ya tiene la nueva contraseña de la cuenta. Arráncalo y
    comprueba que funciona.
service-logon-event-vault-deleted =
    La entrada exportada está borrada: la contraseña sigue en el gestor de
    contraseñas, y en ningún otro sitio del servidor. Gracias, dice Mariam.
service-logon-event-end =
    Mariam: «La Agenda ha vuelto, las familias vuelven a reservar.
    ¡Gracias! Lo escribiré en el procedimiento: cuando cambia la
    contraseña de un servicio, el servicio la recibe el mismo día, y lo
    reiniciamos para comprobarlo.»

    ¡Bien hecho! Has terminado el capítulo «Sin poder entrar».

    QUÉ HA PASADO
    Un servicio de Windows arranca con una cuenta de inicio de sesión; para
    una cuenta local, el Service Control Manager guarda su contraseña con
    la configuración del servicio. Gabriel cambió, con razón, la contraseña
    de svc_agenda, pero no la copia que guardaba el servicio. La Agenda
    siguió funcionando hasta el reinicio por la actualización del domingo,
    y entonces no pudo iniciar sesión: 7038 y 7000 en el registro System,
    error 1069. Diste al servicio la nueva contraseña del gestor de
    contraseñas (sc.exe config) y lo arrancaste con su propia cuenta.

    BUENA PRÁCTICA
    - Cambiar la contraseña de una cuenta de servicio significa actualizar
      todo lo que la guarda: servicios (Get-CimInstance Win32_Service,
      StartName), tareas programadas (Get-ScheduledTask, su Principal),
      scripts.
    - Reinicia el servicio justo después del cambio: un fallo se ve el
      mismo día, no en el próximo reinicio, a las 3 de la madrugada.
    - El registro System dice por qué: el evento 7038 nombra la cuenta, el
      7000 el servicio.
    - Mínimo privilegio: un servicio se ejecuta con su propia cuenta y los
      permisos que necesita, ni como LocalSystem ni como administrador.
    - Las contraseñas viven en el gestor de contraseñas; una exportación se
      borra una vez usada.

    OTRA MANERA
    En un dominio, una cuenta de servicio administrada de grupo (gMSA)
    cambia su propia contraseña y los servicios la siguen, sin nada que
    volver a escribir. En un solo servidor, una cuenta virtual (NT
    SERVICE\Agenda) no necesita contraseña, cuando la aplicación solo
    necesita permisos locales. La consola Servicios (services.msc),
    pestaña Iniciar sesión, hace lo que hace sc.exe config.

    DOCUMENTACIÓN
    - Cuentas de usuario de servicio: https://learn.microsoft.com/windows/win32/services/service-user-accounts
    - sc.exe config: https://learn.microsoft.com/windows-server/administration/windows-commands/sc-config
    - Eventos 7000, 7011, 7009: https://learn.microsoft.com/troubleshoot/windows-server/system-management-components/event-id-7000-7011-7009
    - Get-WinEvent: https://learn.microsoft.com/powershell/module/microsoft.powershell.diagnostics/get-winevent?view=powershell-5.1
    - Cuentas de servicio administradas de grupo: https://learn.microsoft.com/windows-server/security/group-managed-service-accounts/group-managed-service-accounts-overview
