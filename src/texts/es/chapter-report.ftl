### Historia «La Auditoría», capítulo «El informe»: cuatro hallazgos de
### higiene en el servidor de la Panadería (SSH, una cuenta olvidada, sudo
### sin contraseña, un secreto legible por todo el mundo). Las palabras clave
### (PermitRootLogin, NOPASSWD…), los comandos, las rutas y los mensajes de
### las herramientas no se traducen.

chapter-report = El informe
    .summary = Corregir los hallazgos de una auditoría: SSH, una cuenta olvidada, sudo sin contraseña, un secreto legible por todo el mundo.

## Archivos

report-email-nadia =
    De:      Nadia (la Panadería)
    Para:    tú
    Asunto:  La auditoría de mi servidor

    Yo llevo la panadería, no el servidor: ahora te ocupas tú. Mi
    aseguradora quiere una auditoría de seguridad antes de renovar el
    contrato, así que llamé a Salomé, una auditora independiente. Ayer
    revisó el servidor y me dejó su informe, que he copiado en tu carpeta:
    informe_auditoria.txt.

    No lo entiendo todo, pero parece seria. ¿Podrías tratar los hallazgos
    uno por uno sin cortar los pedidos en línea? Cada mañana hay cola en el
    mostrador, y el sitio no se puede caer.

    Para sudo, tu contraseña es: harina-2028
    Y, por favor, comprueba cada corrección: Salomé volverá a verificarlo.

# The orders app's service, as systemctl status describes it.
audit-orders-description = Pedidos de la Panadería (aplicación de pedidos en línea)

report-report-audit =
    INFORME DE AUDITORÍA — la Panadería (obrador.example)
    Auditora: Salomé, independiente
    Perímetro: el servidor obrador (192.0.2.22)
    Método: revisión de cuentas y configuración, escaneo de puertos desde
    internet, lectura de los registros

    Este informe tiene tres partes. Aquí está la primera, la higiene del
    servidor. Las otras dos vendrán después (exposición de red, rastros de
    inicio de sesión).

    C1 — SSH acepta inicios de sesión directos de la cuenta root  [alta]
         Un bot que adivine una contraseña, o una clave robada, entregaría
         todos los derechos de golpe. Referencia: sshd_config(5),
         PermitRootLogin.

    C2 — La cuenta de una persona que se fue sigue existiendo     [alta]
         lucas, un becario cuyo contrato terminó el 28 de febrero, sigue
         teniendo una cuenta, y es miembro del grupo sudo.

    C3 — sudo sin contraseña para la cuenta de administración     [media]
         Basta una sesión robada o una pantalla sin bloquear para obtener
         root sin escribir nada. Referencia: sudoers(5), NOPASSWD.

    C4 — Un archivo de secretos es legible por todo el mundo      [media]
         /srv/pedidos/.env contiene la dirección de la base de datos con su
         contraseña. Cualquier cuenta del servidor puede leerlo.

    Se espera: para cada hallazgo, corregirlo y luego comprobar que la
    corrección aguanta (y que no se rompe nada: el sitio, la aplicación de
    pedidos y el acceso de administración siguen en servicio).

## Eventos

report-event-sudoers-broken =
    ¡Hay un error en la política de sudo! Cuando un archivo sudoers está
    mal, sudo lo rechaza todo, para todo el mundo. Estos archivos se editan
    con visudo (man visudo): comprueba la sintaxis antes de guardar.
report-event-locked-out =
    ATENCIÓN: con la configuración que sshd acaba de cargar, un nuevo inicio
    de sesión desde tu cuenta sería rechazado. Tu sesión actual sigue
    abierta (sshd nunca corta las sesiones en curso): es el momento de
    corregirlo, ANTES de desconectarte.
report-event-without-effect =
    El archivo dice «PermitRootLogin no»… pero sshd todavía no lo ha
    aplicado: lee su configuración al arrancar y cuando se le pide que la
    recargue. Comprueba con  sudo sshd -t  (la sintaxis) y luego haz que el
    servicio la recargue. Para ver lo que sshd aplica de verdad:
    sudo sshd -T
report-event-account-incomplete =
    Solo has tratado una parte del hallazgo C2. Una cuenta «cerrada» quiere
    decir: ya no hay manera de iniciar sesión (contraseña bloqueada, cuenta
    caducada) Y no le queda ningún derecho (fuera del grupo sudo). Mira lo que
    queda con  id lucas  y  sudo chage -l lucas  (man chage, man usermod).
report-event-app-blind =
    El secreto ya no es legible por todo el mundo… ¡pero la aplicación de
    pedidos tampoco puede leerlo! Se ejecuta con la cuenta «pedidos» y lee el
    archivo .env al arrancar: no volvería en el próximo reinicio. Mira quién es el
    dueño del archivo (ls -l): el objetivo es cerrar la puerta a las demás
    cuentas, no a la aplicación.
report-event-ssh =
    sshd aplica tu nueva configuración: root ya no puede iniciar sesión, y tu
    cuenta sí. C1 está tratado.

    En un servidor real se deja una sesión abierta y se prueba con una
    segunda antes de cerrar la primera.
report-event-account =
    Ya nadie puede iniciar sesión con la cuenta de Lucas, y no le queda
    ningún derecho en el servidor. C2 está tratado.
report-event-sudo =
    No queda ninguna regla NOPASSWD para tu cuenta: sudo pide tu contraseña,
    como debe ser, y puedes seguir administrando. C3 está tratado.
report-event-secret =
    El archivo de secretos ya solo lo puede leer la aplicación (y su dueño),
    y la aplicación lo sigue leyendo. C4 está tratado.
report-event-end =
    Los cuatro hallazgos están corregidos y no se ha roto nada. Nadia: «El
    sitio no se ha movido ni un pelo. ¡Se lo paso a Salomé!».

    ¡Bien hecho! Has terminado el capítulo «El informe».

    QUÉ HA PASADO
    Una auditoría no busca piratas: compara el servidor con lo que debería
    ser. Estos cuatro hallazgos son los más frecuentes: una entrada demasiado
    amplia (root por SSH), un acceso olvidado tras una salida (cuenta y
    sudo), un privilegio sin salvaguarda (sudo sin contraseña) y un secreto
    al alcance de cualquiera (.env en rw-r--r--). Ninguno es un ataque: cada
    uno facilita un ataque.

    BUENA PRÁCTICA
    - PermitRootLogin no: se pasa a root con sudo, desde la cuenta propia, lo
      que deja rastro de quién hizo qué. Siempre sshd -t antes de recargar, y
      una sesión abierta para probar.
    - En cada salida, cierra la cuenta: userdel (o usermod -L, un chage -E y
      quitarla de sudo si quieres conservar sus archivos). Una lista de
      cuentas revisada con regularidad evita los olvidos.
    - sudo con contraseña, o reglas limitadas a un comando: el mínimo
      privilegio. Los archivos de /etc/sudoers.d se editan con visudo.
    - Un archivo de secretos: chmod 600, propiedad de la cuenta que lo usa.
      Mejor aún: no guardar nunca un secreto en claro en un repositorio o en
      un recurso compartido.

    OTRA MANERA
    Para C2, borrar la cuenta es lo más limpio; bloquearla, hacerla caducar y
    quitarla de sudo conserva sus archivos para un traspaso, pero deja una
    puerta que vigilar: una cuenta solo bloqueada (usermod -L) seguiría
    aceptando una clave SSH; es la caducidad (usermod -e, chage -E) la que la
    cierra de verdad, junto con la salida de sudo.

    DOCUMENTACIÓN
    - sshd_config: https://man.openbsd.org/sshd_config
    - sudoers: https://www.sudo.ws/docs/man/sudoers.man/
    - userdel y usermod: https://man7.org/linux/man-pages/man8/userdel.8.html
    - chmod: https://man7.org/linux/man-pages/man1/chmod.1.html
