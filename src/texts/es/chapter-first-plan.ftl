### Historia «El Mapatón», capítulo «El primer plan»: un registro DNS
### añadido como código con OpenTofu (init, fmt, validate, una variable,
### plan, apply, dig). Los comandos, las opciones, las rutas, las
### direcciones de recursos, los nombres de registros y la salida de
### OpenTofu no se traducen.

chapter-first-plan = El primer plan
    .summary = El mapatón del sábado necesita un nombre para su servidor de teselas. El DNS del colectivo se mantiene como código con OpenTofu, y la coordinadora escribió el registro nuevo ella misma, con prisas. Lee la configuración, haz que funcione, planifica, aplica y comprueba lo que dice de verdad el servidor DNS.

## Archivos

first-plan-message-andile =
    De: Andile (coordinación de Wayfinders)
    Jueves 10 de junio, 18:30

    ¡Hola, y gracias por hacerte cargo del DNS!

    El sábado es nuestro mapatón en el centro cívico: cuarenta personas
    recorriendo el casco antiguo con el móvil, anotando cada bordillo,
    escalón y rampa. Malalai ha montado un servidor de teselas para el mapa
    de la tarde, en 192.0.2.180, y los móviles necesitan un nombre para él:
    tiles.wayfinders.example.

    Yusra me enseñó que la zona nunca se toca a mano: los registros viven
    como código en /srv/dns, y OpenTofu hace que el servidor DNS coincida con
    el código. Así que anoche añadí yo misma el registro en
    /srv/dns/records.tf, copiando el de www. Todavía no me he atrevido a
    ejecutar nada; nunca he usado el comando tofu en hito.

    Sus notas están en tu carpeta personal. ¿Puedes hacer que
    tiles.wayfinders.example funcione antes del sábado?

    Andile

first-plan-notes-yusra =
    Notas de Yusra (el DNS como código, 2031)

    - La zona wayfinders.example la sirve named en esta máquina. Es una
      zona dinámica: los cambios llegan como actualizaciones firmadas (RFC
      2136) con la clave tofu-key, y named las guarda en su diario. No
      edites /var/lib/bind/db.wayfinders.example: named lo ignoraría.
    - El código está en /srv/dns (grupo dnsadmins): versions.tf (OpenTofu
      y el proveedor dns), provider.tf, variables.tf, records.tf,
      outputs.tf. Los valores van en terraform.tfvars; el secreto de la
      clave en secrets.auto.tfvars, que nunca se sube al repositorio.
    - OpenTofu recuerda lo que gestiona en terraform.tfstate. No lo edites,
      no lo borres.
    - Una copia nueva del código se inicializa una vez (tofu init): instala
      el proveedor desde el espejo local (no hay internet en hito, ver
      ~/.tofurc) y escribe .terraform.lock.hcl, las versiones elegidas.
    - Después, cada vez: tofu fmt, tofu validate, tofu plan, leer el plan,
      tofu apply. Y comprobar con dig.
    - man tofu.

## Eventos

first-plan-event-not-initialised =
    Esta copia del código nunca se ha inicializado en hito: no hay archivo
    de bloqueo (.terraform.lock.hcl), ni proveedor en la carpeta .terraform.
    OpenTofu necesita el proveedor dns para entender los recursos, y es tofu
    init quien lo instala.
first-plan-event-initialised =
    El directorio de trabajo está inicializado: el proveedor hashicorp/dns
    ha venido del espejo local, y .terraform.lock.hcl registra su versión y
    su suma de comprobación. Ese archivo va en el control de versiones,
    para que todo el mundo tenga el mismo proveedor; la carpeta .terraform/
    no (ver .gitignore).
first-plan-event-formatted =
    tofu fmt ha reescrito los archivos en el estilo estándar: dos espacios
    por nivel, los «=» de los argumentos vecinos alineados. Solo cambia la
    presentación; una errata sigue siendo una errata.
first-plan-event-invalid =
    tofu validate comprueba el código frente al esquema del proveedor sin
    tocar nada: en records.tf, al bloque tiles le falta «addresses» y tiene
    un argumento que el proveedor no conoce. OpenTofu hasta propone el
    nombre correcto.
first-plan-event-valid =
    La configuración es válida. Válida no quiere decir completa: una
    variable todavía espera su valor antes de que OpenTofu pueda planificar.
first-plan-event-no-value =
    La variable tiles_address está declarada en variables.tf, sin valor por
    defecto, y ningún archivo le da uno. -var le da uno para un solo
    comando; terraform.tfvars lo guarda para cualquiera que ejecute tofu
    aquí.
first-plan-event-planned =
    El plan se lee como un diff: + crea, ~ modifica en el sitio, - destruye,
    -/+ sustituye. Aquí: un conjunto de registros que añadir, nada más
    tocado. www y wiki se vuelven a leer, se comparan con el código y se
    dejan como están.
first-plan-event-zone-by-hand =
    El archivo de zona se ha editado a mano. named no vuelve a leer el
    archivo de una zona dinámica (rndc reload se niega): su verdad está en
    memoria y en el diario. Y OpenTofu tampoco se enteraría. Deja el archivo
    como estaba (Yusra lo mantiene intacto), y cambia el código en su
    lugar.
first-plan-event-state-gone =
    terraform.tfstate ha desaparecido. Sin él, OpenTofu olvida que gestiona
    www y wiki, y querría crearlos de nuevo. La versión anterior está en
    terraform.tfstate.backup: cópiala de vuelta antes que nada.
first-plan-event-applied =
    OpenTofu ha enviado la actualización a named y ha escrito el registro
    nuevo en su estado: ahora gestiona tiles, como www y wiki.
first-plan-event-cli-var =
    El registro está, pero el valor de tiles_address solo estaba en tu línea
    de comandos: el próximo tofu plan aquí, de Andile o de quien sea, se
    parará en «No value for required variable». Guárdalo en
    terraform.tfvars.
first-plan-event-checked =
    dig ha preguntado directamente a named: tiles.wayfinders.example
    responde 192.0.2.180. El código, el estado de OpenTofu y el servidor
    están de acuerdo.
first-plan-event-end =
    Andile: «Malalai ve las teselas en su móvil. ¡El sábado está salvado!»

    ¡Bien hecho! Has terminado el capítulo «El primer plan».

    QUÉ HA PASADO
    El registro estaba escrito como código, pero el código nunca se había
    ejecutado en hito: tofu init instaló el proveedor dns desde el espejo
    local y escribió el archivo de bloqueo. tofu fmt arregló la
    presentación, tofu validate cazó la errata (adresses), y la variable
    nueva recibió su valor en terraform.tfvars. tofu plan mostró un único
    añadido, tofu apply lo hizo tras tu «yes» (una actualización dinámica
    firmada con la clave TSIG), y dig confirmó lo que sirve named.

    BUENA PRÁCTICA
    - Todo cambio pasa por el código: el estado del servidor es su
      consecuencia, y el código guarda quién cambió qué (en git, junto con
      el archivo .terraform.lock.hcl).
    - init una vez por copia, y luego fmt, validate, plan, apply: lee la
      línea de resumen del plan antes de decir yes.
    - Los valores que todo el mundo necesita van en un archivo .tfvars; los
      secretos en un archivo que nunca se sube al repositorio (o en
      variables TF_VAR_).
    - No edites nunca a mano lo que gestiona OpenTofu, ni los registros ni
      terraform.tfstate.
    - Comprueba el resultado donde importa (dig @127.0.0.1 tiles.wayfinders.example).

    OTRA MANERA
    Terraform, del que OpenTofu es un fork desde 2023, lee los mismos
    archivos y funciona igual. Ansible (módulo nsupdate) o nsupdate a secas
    pueden hacer el mismo cambio, pero sin un plan que leer ni un estado con
    el que comparar la próxima vez.

    DOCUMENTACIÓN
    - tofu init: https://opentofu.org/docs/cli/commands/init/
    - tofu plan y apply: https://opentofu.org/docs/cli/commands/plan/
    - Las variables: https://opentofu.org/docs/language/values/variables/
    - El archivo de bloqueo de dependencias: https://opentofu.org/docs/language/files/dependency-lock/
    - El proveedor dns: https://search.opentofu.org/provider/hashicorp/dns/latest
