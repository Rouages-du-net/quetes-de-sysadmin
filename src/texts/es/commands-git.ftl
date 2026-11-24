### El comando git (src/engine/commands/git.ts): los mensajes de git en
### español, tal como los muestra el git real con LANG=es (traducción oficial
### de git, po/es.po), más algunos comentarios del juego. Lo que git no
### traduce (el resumen de un commit, «To», «Everything up-to-date») se queda
### en inglés. Los identificadores técnicos (main, HEAD, .git, las opciones)
### no se traducen. { $path }: ruta de una carpeta; { $file }: nombre de un archivo.

## Los mensajes de git

git-not-repo = fatal: no es un repositorio git (ni ninguno de los directorios superiores): .git
git-init-existing = Reinicializado el repositorio Git existente en { $path }/.git/
git-init-empty = Inicializado repositorio Git vacío en { $path }/.git/
git-write-permission = error: no se puede crear el archivo { $file }: Permiso denegado
git-path-unknown = fatal: ruta especificada '{ $file }' no concordó con ningún archivo
git-nothing-a-validate =
    En la rama main
    no hay nada para confirmar (crea/copia archivos y usa "git add" para hacerles seguimiento)
git-none-commit-branch = fatal: tu rama actual 'main' no tiene ningún commit todavía
# { $revision }: lo que escribió la persona (HEAD~9, un identificador…)
git-revision-ambiguous = fatal: argumento ambiguo '{ $revision }': revisión desconocida o ruta fuera del árbol de trabajo.
git-restore-without-path = fatal: debes especificar path(s) para restaurar
git-reference-invalid = fatal: referencia inválida: { $revision }
git-restore-unknown = error: ruta especificada '{ $file }' no concordó con ningún archivo conocido por git

git-not-tree = fatal: esta operación debe ser realizada en un árbol de trabajo
# { $option }: la opción desconocida
git-option-unknown =
    unknown option: { $option }
    usage: git [--version] [--help] [--git-dir=<path>] [--work-tree=<path>] <command> [<args>]

## Repositorios desnudos, remotos, push y pull (https://git-scm.com/book/es/v2/Git-en-el-Servidor-Configurando-el-servidor)

git-init-existing-bare = Reinicializado el repositorio Git existente en { $path }/
git-init-empty-bare = Inicializado repositorio Git vacío en { $path }/
git-init-impossible = fatal: no se puede crear directorio { $path }: Permiso denegado
git-work-tree-missing = fatal: no se puede aplicar chdir a '{ $path }'
# { $files }: un archivo por línea, precedido de un tabulador
git-checkout-not-tracked =
    error: Los siguientes archivos sin seguimiento en el árbol de trabajo serán sobrescritos al actualizar el árbol de trabajo:
    { $files }
    Por favor, muévelos o elimínalos antes de cambiar de rama.
    Abortando
git-checkout-changes-local =
    error: Los cambios locales de los siguientes archivos serán sobrescritos por checkout:
    { $files }
    Por favor realiza un commit con los cambios o un stash antes de cambiar de rama.
    Abortando
git-rm-usage = fatal: No se entregó un pathspec. ¿Qué archivos se deberían eliminar?
git-clone-usage = fatal: Tienes que especificar un repositorio para clonar.
# { $repository }: la ruta o el nombre del repositorio remoto
git-remote-missing =
    fatal: '{ $repository }' no parece ser un repositorio git
    fatal: No se pudo leer del repositorio remoto.

    Por favor asegúrate de que tengas los permisos de acceso correctos
    y que el repositorio exista.
git-clone-exists = fatal: la ruta de destino '{ $path }' ya existe y no es un directorio vacío.
git-clone-in = Clonando en '{ $path }'...
git-done = hecho.
git-clone-empty = advertencia: Pareces haber clonado un repositorio sin contenido.
git-remote-usage =
    usage: git remote [-v | --verbose]
       or: git remote add <name> <url>
       or: git remote remove <name>
       or: git remote set-url <name> <newurl>
# { $name }: el nombre del remoto (origin, prod…)
git-remote-exists = error: remoto { $name } ya existe.
git-remote-unknown = error: No existe el remoto '{ $name }'
git-push-without-destination =
    fatal: No se ha configurado un destino para el empuje.
    Puedes o especificar una URL desde la línea de comandos o configurar un repositorio remoto usando

        git remote add <nombre> <url>

    y luego empujar al nombre del remoto

        git push <nombre>
git-to = To { $repository }
git-push-impossible = error: falló el empuje de algunas referencias a '{ $repository }'
# { $ref }: la rama pedida
git-refspec-unknown = error: src refspec { $ref } no concuerda con ninguno
git-all-a-day = Everything up-to-date
git-push-rejected-tip =
    ayuda: Actualizaciones fueron rechazadas porque el remoto contiene trabajo que
    ayuda: no existe localmente. Esto es causado usualmente por otro repositorio
    ayuda: empujando a la misma ref. Quizás quieras integrar primero los cambios
    ayuda: remotos (ej. 'git pull ...') antes de volver a hacer push.
# { $objects }, { $bytes }: números, ya con formato
git-push-progress =
    Enumerando objetos: { $objects }, listo.
    Contando objetos: 100% ({ $objects }/{ $objects }), listo.
    Compresión delta usando hasta 2 hilos
    Comprimiendo objetos: 100% ({ $objects }/{ $objects }), listo.
    Escribiendo objetos: 100% ({ $objects }/{ $objects }), { $bytes } bytes | { $bytes }.00 KiB/s, listo.
    Total { $objects } (delta 0), reusados 0 (delta 0), pack-reusados 0
git-push-rights =
    error: permisos insuficientes para agregar un objeto a la base de datos del repositorio ./objects
    fatal: falló al escribir el objeto
    error: unpack-objects abnormal exit
git-push-branch-extracted =
    remote: error: refusing to update checked out branch: refs/heads/main
    remote: error: By default, updating the current branch in a non-bare repository
    remote: error: is denied, because it will make the index and work tree inconsistent
    remote: error: with what you pushed, and will require 'git reset --hard' to match
    remote: error: the work tree to HEAD.
# { $hook }: la ruta del hook
git-hook-ignore =
    ayuda: El hook '{ $hook }' fue ignorado porque no ha sido configurado como ejecutable.
    ayuda: Puedes desactivar esta advertencia con `git config advice.ignoredHook false`.
# { $remote }: el nombre del remoto
git-push-follow = rama 'main' configurada para rastrear '{ $remote }/main'.
git-pull-without-remote =
    No hay información de rastreo para la rama actual.
    Por favor especifica a qué rama quieres fusionar.

        git pull <remoto> <rama>
git-since = Desde { $repository }
git-already-a-day = Ya está actualizado.
git-pull-diverge = fatal: No es posible hacer fast-forward, abortando.
# { $before }, { $after }: identificadores de commit (7 caracteres)
git-update = Actualizando { $before }..{ $after }
git-advance-fast = Fast-forward

## git status (las etiquetas de los archivos se alinean en la misma columna)

git-status-branch = En la rama main
git-status-none-commit = No hay commits todavía
git-status-deleted = borrados:        { $file }
git-status-new = nuevos archivos: { $file }
git-status-modified = modificados:     { $file }
git-status-indexes =
    Cambios a ser confirmados:
      (usa "git restore --staged <archivo>..." para sacar del área de stage)
git-status-not-indexes =
    Cambios no rastreados para el commit:
      (usa "git add <archivo>..." para actualizar lo que será confirmado)
      (usa "git restore <archivo>..." para descartar los cambios en el directorio de trabajo)
git-status-not-tracked =
    Archivos sin seguimiento:
      (usa "git add <archivo>..." para incluirlo a lo que será confirmado)
git-status-own = nada para hacer commit, el árbol de trabajo está limpio
git-status-only-not-tracked = no hay nada agregado al commit pero hay archivos sin seguimiento presentes (usa "git add" para hacerles seguimiento)
git-status-nothing-added = sin cambios agregados al commit (usa "git add" y/o "git commit -a")

## git commit

# Primera línea del resumen de un commit: { $id } (7 caracteres), { $message }
git-commit-header = [main { $id }] { $message }
git-commit-header-root = [main (commit-raíz) { $id }] { $message }
# Resumen (git no lo traduce): «1 file changed, 3 insertions(+), 3 deletions(-)»
git-commit-files =
    { $count ->
        [one] { $count } file changed
       *[other] { $count } files changed
    }
git-commit-insertions =
    { $count ->
        [one] { $count } insertion(+)
       *[other] { $count } insertions(+)
    }
git-commit-deletions =
    { $count ->
        [one] { $count } deletion(-)
       *[other] { $count } deletions(-)
    }

## Comentarios del juego (donde el git real se comporta de otra manera)

git-add-nothing =
    No se ha indicado nada, no se ha añadido nada.
    (por ejemplo: git add novela.txt, o git add . para todo)
git-commit-without-message =
    Escribe el mensaje con -m, entre comillas: git commit -m "Lo que he cambiado"
    (el git real abriría un editor de texto)
git-checkout-usage =
    En este juego, git checkout sirve para restaurar un archivo: git checkout ID -- archivo
    (hoy en día, mejor: git restore --source=ID archivo),
    o para extraer los archivos de un repositorio en un lugar: git --work-tree=lugar checkout -f main
git-usage =
    usage: git <command> [<args>]
    (mira man git)
# { $commands }: los subcomandos del juego, separados por comas
git-under-command-unknown = git: '{ $command }' no es un comando de git (en este juego: { $commands }).

## Firmas, etiquetas, config, reset, archive (https://git-scm.com/docs/git-config, git-tag, git-reset, git-archive)

git-sign-failed = fatal: falló al escribir el objeto commit
git-tag-sign-failed = error: incapaz de firmar tag
git-sign-no-key = either user.signingkey or gpg.ssh.defaultKeyCommand needs to be configured
git-allowed-signers-missing = gpg.ssh.allowedSignersFile needs to be configured and exist for ssh signature verification
git-amend-nothing = fatal: No tienes nada que enmendar.
git-config-usage = usage: git config [<options>]
git-tag-without-message =
    Escribe el mensaje de la etiqueta con -m, entre comillas: git tag -a v1.0 -m "Versión 1.0"
    (el git real abriría un editor de texto)
git-reset-unstaged = Cambios fuera del área de stage tras el reset:
git-archive-to-terminal =
    fatal: refusing to write an archive to the terminal: use -o FILE (--output=FILE)
git-push-behind-tip =
    ayuda: Actualizaciones fueron rechazadas porque la punta de tu rama actual está
    ayuda: detrás de su contraparte remota. Integra los cambios remotos (es decir
    ayuda: 'git pull ...') antes de empujar de nuevo.
    ayuda: Mira 'Note about fast-forwards' en 'git push --help' para más detalles.
git-push-tag-exists-tip = ayuda: Actualizaciones fueron rechazadas porque el tag ya existe en el remoto.
