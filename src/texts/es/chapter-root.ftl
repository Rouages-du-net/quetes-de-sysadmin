### El Borrador, capítulo 3 — La Raíz. Permisos y administración:
### ls -l, chmod, whoami, sudo. El árbol es el de un Linux real
### (/home, /etc, /var/log, /root): esas rutas del sistema no se traducen.
### Los demás nombres de lugares y archivos (recuerdos, borrador.conf,
### /Reino/Papelera…) y los nombres de las cuentas (tu, y el usuario del
### demonio «borrador») vienen de names.ftl.

chapter-root = La Raíz
    .summary = Permisos y administración: ls -l, chmod, whoami, sudo.
root-arrival =
    Bajas el tobogán a toda velocidad y aterrizas… en una habitación que
    te resulta familiar. En la puerta, una placa: /home/tu.

    Tu casa. La de verdad. En lo más hondo del reino, en la Raíz («/»), los
    lugares tienen por fin sus nombres reales de Linux: /home para las
    carpetas personales, /etc para los ajustes, /var/log para los registros,
    /root para la administración.

    Lee el manual que hay sobre la mesa:  cat manual_admin.txt
root-manual-admin =
    EL MANUAL DE ADMINISTRACIÓN

    Cada objeto y cada lugar tiene un PROPIETARIO y unos PERMISOS.
    Para verlos:  ls -l

      d rwx r-x r-x   tu    tu    4096  recuerdos/
      │  │   │   │     └─ propietario
      │  │   │   └─ los demás: r-x
      │  │   └─ el grupo: r-x
      │  └─ el propietario: rwx
      └─ d = un lugar (directorio), - = un objeto (archivo)

    (ls -l escribe los tres grupos pegados: drwxr-xr-x.)

      r  leer (read)
      w  escribir (write)   para un lugar: crear, borrar, renombrar dentro
      x  ejecutar (execute) para un lugar: entrar en él, atravesarlo

    chmod cambia los permisos (solo puede hacerlo el propietario):
      chmod o-w lugar   quita a los demás (o) el permiso de escribir (w)
      chmod 755 lugar   rwx para el propietario, r-x para todos los demás

    whoami te dice quién eres. root tiene TODOS los permisos. Para actuar
    como root, se pone sudo delante del comando. sudo pide TU contraseña.

    ¿Tu contraseña? El Borrador te la hizo olvidar, como todo lo demás.
    Quizá la anotaste en algún sitio de tu casa… Tu diario.txt es largo: grep
    está hecho para eso. (Las comillas conservan los espacios: grep "mi contraseña" …)
root-journal =
    DIARIO

    Año 98: me confían la administración del reino. Una gran responsabilidad.
    Año 99: instalado el reloj del Pueblo. Los engranajes giran bien.
    Año 100: la Papelera se desborda. Es solo una carpeta donde cada cual deja lo que quiere tirar: necesitamos un programa que la vacíe para siempre.
    Año 101: escribo el Borrador, un pequeño demonio que vaciará la Papelera.
    Año 102: escrita la configuración del Borrador en /etc. No hay tiempo de releerla.
    Año 102: cambio de contraseña. La apunto aquí (¡muy mala idea!): mi contraseña es girasol
    Año 102: arrancado el Borrador. Se ejecuta con su propio usuario, «borrador».
    Año 103: desastre. Desaparece la masa madre de la Panaderia. Luego los engranajes.
    Año 103: he encontrado el error en la configuración. He preparado una versión corregida, aquí, en mi casa.
    Año 103: hay que instalarla con sudo antes de que el Borrador llegue hasta mí.
# Archivo de configuración: conservar la línea «objetivo = /Reino/Papelera»
# tal cual (el juego la comprueba: name-target = /name-Kingdom/name-Bin en names.ftl).
root-eraser-conf-fixed =
    # La configuración del Borrador — versión corregida (año 103)
    # En cada pasada, el demonio borra todo lo que encuentra en el objetivo.
    objetivo = /Reino/Papelera
root-memory-school = Un aula. Alguien te enseña a contar en binario con los dedos: hasta 31 con una sola mano.
root-memory-first-program = Tu primerísimo programa. Mostraba «Hola» y gritaste de alegría.
root-memory-garden = Un jardín lleno de girasoles. Te encantaba su color.
root-memory-song = Una canción que tarareabas mientras arreglabas servidores.
root-memory-journey = Un viaje en tren, con la nariz pegada a la ventana.
root-memory-friend = Una amiga que te decía: «Reléelo siempre antes de pulsar Intro».
root-memory-library = Una biblioteca inmensa, donde aprendiste la palabra «Unix».
root-memory-first-server = El primer servidor que tuviste a tu cargo. Ronroneaba como un gato.
root-journal-private-root =
    Podrías leerlo: root tiene todos los permisos. Pero es el diario íntimo de Nour. Lo cierras sin leerlo.
    (#1: respeta la privacidad de los demás.)
# Configuración defectuosa: conservar la línea «objetivo = /Reino /Papelera» (con el espacio).
root-eraser-conf =
    # La configuración del Borrador — escrita por: tu (año 102)
    # En cada pasada, el demonio borra todo lo que encuentra en el objetivo.
    objetivo = /Reino /Papelera
root-sudoers =
    # Quién tiene derecho a usar sudo, y para qué.
    root    ALL=(ALL:ALL) ALL
    tu      ALL=(ALL:ALL) ALL   # tu: administración del reino
# Registro del demonio: una entrada por línea (se lee con grep).
root-eraser-log =
    {"["}año 102] arranque del demonio borrador (usuario: borrador)
    {"["}año 102] lectura de /etc/borrador.conf
    {"["}año 102] objetivo = /Reino /Papelera
    {"["}año 102] 2 objetivos encontrados: «/Reino» y «/Papelera»
    {"["}año 102] borrando /Reino/Papelera/papeles_viejos
    {"["}año 102] borrando /Reino/Pueblo/Panaderia/masamadre_4
    {"["}año 103] borrando /Reino/Pueblo/Panaderia/masamadre_5
    {"["}año 103] borrando /Reino/Pueblo/Taller/engranaje_12
    {"["}año 104] borrando /Reino/Isla/Faro/bombilla
    {"["}año 131] nuevo objetivo accesible: /home/tu/recuerdos (permisos: rwxrwxrwx)
root-notes-root =
    Si estás leyendo esto, eres root (o has usado sudo).

    root puede leerlo todo, cambiarlo todo, borrarlo todo, incluido el
    propio sistema. Por eso nunca se trabaja como root en el día a día:
    se usa sudo, para un solo comando, cuando hace falta.
root-event-alert =
    De repente, un crujido en el lugar recuerdos… ¡El Borrador está aquí! Con
    cada uno de tus comandos, borrará uno de tus recuerdos.

    Mira los permisos:  ls -l
    El lugar recuerdos está en rwxrwxrwx: todo el mundo, incluido el usuario
    «borrador», tiene derecho a escribir en él, y por tanto a borrar en él.
    Quítales ese permiso a los demás (o), ¡rápido!:

      chmod o-w recuerdos
root-event-conf-erased =
    El demonio busca su configuración… y ya no la encuentra. Se detiene.
    Mejor que nada, pero ahora nadie vacía la Papelera. Falta una
    configuración correcta en /etc: el demonio solo lee el archivo
    /etc/borrador.conf, con ese nombre exacto.

# { $memory }: nombre del archivo borrado (identificador técnico)
root-memory-erases = ✗ Un recuerdo se desvanece: { $memory }
# { $saved }: recuerdos salvados; { $total }: número de recuerdos al principio
root-event-protected =
    El Borrador sigue atacando tus recuerdos… «Permiso denegado». Se
    retira. En Linux, borrar un archivo es modificar el lugar que lo
    contiene: sin permiso para escribir en ese lugar, no se puede borrar nada en él.

    Has salvado { $saved ->
        [one] { $saved } recuerdo
       *[other] { $saved } recuerdos
    } de { $total }. Pero el Borrador sigue en otras partes, por todo
    el reino. ¿De dónde vienen sus órdenes? Los demonios escriben lo que
    hacen en un registro:

      cat /var/log/borrador.log
# { $loss }: «yes» si se borraron recuerdos, si no «no»
root-event-fixed =
    El demonio vuelve a leer su configuración: «objetivo = /Reino/Papelera». Un solo
    objetivo, esta vez. El Borrador se detiene en seco… y luego se pone a vaciar la
    Papelera, como el primer día.

    Y te vuelve todo a la memoria. Tú administrabas el reino. Tú escribiste
    esta configuración, con un espacio de más: «/Reino
    /Papelera» en lugar de «/Reino/Papelera». Para el Borrador, eso
    eran dos objetivos, y uno de ellos era el reino entero. No era malvado:
    hacía exactamente lo que le habían dicho.

    Has salvado { $saved ->
        [one] { $saved } recuerdo
       *[other] { $saved } recuerdos
    } de { $total }.{ $loss ->
        [yes] {" "}Los que se han ido no volverán: rm no pasa por ninguna papelera… salvo que hayas hecho copias de seguridad. Pero esa es otra historia.
       *[no] {""}
    }

    EL REINO ESTÁ A SALVO. (Te espera un último capítulo: La Copia de
    Seguridad, para que nunca más se pierda nada.)

    Ya conoces los permisos (ls -l, chmod), la diferencia entre un
    usuario y root, y sudo — con sus tres reglas. La segunda es
    la más importante: piensa antes de escribir.
