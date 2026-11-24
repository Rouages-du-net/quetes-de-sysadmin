### Historia «La Escuela de Música», capítulo «Dos cerraduras»: el
### profesorado no puede guardar en su recurso compartido del Windows Server
### de la escuela; permisos del recurso y permisos NTFS, los dos demasiado
### estrictos. También los textos compartidos de la historia (el traspaso de
### Gabriel). Los comandos, cmdlets, rutas y salidas no se traducen.

chapter-two-locks = Dos cerraduras
    .summary = El profesorado puede abrir su recurso compartido en el Windows Server de la escuela de música, pero no puede guardar nada en él: lee los permisos del recurso y los permisos NTFS de las carpetas, y abre las dos cerraduras para el profesorado, y solo para él.

## Files

music-school-handover =
    pentagrama - notas de traspaso (Gabriel, 30 de noviembre de 2029)

    El servidor: pentagrama.internal (192.0.2.42), Windows Server 2022.
    Acceso remoto: OpenSSH, integrado en Windows, con tu clave. Llega a
    cmd.exe: escribe powershell para tener PowerShell (exit vuelve).

    Grupos locales:
      Teachers   samir, lucia, yuki
      Office     beatriz, tomasz

    Recursos compartidos (D:\Shares en el servidor):
      Teachers   clases, partituras, grabaciones (el profesorado)
      Office     inscripciones y cuotas (la secretaría)
      Public     carteles y horarios (todo el mundo lee)

    En verano trasladé los recursos al disco nuevo (D:) y los volví a
    crear con New-SmbShare. Durante la copia congelé LessonPlans para que
    nadie cambiara un archivo a medias.

    Servicio:
      Agenda     reservas de clases y salas (http://pentagrama.internal:8080),
                 se ejecuta con su propia cuenta local, svc_agenda.

    Tarea programada:
      Nightly Backup   cada noche a la 1:30, C:\Scripts\backup.ps1 como
                       svc_backup: copia D:\Shares a D:\Backup\Shares.

    Registros: D:\Logs (Agenda, Backup). Windows Update reinicia el
    servidor las noches de domingo a las 3:00 cuando una actualización lo
    necesita.

    Contraseñas: en el gestor de contraseñas de la escuela (lo abre
    Mariam).

    ¡Gracias por tomar el relevo, y suerte!
    Gabriel

two-locks-email-samir =
    De:    Samir (coordinador del profesorado)
    Para:  tú
    Cc:    Mariam

    ¡Hola, y te damos la bienvenida a la escuela!

    Desde el inicio del curso, el profesorado puede abrir nuestro recurso
    compartido (\\pentagrama\Teachers) pero no podemos guardar nada en él:
    Word dice que no tenemos permiso para guardar en esta ubicación, y al
    copiar un archivo ahí sale «Access is denied». Igual para Lucia, Yuki
    y para mí, en Scores y en LessonPlans. La secretaría no tiene problemas
    con su propio recurso.

    Gabriel te escribió un traspaso (Documents\traspaso.txt). Antes de irse
    dijo «deben de ser los permisos», pero no le dio tiempo a mirarlo.

    Tenemos que poner las partes del concierto en Scores antes del ensayo
    del viernes, y las programaciones de diciembre en LessonPlans. Y por
    favor: solo el profesorado. La secretaría no debería poder cambiar
    nuestros archivos (ni nosotros los suyos).

    Samir

## Events

two-locks-event-cmd =
    Estás en cmd.exe, el viejo intérprete de comandos de Windows: su
    OpenSSH lo arranca cuando no hay ningún DefaultShell configurado.
    Conoce dir, cd, type y los programas (icacls, net, sc, whoami), no los
    cmdlets de PowerShell. Escribe powershell para arrancar Windows
    PowerShell dentro (exit vuelve).
two-locks-event-powershell =
    PS C:\Users\tu>: Windows PowerShell. Sus comandos, los cmdlets, se
    llaman verbo-sustantivo; Get-Help NOMBRE es el manual, y Get-Command
    -Noun Smb* lista los que tratan con recursos compartidos. ¿Desde dónde
    se comparten los archivos del profesorado?
two-locks-event-shares =
    Get-SmbShare lista los recursos: Teachers es D:\Shares\Teachers en el
    servidor (los que terminan en $ son los recursos administrativos de
    Windows). Para llegar a un archivo a través de un recurso se pasan dos
    cerraduras: los permisos del recurso (Get-SmbShareAccess), y luego los
    permisos NTFS de la carpeta (Get-Acl, icacls).
two-locks-event-share-access =
    Ahí está: en el recurso, Everyone puede leer (Read), y nada más. Es lo
    que concede New-SmbShare cuando no recibe -ChangeAccess ni -FullAccess:
    cuando Gabriel volvió a crear el recurso en verano, se quedó con el
    valor por defecto. A través del recurso nadie escribe, diga lo que
    diga NTFS. Mira también NTFS antes de cambiar nada.
two-locks-event-ntfs =
    NTFS da al grupo Teachers Modify sobre D:\Shares\Teachers, heredado
    por lo que hay dentro ((OI)(CI): archivos y carpetas), y la carpeta no
    hereda de D:\Shares (ninguna línea (I)): solo SYSTEM, los
    administradores, el profesorado y svc_backup (para la copia). Por este
    lado, el profesorado puede escribir. ¿Quién está en Teachers?
two-locks-event-members =
    Teachers: samir, lucia, yuki, los tres. Un grupo es lo correcto para
    dar permisos: cuando un profesor o una profesora llega o se va, se
    cambia el grupo, no cada carpeta.
two-locks-event-share-fixed =
    Samir: «¡Scores funciona! Acabo de poner ahí las partes del concierto.
    Pero LessonPlans sigue diciendo Access is denied, a los tres.» Ahora
    el recurso deja al profesorado modificar archivos: en LessonPlans, es
    NTFS quien dice que no. Mira los permisos de esa carpeta.
two-locks-event-share-fixed-all =
    Samir: «¡Ya funcionan Scores y LessonPlans!»
two-locks-event-lessons =
    LessonPlans tiene sus propios permisos: ningún (I), así que su herencia
    está desactivada, y el profesorado solo tiene (RX), lectura y
    ejecución. La congelación de Gabriel durante la copia del verano, que
    nunca se levantó. Vuelve a dar a Teachers Modify sobre esta carpeta,
    también para sus archivos y subcarpetas, o reactiva su herencia para
    que reciba las entradas de D:\Shares\Teachers (man icacls: /grant,
    /inheritance).
two-locks-event-folder-only =
    El profesorado ya puede crear archivos en LessonPlans, pero no
    modificar los que ya estaban: la entrada que añadiste solo se aplica a
    la carpeta. Sin (OI)(CI) (object inherit, container inherit), sus
    archivos y subcarpetas no la reciben. Con icacls, los indicadores van
    antes del permiso.
two-locks-event-too-broad =
    Cuidado: personas que no son del profesorado pueden ahora modificar
    archivos del recurso del profesorado (la secretaría, o cualquiera,
    según lo que abriste). A través de un recurso, el acceso es el más
    restrictivo entre el recurso y NTFS: cuando los dos están abiertos a
    todo el mundo, todo el mundo escribe. Da los permisos al grupo
    Teachers, y mantén al menos una cerradura cerrada para el resto.
two-locks-event-admin =
    Un profesor en Administrators pasa todas las cerraduras, en todo el
    servidor: sus archivos, los de la secretaría, los del sistema. Eso no
    es un arreglo, es quitar las cerraduras. Sácalo de Administrators
    (Remove-LocalGroupMember) y da los permisos al grupo Teachers.
two-locks-event-full-control =
    A través del recurso y de NTFS, el profesorado tiene ahora Full
    Control: podría cambiar él mismo los permisos, o apropiarse de los
    archivos. Change en el recurso y Modify en NTFS bastan para trabajar.
two-locks-event-end =
    Samir: «Lucia ha guardado las programaciones de diciembre en
    LessonPlans, yo he puesto las partes en Scores, y Beatriz lo ha
    comprobado: no puede tocar nuestra carpeta. ¡Perfecto, gracias! ¿Nos
    vemos en el concierto?»

    ¡Bien hecho! Has terminado el capítulo «Dos cerraduras».

    QUÉ HA PASADO
    El profesorado llega a sus archivos a través de \\pentagrama\Teachers,
    y ahí deciden dos conjuntos de permisos: los del recurso y los de NTFS.
    Windows se queda con el más restrictivo de los dos. El recurso, vuelto
    a crear con el valor por defecto de New-SmbShare, daba a Everyone solo
    Read; y LessonPlans, congelada durante la copia del verano, había
    perdido su herencia y solo conservaba permisos de lectura para el
    profesorado. Dos cerraduras, las dos cerradas: abriste cada una, solo
    para el grupo Teachers.

    BUENA PRÁCTICA
    - A través de un recurso, el acceso efectivo es los permisos del
      recurso Y los permisos NTFS: gana el más restrictivo. Lee los dos:
      Get-SmbShareAccess, y luego Get-Acl o icacls.
    - Da los permisos a grupos (Teachers), no a personas, y nunca acceso
      de escritura a Everyone.
    - Una elección habitual: permisos del recurso amplios (Authenticated
      Users, Change) y NTFS preciso, o preciso en los dos lados; nunca
      amplio en los dos.
    - (OI)(CI) para que hereden archivos y subcarpetas; una carpeta con la
      herencia desactivada (sin (I)) solo conserva sus propias entradas.
    - Administrators no es un arreglo de permisos, y Full Control permite
      cambiar los permisos: Change y Modify bastan.
    - Una congelación «temporal» se anota con su fecha de fin, y se
      levanta.

    OTRA MANERA
    New-SmbShare -Name Teachers -Path D:\Shares\Teachers -ChangeAccess
    PENTAGRAMA\Teachers habría creado el recurso bien desde el principio. Set-Acl
    con una FileSystemAccessRule hace lo que hace icacls. En el Explorador,
    Propiedades > Seguridad > Opciones avanzadas > Acceso efectivo muestra
    el acceso de un usuario. Y para llegar directamente a PowerShell por
    ssh, el OpenSSH de Windows lee DefaultShell en HKLM:\SOFTWARE\OpenSSH
    (New-ItemProperty).

    DOCUMENTACIÓN
    - Permisos de recurso y NTFS: https://learn.microsoft.com/troubleshoot/windows-server/networking/permissions-on-shared-folders-and-ntfs
    - Grant-SmbShareAccess: https://learn.microsoft.com/powershell/module/smbshare/grant-smbshareaccess
    - icacls: https://learn.microsoft.com/windows-server/administration/windows-commands/icacls
    - Get-Acl: https://learn.microsoft.com/powershell/module/microsoft.powershell.security/get-acl?view=powershell-5.1
    - DefaultShell de OpenSSH: https://learn.microsoft.com/windows-server/administration/openssh/openssh-server-configuration
