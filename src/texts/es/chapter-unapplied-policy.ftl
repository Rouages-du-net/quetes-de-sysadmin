### Historia «El Fichero», capítulo «La directiva que no se aplica»: una GPO
### que asigna la unidad de Events solo llega a una parte de las personas a
### las que va destinada: un vínculo en la OU equivocada y un filtrado de
### seguridad al que le falta un grupo. Los comandos, cmdlets, nombres de
### cuenta, de equipo, de GPO y las salidas no se traducen.

chapter-unapplied-policy = La directiva que no se aplica
    .summary = Los carteles de las horas del cuento de primavera están en el recurso Events, pero la mitad de quienes los necesitan no tienen la unidad E:. Lee lo que aplicó la directiva de grupo en sus puestos, averigua por qué la GPO no les llega y arréglalo sin darle la unidad a todo el mundo.

## Files

unapplied-policy-email-nandini =
    De:    Nandini Mukherjee (directora de la red)
    Para:  tú

    Buenos días:

    Los carteles de las horas del cuento de primavera están listos en el
    recurso Events, y las bibliotecas deberían imprimirlos hoy. Salvo
    que:

      - Josephine (Hilltop) no tiene la unidad E:. Está en HILL-DESK1.
      - Kofi (Riverside) tampoco, en RIVER-DESK1.
      - ¡Y yo! Estoy en CENTRAL-DESK1, tampoco tengo E:. Y sin embargo el
        equipo infantil de aquí, en Central, la tiene desde el otoño.

    Bongani (HILL-DESK2) dice que él tampoco tiene E:, pero nunca la usa.
    Thanh no la necesita, está en el mostrador de préstamos.

    Ahora mismo todos tienen la sesión iniciada. Tomas decía que la unidad
    viene de «una GPO». ¿Podrías echar un vistazo?

    Nandini

## Events

unapplied-policy-event-no-rsop =
    «Does not have RSoP data»: gpresult muestra lo que se aplicó en ESTE
    equipo, en sus inicios de sesión. Josephine nunca ha iniciado sesión
    en registro. El conjunto resultante de directivas vive en su puesto:
    gpresult puede leerlo a distancia (man gpresult: /s, /user), y también
    Get-GPResultantSetOfPolicy.
unapplied-policy-event-gpupdate-here =
    Eso ha actualizado la directiva del propio registro: el controlador de
    dominio, y tú. Los puestos de los bibliotecarios se actualizan solos
    (cada 90 minutos, o en el próximo inicio de sesión), o cuando se les
    pide desde aquí: Get-Help Invoke-GPUpdate.
unapplied-policy-event-josephine =
    Su puesto aplicó Staff Drives (S:), y descartó por filtrado Archives
    Drive (no está en historia local). Pero Events Drive no aparece en
    ninguna parte: ni aplicada ni descartada. Una GPO que gpresult ni
    siquiera lista no se encontró al bajar del dominio a su OU: ningún
    vínculo le llega. ¿Dónde está vinculada? (Get-Help Get-GPInheritance,
    Get-GPOReport.)
unapplied-policy-event-links =
    Events Drive solo está vinculada a OU=Central, donde la probó Tomas.
    Riverside y Hilltop heredan lo que está vinculado por encima de ellas
    (el dominio, OU=Branches), no lo vinculado en una OU hermana. Las
    convenciones de Tomas dicen dónde va una GPO para el personal.
unapplied-policy-event-root =
    Un vínculo en la raíz del dominio: todas las cuentas y todos los
    equipos del dominio leen ahora esta GPO en cada inicio de sesión y
    actualización, el controlador de dominio y los servidores incluidos,
    y solo el filtrado de seguridad se interpone entre la unidad y todo el
    mundo. Las convenciones reservan la raíz para la Default Domain
    Policy: vincúlala mejor a OU=Branches (Remove-GPLink, New-GPLink).
unapplied-policy-event-enforced =
    Enforced solo se impone a una herencia bloqueada y a las GPO
    vinculadas más abajo. No hace que una GPO llegue a una OU por encima de
    la cual no está vinculada, ni que pase el filtrado de seguridad. Aquí
    nada bloquea la herencia: quítalo (Set-GPLink … -Enforced No).
unapplied-policy-event-linked =
    Todas las bibliotecas están ahora bajo un vínculo de Events Drive.
    ¿Basta con eso? Actualiza un puesto y vuelve a leer su resultado;
    también el de Nandini.
unapplied-policy-event-nandini =
    En Central, donde el vínculo siempre ha estado, el puesto de Nandini
    lista Events Drive entre las «filtradas»: Filtering: Denied
    (Security). La GPO llegó a su cuenta; sus permisos no la dejaron
    aplicarse. ¿Quién puede aplicarla? (Get-Help Get-GPPermission.)
unapplied-policy-event-filtering =
    Apply Group Policy: solo GG_Children. Tomas la probó con el equipo
    infantil; se olvidó de los responsables. El recurso que asigna,
    Events, es para DL_Events_RW: GG_Children y GG_Management.
# { $accounts }: nombres de cuenta (no se traducen).
unapplied-policy-event-everyone =
    Ahora la unidad llega a personas a las que no está destinada:
    { $accounts }… Todo el personal de préstamo, todo el de archivo, las
    cuentas de servicio si el vínculo está lo bastante alto, reciben una
    E: que ni siquiera pueden abrir (los permisos NTFS del recurso son
    para DL_Events_RW). El filtrado de seguridad debería nombrar los mismos
    grupos que el recurso, no Authenticated Users. (Authenticated Users
    conserva GpoRead: los equipos necesitan leer la GPO.)
unapplied-policy-event-filtered =
    Los responsables ya pueden aplicarla, y nadie más la ha ganado.
unapplied-policy-event-filtered-unlinked =
    Los responsables ya pueden aplicarla, y nadie más la ha ganado. En
    Central, eso basta; Riverside y Hilltop siguen sin ningún vínculo por
    encima.
unapplied-policy-event-right =
    En el directorio, la directiva es correcta: todo el personal de la
    sección infantil y todos los responsables de las tres bibliotecas
    recibirían E:, nadie más. Pero los puestos la aplican en su próxima
    actualización: pídeselo ahora a uno (Get-Help Invoke-GPUpdate
    -Examples), y comprueba con gpresult.
unapplied-policy-event-end =
    Josephine, un minuto después: «¡Ya está E:! Imprimiendo los carteles.»

    ¡Bien hecho! Has terminado el capítulo «La directiva que no se
    aplica».

    QUÉ HA PASADO
    Tomas creó la GPO «Events Drive» en otoño y la probó en Central con el
    equipo infantil: la vinculó a OU=Central y la filtró a GG_Children. Dos
    capas, dos síntomas. En Riverside y Hilltop, gpresult ni siquiera
    listaba la GPO: ningún vínculo por encima de su OU. En Central, la
    listaba como «Denied (Security)» para Nandini: le llegaba, pero no
    tenía permiso. La vinculaste donde está el personal, diste a
    GG_Management el derecho a aplicarla y pediste a un puesto que se
    actualizara.

    BUENA PRÁCTICA
    - Parte del resultado, en el equipo de la persona: gpresult /s EQUIPO
      /user DOMINIO\usuario /r (o Get-GPResultantSetOfPolicy). Aplicada,
      filtrada (y por qué), o ausente: tres problemas distintos.
    - Ausente: un problema de vínculo (dónde está vinculada, herencia
      bloqueada, el objeto en otra OU de la que crees). «Denied
      (Security)»: filtrado de seguridad. «Disabled (Link)», «Disabled
      (GPO)», «Not Applied (Empty)»: la propia GPO.
    - Vincula donde están los objetos, filtra con los grupos a los que se
      refiere el ajuste. Ni en la raíz, ni Enforced, ni Authenticated
      Users por reflejo.
    - Conserva GpoRead para Authenticated Users (o Domain Computers) al
      filtrar: desde la actualización MS16-072, los equipos también leen
      las GPO de usuario.
    - Tras un cambio: Invoke-GPUpdate -Computer, o espera a la
      actualización en segundo plano (90 minutos, más o menos 30).

    COMO EN «EL DIRECTORIO», EN ACTIVE DIRECTORY
    Una GPO vive en el directorio (CN={"{"}GUID{"}"},CN=Policies,CN=System) y
    una OU apunta a ella con su atributo gPLink, que el módulo muestra como
    LinkedGroupPolicyObjects: Get-ADOrganizationalUnit
    'OU=Branches,DC=lending,DC=internal' | Select-Object -ExpandProperty
    LinkedGroupPolicyObjects muestra el vínculo que añadiste.

    DOCUMENTACIÓN
    - gpresult: https://learn.microsoft.com/windows-server/administration/windows-commands/gpresult
    - Filtrado de seguridad: https://learn.microsoft.com/troubleshoot/windows-server/group-policy/apply-group-policy-objects-users-computers
    - New-GPLink: https://learn.microsoft.com/powershell/module/grouppolicy/new-gplink
    - Set-GPPermission: https://learn.microsoft.com/powershell/module/grouppolicy/set-gppermission
    - Invoke-GPUpdate: https://learn.microsoft.com/powershell/module/grouppolicy/invoke-gpupdate
