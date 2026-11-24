### Historia «El Fichero», capítulo «Puertas y cuentas dormidas»: la
### auditoría anual del ayuntamiento: Escritorio remoto abierto a Internet en
### el servidor de archivos, y las cuentas que nadie ha usado en 90 días,
### cerradas con un pequeño script y listadas en un informe CSV.
### Los comandos, cmdlets, nombres de cuenta, direcciones, rutas y salidas no
### se traducen.

chapter-dormant-accounts = Puertas y cuentas dormidas
    .summary = El equipo de seguridad informática del ayuntamiento encontró el Escritorio remoto abierto a Internet en el servidor de archivos, y quiere cerradas las cuentas que nadie ha usado en 90 días, con un informe. Cierra la puerta sin dejarte fuera, y luego escribe un pequeño script que cierre las cuentas dormidas, y solo esas.

## Files

dormant-accounts-email-nandini =
    De:    Nandini Mukherjee (directora de la red)
    Para:  tú

    Buenos días:

    El equipo de seguridad informática del ayuntamiento nos ha enviado su
    auditoría anual (en tus Documents). Dos cosas para nosotros, para el
    viernes. Cuidado con la segunda: el año pasado Tomas cerró una cuenta
    que el archivo todavía necesitaba, y no nos enteramos hasta abril.

    El informe que quieren va también en tus Documents, como archivo CSV:
    entra directamente en su hoja de cálculo.

    Nandini

# { $scanner }: la dirección del escáner (no se traduce).
dormant-accounts-audit =
    Ayuntamiento - bibliotecas - seguridad informática - auditoría anual
    2030
    Red: bibliotecas públicas (LENDING)

    1. ESCANEO EXTERNO (trimestral, desde { $scanner })
       La dirección pública de las bibliotecas responde en TCP 3389
       (Escritorio remoto). El router lo reenvía a un servidor interno.
       El Escritorio remoto nunca debe ser accesible desde Internet, ni
       desde los puestos de consulta públicos. Administración solo desde
       el puesto de informática (192.0.2.2).

    2. CUENTAS DORMIDAS
       Cuentas de personas sin inicio de sesión desde hace 90 días o más:
         - desactivarlas, moverlas a vuestra OU de bajas, quitarlas de
           todos los grupos (excepto el grupo principal);
         - enviarnos la lista como archivo CSV (nombre de cuenta, nombre,
           último inicio de sesión).
       No toquéis las cuentas de servicio sin comprobar qué las usa.
       Comprobad también que vuestras bajas están de verdad fuera de sus
       grupos.

dormant-accounts-gpo-refresh =
    Noventa minutos después, estantes actualiza su directiva en segundo
    plano: la regla de la GPO de los servidores vuelve a dejar entrar a
    registro por el puerto 22. (En la vida real, quizá alguien habría
    tenido que ir en coche hasta la sala de servidores.)

## Events

dormant-accounts-event-rdp-found =
    «Remote Desktop - Any»: TCP 3389, desde Any dirección, en todos los
    perfiles. Tomas la creó en 2028 para trabajar desde casa, y el router
    todavía reenvía el puerto: cualquiera en Internet puede probar
    contraseñas en el Escritorio remoto de estantes, y también cualquiera
    en un puesto de consulta público. Las reglas de Escritorio remoto
    integradas están desactivadas; esta no. ¿Alguien sigue usando el
    Escritorio remoto? Tú entras con ssh.
dormant-accounts-event-profile-off =
    Un perfil del cortafuegos está desactivado: en esa red, estantes
    acepta ahora todo, todos los puertos, de todo el mundo. La puerta que
    te pidieron cerrar está abierta de par en par, y todas las demás
    también. Vuelve a activarlo (Set-NetFirewallProfile -Enabled True) y
    ocúpate de esa única regla.
dormant-accounts-event-ssh-cut =
    Cuidado: el cortafuegos de estantes ya no deja entrar a registro por el
    puerto 22. Tu sesión aguanta (una conexión abierta sigue abierta), pero
    el próximo ssh estantes agotará el tiempo de espera. Vuelve a ponerla
    ahora (Get-NetFirewallRule -Name OpenSSH-Server-In-TCP,
    Enable-NetFirewallRule, Set-NetFirewallRule -RemoteAddress), antes de
    salir.
# { $kiosk }: la dirección de un puesto de consulta (no se traduce).
dormant-accounts-event-lan-wide =
    Desde Internet, cerrado. Pero { $kiosk }, un puesto público de consulta
    del catálogo, todavía entra: está en la misma red (192.0.2.0/24) que el
    personal. LocalSubnet o todo el /24 no es «el puesto de
    administración».
dormant-accounts-event-rdp-closed =
    Puerto 3389 cerrado para todo el mundo: desde Internet y desde los
    puestos de consulta. Tú sigues entrando con ssh. (El reenvío de puerto
    del router también debería desaparecer: una nota para el proveedor de
    Nandini.)
dormant-accounts-event-rdp-narrowed =
    Puerto 3389 abierto solo al puesto de informática: ni desde Internet,
    ni desde los puestos de consulta. Tú sigues entrando con ssh.
dormant-accounts-event-inactive =
    Las cuentas inactivas del dominio. Mira bien antes de actuar: Guest y
    krbtgt son cuentas integradas (desactivadas, nunca «han iniciado
    sesión»), oadeyemi se fue en mayo, svc_backup es una cuenta de
    servicio. Las personas son ychen y pmorel. -SearchBase puede limitar
    la búsqueda al personal de las bibliotecas.
dormant-accounts-event-too-short =
    lhassan en la lista: Leila está de permiso parental desde diciembre,
    vuelve en marzo. Con un -TimeSpan demasiado corto, la auditoría cierra
    a personas que van a volver. La auditoría dice 90 días.
dormant-accounts-event-service-account =
    svc_backup ejecuta la copia externa de Archives, el 1 de octubre y el
    1 de abril. Su último inicio de sesión es de octubre: inactiva desde
    hace 90 días, y necesaria de nuevo dentro de nueve semanas. El
    LastLogonDate de una cuenta de servicio dice cuándo inició sesión por
    última vez, no si algo depende de ella.
dormant-accounts-event-service-touched =
    Se ha modificado una cuenta de servicio. svc_backup parece inactiva,
    pero la tarea Offsite Copy de estantes se ejecuta como svc_backup el 1
    de abril: desactivada, fuera de su grupo o movida, la copia falla
    (0x80070533, la cuenta está desactivada), y Archives se queda sin copia
    externa. Déjala como estaba: Enable-ADAccount, su grupo, OU=Service
    Accounts.
dormant-accounts-event-builtin-touched =
    Se ha movido o modificado una cuenta integrada (Guest, krbtgt,
    Administrator…). Están desactivadas o las necesita el propio dominio:
    la auditoría trata de personas. Déjala donde estaba (Move-ADObject).
# { $accounts }: nombres de cuenta (no se traducen).
dormant-accounts-event-active-touched =
    Se ha modificado la cuenta de una persona activa: { $accounts }. Ha
    iniciado sesión en los últimos 90 días: deja la cuenta como estaba
    (activada, su OU, sus grupos).
# { $accounts }: nombres de cuenta (no se traducen).
dormant-accounts-event-deleted =
    Borrado: { $accounts }. La auditoría pide desactivar, no borrar: el SID
    es propietario de archivos, la auditoría quiere el nombre. La Papelera
    de reciclaje todavía lo tiene (Get-ADObject -IncludeDeletedObjects,
    Restore-ADObject).
dormant-accounts-event-closed =
    ychen y pmorel: desactivadas, en Leavers, fuera de sus grupos. Si una
    de ellas vuelve, Enable-ADAccount, un grupo GG_ y un Move-ADObject la
    traen de vuelta.
dormant-accounts-event-leftover-seen =
    Olu se fue en mayo de 2029. Desactivada, en Leavers... pero todavía en
    GG_Lending y DL_Staff_RW. Desactivada, no puede iniciar sesión; pero
    quien vuelva a activar su cuenta (por error, o para «comprobar algo»)
    recupera de golpe todos sus accesos, y cada informe del recurso Staff
    lo lista.
dormant-accounts-event-leftover =
    Olu también está fuera de sus grupos: Leavers está limpia.
dormant-accounts-event-report-active =
    Un informe CSV lista a una persona activa: la auditoría cerraría una
    cuenta que está en uso. Escríbelo a partir de la búsqueda correcta
    (-TimeSpan 90.00:00:00, el personal de las bibliotecas).
dormant-accounts-event-report =
    El informe está ahí, e Import-Csv lo vuelve a leer: la auditoría puede
    pegarlo en su hoja de cálculo.
dormant-accounts-event-end =
    Nandini: «El escaneo está limpio, la auditoría tiene su lista, y el
    archivo se copiará en abril. ¡Gracias!»

    ¡Bien hecho! Has terminado el capítulo «Puertas y cuentas dormidas», y
    la historia «El Fichero».

    QUÉ HA PASADO
    Tomas abrió el Escritorio remoto a Any en estantes en 2028 para
    trabajar desde casa; el router seguía reenviando el puerto, así que el
    escaneo del ayuntamiento lo encontró desde Internet. Ya nadie usa el
    Escritorio remoto: cerraste la regla sin tocar los perfiles ni tu
    propio ssh. Luego la auditoría: Search-ADAccount encontró las cuentas
    que nadie había usado en 90 días, pero entre ellas había cuentas
    integradas, una baja y una cuenta de servicio que solo trabaja dos
    veces al año. Cerraste las cuentas de las dos personas con un script,
    limpiaste los grupos de la baja antigua y escribiste la lista con
    Export-Csv.

    BUENA PRÁCTICA
    - El Escritorio remoto nunca da a Internet: una VPN o una pasarela
      delante, y al menos una regla de cortafuegos limitada a las
      direcciones de administración (-RemoteAddress). Mejor desactivar una
      regla que nadie usa: dice lo que era, y puede volver.
    - Restringe una regla, nunca un perfil entero. Antes de cambiar la
      regla por la que entraste, comprueba qué te sigue dejando entrar.
    - Un script de auditoría primero lee y después actúa: guarda la
      búsqueda en una variable, mírala, expórtala (Export-Csv
      -NoTypeInformation), y luego actúa sobre ella, con -WhatIf la
      primera vez.
    - LastLogonDate es lastLogonTimestamp: replicado con hasta 14 días de
      retraso, y solo cuenta un inicio de sesión. Excluye lo que no es una
      persona: -SearchBase la OU de las personas, las cuentas de servicio
      en su propia OU, las cuentas integradas.
    - Desactiva, no borres: una cuenta desactivada vuelve con un comando;
      una borrada necesita la Papelera de reciclaje, durante 180 días.

    COMO EN «EL DIRECTORIO», EN ACTIVE DIRECTORY
    Search-ADAccount -AccountInactive es una búsqueda LDAP sobre el
    atributo lastLogonTimestamp: Get-ADUser -LDAPFilter
    '(lastLogonTimestamp<=…)' hace lo mismo, con la fecha escrita como
    FILETIME (intervalos de 100 nanosegundos desde 1601), como lo haría
    ldapsearch.

    DOCUMENTACIÓN
    - Search-ADAccount: https://learn.microsoft.com/powershell/module/activedirectory/search-adaccount
    - Export-Csv: https://learn.microsoft.com/powershell/module/microsoft.powershell.utility/export-csv?view=powershell-5.1
    - Set-NetFirewallRule: https://learn.microsoft.com/powershell/module/netsecurity/set-netfirewallrule
    - Escritorio remoto desde cualquier lugar, con seguridad: https://learn.microsoft.com/windows-server/remote/remote-desktop-services/rds-plan-access-from-anywhere
    - La Papelera de reciclaje de AD: https://learn.microsoft.com/windows-server/identity/ad-ds/get-started/adac/advanced-ad-ds-management-using-active-directory-administrative-center--level-200-
