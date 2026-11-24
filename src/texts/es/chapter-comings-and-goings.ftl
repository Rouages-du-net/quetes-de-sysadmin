### Historia «El Fichero», capítulo «Llegadas y salidas»: un bibliotecario
### nuevo empieza el lunes, otro se ha ido hoy. Los textos compartidos de la
### historia (el traspaso de Tomas, las convenciones) también están aquí. Los
### comandos, cmdlets, nombres de cuenta, DN, rutas, contraseñas y salidas no
### se traducen.

chapter-comings-and-goings = Llegadas y salidas
    .summary = Tu primer viernes en el controlador de dominio de las bibliotecas: crea la cuenta del bibliotecario que empieza el lunes, con los permisos de su puesto y nada más, y cierra la cuenta del que se ha ido hoy, sin borrarla.

## The story's shared files

card-catalogue-handover =
    registro - notas de traspaso (Tomas, 20 de diciembre de 2029)

    El dominio: lending.internal (nombre NetBIOS LENDING), tres
    bibliotecas: Central, Riverside, Hilltop.
      - registro.internal (192.0.2.46): el controlador de dominio, Windows
        Server 2022 (Active Directory, DNS). Aquí OpenSSH llega a
        PowerShell, con tu clave. El módulo ActiveDirectory está
        instalado: Get-Command -Module ActiveDirectory.
      - estantes (192.0.2.47): el servidor de archivos (recursos Staff,
        Events, Archives, Finance, Scans). Desde registro: ssh estantes
        (tu clave está en %USERPROFILE%\.ssh, y autorizada allí).

    Estás en Domain Admins: todas las cuentas, todos los grupos, todos los
    servidores. Úsalo con cuidado. Lee Documents\convenciones.txt antes de
    crear nada.

    Cosas que no terminé:
      - svc_scans (OU=Service Accounts): creada en diciembre para sustituir
        la cuenta de Rafael en la tarea de importación de escaneos de
        estantes. Todavía no se ha cambiado. Su contraseña está en el
        gestor (Nandini puede exportarla).
      - La unidad de Events (GPO «Events Drive») solo está vinculada donde
        la probé.
      - Una limpieza de cuentas viejas (algunas llevan meses sin iniciar
        sesión).

    Suerte. Ahora estoy en el departamento de informática del
    ayuntamiento, puedes llamarme.
    Tomas

card-catalogue-conventions =
    LENDING - cómo está organizado el dominio (Tomas)

    CUENTAS
      - Nombre (sAMAccountName): primera letra del nombre + apellido, en
        minúsculas, sin acentos: Thanh Nguyen -> tnguyen.
      - Nombre completo (Name, CN): «Nombre Apellido». GivenName y Surname
        rellenados.
      - Dónde: OU=<biblioteca>,OU=Branches,DC=lending,DC=internal
        (Central, Riverside o Hilltop).
      - Department, Title y Manager: como los escribe RR. HH. en el ticket.
      - Primera contraseña: la elegimos nosotros, la entrega en persona el
        responsable la primera mañana, y hay que cambiarla en el primer
        inicio de sesión. El dominio quiere al menos 10 caracteres, tres
        tipos (mayúsculas, minúsculas, cifras, símbolos), y no el nombre
        de la persona.

    GRUPOS (AGDLP)
      - Las A de Accounts (cuentas) van en G de grupos Globales, uno por
        departamento: GG_Lending, GG_Children, GG_LocalHistory,
        GG_Management.
      - Los grupos globales van en DL de grupos de Dominio Local, uno por
        recurso compartido y nivel: DL_Staff_RW, DL_Events_RW,
        DL_Archives_RW, DL_Archives_RO, DL_Finance_RW.
      - P de Permisos: solo los grupos DL_ aparecen en los permisos NTFS
        de estantes.
      - Así que una persona va en el grupo GG_ de su departamento, y en
        ningún otro. Las excepciones se escriben en el ticket de la cuenta.

    BAJAS
      - Nunca se borran durante un año: su SID es propietario de archivos
        en estantes, su buzón está archivado, la auditoría puede preguntar.
      - El último día: desactivada, movida a OU=Leavers, fuera de sus
        grupos. La descripción dice cuándo se fue.

    DIRECTIVAS DE GRUPO
      - Una GPO se vincula a la OU de aquello para lo que es: OU=Branches
        para el personal, OU=Servers para los servidores. La raíz del
        dominio solo lleva la Default Domain Policy.
      - Quién la recibe: filtrado de seguridad con los mismos grupos que el
        recurso compartido al que se refiere (grupos GG_, o el grupo DL_
        del recurso).

    CUENTAS DE SERVICIO
      - svc_*, en OU=Service Accounts: una por tarea, nunca la cuenta de
        una persona. Algunas solo se ejecutan unas pocas veces al año.

## Files

comings-and-goings-email-nandini =
    De:    Nandini Mukherjee (directora de la red)
    Para:  tú

    ¡Hola, y te damos la bienvenida!

    Dos tickets de RR. HH. para ti antes del fin de semana, los dos en tus
    Documents:

      - rrhh-0112-llegada.txt: Kofi Mensah empieza el lunes en Riverside.
        Ines le dará su contraseña a las 9:00.
      - rrhh-0113-salida.txt: Mateo Rossi ha dejado Hilltop hoy. Su
        último día fue bien; seguimos en contacto.

    Las convenciones de Tomas están en Documents\convenciones.txt. ¡Buen
    fin de semana!

    Nandini

comings-and-goings-ticket-arrival =
    Ticket de RR. HH. 0112 - LLEGADA
    Abierto el 2 de enero de 2030 por RR. HH. (Rebecca Owusu)

    Nombre:          Kofi Mensah
    Incorporación:   lunes 7 de enero de 2030
    Biblioteca:      Riverside
    Departamento:    Children
    Puesto:          Youth Librarian
    Responsable:     Ines Duarte (iduarte)

    Accesos: «los mismos que Amara Okoye, mismo puesto, misma biblioteca».
    Si es más fácil, copiad la cuenta de Amara.

    Excepciones: ninguna.

comings-and-goings-ticket-departure =
    Ticket de RR. HH. 0113 - SALIDA
    Abierto el 4 de enero de 2030 por RR. HH. (Rebecca Owusu)

    Nombre:          Mateo Rossi (mrossi)
    Último día:      viernes 4 de enero de 2030
    Biblioteca:      Hilltop
    Departamento:    Lending

    Por favor, cerrad sus accesos esta noche. Sus archivos del recurso
    Staff se quedan donde están: Bongani los ordenará.

## Events

comings-and-goings-event-ous =
    El árbol del dominio: OU=Branches contiene una OU por biblioteca, ahí
    viven las personas; Groups, Leavers, Servers, Service Accounts y
    Workstations al lado. Un DN se lee desde el objeto hasta el dominio,
    como en «El directorio»: el de Kofi sería
    CN=Kofi Mensah,OU=Riverside,OU=Branches,DC=lending,DC=internal.
comings-and-goings-event-colleague =
    Amara es más que bibliotecaria infantil: está en GG_Management
    (subdirectora en funciones en Riverside desde el otoño) y,
    directamente, en DL_Finance_RW, una excepción mientras se ocupa del
    presupuesto. «Lo mismo que Amara» le daría a Kofi el recurso de
    finanzas desde su primer día. Dale el grupo de su puesto, no la
    historia de su compañera.
comings-and-goings-event-agdlp =
    Ahí está AGDLP: DL_Events_RW, el grupo de los permisos NTFS del
    recurso, no contiene personas sino grupos globales, GG_Children y
    GG_Management. Un nuevo bibliotecario infantil solo necesita
    GG_Children: el anidamiento hace el resto.
comings-and-goings-event-complexity =
    Rechazado: la política de contraseñas del dominio (Default Domain
    Policy) quiere al menos 10 caracteres, tres tipos de caracteres, y
    nada del nombre de la cuenta ni del nombre de la persona. Cuidado:
    New-ADUser creó la cuenta de todos modos, sin contraseña y
    desactivada. Dale una contraseña con Set-ADAccountPassword -Reset, o
    borra esta cuenta a medio hacer y vuelve a empezar.
comings-and-goings-event-other-name =
    Esa cuenta no tiene el nombre que dicen las convenciones: primera
    letra del nombre y el apellido, en minúsculas, kmensah. Todos los
    scripts y todos los compañeros buscarán kmensah. Cámbiale el nombre
    (Set-ADUser -SamAccountName, y su UserPrincipalName), o bórrala y
    vuelve a crearla.
comings-and-goings-event-created =
    La cuenta de Kofi existe. Compruébala como se lee el ticket: Get-ADUser
    kmensah -Properties Department, Title, Manager, Enabled.
comings-and-goings-event-created-disabled =
    La cuenta está desactivada: New-ADUser crea una cuenta desactivada si
    no recibe una contraseña que el dominio acepte y -Enabled $true.
    Enable-ADAccount, una vez que tenga contraseña.
comings-and-goings-event-wrong-ou =
    Kofi no está en OU=Riverside,OU=Branches: las directivas y
    delegaciones de la biblioteca no le llegarán ahí. Move-ADObject mueve
    un objeto a otra OU (-TargetPath, un DN).
comings-and-goings-event-copied =
    Kofi tiene ahora los extras de Amara: GG_Management, o DL_Finance_RW,
    los presupuestos y las facturas. Esa es la trampa de copiar a una
    compañera: copias su historia, sus excepciones, sus funciones
    interinas, no su puesto. Sácalo de esos grupos (Remove-ADGroupMember,
    o Remove-ADPrincipalGroupMembership).
comings-and-goings-event-direct-dl =
    Kofi está directamente en un grupo DL_. Hoy funciona, pero las
    convenciones dicen AGDLP: personas solo en grupos GG_, grupos GG_ en
    grupos DL_. Una persona en un grupo DL_ es una excepción que nadie
    verá cuando cambien los permisos del departamento. Sácalo y ponlo en
    GG_Children.
comings-and-goings-event-admin =
    Kofi es ahora administrador del dominio, o de sus servidores. Un
    bibliotecario infantil necesita horas del cuento, no las llaves de
    todas las cuentas. Sácalo de ese grupo enseguida.
comings-and-goings-event-no-change =
    La cuenta de Kofi tiene contraseña pero no tendrá que cambiarla: la
    contraseña que elegiste, y que Ines le entregará en papel, seguiría
    siendo la suya. Set-ADUser kmensah -ChangePasswordAtLogon $true.
comings-and-goings-event-details =
    Casi: compara la cuenta con el ticket, campo por campo: GivenName,
    Surname, Department, Title, Manager (Get-ADUser kmensah -Properties
    Department, Title, Manager). Set-ADUser corrige lo que difiera.
comings-and-goings-event-arrival =
    Kofi está listo para el lunes: en su biblioteca, solo el grupo de su
    puesto, una primera contraseña que cambiará a las 9:01. Ahora, Mateo.
comings-and-goings-event-deleted =
    La cuenta de Mateo ha desaparecido. Con ella se fue su SID: los
    archivos de los que es propietario en estantes muestran ahora un
    propietario desconocido S-1-5-21-…, la pregunta de la auditoría
    «¿quién tenía acceso en diciembre?» no tiene respuesta, y una cuenta
    nueva con el mismo nombre sería otra persona, con otro SID. Por suerte,
    Tomas activó la Papelera de reciclaje de AD (Get-ADOptionalFeature
    'Recycle Bin Feature'): la cuenta espera en CN=Deleted Objects,
    entera. Encuéntrala con Get-ADObject -IncludeDeletedObjects, devuélvela
    con Restore-ADObject (Get-Help Restore-ADObject -Examples) y luego
    ciérrala como dicen las convenciones.
comings-and-goings-event-restored =
    Mateo ha vuelto a donde estaba, con el mismo SID, sus atributos e
    incluso sus grupos: la Papelera de reciclaje conserva los valores de
    vínculo. Por eso vuelve a estar su grupo. Ahora: desactivada, fuera de
    sus grupos, en Leavers.
comings-and-goings-event-leaver-disabled =
    La cuenta de Mateo está desactivada: ya nadie puede iniciar sesión con
    ella, y sigue existiendo, con su SID. Ahora bien, ¿a qué sigue
    perteneciendo?
comings-and-goings-event-leaver-groups =
    Mateo está fuera de sus grupos: si un día alguien activara la cuenta
    por error, no abriría nada. Una cosa más: la OU donde esperan las
    bajas.
comings-and-goings-event-leaver-groups-moved =
    Mateo está fuera de sus grupos, en OU=Leavers.
comings-and-goings-event-leaver-moved =
    Mateo está en OU=Leavers, pero sigue en sus grupos: GG_Lending todavía
    lo lista. Get-ADPrincipalGroupMembership mrossi dice cuáles (Domain
    Users, su grupo principal, se queda).
comings-and-goings-event-end =
    Nandini: «Kofi empieza el lunes, lo de Mateo está cerrado. ¡Gracias, y
    buen fin de semana!»

    ¡Bien hecho! Has terminado el capítulo «Llegadas y salidas».

    QUÉ HA PASADO
    Dos tickets de RR. HH. un viernes. Creaste la cuenta de Kofi donde la
    espera el dominio (OU=Riverside,OU=Branches), con lo que dice el
    ticket (Department, Title, Manager), una primera contraseña que debe
    cambiar, y un grupo, GG_Children: el de su departamento. Cerraste la
    cuenta de Mateo sin borrarla: desactivada, fuera de sus grupos,
    movida a OU=Leavers.

    AGDLP
    Las cuentas (Accounts) van en grupos Globales (uno por departamento,
    GG_), los grupos globales en grupos de Dominio Local (uno por recurso
    y nivel, DL_), y solo los grupos de dominio local reciben Permisos
    sobre los archivos. Cuando cambian los permisos de un departamento,
    cambias un anidamiento, no cuarenta cuentas; cuando alguien llega,
    basta un grupo. Copiar a una compañera copia sus excepciones con su
    puesto: parte del puesto.

    COMO EN «EL DIRECTORIO», EN ACTIVE DIRECTORY
    Active Directory es un directorio LDAP: el DN de Kofi,
    CN=Kofi Mensah,OU=Riverside,OU=Branches,DC=lending,DC=internal, se lee
    como uid=…,ou=…,dc=… en OpenLDAP, y los filtros LDAP que escribiste con
    ldapsearch funcionan aquí también:
    Get-ADUser -LDAPFilter '(&(department=Children)(title=Youth*))'.
    Get-ADUser -Filter "Department -eq 'Children'" es la misma búsqueda en
    el lenguaje propio de PowerShell.

    BUENA PRÁCTICA
    - Crea a partir del ticket y de las convenciones, no de un compañero.
    - Una primera contraseña que la persona cambia en su primer inicio de
      sesión (-ChangePasswordAtLogon $true), entregada en persona.
    - Una baja se desactiva, no se borra: el SID es propietario de
      archivos, los registros lo nombran, y una cuenta borrada no se puede
      recuperar sin la Papelera de reciclaje de AD (aquí está activada:
      Restore-ADObject salvó la situación, pero solo guarda un objeto
      borrado 180 días).
    - Fuera de los grupos, con una descripción que diga cuándo y por qué.

    DOCUMENTACIÓN
    - New-ADUser: https://learn.microsoft.com/powershell/module/activedirectory/new-aduser
    - Los grupos de seguridad y su ámbito: https://learn.microsoft.com/windows-server/identity/ad-ds/manage/understand-security-groups
    - La contraseña debe cumplir los requisitos de complejidad: https://learn.microsoft.com/windows-server/security/group-policy/password-must-meet-complexity-requirements
    - Disable-ADAccount: https://learn.microsoft.com/powershell/module/activedirectory/disable-adaccount
    - Move-ADObject: https://learn.microsoft.com/powershell/module/activedirectory/move-adobject
