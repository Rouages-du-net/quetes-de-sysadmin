### La shell: el prompt, sudo, las tuberías y redirecciones, man, y los
### mensajes de error comunes a varios comandos (tomados de coreutils, glibc
### y bash en español, del Translation Project: https://translationproject.org/team/es.html).
### { $command }: nombre del comando; { $target }: ruta.

## Mensajes comunes

error-missing = { $command }: { $target }: No existe el fichero o el directorio
error-is-one-directory = { $command }: { $target }: Es un directorio
error-permission = { $command }: { $target }: Permiso denegado
error-binary = { $command }: { $target }: fichero binario (un archivo comprimido: para ver lo que contiene, tar -tf { $target })
error-creation-permission = { $command }: no se puede crear '{ $target }': Permiso denegado
error-space = { $command }: error de escritura: No queda espacio en el dispositivo

## sudo

# El mensaje que sudo muestra la primera vez que se usa (traducción de sudoers).
sudo-lecture =
    Confiamos que haya recibido la charla habitual del administrador de sistema local. Por lo general se reduce a estas tres cosas:

        #1) Respeta la privacidad de otros.
        #2) Piensa antes de escribir.
        #3) Un gran poder conlleva una gran responsabilidad.
# { $user }: nombre del usuario (identificador técnico)
sudo-prompt = [sudo] contraseña para { $user }:
sudo-bad-password = Lo siento, pruebe otra vez.
# Sin traducción en sudoers: sudo lo dice en inglés.
sudo-three-failures = sudo: 3 incorrect password attempts
sudo-not-still = sudo: todavía no tienes este comando en este capítulo.
sudo-cd =
    sudo: cd: orden no encontrada
    (cd forma parte de la propia shell, así que sudo no puede ejecutarlo. Con sudo, miras y actúas a distancia: sudo ls lugar, sudo cat archivo…)

## Líneas de comandos, tuberías y redirecciones

# { $operator }: > o >>
syntax-redirection = error de sintaxis: falta un nombre de fichero después de { $operator }
syntax-pipe = error de sintaxis cerca del elemento inesperado `|'
syntax-token = error de sintaxis cerca del elemento inesperado `{ $token }'
syntax-end = error de sintaxis: no se esperaba el final del fichero
syntax-eof = error de sintaxis: no se esperaba el final del fichero
# { $line }: el número de línea de la entrada; { $delimiter }: la palabra del documento-aquí (EOF)
heredoc-eof = aviso: el documento-aquí en la línea { $line } está delimitado por fin-de-fichero (se esperaba `{ $delimiter }')
# { $command }: break o continue, escrito fuera de un bucle
shell-loop-only = -bash: { $command }: solo tiene significado en un bucle `for', `while', o `until'
# { $count }: el número de vueltas tras el que el juego detiene un bucle
shell-loop-limit = (El juego ha detenido este bucle tras { $count } vueltas: un bucle sin fin congelaría la página. En una máquina real, Ctrl-C lo detiene.)
redirection-is-one-directory = { $target }: Es un directorio
redirection-permission = { $target }: Permiso denegado
redirection-sudo = (La redirección > la hace tu propia shell, no sudo. Truco: envía el texto a «sudo tee -a archivo», que escribe como root.)
command-not-still = { $command }: todavía no tienes este comando en este capítulo. Escribe «ayuda» para ver la lista.
command-missing = { $command }: orden no encontrada. Escribe «ayuda» para ver la lista.
command-replaced = { $command }: orden no encontrada. (Debian 13 ya no tiene { $command }: prueba { $replacement }.)
# { $commands }: lista de comandos, separados por comas
# El nombre del comando que lista los demás, en el idioma (ayuda, help)
command-help = ayuda
help-commands = Comandos conocidos: { $commands }.
# { $commands }: los comandos que este capítulo conserva de los capítulos que supone, separados por comas
help-inherited = Aprendidos en capítulos anteriores: { $commands }.
help-more = Para saber más: «man comando» (el manual completo), «comando --help» (un resumen), «man -k palabra» (buscar un comando por palabra clave).

## man, apropos, whatis (mensajes de man-db)

manual-not-still = (Todavía no tienes este comando en este capítulo.)
manual-what-search = ¿{ $command } qué?
manual-nothing = { $word }: nada apropiado.
manual-which-page =
    ¿Qué página del manual desea?
    Por ejemplo, pruebe 'man man'.
manual-not-page = Ninguna entrada del manual para { $command }

## Scripts (/bin/sh): hooks de git, scripts de despliegue (src/engine/script.ts)

# { $operator }: lo que se le dio a test (dash no está traducido)
test-operator = { $operator }: unexpected operator
test-too-arguments = too many arguments
# { $file }: el script pedido
sh-missing = sh: 0: cannot open { $file }: No such file
sh-interactive = (En este juego, sh ejecuta un script: sh archivo. La shell interactiva es la que ya estás usando.)
# { $argument }: lo que no se entendió
date-invalid = date: fecha inválida '{ $argument }'
# El formato de la fecha sin argumento, como date con LANG=es_ES.UTF-8
date-format = %a %d %b %Y %T %Z
readlink-operand =
    readlink: falta un operando
    Pruebe 'readlink --help' para más información.
# Ejecutar ./script: { $command } es la ruta escrita
script-missing = bash: { $command }: No existe el fichero o el directorio
script-directory = bash: { $command }: Es un directorio
script-permission = bash: { $command }: Permiso denegado

## Discos (mount, umount)

mount-usage =
    Usage:
     mount [-lhV]
     mount -a [options]
     mount [options] [--source] <source> | [--target] <directory>
     mount [options] <source> <directory>
    (Aquí: mount, o sudo mount [-o ro] dispositivo punto_de_montaje; mira man mount)
# sfdisk sin script: el sfdisk real abriría un diálogo (diferencia del juego)
sfdisk-interactive =
    sfdisk: el modo interactivo no existe en este juego. Dale un script
    por su entrada estándar: por ejemplo la tabla de otro disco,
    sfdisk -d /dev/sda | sudo sfdisk /dev/sdb (mira man sfdisk).
# mdadm --create con un nivel distinto de RAID 1 (diferencia del juego)
# { $level }: el nivel pedido
mdadm-level = mdadm: en este juego solo se simula RAID 1 (--level=1), no «{ $level }».
update-initramfs-usage =
    Usage: update-initramfs {"{"} -c | -d | -u {"}"} [-k version] [-v] [-b directory]
umount-usage =
    Usage:
     umount [-hV]
     umount <source> | <directory> [options]
# { $command }: el comando; { $target }: la ruta
error-read-only = { $command }: { $target }: Sistema de ficheros de sólo lectura

# sudo -u con una cuenta que no existe; { $account }: el nombre dado
sudo-account-unknown = sudo: usuario desconocido: { $account }

# Un comodín que da demasiados nombres: el límite de argumentos de un programa (ARG_MAX).
# { $program }: la ruta del programa, p. ej. /usr/bin/rm
list-arguments-too-long = bash: { $program }: La lista de argumentos es demasiado larga
sudo-list-arguments-too-long = sudo: no se puede ejecutar { $program }: La lista de argumentos es demasiado larga
date-option-argument =
    date: la opción requiere un argumento -- 's'
    Pruebe 'date --help' para más información.
date-setting-refuse = date: no se puede establecer la fecha: Operación no permitida

## Guiños (ver EGGS en src/engine/shell.ts): en inglés, como sus originales

egg-xyzzy = Nothing happens.
egg-sandwich-refusal = What? Make it yourself.
egg-sandwich = Okay.
egg-sl =
          ====        ________                ___________
      _D _|  |_______/        \__I_I_____===__|_________|
       |(_)---  |   H\________/ |   |        =|___ ___|
       /     |  |   H  |  |     |   |         ||_| |_||
      |      |  |   H  |__--------------------| (___) |
      | ________|___H__/__|_____/(__)~\_______|       |
      |/ |   |-----------I_____I (__) (__)  D |=======|__
    __/ =| o |=-~~\  /~~\  /~~\  /~~\ ____Y___________|__
     |/-=|___|=    ||    ||    ||    |_____/~\___/
      \_/      \O=====O=====O=====O_/      \_/

# --color=CUÁNDO desconocido (ls, grep, diff), como lo dice coreutils en español.
colour-argument-invalid =
    { $command }: argumento '{ $value }' inválido para '--color'
    Los argumentos válidos son:
      - 'always', 'yes', 'force'
      - 'never', 'no', 'none'
      - 'auto', 'tty', 'if-tty'
    Pruebe '{ $command } --help' para más información.

# vim, vi, emacs…: no simulados; el juego muestra su editor.
editor-only-nano = { $command }: orden no encontrada. El editor de este juego es nano: nano { $file } (Ctrl-O para guardar, Ctrl-X para salir).
editor-file = archivo
