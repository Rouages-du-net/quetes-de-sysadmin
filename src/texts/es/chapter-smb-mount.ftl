### Historia «Windows al Lado», capítulo «El recurso de al lado»: el recurso
### compartido SMB de un servidor Windows montado en Linux (mount -t cifs),
### sus credenciales, sus propietarios y su línea en /etc/fstab. Los
### comandos, opciones, rutas y salidas de las herramientas no se traducen.

chapter-smb-mount = El recurso de al lado
    .summary = Plotter debe guardar sus PDF en el recurso compartido del servidor Windows: móntalo en Linux con un archivo de credenciales, haz que el servicio pueda escribir en él y escribe la línea de fstab que sobrevive a un arranque sin el servidor.

## Files

smb-mount-email-ifeoma =
    De:    Ifeoma
    Para:  tú

    ¡Hola!

    Plotter, el servicio de compas que exporta nuestros planos a PDF cada
    mañana (se ejecuta con la cuenta plotter), debería dejar los PDF en
    armario, en el recurso compartido «plans», carpeta exports: ahí es
    donde todo el mundo los busca. Hasta ahora los guardaba en compas, y
    los copiábamos a mano.

    Priya dejó sus notas (notas-de-priya.txt): el recurso, la cuenta que
    creó para compas, la contraseña. ¿Podrías montar el recurso en compas,
    en /mnt/plans, de forma que Plotter pueda escribir ahí, y que vuelva
    solo tras un reinicio? Cuidado: armario se reinicia algunas noches de
    martes por Windows Update, y compas tiene que arrancar igualmente si
    armario está apagado en ese momento.

    Henrik dice que en su antiguo NAS siempre tenía que añadir vers=1.0. Ni
    idea de lo que significa.

    Ifeoma

smb-mount-notes-priya =
    Para compas (Priya, 28 de octubre de 2029)

    Servidor de archivos: armario.internal (Windows Server 2022)
    Recurso para compas: plans  (D:\Shares\plans en el servidor)
    Cuenta: compass-svc   contraseña: Ruler-2029-cab
            (una cuenta local de armario; puede modificar archivos en plans)
    El recurso también tiene una carpeta exports, para Plotter.

    SMB1 está desactivado en armario, a propósito. SMB 3 está bien.
    No dejes esta contraseña por ahí una vez instalada.

## Events

smb-mount-event-listed =
    Los recursos de armario: plans y scans, y los que terminan en $
    (ADMIN$, C$, D$, IPC$), que Windows crea para sus administradores.
    «SMB1 disabled»: smbclient habló SMB 3, y no hay exploración NetBIOS.
    Ahora, en lugar de la sesión puntual de smbclient, un montaje: man
    mount.cifs.
smb-mount-event-helper-missing =
    mount conoce el tipo cifs, pero necesita su ayudante, /sbin/mount.cifs,
    que lee las opciones, pide la contraseña y pasa el resto al núcleo.
    Viene en un paquete que no está instalado: cifs-utils.
smb-mount-event-helper =
    cifs-utils está instalado: mount -t cifs (y mount.cifs) ya pueden
    funcionar.
smb-mount-event-smb1 =
    «Host is down»: armario no se negó con un mensaje, cortó la conexión.
    vers=1.0 pide SMB1, el protocolo de los años 80 detrás del gusano
    WannaCry en 2017; Windows Server ya no lo instala desde 2019, y Priya
    lo mantiene desactivado. El antiguo NAS de Henrik solo hablaba SMB1;
    armario habla SMB 3. Quita vers= (el núcleo elige el mejor), o pide
    vers=3.0 o 3.1.1.
smb-mount-event-denied =
    «Permission denied» (error 13): armario rechazó la cuenta o la
    contraseña. Comprueba username= y la contraseña (en las notas de
    Priya), y que se lo estás pidiendo a armario.
smb-mount-event-password-visible =
    Funciona, pero esa contraseña está ahora en el historial de tu shell
    (history), y mientras mount.cifs estuvo en marcha, cualquiera en compas
    podía leerla en ps o en /proc/PID/cmdline. Pon la cuenta y su
    contraseña en un archivo que solo lea root (man mount.cifs:
    credentials=), y haz referencia a él.
smb-mount-event-mounted =
    El recurso está montado: /mnt/plans es el D:\Shares\plans de armario.
    Mira quién es propietario de qué ahí dentro (ls -l), y pregúntate con
    qué cuenta se ejecuta Plotter.
smb-mount-event-root-owned =
    Todo en /mnt/plans pertenece a root, con permisos 755: Plotter (la
    cuenta plotter) puede leer, no escribir. Un servidor Windows no tiene
    propietarios Unix que dar: el cliente Linux muestra los de las opciones
    del montaje, root y 0755 por defecto. Se eligen al montar (man
    mount.cifs: uid=, gid=, file_mode=, dir_mode=).
smb-mount-event-chown =
    chown y chmod no dijeron nada, y nada cambió: en un recurso de un
    servidor Windows, el propietario y los permisos mostrados vienen de las
    opciones del montaje, no de los archivos. Vuelve a montar con uid= y
    gid= (umount, y luego mount otra vez).
smb-mount-event-writable =
    plotter ya puede escribir en /mnt/plans: el montaje presenta el recurso
    como suyo. En armario, sigue siendo compass-svc quien escribe, con los
    permisos de esa cuenta sobre el recurso.
smb-mount-event-world-readable =
    Ese archivo de credenciales lo pueden leer otros además de root: la
    contraseña de compass-svc sería legible por todas las cuentas de
    compas. chmod 600, propiedad de root.
smb-mount-event-credentials =
    El archivo de credenciales es correcto: de root, rw------- (600), con la
    cuenta y su contraseña, y nada más en la línea de comandos.
smb-mount-event-no-nofail =
    Sin nofail, un arranque durante el cual armario no es accesible espera
    al montaje y lo marca como fallido (y con él lo que lo requiere). Con
    nofail, compas arranca de todos modos, y mount -a lo monta después.
    _netdev dice que es un sistema de archivos de red: esperar antes a la
    red.
smb-mount-event-fstab-password =
    /etc/fstab lo pueden leer todas las cuentas de compas: nada de
    contraseñas ahí. credentials= apunta al archivo que solo lee root.
smb-mount-event-fstab =
    La línea de fstab es correcta: el recurso plans de armario en
    /mnt/plans, el archivo de credenciales, los propietarios que necesita
    Plotter, _netdev y nofail. Pruébala: umount /mnt/plans, y luego mount
    -a (o mount /mnt/plans).
smb-mount-event-end =
    Ifeoma: «¡Los PDF de esta mañana están en exports! Y Henrik ha
    aprendido qué significaba vers=1.0. Gracias.»

    ¡Bien hecho! Has terminado el capítulo «El recurso de al lado».

    QUÉ HA PASADO
    armario comparte sus carpetas por SMB, el protocolo de compartición de
    archivos de Windows. Linux las monta con el cliente cifs del núcleo y
    su ayudante, mount.cifs (paquete cifs-utils). Listaste los recursos con
    smbclient, montaste plans con un archivo de credenciales en lugar de
    una contraseña en la línea de comandos, diste a los archivos el
    propietario que necesitaba Plotter (uid=, gid=: un servidor Windows no
    tiene propietarios Unix que mostrar), y escribiste la línea de fstab
    con _netdev y nofail.

    BUENA PRÁCTICA
    - La contraseña en un archivo de root, modo 600 (credentials=), nunca
      en una línea de comandos (history, ps) ni en /etc/fstab (legible por
      todo el mundo).
    - Una cuenta creada para el servidor (compass-svc), con solo los
      permisos que necesita en el recurso.
    - uid=, gid=, file_mode=, dir_mode=: a quién pertenecen los archivos en
      Linux se decide al montar; chown y chmod no cambian nada ahí.
    - Nunca vers=1.0: SMB1 está obsoleto y es peligroso; deja que elija el
      núcleo (SMB 3.1.1 con un Windows reciente), o pide vers=3.0.
    - En fstab, _netdev y nofail para un recurso de red: el arranque no
      depende de otra máquina. Prueba la línea con umount y luego mount -a.

    OTRA MANERA
    x-systemd.automount monta el recurso en el primer acceso en lugar de al
    arrancar (y lo vuelve a montar si armario volvió más tarde). Para un
    recurso al que varios usuarios de Linux acceden con sus propias cuentas
    Windows, mira la opción multiuser y Kerberos (sec=krb5) en
    mount.cifs(8).

    DOCUMENTACIÓN
    - mount.cifs(8): https://manpages.debian.org/mount.cifs.8
    - El cliente cifs del núcleo: https://www.kernel.org/doc/html/latest/admin-guide/cifs/usage.html
    - SMBv1 en Windows: https://learn.microsoft.com/windows-server/storage/file-server/troubleshoot/detect-enable-and-disable-smbv1-v2-v3
    - systemd.mount, _netdev y nofail: https://www.freedesktop.org/software/systemd/man/latest/systemd.mount.html
