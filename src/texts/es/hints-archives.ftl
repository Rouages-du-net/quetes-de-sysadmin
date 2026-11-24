### Pistas graduales de El Archivo (ver src/engine/hints.ts): un mensaje por
### paso, hint-<capítulo>-<evento>, con .lead (una pista, sin el comando
### exacto) y .solution (casi la respuesta). Los nombres de lugares, como en
### names.ftl.

## Capítulo 1 — El Archivo

hint-archives-cleanup =
    .lead = Los fondos no caben en la memoria de 64 MB. du muestra adónde va el espacio, y Rosa habla de archivos temporales (.tmp) que se pueden tirar: find puede localizarlos en todas las subcarpetas, y borrarlos.
    .solution = find fondos -name "*.tmp" para verlos, y luego find fondos -name "*.tmp" -delete (con el -name, o se va todo).
hint-archives-saved =
    .lead = La limpieza está hecha: ahora mete todos los fondos en UN archivo comprimido, escrito directamente en la memoria (/media/memoria). Mira man tar: -c crea, -z comprime, -f nombra el archivo.
    .solution = tar -czf /media/memoria/fondos.tar.gz fondos (luego tar -tzf /media/memoria/fondos.tar.gz para comprobarlo).

## Capítulo 2 — Las Versiones

hint-versions-restored =
    .lead = El diario de Marie se estropeó hace unas noches; las instantáneas más antiguas aún tienen la versión buena. restic find --long muestra cuándo cambió el archivo, snapshots da los ID, y dump (o restore) saca un archivo de una instantánea. Cada comando necesita -r y --password-file (notes_restic.txt).
    .solution = restic -r /mnt/ayuntamiento/restic-biblioteca --password-file ~/.config/restic/contrasena snapshots, luego, con las mismas opciones y el ID de una instantánea del 1 de febrero o anterior: restic … dump ID /home/tu/fondos/manuscritos/diario_de_marie.txt > ~/fondos/manuscritos/diario_de_marie.txt
hint-versions-place =
    .lead = Treinta instantáneas llenan el disco del ayuntamiento. forget quita instantáneas según una política (--keep-daily, --keep-weekly…), pero solo prune libera el espacio. Conserva al menos una instantánea con la versión buena, y prueba primero --dry-run.
    .solution = restic (con -r y --password-file) forget --keep-daily 7 --keep-weekly 4 --keep-monthly 12 --prune (luego df -h /mnt/ayuntamiento para ver el espacio liberado).
hint-versions-end =
    .lead = Dos cosas más: el archivo de la contraseña lo puede leer cualquier cuenta (ls -l), y después de un prune se comprueba que el repositorio está intacto (man restic).
    .solution = chmod 600 ~/.config/restic/contrasena, luego restic (con -r y --password-file) check (debería decir «no errors were found»).
