### Pistas graduadas de la historia «El Mapatón»: una dirección, y luego casi
### la respuesta, para cada paso (ver hints.ts).

## Capítulo 1 — El primer plan

hint-first-plan-initialised =
    .lead = El código vive en /srv/dns. Una copia nueva se inicializa una vez antes de que OpenTofu pueda usarla: así se instala el proveedor (man tofu, las notas de Yusra).
    .solution = cd /srv/dns; tofu init
hint-first-plan-formatted =
    .lead = El bloque de Andile está mal sangrado. OpenTofu tiene su propio formateador para todo el directorio.
    .solution = tofu fmt (lista los archivos que ha reescrito)
hint-first-plan-valid =
    .lead = Comprueba la configuración frente al esquema del proveedor antes de planificar; lee el archivo, la línea y la sugerencia de cada error.
    .solution = tofu validate, y luego nano records.tf: adresses → addresses; tofu validate otra vez
hint-first-plan-planned =
    .lead = El plan se para en una variable sin valor. ¿Dónde viven los valores de esta configuración? Luego, lee lo que haría OpenTofu.
    .solution = añade tiles_address = "192.0.2.180" a terraform.tfvars; tofu plan
hint-first-plan-applied =
    .lead = Aplica el plan, y responde a su pregunta solo después de leer la línea de resumen.
    .solution = tofu apply, y luego yes
hint-first-plan-checked =
    .lead = Pregunta al propio servidor DNS qué responde para el nombre nuevo (man dig).
    .solution = dig @127.0.0.1 tiles.wayfinders.example
hint-first-plan-end =
    .lead = Comprueba cada parte: el registro servido, gestionado en el estado, los archivos formateados, el valor guardado en un archivo.
    .solution = tofu plan (No changes), tofu fmt -check, dig tiles.wayfinders.example

## Capítulo 2 — Deriva

hint-drift-locked =
    .lead = Empieza donde se quedó Andile: pregunta a OpenTofu qué cambiaría, y lee por qué se niega.
    .solution = cd /srv/dns; tofu plan (lee Lock Info: quién, qué operación, desde cuándo)
hint-drift-freed =
    .lead = El bloqueo de un estado local pertenece al proceso que lo tomó. ¿Sigue en marcha ese proceso? (man ps, man kill)
    .solution = ps aux | grep tofu, y luego sudo kill 23817 (el tofu apply de Femi)
hint-drift-drift =
    .lead = Ahora planifica, y lee las dos partes: lo que cambió fuera de OpenTofu, y lo que haría aplicar el código.
    .solution = tofu plan (Objects have changed outside of OpenTofu: www)
hint-drift-code =
    .lead = ¿Qué lado es el verdadero, el código o el servidor? El mensaje de Andile lo dice. Haz que records.tf diga lo que es verdad, y vuelve a planificar.
    .solution = nano records.tf: addresses = ["198.51.100.41"] para www (ttl 60, o 300 con una sustitución); tofu plan; tofu apply
hint-drift-imported =
    .lead = status existe en named pero ni en el código ni en el estado. Descríbelo en records.tf, y luego adopta el registro existente (man tofu: import).
    .solution = un bloque resource "dns_a_record_set" "status" (zone, name = "status", addresses = ["198.51.100.42"], ttl = 300), y luego tofu import dns_a_record_set.status status.wayfinders.example.
hint-drift-end =
    .lead = El trabajo está hecho cuando OpenTofu no encuentra nada más que hacer.
    .solution = tofu plan: No changes. Your infrastructure matches the configuration.
