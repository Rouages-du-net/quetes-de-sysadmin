### Historia «Windows al Lado», capítulo «El otro lado»: el volumen del
### recurso compartido está lleno, pero no por culpa del recurso; una mirada
### dentro del servidor Windows a través de su OpenSSH y PowerShell, en solo
### lectura. Los comandos, cmdlets, rutas y salidas no se traducen.

chapter-full-volume = El otro lado
    .summary = El recurso compartido de Windows está lleno aunque el recurso en sí no lo está: entra a mirar en el servidor Windows a través de su OpenSSH, léelo con unos cuantos cmdlets de PowerShell y anota qué llena el disco para la persona que se ocupa de él.

## Files

full-volume-email-ifeoma =
    De:    Ifeoma
    Para:  tú

    Hola:

    Plotter no consiguió guardar los PDF de esta mañana en armario: «No
    space left on device», dice su registro (/var/log/plotter/export.log).
    Es raro: nuestros planos no son tan grandes, y nadie ha añadido nada
    esta semana, que yo sepa.

    Priya viene el primer lunes del mes, y es ella quien administra
    armario: por favor, no cambies nada en él. Pero tienes una cuenta allí
    (puso tu clave), y dice que es «OpenSSH, integrado en Windows».
    ¿Podrías ir a mirar qué lo llena y anotar lo que encuentres en
    informe-armario.txt? Se lo enviaré.

    Ifeoma

full-volume-report =
    armario - por qué está lleno el recurso compartido (para Priya)

    El volumen lleno:
    Qué lo llena (ruta completa):
    Desde cuándo:
    Visto en el registro de eventos:

## Events

full-volume-event-full =
    df lo dice: el volumen del recurso está lleno (100%), unos 500 GB. Es
    el disco de armario, tal como lo cuenta armario, no solo la carpeta del
    recurso. ¿Cuánto contiene el propio recurso? (du)
full-volume-event-outside =
    El recurso contiene unos 60 GB, el volumen 500 GB: lo que lo llena está
    en el mismo disco, pero fuera del recurso, donde compas no ve. Para
    mirar ahí, hay que estar en armario: su OpenSSH, integrado en Windows,
    abre un PowerShell.
full-volume-event-deleted-drawings =
    Cuidado: eran los planos del estudio, y hacer sitio no te corresponde
    aquí. El recurso solo contiene una fracción del volumen: lo que lo
    llena está en otra parte.
full-volume-event-powershell =
    «PS C:\Users\tu>»: estás en Windows, en PowerShell. Los comandos se
    llaman cmdlets, con nombres verbo-sustantivo (Get-ChildItem,
    Get-Service), sus parámetros empiezan por un guion (-Recurse), y las
    mayúsculas no importan. Algunos nombres de Linux funcionan como alias
    (ls, cat, cd, pwd). Get-Help NOMBRE es el manual; Get-Command lista lo
    que hay.
full-volume-event-linux-habit =
    No todos los comandos de Linux tienen un alias en PowerShell: grep, df
    o du no existen aquí. Los equivalentes son cmdlets: Get-Volume o
    Get-PSDrive para los discos, Get-ChildItem para los archivos,
    Where-Object para filtrar. Get-Help y Get-Command para encontrarlos.
full-volume-event-parameter =
    ls es solo un alias de Get-ChildItem, y Get-ChildItem no tiene ni -l ni
    -a: sus parámetros tienen nombre (-Force para los archivos ocultos,
    -Recurse para bajar). Get-Help Get-ChildItem los lista.
full-volume-event-volume =
    D: (Data): 500 GB, quedan unos 11 MB. Es el volumen de los recursos
    compartidos (D:\Shares). ¿Qué lo llena? Get-ChildItem puede recorrer
    toda la unidad (-Recurse), y sus objetos se pueden ordenar por tamaño
    antes de mirarlos.
full-volume-event-culprit =
    Ahí está: plans-full-2029-11-03.zip, más de 400 GB, en D:\Backup, fuera
    de los recursos, escrito el 3 de noviembre. Una copia completa de los
    planos, comprimida y olvidada. Anótalo en informe-armario.txt (el
    volumen, el archivo, desde cuándo); el registro de eventos puede
    decirte desde cuándo se queja Windows (Get-WinEvent o Get-EventLog).
full-volume-event-event-log =
    Evento 2013 de srv (el servidor de archivos): «The D: disk is at or
    near capacity», cada pocas horas desde el 18 de noviembre. Windows lo
    venía diciendo; nadie lo leía.
full-volume-event-read-only =
    Estás aquí para leer: cambiar armario le corresponde a Priya. Anota lo
    que encontraste; ella hará lo que haya que hacer.
full-volume-event-end =
    Ifeoma: «Le he enviado tu informe a Priya. Lo supo enseguida: el 3 de
    noviembre, antes de mover el recurso, comprimió todos los planos por
    precaución y se olvidó del zip. Lo ha quitado desde su casa, y Plotter
    entregará mañana los PDF. Pregunta si te gustaría venir el lunes, a
    ver el lado Windows.»

    ¡Bien hecho! Has terminado el capítulo «El otro lado».

    QUÉ HA PASADO
    El recurso estaba lleno porque su volumen lo estaba: df en Linux
    muestra el disco del servidor, du solo el recurso. El resto quedaba
    fuera de la vista de Linux. A través del OpenSSH de armario (integrado
    en Windows desde 2019), llegaste a PowerShell, encontraste el volumen
    (Get-Volume, Get-PSDrive), el archivo (Get-ChildItem -Recurse,
    ordenado por Length) y los avisos que Windows había escrito
    (Get-WinEvent). Leíste, anotaste y dejaste el cambio a la persona que
    administra el servidor.

    BUENA PRÁCTICA
    - df y du no miden lo mismo: en un recurso de red, df es el volumen del
      servidor.
    - PowerShell pasa objetos, no texto: ordena y selecciona por
      propiedades (Sort-Object Length -Descending, Select-Object -First 5),
      y deja el formato para el final.
    - Get-Help y Get-Command son el manual: el reflejo «primero el manual»
      también vale en Windows.
    - En un servidor que no administras, lee e informa: el volumen, el
      archivo con su ruta completa, la fecha, los eventos.
    - Vigila los discos de los servidores de los que dependes (un recurso
      que se llena detiene servicios al otro lado).

    OTRA MANERA
    El PowerShell de Linux (pwsh) ejecuta los mismos cmdlets en Linux;
    Windows Admin Center y el Explorador muestran lo mismo en ventanas. WSL
    lleva un Linux a los puestos Windows, al revés. Administrar Windows es
    una historia aparte.

    DOCUMENTACIÓN
    - OpenSSH para Windows: https://learn.microsoft.com/windows-server/administration/openssh/openssh-overview
    - Get-ChildItem: https://learn.microsoft.com/powershell/module/microsoft.powershell.management/get-childitem?view=powershell-5.1
    - Get-Volume: https://learn.microsoft.com/powershell/module/storage/get-volume
    - Get-WinEvent: https://learn.microsoft.com/powershell/module/microsoft.powershell.diagnostics/get-winevent?view=powershell-5.1
    - Acerca de las canalizaciones: https://learn.microsoft.com/powershell/module/microsoft.powershell.core/about/about_pipelines?view=powershell-5.1
