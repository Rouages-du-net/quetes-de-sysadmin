### Comandos de archivos (src/engine/commands/files.ts): mensajes de error
### tomados de coreutils, findutils, tar y bash en español (Translation
### Project). { $target }: la ruta escrita. Los errores comunes (no existe,
### Permiso denegado…) están en shell.ftl.

## ls

ls-access-missing = ls: no se puede acceder a '{ $target }': No existe el fichero o el directorio
ls-access-permission = ls: no se puede acceder a '{ $target }': Permiso denegado
ls-open-permission = ls: no se puede abrir el directorio '{ $target }': Permiso denegado

## cd

cd-not-one-directory = cd: { $target }: No es un directorio (es un objeto: prueba cat)
# cd - sin carpeta anterior (bash: «OLDPWD no está establecido»).
cd-old-missing = cd: OLDPWD no está establecido

## cat, mv, cp, rm, touch, mkdir

cat-usage = Uso: cat archivo
mv-usage = Uso: mv origen destino
mv-missing = mv: no se puede efectuar `stat' sobre '{ $target }': No existe el fichero o el directorio
# Simplificación del juego: los lugares no se mueven.
mv-place = mv: { $target } es un lugar; en este juego solo se mueven objetos
mv-permission = mv: no se puede mover '{ $target }': Permiso denegado
cp-usage = Uso: cp origen destino
cp-missing = cp: no se puede efectuar `stat' sobre '{ $target }': No existe el fichero o el directorio
cp-directory = cp: no se ha especificado -r; se omite el directorio '{ $target }'
cp-same-file = cp: '{ $source }' y '{ $destination }' son el mismo fichero
cp-read-permission = cp: no se puede abrir '{ $target }' para lectura: Permiso denegado
rm-usage = Uso: rm archivo
# ln (mensajes de coreutils)
ln-operand-missing =
    ln: falta un fichero como operando
    Pruebe 'ln --help' para más información.
ln-impossible-symbolic = ln: fallo al crear el enlace simbólico '{ $target }': { $reason }
ln-impossible-physical = ln: fallo al crear el enlace duro '{ $target }': { $reason }
ln-exists = El fichero ya existe
ln-permission = Permiso denegado
ln-missing = No existe el fichero o el directorio
ln-access-impossible = ln: fallo al acceder a '{ $target }': No existe el fichero o el directorio
ln-physical-directory = ln: { $target }: no se permiten enlaces fuertes para directorios
rm-missing = rm: no se puede borrar '{ $target }': No existe el fichero o el directorio
rm-directory = rm: no se puede borrar '{ $target }': Es un directorio (haría falta rm -r, y es peligroso: aquí no lo usamos)
rm-permission = rm: no se puede borrar '{ $target }': Permiso denegado
touch-usage = Uso: touch archivo
mkdir-usage = Uso: mkdir lugar
mkdir-exists = mkdir: no se puede crear el directorio '{ $target }': El fichero ya existe

## chmod

chmod-usage = Uso: chmod modo archivo (p. ej. chmod o-w recuerdos, chmod 755 recuerdos)
chmod-access-missing = chmod: no se puede acceder a '{ $target }': No existe el fichero o el directorio
chmod-access-permission = chmod: no se puede acceder a '{ $target }': Permiso denegado
chmod-not-allowed = chmod: cambiando los permisos de '{ $target }': Operación no permitida
# { $permissions }: lo que se escribió (p. ej. o-w)
chmod-mode-incorrect = chmod: modo inválido: '{ $permissions }' (mira man chmod)

## find

# { $predicate }: la opción desconocida escrita
find-predicate-unknown = find: predicado desconocido `{ $predicate }'
find-argument-missing = find: falta el argumento de `{ $predicate }'
# { $predicate }: -mtime, -maxdepth; { $value }: lo que se escribió
find-argument-numeric = find: argumento `{ $value }' inválido para la opción `{ $predicate }'
find-missing = find: '{ $target }': No existe el fichero o el directorio
find-permission = find: '{ $target }': Permiso denegado
find-remove-not-empty = find: no se puede borrar '{ $target }': El directorio no está vacío
find-remove-permission = find: no se puede borrar '{ $target }': Permiso denegado

## du, df

missing = du: no se puede acceder a '{ $target }': No existe el fichero o el directorio
# Cabeceras de las columnas de df (coreutils en español): los anchos deben
# quedar alineados con las columnas (18, 6, 7, 6 y 4 caracteres).
df-header = S.ficheros         Tamaño  Usados   Disp Uso% Montado en
df-header-inodes = S.ficheros         Nodos-i NUsados NLibres NUso% Montado en
# df -T: el título de la columna del tipo.
df-type = Tipo
depth = du: profundidad máxima inválida

## tar

tar-usage = Uso: tar -czf archivo.tar.gz lugar  |  tar -tzf archivo.tar.gz  |  tar -xzf archivo.tar.gz [-C lugar]
tar-archive-empty = tar: Rechazo cobarde a crear un archivo vacío
tar-open-impossible = tar: { $target }: No se puede efectuar open: No existe el fichero o el directorio
tar-not-one-archive = tar: { $target }: Esto no parece un archivo tar
# Un archivo cortado mientras se escribía (gzip, luego tar, como GNU tar).
tar-truncated =
    gzip: stdin: unexpected end of file
    tar: Fin de fichero inesperado en el archivo
    tar: Error is not recoverable: exiting now
tar-place-missing = tar: { $target }: No se puede efectuar chdir: No existe el fichero o el directorio
tar-option-missing = tar: Debe especificar una de las opciones `-Acdtrux', '--delete' o '--test-label'

## cp, mv, rm y rmdir: opciones (mensajes de coreutils)

target-not-directory = { $command }: el objetivo '{ $target }' no es un directorio
target-missing = { $command }: objetivo '{ $target }': No existe el fichero o el directorio
# -i: la pregunta (el código añade el espacio después); s (o sí) sustituye el fichero.
cp-overwrite = cp: ¿sobreescribir '{ $target }'? (s/n)
mv-overwrite = mv: ¿sobreescribir '{ $target }'? (s/n)
# mv -v
mv-renamed = renamed '{ $source }' -> '{ $destination }'
rm-ask = rm: ¿borrar el fichero regular '{ $target }'? (s/n)
rm-ask-empty = rm: ¿borrar el fichero regular vacío '{ $target }'? (s/n)
rm-ask-link = rm: ¿borrar el enlace simbólico '{ $target }'? (s/n)
rm-removed = '{ $target }' borrado
rm-removed-directory = directorio borrado: '{ $target }'
rmdir-usage =
    rmdir: falta un operando
    Pruebe 'rmdir --help' para más información.
rmdir-failed = rmdir: fallo al borrar '{ $target }': { $reason }
rmdir-missing = No existe el fichero o el directorio
rmdir-not-directory = No es un directorio
rmdir-not-empty = El directorio no está vacío
rmdir-permission = Permiso denegado
rmdir-removing = rmdir: removing directory, '{ $target }'
