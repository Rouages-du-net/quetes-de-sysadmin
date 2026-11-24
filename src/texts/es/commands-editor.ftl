### El editor nano: mensajes de la línea de estado y etiquetas de la
### interfaz, cerca de los mensajes de GNU nano en español. { $path }: ruta
### completa del archivo; { $lines }: número de líneas.

nano-usage = Uso: nano archivo (p. ej. nano notas.txt; mira man nano)
nano-directory = «{ $path }» es un directorio
nano-new = [ Nuevo fichero ]
nano-lines-read =
    {"["} { $lines ->
        [one] { $lines } línea leída
       *[other] { $lines } líneas leídas
    } ]
nano-lines-read-dos =
    {"["} { $lines ->
        [one] { $lines } línea leída (convertida desde formato DOS)
       *[other] { $lines } líneas leídas (convertidas desde formato DOS)
    } ]
nano-lines-written =
    {"["} { $lines ->
        [one] { $lines } línea escrita
       *[other] { $lines } líneas escritas
    } ]
nano-read-only = [ El fichero «{ $path }» no es de escritura ]
nano-error-read = [ Error leyendo «{ $path }»: Permiso denegado ]
nano-error-write = [ Error al escribir «{ $path }»: Permiso denegado ]
nano-error-directory = [ Error al escribir «{ $path }»: No existe el fichero o el directorio ]
nano-binary = [ { $path } es un fichero binario ]

## Interfaz del editor

nano-modified = Modificado
# Los atajos: ^O = Ctrl+O, ^X = Ctrl+X, ^C = Ctrl+C
nano-write = Guardar
nano-quit = Salir
nano-save = ¿Guardar el búfer modificado?
nano-yes = Sí
nano-yes-key = S
nano-not = No
nano-cancel = Cancelar
nano-zone = Contenido de { $path }
