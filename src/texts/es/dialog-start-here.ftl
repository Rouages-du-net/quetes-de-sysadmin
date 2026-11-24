### El diálogo de «¿Por dónde empiezo?» (src/engine/start-here.ts), cargado
### cuando se abre por primera vez (src/texts/plugin.mjs: dialog-*.ftl). Su
### botón, la tarjeta de la primera visita y la burbuja de la visita guiada están en start-here.ftl.

start-here-title = ¿Por dónde empiezo?
start-here-intro = Cuatro preguntas rápidas, y el juego te propone un recorrido y un primer capítulo. Tus respuestas se quedan en este navegador y puedes cambiarlas cuando quieras.

## Las preguntas (cada una, un grupo de opciones)
start-here-experience = ¿Ya has usado una terminal?
start-here-experience-never = Nunca
start-here-experience-little = Un poco
start-here-experience-daily = Todos los días
start-here-goal = ¿Qué te trae por aquí?
start-here-goal-curiosity = La curiosidad
start-here-goal-studies = Estudios o una certificación
start-here-goal-job = Un trabajo de sysadmin o en DevOps
start-here-goal-teacher = Doy clase
start-here-systems = ¿Qué te interesa más?
start-here-systems-linux = Linux
start-here-systems-windows = Windows
start-here-systems-both = Linux y Windows a la vez
start-here-systems-network = Las redes
start-here-systems-security = La seguridad
start-here-systems-vintage = Los Unix antiguos y los mainframes
start-here-time = ¿Cuánto dura una sesión para ti?
start-here-time-short = Unos 10 minutos
start-here-time-medium = Unos 30 minutos
start-here-time-long = Una hora o más

## La propuesta
start-here-incomplete = Responde a las cuatro preguntas para ver una propuesta.
start-here-result = Nuestra propuesta
# { $path }: el nombre del recorrido
start-here-path = Recorrido: { $path }
# { $chapter }: el título del capítulo; { $story }: el de su historia
start-here-chapter = { $chapter }, en «{ $story }»
# { $chapter }: el título del primer capítulo del recorrido, todavía bloqueado; { $count }: los capítulos que hay que terminar antes de que se abra
start-here-locked =
    { $count ->
        [one] { $chapter } se abre después de un capítulo más: empieza por este.
       *[other] { $chapter } se abre después de { $count } capítulos más: empieza por este.
    }
start-here-alternatives = Otras puertas de entrada
start-here-teachers = Para tus clases, las fichas de las misiones dan el objetivo, los requisitos previos, los comandos nuevos y la duración de cada capítulo.
start-here-teachers-link = Abrir las fichas de las misiones
start-here-all-done = Has terminado todos los recorridos. Vuelve a jugar un capítulo en modo examen o atiende el incidente del día.
start-here-close = Cerrar

## Razones (una frase cada una)
start-here-reason-beginner = Nunca has usado una terminal: este recorrido empieza desde el primer comando, paso a paso.
start-here-reason-teacher = Juega tú los primeros pasos: es lo primero que verá tu alumnado.
start-here-why-start = Los primeros pasos cubren los comandos de todos los días sobre los que se construyen los demás capítulos.
start-here-why-security = Cerrarás las puertas de un servidor, vigilarás quién llama y responderás a una intrusión.
start-here-why-web = Harás funcionar un sitio web: nginx, registros, certificados y el tráfico que los acompaña.
start-here-why-network = Seguirás a los paquetes: DNS, túneles SSH, VLAN, DHCP, cortafuegos y VPN.
start-here-why-backups = Copiar y restaurar son lo básico que piden todos los exámenes y todos los trabajos.
start-here-why-deployment = Desplegarás como un equipo en el trabajo: git, Docker, Compose, marcha atrás y Kubernetes.
start-here-why-production = Incidentes reales: discos llenos, servicios bloqueados, Unix antiguos y mainframes, servidores Windows.
start-here-why-identities = Cuentas y permisos, de los grupos de Linux a los recursos compartidos de Windows y Active Directory.

## El tiempo por sesión
start-here-note-short = Un capítulo dura entre diez y veinte minutos, y el juego guarda tu sitio si te paras a medias.
start-here-note-medium = Media hora basta para uno o dos capítulos, y el juego guarda tu sitio si te paras a medias.
start-here-note-long = Con una hora o más, puedes jugar una historia entera de principio a fin.

## Para lectores de pantalla
# { $chapter }: el título del capítulo propuesto; { $path }: el nombre de su recorrido
start-here-announce = Propuesta: «{ $chapter }», en el recorrido «{ $path }».
