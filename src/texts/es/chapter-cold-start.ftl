### Historia «El Centro de Salud», capítulo «El arranque en frío»: tras un
### corte de luz, la máquina virtual de contabilidad no volvió; arrancada a
### mano, se pausa con un /var lleno: una cadena de instantáneas externas
### olvidadas. virsh list, dominfo, domstate, domblkerror, qemu-img info,
### blockcommit, snapshot-delete, autostart. Los comandos, las opciones, las
### rutas y las salidas no se traducen.

chapter-cold-start = El arranque en frío
    .summary = El sábado por la noche una tormenta cortó la luz en el valle. El lunes la agenda de citas de recepción ha vuelto, pero el servidor de contabilidad no, y Priya tiene que enviar las nóminas. Averigua por qué una máquina virtual se quedó apagada, por qué se congela en cuanto arranca, y haz sitio en el hipervisor sin perder un año de cuentas.

## Archivos

cold-start-message-grace =
    De: Grace (gerente del centro)
    Lunes 11 de marzo, 8:05

    ¡Buenos días, y bienvenida o bienvenido al Centro de Salud de
    Millbrook!

    La tormenta del sábado por la noche cortó la luz durante tres horas,
    más de lo que aguanta el SAI. hogar, el servidor de la trastienda,
    volvió a arrancar solo cuando volvió la luz. La agenda de citas
    (agenda) y las historias clínicas (records) funcionan; la contabilidad
    (ledger) no, y Priya tiene que enviar las nóminas el miércoles.

    Todos nuestros servidores son máquinas virtuales en hogar (KVM, con
    libvirt): estás en el grupo libvirt, y sudo funciona con tu
    contraseña. Ilse, que lo montó todo, se ha mudado a la costa; dejó
    una nota en tu carpeta personal. Priya también dejó una.

    Por favor, no pierdas las cuentas de Priya.

    Grace

cold-start-note-ilse =
    Notas de Ilse (hogar)

    - virsh es tu amigo: virsh list --all muestra todas las VM, en marcha
      o no. ~/.config/libvirt/libvirt.conf dirige virsh a qemu:///system.
    - Imágenes en /var/lib/libvirt/images (solo root: usa sudo).
    - Antes de cualquier cosa arriesgada en ledger hice una instantánea
      (virsh snapshot-create-as --disk-only): antes de la actualización del
      programa, antes del cierre del ejercicio, antes del paso a Debian 13.
      Quería limpiarlas después...
    - ledger-test-clone.qcow2 es una copia que hice en enero para probar
      la nueva versión de contabilidad con Priya. Nada la usa; puede irse
      en cuanto ella diga que la prueba ha terminado.

    Ilse

cold-start-message-priya =
    De: Priya (contabilidad, lunes y miércoles)

    ¡Hola! La prueba de la nueva versión que hizo Ilse en enero ha
    terminado: nos quedamos con la antigua. Su copia de prueba se puede
    borrar, no la necesito.

    Las cuentas de verdad están en ledger, y las necesito para el
    miércoles.

    Priya

## Eventos

cold-start-event-list =
    ledger está «shut off»: agenda y records volvieron con hogar, ledger
    no. Un dominio arranca con su anfitrión solo si está marcado autostart
    (virsh dominfo lo muestra). Antes de arrancarlo, míralo: virsh dominfo
    ledger.
cold-start-event-autostart-off =
    Autostart: disable. ledger nunca volvió solo tras un reinicio: alguien
    lo arrancaba siempre a mano. Eso tiene arreglo (man virsh, autostart),
    pero primero, ¿arranca siquiera? virsh start ledger.
cold-start-event-paused =
    ledger arrancó... y se congeló unos segundos después: ahora está
    «paused» (virsh list). QEMU pausa a un invitado que no puede escribir
    en su disco en lugar de dejar que corrompa su sistema de archivos (su
    política werror=enospc por defecto). ¿Por qué? virsh domstate ledger
    --reason, virsh domblkerror ledger, ¿y qué dice el disco del anfitrión
    (df -h)?
cold-start-event-no-space =
    «vda: no space», y /var está al 100 %: el invitado escribió, su imagen
    creció, y el sistema de archivos que contiene las imágenes está lleno.
    ¿Qué ocupa todo ese espacio? sudo ls -lh /var/lib/libvirt/images, ¿y
    qué imágenes usa de verdad ledger? virsh domblklist ledger, luego
    qemu-img info sobre su disco (sudo).
cold-start-event-lock =
    qemu-img se niega: la imagen está en uso, y QEMU tiene un bloqueo
    sobre ella para que nadie escriba a sus espaldas. Para solo leerla,
    pide una apertura compartida: qemu-img info -U (--force-share). Nunca
    escribas en una imagen que usa un invitado en marcha.
cold-start-event-chain =
    El disco de ledger es una cadena: before-upgrade se apoya en
    before-yearend, que se apoya en before-update, que se apoya en
    ledger.qcow2. Cada instantánea externa congeló la imagen de debajo y
    creó un archivo nuevo encima, adonde ha ido cada escritura desde
    entonces. Cuatro archivos para un disco de 200 GiB (virtual size: lo
    que ve el invitado; disk size: lo que le da el anfitrión). Mira
    también las instantáneas: virsh snapshot-list ledger.
cold-start-event-acpi-paused =
    virsh shutdown pulsa el botón de encendido virtual (ACPI): el sistema
    del invitado tiene que oírlo y apagarse solo. Un invitado en pausa no
    oye nada: ledger sigue en pausa. El problema es su disco, no su
    alimentación.
cold-start-event-destroyed =
    virsh destroy tira del enchufe: sin apagado, el invitado se para en
    seco, como le hizo la tormenta. Estaba en pausa, así que esta vez no
    quedó nada a medio escribir; en un invitado en marcha, destroy es el
    último recurso. La cadena y el /var lleno siguen ahí.
cold-start-event-revert =
    Una negativa afortunada. Volver a before-update dejaría ledger como
    estaba en marzo del año pasado: un año de cuentas perdido. Una
    instantánea es un punto al que volver, no un sitio en el que seguir
    viviendo.
cold-start-event-undefine =
    libvirt se niega a eliminar la definición de un dominio que todavía
    tiene instantáneas, y tiene razón: quitar la definición de ledger no
    arreglaría su disco, y con --remove-all-storage lo borraría.
cold-start-event-rm-held =
    Has borrado una imagen que ledger está usando. Mira df: no se ha
    liberado nada. QEMU todavía tiene el archivo abierto (sudo lsof lo
    muestra «(deleted)»): sus bloques solo se liberan cuando el invitado
    se para. Y cuando se pare, la cadena apuntará a un archivo que ya no
    existe. No pares ledger: mientras QEMU tenga el archivo, un block
    commit todavía puede leerlo y fusionarlo todo en la base.
cold-start-event-broken =
    La cadena de ledger está rota: una imagen que necesita ha
    desaparecido, y QEMU ya no la tiene. libvirt ya no puede arrancar el
    dominio («Cannot access backing file»). Los datos escritos en esa
    imagen se han perdido. Vuelve a empezar el capítulo (o usa la
    instantánea de rescate): nunca borres una imagen sin comprobar qué la
    usa (virsh domblklist, qemu-img info --backing-chain).
cold-start-event-commit-failed =
    La fusión ha fallado: hacer commit de una imagen en su base hace
    crecer la base en lo que recibe, y a /var no le queda sitio. Haz
    sitio primero, con algo que nada usa (la nota de Ilse, el mensaje de
    Priya), y luego fusiona.
cold-start-event-room =
    El clon de prueba ha desaparecido: unos 12 GiB libres en /var. No es
    mucho: la cadena todavía contiene un año de escrituras encima de la
    base. Fusiónala: virsh blockcommit con --active --pivot fusiona toda
    la cadena en la base mientras el invitado funciona (o está en pausa);
    virsh snapshot-delete fusiona una instantánea externa cada vez (man
    virsh).
cold-start-event-merged =
    La cadena está fusionada: el disco de ledger es solo ledger.qcow2, con
    todo lo que se escribió encima. Las capas y las instantáneas se han
    ido con ella.
cold-start-event-merged-leftovers =
    La cadena está fusionada: ledger escribe ahora solo en ledger.qcow2.
    Pero los archivos de las capas siguen en /var (blockcommit no los
    borra sin --delete), y libvirt sigue listando las instantáneas, que
    apuntan a imágenes que ya no están en la cadena. Quita los archivos
    que ya nada usa (compruébalo con virsh domblklist ledger), y los
    metadatos obsoletos: virsh snapshot-delete --metadata.
cold-start-event-paused-again =
    Otra vez en pausa: el invitado siguió escribiendo, y /var seguía lleno
    de las capas antiguas. Una fusión copia datos en la base; no libera
    nada mientras los archivos antiguos sigan en el disco.
cold-start-event-cleaned =
    /var vuelve a tener sitio: una sola imagen para ledger, ninguna capa
    sobrante, y metadatos de instantáneas que coinciden con el disco.
cold-start-event-resumed =
    ledger vuelve a funcionar (virsh resume despierta a un invitado en
    pausa; sigue desde donde se congeló). Dale unos segundos para que
    termine de arrancar.
cold-start-event-autostart =
    ledger está marcado autostart: /etc/libvirt/qemu/autostart/ledger.xml
    enlaza con su definición, y la próxima tormenta no lo dejará atrás.
cold-start-event-ssh =
    Estás en ledger: las cuentas de Priya están en /srv/ledger/books.
    Vuelve a hogar con exit.
cold-start-event-end =
    Grace: «Priya dice que las cuentas están todas, nóminas el miércoles
    como estaba previsto. ¡Gracias!»

    ¡Bien hecho! Has terminado el capítulo «El arranque en frío».

    QUÉ HA PASADO
    El corte de luz del sábado reinició hogar. agenda y records estaban
    marcados autostart; ledger no. Arrancado a mano, se pausó enseguida:
    a lo largo de un año, Ilse le había hecho tres instantáneas externas
    solo de disco y nunca las fusionó. Cada una creó una capa nueva
    adonde iba cada escritura, y la cadena de cuatro imágenes había
    llenado /var. Hiciste sitio con lo que nada usaba (el clon de prueba),
    fusionaste la cadena en su base, quitaste los restos y los metadatos
    obsoletos, reanudaste ledger, lo marcaste autostart, y lo comprobaste
    desde dentro.

    BUENA PRÁCTICA
    - virsh list --all, no virsh list: si no, un dominio parado no
      aparece. virsh autostart para cada invitado que tenga que volver con
      su anfitrión.
    - «paused (I/O error)» con «no space»: mira el sistema de archivos del
      anfitrión antes de tocar el invitado.
    - Una imagen fina (qcow2) puede crecer hasta su tamaño virtual: la suma
      de los tamaños virtuales puede muy bien superar el disco. Vigila df
      en el anfitrión.
    - Una instantánea externa es un archivo nuevo encima del antiguo:
      fusiónala (blockcommit, o snapshot-delete desde libvirt 9) en cuanto
      deje de hacer falta. Nunca hagas rm de una imagen de una cadena.
    - qemu-img info -U para leer una imagen en uso; nunca escribas en ella.
    - Una instantánea es un punto al que volver, en el mismo disco: no es
      una copia de seguridad.

    DOCUMENTACIÓN
    - virsh: https://libvirt.org/manpages/virsh.html
    - Fusionar cadenas de imágenes de disco: https://libvirt.org/kbase/merging_disk_image_chains.html
    - Instantáneas en libvirt: https://libvirt.org/kbase/snapshots.html
    - qemu-img: https://www.qemu.org/docs/master/tools/qemu-img.html
    - KVM en Debian: https://wiki.debian.org/KVM
