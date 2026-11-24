### Interfaz del juego: elegir historias y capítulos, la terminal,
### el progreso. Una frase entera por mensaje; las variables entre { }.

stories-title = Historias
# { $story }: título de la historia
chapters-title = Capítulos de «{ $story }»
chapter-number = Capítulo { $number }
chapter-title-complete = { $story } — capítulo { $number }: { $title }
state-story-finished = ✓ Terminada
state-chapters-done =
    { $finished ->
        [one] { $finished } capítulo
       *[other] { $finished } capítulos
    } de { $total }
state-chapter-finished = ✓ Terminado
state-locked = 🔒 Termina el capítulo anterior
state-key-missing = 🔒 Bloqueada
# { $chapters }: los títulos de los capítulos que quedan por terminar (lista con formato)
state-key-after = 🔒 Después de { $chapters }
# { $title }: un título de capítulo, en la lista de arriba
state-key-chapter = «{ $title }»
key-help = 🔑 Estas historias se abren poco a poco: bajo cada nombre, los capítulos que hay que terminar antes de recibir su clave. Las primeras se abren después de La Raíz (El Borrador, capítulo 3).
stories-locked = { $count ->
    [one] 🔒 Todavía queda una historia bloqueada
   *[other] 🔒 Todavía quedan { $count } historias bloqueadas
}
button-next = Capítulo siguiente →
button-restart = Reiniciar este capítulo
tips = Consejos: Tab completa los nombres de comandos, carpetas y archivos, ↑ recupera los comandos, «ayuda» lista los que conoces, «man comando» abre el manual, «exit» te devuelve a tu puesto. Como en la mayoría de las terminales Linux, seleccionar texto lo copia y el clic derecho lo pega. Tu progreso se guarda en este navegador.
# { $lines }: número de líneas no mostradas
output-cut =
    { $lines ->
        [one] (… { $lines } línea más arriba, no mostrada)
       *[other] (… { $lines } líneas más arriba, no mostradas)
    }
workstation-title = Tu puesto
## El menú de historias: dos vistas
view-title = Cómo mostrar las historias
view-network = Mapa de la red
view-internet = Internet
input-label = Comando
credit = Quêtes de Sysadmin, un juego libre (GPL v3, textos CC BY-SA 4.0), inspirado en Terminus, creado en el MIT por Shawn Conrad y Michele Pratusevich.
credit-link-project = El proyecto
credit-link-original = Terminus

## El cuaderno del sysadmin

notebook-title = El cuaderno del sysadmin
# { $count }: el número de comandos anotados
notebook-account = { $count ->
    [0] (vacío)
    [one] ({ $count } comando)
   *[other] ({ $count } comandos)
}
notebook-help = Cada comando que ejecutas por primera vez se añade aquí, con lo que hace y la línea que escribiste. Tu chuleta, para llevártela.
notebook-empty = Nada todavía: ejecuta un comando (ls, por ejemplo) y se anotará aquí.
notebook-export = Descargar (Markdown)
notebook-copy-button = Copiar
notebook-copy = Copiado al portapapeles.
notebook-copy-impossible = Este navegador no permite acceder al portapapeles: usa mejor la descarga.
# El nombre del archivo descargado: sin espacios ni caracteres difíciles de escribir.
notebook-file = cuaderno-sysadmin.md
# Al principio del archivo Markdown. { $count }: el número de comandos
notebook-markdown-intro = { $count ->
    [one] Un comando aprendido jugando a Quêtes de Sysadmin.
   *[other] { $count } comandos aprendidos jugando a Quêtes de Sysadmin.
}
notebook-progress = Progreso
notebook-progress-empty = Todavía no hay ningún capítulo terminado.
# { $story }: el título de la historia; { $finished } y { $total }: capítulos terminados y en total
notebook-progress-story = { $story }: { $finished ->
    [one] { $finished } capítulo terminado
   *[other] { $finished } capítulos terminados
} de { $total }
# { $chapter }: el título del capítulo donde se usó el comando por primera vez
notebook-discovery = Descubierto en «{ $chapter }».
# { $command }: el comando que abre el manual (man ls)
notebook-manual = Para saber más: { $command }

## Enlaces a Les rouages du net (después de un capítulo)

rouages-intro = Para entender lo que pasa por dentro, en Les rouages du net (en francés):
rouages-link-entree-nom = «De la tecla Intro a la página»: el nombre se convierte en una dirección (DNS)
rouages-link-entree-box = «De la tecla Intro a la página»: tu router y tu red local
rouages-link-entree-liaison = «De la tecla Intro a la página»: abrir la conexión (TCP, puertos)
rouages-link-entree-cadenas = «De la tecla Intro a la página»: el candado (TLS, certificados)
rouages-link-entree-voyage = «De la tecla Intro a la página»: el viaje de los paquetes
rouages-link-entree-serveur = «De la tecla Intro a la página»: el servidor responde
rouages-link-ordinateur-binaire = «Cómo funciona un ordenador»: todo es un número
rouages-link-ordinateur-memoire = «Cómo funciona un ordenador»: la memoria
rouages-link-glossaire-ttl = Glosario: TTL
rouages-link-glossaire-port = Glosario: puerto
rouages-link-glossaire-nat = Glosario: NAT
rouages-link-glossaire-routeur = Glosario: router
rouages-link-glossaire-commutateur = Glosario: switch
rouages-link-glossaire-hebergeur = Glosario: proveedor de alojamiento
rouages-link-glossaire-chiffrement = Glosario: cifrado
rouages-link-glossaire-autorite-certification = Glosario: autoridad de certificación
rouages-link-glossaire-code-http = Glosario: código de estado HTTP
rouages-link-glossaire-requete = Glosario: petición
rouages-link-glossaire-datacenter = Glosario: centro de datos
rouages-link-glossaire-octet = Glosario: byte

## Modo examen

exam-case = Modo examen: sin pistas, con cronómetro (el capítulo vuelve a empezar)
# { $time }: el tiempo transcurrido, en minutos:segundos
exam-timer = ⏱ { $time }
# La confirmación, cuando hay un capítulo en curso (el modo examen lo reinicia).
exam-confirm-title = ¿Pasar al modo examen?
exam-confirm-text = El capítulo actual volverá a empezar desde el principio, en una máquina nueva: lo que ya hayas hecho en él se perderá. Los capítulos terminados siguen terminados.
exam-confirm = Reiniciar en modo examen
exam-quit-title = ¿Salir del modo examen?
exam-quit-text = El capítulo actual volverá a empezar desde el principio, con pistas: lo que ya hayas hecho en él se perderá. Los capítulos terminados siguen terminados.
exam-quit = Reiniciar sin modo examen
exam-cancel = Cancelar
exam-start = Modo examen: no se mostrará ninguna pista y el cronómetro está en marcha. Tu misión está en el mensaje de bienvenida (vuelve a leerlo con cat). El repaso llegará al final. Para empezar de cero, máquina y cronómetro: «Reiniciar este capítulo», debajo de la terminal.
# { $time }: el tiempo de esta partida; { $record }: el mejor tiempo en este navegador
exam-finished = Examen superado en { $time }. Tu mejor tiempo en este capítulo: { $record }.
exam-finished-record = Examen superado en { $time }: es tu mejor tiempo en este capítulo.

## El mapa (un botón junto a la terminal; ver src/engine/map.ts)

map-button = Mapa
# { $machine }: el nombre de la máquina en la que estás (reino, puesto…).
map-title = Mapa de { $machine }
map-caption = Los lugares (carpetas) que conoces en esta máquina: aquellos en los que has entrado y, en cursiva, los que solo has entrevisto. Los archivos no se muestran: para eso, usa ls.
map-here = ← estás aquí
map-home = tu carpeta personal, ~
map-closed = cerrado por ahora
map-preview = todavía sin visitar
map-close = Cerrar

## El plano de la red (pestaña «Red» del mapa; ver src/engine/plan.ts)

map-tab-places = Lugares
map-tab-network = Red
plan-caption = La red tal como la planeó el equipo, como el esquema de la pared: lo que debería ser, no necesariamente lo que es. Para comprobarlo: ip a, ip route, ping, wg show… Los enlaces punteados pasan por un túnel WireGuard.
plan-version-text = El plano en forma de lista
plan-internet = Internet
plan-your-workstation = tu puesto
plan-here = estás aquí
plan-visit = ya conectado
plan-not-visit = todavía sin conectar
plan-tunnel = por el túnel WireGuard
plan-dhcp = DHCP
plan-network-internal = red interna
plan-note-gateway = pasarela
plan-note-wiki = wiki
plan-note-archives = copias de seguridad
plan-note-host = alojamiento web
plan-note-router = router
# { $id }: el número de VLAN; { $name }: su nombre en la configuración (oficinas, invitados…).
plan-vlan = VLAN { $id } · { $name }
plan-note-remote-work = teletrabajo
plan-annex = Router del anexo
plan-note-annex = segunda sede
plan-network-annex = Red del anexo

## Mi progreso (ver src/engine/progress.ts)

# El título del cuaderno cuando se da un nombre.
notebook-title-of = El cuaderno de { $name }
progress-button = Mi progreso
progress-title = Mi progreso
progress-intro = Tu progreso se queda en este navegador. Para seguir en otro equipo (otra aula, en casa), llévatelo con el código o con el archivo. No se envía nada a ninguna parte.
progress-name = Tu nombre (opcional)
progress-name-help = Aparece al principio de tu cuaderno («El cuaderno de…») y en tus guardados.
progress-code-title = El código, para copiarlo
progress-code-help = Contiene los capítulos terminados, nada más: ni el cuaderno ni las claves que hayas creado. Anótalo y luego escríbelo en el otro equipo.
progress-copy = Copiar
progress-code-input = Continuar con un código:
progress-resume = Continuar
progress-file-title = El archivo, para llevártelo todo
progress-file-help = Capítulos, cuaderno, claves que hayas creado, configuración de ssh, récords del modo examen. Guárdalo en una memoria USB o envíatelo.
progress-download = Descargar mi guardado
progress-file-input = Continuar desde un archivo:
progress-name-file = quetes-de-sysadmin.json
progress-downloaded = Guardado descargado.
# { $count }: los capítulos terminados en el archivo.
progress-confirm = ¿Continuar con este guardado ({ $count ->
        [one] { $count } capítulo terminado
       *[other] { $count } capítulos terminados
    })? Sustituirá todo lo que se guarda en este navegador.
progress-nothing-new = Este código no añade ningún capítulo a los que ya has terminado aquí.
progress-code-unreadable = Esto no es un código de progreso: empieza por QDS, seguido de grupos de letras y cifras.
progress-code-mistake = Este código tiene una errata: compruébalo carácter por carácter.
progress-code-too-recent = Este código viene de una versión más reciente del juego: recarga la página.
progress-file-unreadable = Este archivo no es un guardado legible (JSON).
progress-file-other = Este archivo no es un guardado de Misiones de Sysadmin.
progress-file-too-recent = Este guardado viene de una versión más reciente del juego: recarga la página.

## La misión, la barra de teclas, Ctrl-R

mission-button = Misión
# { $chapter }: «Capítulo 2»; { $title }: su título.
mission-title = { $chapter }: { $title }
mission-instructions = Las instrucciones
mission-journal = Lo que ha pasado
mission-nothing = Nada todavía: la historia avanza a medida que actúas.
# Durante tail -f o journalctl -f: el botón que hace Ctrl-C.
follow-stop = Detener (Ctrl-C)
follow-suspend = Suspender (Ctrl-Z)
keys-title = Teclas de la terminal
key-up = Comando anterior
key-down = Comando siguiente
# Lo que muestra bash durante Ctrl-R (readline no está traducido).
search-history = (reverse-i-search)`{ $pattern }': { $command }

## Logros y rangos (ver src/engine/achievements.ts)

achievements-title = Logros
# { $earned } de { $total }: el recuento que se muestra en el enlace.
achievements-button = Logros ({ $earned }/{ $total })
# Se anuncia en la terminal cuando se consigue un logro.
achievements-obtained = 🏆 Logro: { $name }
achievements-grade = Tu rango: { $grade }.
achievements-grade-next = Siguiente rango, { $grade }, con { $chapters } capítulos terminados.
achievements = ({ $date })
achievements-cache = Logro oculto
    .description = Un guiño a la cultura de la terminal. Te toca encontrarlo.
notebook-grade = Rango: { $grade }.
grade-intern = En prácticas
grade-apprentice = Sysadmin aprendiz
grade-junior = Admin júnior
grade-admin = Administración de sistemas
grade-confirmed = Admin con experiencia
grade-senior = Admin sénior
grade-sre = SRE (ingeniería de fiabilidad)
achievements-first-command = Primer paso
    .description = Ejecuta un primer comando.
achievements-manual = Leer el manual
    .description = Abre el manual (man o apropos): el primer reflejo de los profesionales.
achievements-cache-ls = Lo que está oculto
    .description = Muestra los archivos ocultos (ls -a).
achievements-pipe = Primera tubería
    .description = Une dos comandos con una tubería (|).
achievements-redirection = Al archivo
    .description = Envía la salida de un comando a un archivo (> o >>).
achievements-first-chapter = Primer capítulo
    .description = Termina un capítulo.
achievements-eraser = El Borrador detenido
    .description = Termina la historia del Borrador.
achievements-restore = Restauración probada
    .description = Restaura una copia de seguridad de verdad: una copia que nunca has restaurado no es una copia.
achievements-network = Toda La Colmena
    .description = Termina La Colmena: VLAN, DHCP, cortafuegos, VPN, directorio y wifi.
achievements-three-stories = Tres historias
    .description = Termina tres historias.
achievements-all-stories = La vuelta completa
    .description = Termina todas las historias.
achievements-fifty-commands = Caja de herramientas
    .description = Ten 50 comandos en tu cuaderno.
achievements-exam = Examen superado
    .description = Termina un capítulo en modo examen.
achievements-exam-lightning = Relámpago
    .description = Termina un capítulo en modo examen en menos de 5 minutos.
achievements-xyzzy = Palabra mágica
    .description = La contraseña de Colossal Cave Adventure (1976), una de las primeras aventuras de texto.
achievements-sandwich = Con los permisos
    .description = Con sudo lo consigues todo, hasta un sándwich (xkcd 149).
achievements-sl = Locomotora
    .description = sl en lugar de ls: la errata más famosa, castigada con un tren.

## Pistas graduales (ver src/engine/hints.ts; las pistas en sí: hints-<story>.ftl)

hint-title = ¿Necesitas ayuda?
hint-intro = Tres niveles, para abrir uno tras otro: primero el manual, como en el trabajo. El repaso dirá cuántas has pedido.
hint-button-manual = El manual
hint-button-lead = Una pista
hint-button-solution = Casi la respuesta
# { $pages }: «man mv, man cp».
hint-manual = Páginas que leer: { $pages }. Busca también con man -k y una palabra clave.
hint-more-nothing = No hay más pistas para este capítulo: vuelve a leer las instrucciones y lo que ha pasado.
## El resumen de fin de capítulo (ver src/engine/summary.ts)
# { $time }: «6:12»; { $commands }, { $errors }, { $hints }: números
summary-summary = Resumen: { $time } · { $commands ->
        [one] un comando
       *[other] { $commands } comandos
    }{ $errors ->
        [0] {""}
       *[other] {" "}({ $errors } con error)
    } · { $hints ->
        [0] sin pistas
        [one] una pista
       *[other] { $hints } pistas
    }
summary-button = Ver los detalles
# { $chapter }: el título del capítulo
summary-title = Resumen: { $chapter }
summary-intro = Tu comando junto a la solución de referencia, paso a paso. El juego comprueba el estado de la máquina, no el comando que escribiste: otra manera de hacerlo es igual de buena si llega al mismo resultado.
summary-col-step = Paso
summary-col-you = Tu comando
summary-col-reference = La solución de referencia
summary-otherwise = (conseguido de otra manera)
summary-encourage = { $hints ->
        [0] Sin pistas: bien hecho. ¿Lo vuelves a jugar en modo examen para mejorar tu tiempo?
       *[other] ¿La próxima vez, con menos pistas?
    }
# Volver a jugar y comparar (ver src/engine/runs.ts); la comparación en sí está en dialog-compare.ftl.
replay-button = Volver a jugar este capítulo
# { $before }: los comandos de la partida anterior de este capítulo
summary-compare = La última vez: { $before ->
        [one] un comando
       *[other] { $before } comandos
    }. Los detalles comparan las dos partidas.
## El punto de restauración (panel Misión; ver Console.restaurer)
rescue-title = Punto de restauración
rescue-intro = Como una instantánea de máquina virtual antes de una operación arriesgada: haz una, prueba tu jugada y vuelve a ella si algo sale mal. El capítulo se vuelve a jugar hasta ese punto, sin perder nada más.
rescue-take = Hacer una instantánea
rescue-go-back = Volver a la instantánea
rescue-cancel = Deshacer la última entrada
rescue-none = Todavía no hay ninguna instantánea en este capítulo.
# { $steps }: el número de entradas (comandos, respuestas, guardados de nano) desde el principio del capítulo
rescue-taken = { $steps ->
        [0] Instantánea hecha al principio del capítulo.
        [one] Instantánea hecha después de una entrada.
       *[other] Instantánea hecha después de { $steps } entradas.
    }
rescue-impossible = Aquí no se puede hacer ninguna instantánea: el capítulo se retomó o pasaste por tu puesto. «Reiniciar este capítulo» empieza de cero.
rescue-exam = No hay instantáneas en modo examen.
rescue-restored = { $steps ->
        [0] ↺ Máquina devuelta al estado del principio del capítulo.
        [one] ↺ Máquina devuelta al estado posterior a la primera entrada del capítulo.
       *[other] ↺ Máquina devuelta al estado posterior a { $steps } entradas del capítulo.
    }
## El guardado automático dentro de un capítulo (banda encima de la terminal; ver src/engine/autosave.ts)
autosave-title = Capítulo en curso
# { $chapter }: el título del capítulo; { $story }: el de su historia; { $steps }: las entradas (comandos, respuestas, guardados de nano) conservadas
autosave-text = { $steps ->
        [one] Dejaste «{ $chapter }» ({ $story }) a medias, después de una entrada. Se ha conservado en este navegador: retómalo y la máquina volverá tal como la dejaste.
       *[other] Dejaste «{ $chapter }» ({ $story }) a medias, después de { $steps } entradas. Se han conservado en este navegador: retómalo y la máquina volverá tal como la dejaste.
    }
autosave-resume = { $steps ->
        [one] Continuar donde lo dejé (una entrada)
       *[other] Continuar donde lo dejé ({ $steps } entradas)
    }
autosave-restart = Empezar el capítulo de nuevo
autosave-resumed = { $steps ->
        [one] ↺ Capítulo retomado donde lo dejaste: una entrada reproducida.
       *[other] ↺ Capítulo retomado donde lo dejaste: { $steps } entradas reproducidas.
    }
# Encima del final de la terminal mostrado tras retomar
autosave-earlier = { $steps ->
        [one] (una entrada anterior no mostrada)
       *[other] ({ $steps } entradas anteriores no mostradas)
    }
autosave-changed = El juego ha cambiado desde tu última visita: este capítulo no se ha podido retomar tal como lo dejaste. Vuelve a empezar desde el principio.
autosave-failed = Este capítulo no se ha podido retomar. Vuelve a empezar desde el principio.
## Recorridos temáticos (menú «Recorridos»; ver src/engine/paths.ts)
view-paths = Recorridos
path-choice = Elige un recorrido
path-start = Primeros pasos
    .description = Moverse, leer, buscar, ordenar, y luego la red, git y los archivos comprimidos: para quien nunca ha abierto una terminal.
path-security = Proteger un servidor
    .description = SSH, cortafuegos, fail2ban, cuentas y permisos, secretos, actualizaciones y la auditoría final: cerrar las puertas, mantener la casa en orden y demostrarlo.
path-web = Servir la web
    .description = nginx, registros, copias de urgencia, certificados, sitios compartidos, tráfico y proxies.
path-network = Redes
    .description = DNS, saltos y túneles SSH, VLAN, DHCP, cortafuegos nftables, VPN WireGuard y DMZ.
path-backups = Copiar y restaurar
    .description = rsync, archivos comprimidos, restic, rsnapshot, bases de datos PostgreSQL, transferencias: y siempre, comprobar que sabes restaurar.
path-deployment = Contenedores y despliegue
    .description = git, Docker y Compose, repositorios desnudos y hooks, marcha atrás, azul/verde, canario y migración.
path-production = Averías en producción
    .description = Un servicio que no vuelve a arrancar, un disco lleno, la memoria, los inodos, la hora, la monitorización y el post mortem.
path-identities = Cuentas e identidades
    .description = Grupos, una compañera que se va, permisos compartidos, claves SSH, directorio LDAP y wifi de empresa.
# { $finished } / { $total }: números
path-progress = { $finished } de { $total } capítulos hechos
path-finished = ✓ Recorrido completo
# { $story }: el título de la historia
path-in = en «{ $story }»
path-done = ✓ Hecho
path-open = Por hacer
path-next = ▶ Siguiente
# { $chapter }: el título del capítulo que hay que terminar antes
path-locked = 🔒 Antes: { $chapter }
path-without-key = 🔒 Historia bloqueada
## La guardia y el incidente del día (ver src/engine/on-call.ts)
on-call-button = 🚨 Incidente del día
# { $chapter }: título del capítulo; { $story }: título de la historia
on-call-today = Hoy: «{ $chapter }» ({ $story })
# { $percent }: presupuesto que queda
on-call-already = Hecho hoy: { $percent } % del presupuesto conservado.
# { $date }: la fecha de hoy, en letras
on-call-title = De guardia, { $date }
on-call-intro = Suena el teléfono de guardia: un incidente que resolver. El mismo para todo el mundo hoy; mañana, otro.
on-call-rules = Tienes un presupuesto de errores de 30 minutos, como el objetivo de disponibilidad de un servicio (SLA): se derrite con el tiempo, cada pista cuesta 3 minutos, cada comando que falla 20 segundos. Sin modo examen; el punto de restauración sigue permitido (el tiempo, en cambio, no vuelve).
on-call-take = Atender la llamada
on-call-cancel = Ahora no
on-call-start = 🚨 De guardia: el presupuesto de errores empieza a derretirse.
# { $time }: «24:10»; { $percent }: un número
on-call-gauge = Presupuesto: { $time } ({ $percent } %)
on-call-exhausted = Presupuesto agotado: SLA incumplido. Termina de todos modos, hay que resolver el incidente.
on-call-abandon = Guardia abandonada: has dejado el incidente.
on-call-end-title = Fin de la guardia
on-call-end-intro = El incidente está resuelto. Aquí tienes tu tarjeta de puntuación, para compartir (no se envía nada: la copias donde quieras).
on-call-copy = Copiar la tarjeta
on-call-copied = Tarjeta copiada.
# La tarjeta de puntuación, como una cuadrícula de palabras compartida.
# { $date } (AAAA-MM-DD), { $chapter }, { $gauge } (cinco cuadrados), { $percent }, { $time }, { $hints }, { $errors }, { $address }
on-call-map =
    Quêtes de Sysadmin · de guardia, { $date }
    «{ $chapter }» resuelto en { $time }
    { $gauge } { $percent } % del presupuesto
    { $hints ->
        [0] sin pistas
        [one] una pista
       *[other] { $hints } pistas
    } · { $errors ->
        [0] sin errores
        [one] un error
       *[other] { $errors } errores
    }
    { $address }
# El recordatorio diario (ver src/engine/reminder.ts): el botón del menú; su diálogo está en dialog-reminder.ftl.
reminder-button = 📅 Recordatorio diario
# Una historia publicada desde la última visita (ver src/engine/releases.ts): su etiqueta en el menú.
story-new = Nueva
## La racha de guardias (ver src/engine/streak.ts): amable, nunca culpabilizadora.
# { $days }: la racha actual, en días; { $best }: la mejor
streak-today = 🔥 { $days ->
        [one] Un día de guardia
       *[other] { $days } días de guardia seguidos
    } (mejor: { $best }). Hasta mañana, si te apetece.
streak-going = 🔥 { $days ->
        [one] Un día de guardia
       *[other] { $days } días de guardia seguidos
    } (mejor: { $best }). El incidente de hoy la mantiene.
# Se muestra con streak-going cuando un día perdido no rompería la racha.
streak-rest-ready = Sin presión: un día de descanso a la semana no la rompe.
streak-rest-used = Ayer fue tu día de descanso de la semana.
streak-best = Mejor racha: { $best ->
        [one] un día
       *[other] { $best } días
    }. Empieza una nueva con el incidente de hoy.
achievements-streak-3 = Tres noches de guardia
    .description = Resuelve el incidente del día tres días seguidos (un día de descanso a la semana no rompe la racha).
achievements-streak-7 = Una semana de guardia
    .description = Resuelve el incidente del día siete días seguidos (un día de descanso a la semana no rompe la racha).
achievements-streak-30 = Un mes de guardia
    .description = Resuelve el incidente del día treinta días seguidos (un día de descanso a la semana no rompe la racha).
achievements-without-hint = Sin red
    .description = Termina un capítulo sin pedir ninguna pista.

## La tabla de la clase (página para docentes; ver src/engine/classroom.ts)

class-files = Los archivos de guardado del alumnado:
class-slide = O suéltalos aquí, varios a la vez.
class-codes = O sus códigos, uno por línea, después del nombre:
class-codes-example = Lina QDS-047G-0000-000M-G
class-codes-add = Añadir los códigos
class-export = Descargar la tabla (CSV)
class-empty = Vaciar la tabla
class-name-file = tabla-clase.csv
class-table = La clase
class-account = { $count ->
        [0] Todavía no hay estudiantes.
        [one] Un estudiante.
       *[other] { $count } estudiantes.
    }
# { $source }: el archivo o la línea; { $reason }: lo que falla.
class-error = { $source }: { $reason }
class-col-student = Estudiante
class-col-chapters = Capítulos
class-col-grade = Rango
class-col-achievements = Logros
class-col-exam = Mejor examen
class-col-date = Guardado
class-col-streak = Racha de guardias
class-col-best-streak = Mejor racha de guardias
class-separator = Separador:
class-separator-comma = coma (,)
class-separator-semicolon = punto y coma (;)
class-print = Imprimir la tabla
class-local = El archivo CSV y la impresión se hacen en este navegador, a partir de la tabla de abajo: no se envía nada a ninguna parte.
# Cabeceras del CSV: los capítulos terminados (un número), los de una historia (un número), un capítulo (1 terminado, 0 no).
class-csv-chapters = Capítulos terminados (de { $total })
class-csv-story = { $story } (de { $total })
class-csv-chapter = { $story } { $number }: { $chapter } (1 = terminado)

## La pantalla de la terminal

display-theme = Tema de la terminal
display-theme-phosphor = Fósforo
display-theme-amber = Ámbar
display-theme-contrast = Alto contraste
display-theme-paper = Papel
display-more-small = A− (texto más pequeño)
display-more-big = A+ (texto más grande)
display-colours = Colores
display-focus = Pantalla completa
display-quit-focus = Salir de pantalla completa (Esc)

## Dificultad de un capítulo o de una historia (1 a 5, ver difficulty.ts)
difficulty = Dificultad: { $level } de 5
difficulty-tidy = Dificultad: de { $min } a { $max } de 5

## Consejos: una sola vez, cuando un atajo o un hábito ayudaría (ver tips.ts)

tip-label = Consejo
tip-silence = ¿Ningún mensaje? En Linux, un comando que funciona no suele decir nada. Comprueba tú el resultado: ls muestra dónde están las cosas ahora.
tip-up-twice = ¿Subir varios niveles? cd ../.. sube dos de una vez (y ../../.. tres).
tip-cd-back = ¿Volver adonde estabas? cd - te lleva a la carpeta anterior, sea cual sea su ruta.
tip-cd-home = ¿Volver a casa? cd solo, o cd ~, te lleva desde cualquier sitio.
tip-tab = ¿Nombres largos que escribir? Pulsa Tab: completa el nombre por ti. Pulsado dos veces, lista las opciones posibles.
tip-net-tools = ifconfig, route y netstat pertenecen a net-tools, que ya no se instala en Debian: ip a muestra las direcciones, ip r las rutas, ss -tlnp quién escucha.
display-tips = Consejos
display-tour = Visita guiada
display-autosave = Guardado automático
display-autosave-title = Conservar en este navegador el capítulo en curso, para retomarlo si se cierra la página

## El botón y la ventana del cuaderno

notebook-button = Cuaderno
notebook-close = Cerrar

## La chuleta de navegación, al principio del cuaderno

shortcuts-title = Atajos que conviene conocer
shortcuts-home = tu carpeta personal (cd ~, o cd solo)
shortcuts-back = la carpeta anterior (cd -)
shortcuts-up = la carpeta de arriba (cd ..); dos niveles más arriba: cd ../..
shortcuts-tab = completa un nombre; pulsado dos veces, lista las opciones
shortcuts-history = los comandos anteriores; Ctrl-R los busca
shortcuts-cancel = abandona la línea, o detiene un comando que sigue en marcha

## La visita guiada, en una primera visita

tour-label = Para empezar
tour-step = { $step } de { $total }
tour-next = Siguiente
tour-done = ¡Vamos!
tour-skip = Saltar la visita
tour-input = Escribe aquí tus comandos y pulsa Intro. Es una terminal de verdad: el texto de arriba te dice qué escribir primero.
tour-mission = Misión: lo que tienes que hacer en este capítulo, lo que ya ha pasado y pistas si te atascas.
tour-map = Mapa: los lugares que ya has visitado, para encontrar el camino de vuelta.
tour-notebook = Cuaderno: cada comando que ejecutas se anota aquí, con lo que hace. Tu chuleta.
tour-tab = Tab completa por ti los nombres de comandos, carpetas y archivos: escribe sus primeras letras y luego Tab. Pulsado dos veces, lista las opciones.

# Una historia se carga la primera vez que se abre (sus capítulos y textos).
loading-story = Cargando {$story}…
loading-failed = No se ha podido cargar esta parte del juego: comprueba tu conexión e inténtalo de nuevo.

## Lectores de pantalla (ver docs/ACCESSIBILITY.md y src/engine/announce.ts)
# El nombre de la salida de la terminal (un registro: cada salida nueva se lee una vez)
output-label = Salida de la terminal
# Un encabezado para lectores de pantalla (oculto visualmente) antes de la terminal
terminal-heading = Terminal
# Se lee con la línea de comandos, después de su nombre y del prompt
input-help = Tab completa; Escape y luego Tab sale de la línea hacia delante, Mayús+Tab hacia atrás; Alt+R vuelve a leer la última salida.
# Un botón que se muestra cuando tiene el foco, arriba de la terminal
reread-button = Volver a leer la última salida (Alt+R)
reread-empty = El último comando no mostró nada.
# Antes de una salida larga releída: solo se lee su final
reread-cut = { $lines } líneas; estas son las últimas { $shown }:
follow-announce-start = El comando sigue en marcha y muestra líneas nuevas: un resumen cada diez segundos. Ctrl-C o Escape lo detiene.
follow-announce-watch = La pantalla se actualiza sola: Alt+R la lee. Ctrl-C o Escape la detiene.
follow-announce-lines =
    { $count ->
        [one] Una línea nueva: { $line }
       *[other] { $count } líneas nuevas; la última: { $line }
    }
follow-announce-screen = La pantalla ha cambiado: Alt+R la lee.
chapter-done-announce = Capítulo terminado: { $chapter }. Su resumen está al final de la terminal; Escape y luego Tab llega a los botones que lo siguen.
continuation-announce = El comando no está terminado: escribe su línea siguiente, o Ctrl-C para abandonarlo.
# El recuadro del esquema de red (se desplaza de lado en una pantalla estrecha); su versión de texto va después
plan-diagram-label = Esquema de la red (su versión de texto va después)
shortcuts-escape-tab = sale de la línea de comandos, hacia lo que sigue a la terminal (Tab solo completa)
shortcuts-shift-tab = sale de la línea de comandos, hacia lo que la precede
shortcuts-reread = vuelve a leer la última salida, para lectores de pantalla
