### Pistas graduales de El Lote Nocturno (ver src/engine/hints.ts): un
### mensaje por paso, hint-<capítulo>-<evento>, con .lead (una dirección) y
### .solution (casi la respuesta).

## Capítulo 1 — Ancho fijo

hint-copybook-records =
    .lead = El archivo no tiene líneas: cuenta sus bytes y compáralos con la longitud de registro que da el copybook (man wc; /opt/batch/copybooks/CONTRIB.cpy).
    .solution = wc -c /srv/drop/contrib.ebc: 560 bytes, es decir, 14 registros de 40 (LRECL=40).
hint-copybook-bytes =
    .lead = Mira los bytes en sí, en hexadecimal o como caracteres (man od, man xxd, man hexdump).
    .solution = xxd /srv/drop/contrib.ebc | head, u od -c, o hexdump -C: C8 F0 F0… es «H00…» en EBCDIC; los bytes 34 a 38 de cada registro son el importe empaquetado.
hint-copybook-converted =
    .lead = Una conversión de todo el archivo estropea los importes empaquetados. Las notas de Ramón (/opt/batch/NOTES.txt) nombran la herramienta que convierte campo a campo.
    .solution = /opt/batch/bin/ebc2asc /srv/drop/contrib.ebc /srv/batch/in/contrib.dat, luego cat /srv/batch/in/contrib.dat.
hint-copybook-end =
    .lead = Rellena comprobacion.txt: el tamaño, los registros lo que dice el registro final (la última línea del archivo convertido) y el primer importe tal como lo guarda el archivo original (bytes 34 a 38 del segundo registro, en od o xxd).
    .solution = nano comprobacion.txt: 560 bytes, 14 registros, 12 cuotas, total de control 515.20 (T000012…+000051520), primer importe 00 00 04 25 0C.

## Capítulo 2 — Código de retorno

hint-return-code-compiled =
    .lead = cobc necesita saber dónde están los copybooks, quiere un ejecutable en lugar de un módulo y lee la fuente por sus columnas (man cobc).
    .solution = Pon las líneas de Ayesha en las columnas (el código desde la columna 8: CHECK-TOTALS. tras 7 espacios, las sentencias tras 11), luego cd /opt/batch/src y cobc -x -I /opt/batch/copybooks contrib.cob.
hint-return-code-report =
    .lead = Ejecuta el programa que compilaste con sus dos argumentos: el archivo de entrada y luego el informe que debe escribir.
    .solution = ./contrib /srv/batch/in/contrib.dat /srv/batch/out/contrib.rpt, luego echo $? y cat /srv/batch/out/contrib.rpt.
hint-return-code-rc =
    .lead = Ahora el archivo de prueba de la gestoría, y su código de retorno.
    .solution = ./contrib /srv/batch/in/test-bad.dat /tmp/test.rpt, luego echo $? (8).
hint-return-code-end =
    .lead = Hacen falta las dos ejecuciones: el archivo de esta noche (0) y el archivo de prueba (8), con la comprobación de Ayesha compilada.
    .solution = ./contrib /srv/batch/in/contrib.dat /srv/batch/out/contrib.rpt y ./contrib /srv/batch/in/test-bad.dat /tmp/test.rpt.

## Capítulo 3 — El archivo que llega tarde

hint-late-file-diagnosed =
    .lead = ¿Qué procesó el lote anoche? Su salida está en el registro de su servicio (man journalctl).
    .solution = journalctl -u night-batch: dos ejecuciones con RUN DATE 291122; stat /srv/drop/contrib.ebc: el archivo nuevo llegó a las 02:39.
hint-late-file-first-night =
    .lead = El envoltorio solo debe empezar cuando contrib.ebc.done esté ahí, quitarlo una vez procesado el archivo, y arrancarse de nuevo durante la noche (man systemd.timer, man test).
    .solution = En run-night.sh: set -e, luego test -f /srv/drop/contrib.ebc.done || exit 0, luego rm /srv/drop/contrib.ebc.done antes de los dos programas; en el temporizador, OnCalendar=*-*-* 02..06:00/10, y luego sudo systemctl daemon-reload.
hint-late-file-second-night =
    .lead = Cuando el programa termina con 8, el envoltorio también debe terminar con él (no con el echo), o enviar un correo.
    .solution = set -e al principio de run-night.sh y quita el echo final: systemd marca night-batch como fallido; o /opt/batch/bin/contrib … || echo "contrib failed" | mail -s "night batch" tu.
hint-late-file-end =
    .lead = Las dos noches de un ensayo deben ir bien: el archivo que llega tarde procesado una vez, el incompleto detenido con alguien avisado.
    .solution = set -e; test -f /srv/drop/contrib.ebc.done || exit 0; rm /srv/drop/contrib.ebc.done; ebc2asc; contrib (sin echo); OnCalendar=*-*-* 02..06:00/10 y daemon-reload.
