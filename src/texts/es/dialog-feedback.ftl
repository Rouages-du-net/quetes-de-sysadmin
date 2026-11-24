### El diálogo de «Informar de un problema o una idea» (src/engine/feedback.ts),
### cargado cuando se abre por primera vez (src/texts/plugin.mjs: dialog-*.ftl).
### Sus botones están en feedback.ftl.

feedback-title = Informar de un problema o una idea
feedback-intro = El juego no envía nada por sí solo. Escribe tu mensaje, marca lo que pueda ayudarnos a entenderlo, revisa el texto de abajo y luego envíalo tú.

## El tipo de aviso (un grupo de opciones)
feedback-kind-legend = ¿De qué se trata?
feedback-kind-bug = Un comando que se comporta mal
feedback-kind-text = Un texto o una pista que no se entiende
feedback-kind-idea = Una idea
feedback-kind-other = Otra cosa

## El mensaje
feedback-message-label = Tu mensaje
feedback-message-help = Qué ha pasado, qué esperabas o tu idea. No escribas nada personal: el aviso puede hacerse público.

## Qué incluir (cada casilla muestra exactamente lo que añade)
feedback-parts-legend = Qué incluir
feedback-parts-help = Cada casilla muestra exactamente lo que añade al aviso.
feedback-part-version = La versión del juego
feedback-part-language = El idioma
feedback-part-chapter = Dónde estás (historia, capítulo, máquina, carpeta, eventos alcanzados)
feedback-part-commands = Tus últimos comandos en este capítulo y lo que respondieron
feedback-part-browser = Tu navegador y el tamaño de tu pantalla
feedback-part-settings = Tus ajustes de pantalla
feedback-part-notebook = Los comandos de tu cuaderno
feedback-commands-help = Puedes editar o borrar líneas abajo antes de enviarlo. Las contraseñas que escribiste nunca se incluyen. Los comandos pueden revelar la solución del capítulo a quien lea el aviso.
feedback-commands-label = Los comandos que se incluirán
feedback-commands-none = Todavía no has escrito ningún comando en este capítulo.
feedback-commands-exam = No en modo examen: los comandos de una prueba se quedan en el juego.
feedback-never = Nunca se incluye: tu código de progreso, tu guardado, tu nombre ni nada que no hayas marcado.

## La vista previa y cómo enviarlo
feedback-preview = El texto exacto del aviso
feedback-send = Envíalo tú
feedback-github = Abrir una incidencia en GitHub
feedback-github-help = Una incidencia de GitHub es pública, y necesitas una cuenta de GitHub para crearla. El enlace abre el formulario de GitHub en una pestaña nueva, ya rellenado; no se envía nada hasta que lo envíes allí.
feedback-new-tab = (se abre en una pestaña nueva)
feedback-copy = Copiar el texto
feedback-copy-help = O copia el texto y pégalo donde quieras.
feedback-copied = El texto está copiado.
feedback-copy-selected = El texto está seleccionado: pulsa Ctrl+C (o ⌘+C) para copiarlo.
feedback-link-truncated =
    { $count ->
        [one] El aviso es demasiado largo para un enlace: el formulario de GitHub lo recibe sin la línea de comandos más antigua. Copia el texto y pégalo en la incidencia para darlo todo.
       *[other] El aviso es demasiado largo para un enlace: el formulario de GitHub lo recibe sin las { $count } líneas de comandos más antiguas. Copia el texto y pégalo en la incidencia para darlo todo.
    }
feedback-link-message-cut = El aviso es demasiado largo para un enlace: el formulario de GitHub recibe tu mensaje recortado. Copia el texto y pégalo en la incidencia para darlo todo.
feedback-close = Cerrar

## En el propio aviso (los títulos; las etiquetas de debajo siguen en inglés)
feedback-heading-kind = Tipo
feedback-heading-message = Mensaje
feedback-heading-context = Contexto
feedback-heading-commands = Últimos comandos
feedback-no-message = (sin mensaje)
feedback-redacted = [código de progreso eliminado]
feedback-output-cut =
    { $count ->
        [one] [… una línea más]
       *[other] [… { $count } líneas más]
    }
feedback-truncated =
    { $count ->
        [one] (Se ha omitido la línea más antigua para que quepa en el enlace.)
       *[other] (Se han omitido las { $count } líneas más antiguas para que quepan en el enlace.)
    }
feedback-message-cut = (El mensaje se ha recortado para que quepa en el enlace.)
