### Historia «El Mapatón», capítulo «Deriva»: registros cambiados a mano
### durante un incidente, un apply olvidado que retiene el bloqueo del
### estado, la deriva que muestra tofu plan, y tofu import. Los comandos, las
### opciones, las rutas, las direcciones de recursos, los nombres de
### registros y la salida de OpenTofu no se traducen.

chapter-drift = Deriva
    .summary = Una noche se cayó el alojamiento del sitio web, y el voluntario de guardia arregló el DNS a mano, rápido y bien. Ahora el código dice una cosa, el servidor DNS otra, y OpenTofu ni siquiera arranca. Vuelve a ponerlos de acuerdo sin romper el sitio.

## Archivos

drift-message-andile =
    De: Andile
    Viernes 25 de junio, 9:10

    Buenos días:

    Femi nos salvó la noche ayer: el antiguo alojamiento del sitio
    (198.51.100.40) se cayó a las nueve, y él movió el sitio a la máquina de
    reserva, 198.51.100.41. La empresa de alojamiento confirmó esta mañana
    que la antigua no vuelve: el sitio se queda en la .41.

    Pero Femi lo hizo «a la antigua», a mano, y Yusra nos recuerda que el
    código tiene que decir lo que es verdad. Y esta mañana tofu plan ni
    siquiera arranca: algo de un bloqueo.

    ¿Puedes poner orden? El sitio tiene que seguir funcionando. Femi también
    añadió un registro para la página de estado de Dilnoza: consérvalo, pero
    bajo OpenTofu como los demás. Su nota está en tu carpeta.

    Andile

drift-message-femi =
    De: Femi
    Jueves 24 de junio, 22:05

    Perdón, una nota con prisas antes de dormir.

    21:30: el sitio ya no respondía, su alojamiento estaba muerto. Dilnoza
    arrancó la máquina de reserva (198.51.100.41) y copió el sitio en ella.

    21:41: lancé tofu apply en /srv/dns para cambiar la dirección, pero el
    plan quería cambiar cosas que no entendía, así que lo dejé esperando en
    su pregunta y usé nsupdate, que sí conozco, con la clave de
    /etc/bind/tofu-key.key:
      update delete www.wayfinders.example A
      update add www.wayfinders.example 60 A 198.51.100.41
    (TTL 60, para poder volver atrás rápido.)

    21:51: la página de estado de Dilnoza funciona en 198.51.100.42, así que
    añadí status.wayfinders.example de la misma manera, TTL 300.

    No toqué el código. La batería del portátil se murió antes de que
    pudiera cerrar nada.

    Femi

## Eventos

drift-event-locked =
    OpenTofu bloquea el estado antes de leerlo, para que dos ejecuciones no
    puedan escribirlo a la vez. Otra persona tiene el bloqueo: Lock Info dice
    quién, para qué operación y desde cuándo. ¿Sigue viva esa ejecución?
drift-event-force-unlock =
    tofu force-unlock no puede hacer nada con un estado local: el bloqueo lo
    tiene el sistema operativo para el proceso que lo tomó, y solo ese
    proceso puede soltarlo. Encuentra el proceso (ps) y decide qué hacer con
    él.
drift-event-no-lock =
    -lock=false mientras el apply de Femi sigue esperando: si alguien
    responde yes en su sesión, aplica su plan viejo y escribe su propio
    estado encima del tuyo. Eso es justo lo que impide el bloqueo; detén
    mejor su ejecución.
drift-event-freed =
    El apply de Femi recibió la señal, canceló su operación y soltó el
    bloqueo al detenerse (su .terraform.tfstate.lock.info ha desaparecido).
    El estado está libre.
drift-event-freed-kill =
    El apply de Femi está muerto, matado sin poder recoger: el sistema
    soltó el bloqueo con el proceso, pero su archivo de bloqueo
    (.terraform.tfstate.lock.info) se ha quedado. No pasa nada, la próxima
    ejecución lo sustituye; un kill normal (TERM) deja que OpenTofu se
    detenga como debe.
drift-event-drift =
    «Objects have changed outside of OpenTofu»: la relectura encontró los
    cambios de Femi en www, que el estado no conocía. Lee el plan de debajo:
    aplicar el código tal cual volvería a poner www en 198.51.100.40, el
    alojamiento muerto. La decisión es tuya: aquí, el cambio a mano es la
    verdad, así que es el código el que tiene que seguirlo.
drift-event-reverted =
    www vuelve a apuntar a 198.51.100.40, el alojamiento que se cayó: el
    sitio está caído para todos aquellos cuyo resolvedor pregunte ahora. El
    código seguía teniendo la dirección antigua, y el plan lo decía.
    Corrige records.tf y aplica de nuevo.
drift-event-hand-edit =
    terraform.tfstate se ha editado a mano. El estado es la memoria que
    OpenTofu tiene de los objetos reales, con un número de serie y un
    linaje, y una edición equivocada le hace mentir. Para registrar lo que
    cambió fuera, tofu apply -refresh-only lo hace bien; para olvidar o
    renombrar algo, tofu state rm y tofu state mv. La versión anterior está
    en terraform.tfstate.backup.
drift-event-state-rm =
    tofu state rm ha hecho que OpenTofu olvide un registro, no el DNS: el
    registro sigue en named, y sigue en el código, así que el próximo plan
    quiere crearlo. La diferencia no ha desaparecido, ha cambiado de forma.
    Recupéralo con tofu import.
drift-event-code =
    records.tf dice ahora lo que es verdad: www en 198.51.100.41. Lee el
    próximo plan: ¿y el TTL que Femi bajó a 60? Deja 60 en el código, o
    vuelve a 300 (ttl obliga a sustituir el conjunto de registros: el plan
    lo dice).
drift-event-created-over =
    status.wayfinders.example se ha «creado» encima del registro de Femi: el
    proveedor dns añade las direcciones una a una, así que ha pasado. Con la
    mayoría de los proveedores, crear algo que ya existe falla («already
    exists»), y la forma de adoptar un objeto es tofu import.
drift-event-imported =
    status.wayfinders.example está ahora en el estado de OpenTofu, con los
    valores que tiene de verdad. A partir de ahora, un cambio en él pasa por
    el código como los demás.
drift-event-end =
    Andile: «tofu plan dice No changes. Es la frase más bonita de la
    semana». Femi: «La próxima vez cambio el código, aunque sea de noche».

    ¡Bien hecho! Has terminado el capítulo «Deriva».

    QUÉ HA PASADO
    Durante el incidente, Femi dejó un tofu apply esperando su «yes», que
    retenía el bloqueo del estado, y cambió www y añadió status con
    nsupdate. Detuviste su ejecución (OpenTofu soltó el bloqueo), y tofu
    plan mostró la deriva: el www real difería del estado, y aplicar el
    código viejo habría devuelto el sitio al alojamiento muerto. Hiciste que
    el código siguiera el cambio real, aplicaste, y adoptaste status con
    tofu import, hasta que OpenTofu no tuvo nada más que hacer.

    BUENA PRÁCTICA
    - Una deriva no es forzosamente un error: decide qué lado es el
      verdadero. Si el cambio a mano es el bueno, actualiza el código; si
      no, aplica el código.
    - Lee el plan antes de cada apply, sobre todo cuando destruye o
      sustituye: -auto-approve es para cadenas cuyo plan ya se ha revisado.
    - Un bloqueo quiere decir que una ejecución está (o estaba) en curso:
      encuéntrala, no la fuerces. Nunca -lock=false en un estado compartido.
    - Adopta lo hecho a mano con tofu import (o un bloque import), y luego
      haz que el código coincida hasta que plan diga No changes.
    - No edites terraform.tfstate, y no uses state rm para esconder una
      diferencia; detecta la deriva con regularidad con tofu plan
      -detailed-exitcode (código de salida 2 cuando algo difiere).

    OTRA MANERA
    Un bloque import en el código (import con to e id) hace lo mismo que
    tofu import, pero pasa por plan y apply como cualquier cambio, y se
    puede revisar. tofu apply -refresh-only registra en el estado los
    cambios hechos fuera sin tocar nada, cuando el código ya los sigue.

    DOCUMENTACIÓN
    - El bloqueo del estado: https://opentofu.org/docs/language/state/locking/
    - tofu force-unlock: https://opentofu.org/docs/cli/commands/force-unlock/
    - Los modos de plan (refresh-only): https://opentofu.org/docs/cli/commands/plan/
    - La importación: https://opentofu.org/docs/cli/import/ y https://opentofu.org/docs/language/import/
    - BIND, las actualizaciones dinámicas: https://bind9.readthedocs.io/en/stable/reference.html#dynamic-update-policies
