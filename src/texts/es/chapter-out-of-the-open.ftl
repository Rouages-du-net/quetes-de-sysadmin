### Historia «El Sindicato de Inquilinos», capítulo «Fuera de la vista»:
### un archivo .env confirmado en claro, cifrado con sops y age, su
### contraseña cambiada, descifrado al desplegar. Los comandos, las
### opciones, las rutas, las claves, los nombres de variables y la salida
### de las herramientas no se traducen.

chapter-out-of-the-open = Fuera de la vista
    .summary = La aplicación de reparaciones del sindicato de inquilinos guarda la contraseña de su base de datos en un archivo .env, confirmado en claro, y el repositorio pasó tres días en una forja pública por error. Cífralo con sops y age para que pueda quedarse en git, haz que se descifre al desplegar, y ocúpate de la contraseña que ya salió.

## Compartido por los capítulos de la historia

tenants-union-readme =
    # Repairline

    Los inquilinos de Larkspur avisan de reparaciones (una fuga, la
    calefacción, la humedad), y el Sindicato de Inquilinos de Larkspur las
    sigue con el casero.

    - app.py: la aplicación (Flask), ejecutada por gunicorn, el servicio repairline.
    - .env: su configuración (la base de datos y el correo).
    - deploy.sh: pone la configuración en /etc/repairline/env y reinicia
      la aplicación. Ejecútalo como root en pestillo: sudo /srv/repairline/deploy.sh

    La clave age del propio servidor (su clave pública, para sops):
    { $key }

tenants-union-commit-1 = Repairline: los inquilinos avisan de reparaciones, el sindicato las sigue
tenants-union-commit-2 = Configuración del servidor, para que funcione deploy.sh
tenants-union-commit-3 = Fotos de los daños: un límite de 8 MB
tenants-union-commit-4 = Cifrar .env con sops y age, cambiar la contraseña de la base de datos
tenants-union-commit-5 = Añadir la clave age de Makoa
tenants-union-commit-6 = Configuración del relé de correo, cifrada

## Archivos

out-of-the-open-message-taslima =
    De: Taslima (secretaria del Sindicato de Inquilinos de Larkspur)
    Martes 8 de marzo, 19:05

    ¡Hola, y bienvenida o bienvenido al pequeño equipo técnico del sindicato!

    Primero, algo que da vergüenza. La semana pasada, Makoa montó un espejo
    del repositorio de Repairline en una forja pública, code.example, «para
    que otros sindicatos puedan reutilizarlo». Estuvo público tres días
    hasta que se dio cuenta y lo borró. El repositorio tiene un
    archivo .env con la contraseña de la base de datos dentro, en claro, desde
    enero. Cualquiera ha podido clonarlo.

    Makoa dice que la solución es sops y age: el .env se queda en git, pero
    cifrado, y solo las personas (y el servidor) que tienen una clave pueden
    leerlo. El servidor ya tiene su propia clave age, la de root, en
    /etc/repairline/ (su clave pública está en el README). Me gustaría que
    el .env estuviera cifrado para el servidor y para ti, y una regla para
    que el próximo archivo de secretos que añadamos (llega el relé de
    correo) se cifre igual. Y lo que haga falta con la contraseña que salió.

    El código está en /srv/repairline; el voluntariado lo clona desde
    /srv/git/repairline.git, así que haz push allí cuando termines. La
    aplicación tiene que seguir funcionando: los inquilinos la usan cada
    tarde.

    ¡Gracias!
    Taslima

## Eventos

out-of-the-open-event-history-seen =
    Ahí está: git guarda cada versión de cada archivo. La contraseña está
    en el historial desde el commit de Makoa del 26 de enero, y cada clon
    del repositorio tiene su propia copia de ese historial, los de quienes
    visitaron la forja incluidos. Cifrar el archivo a partir de ahora
    protege las próximas versiones, no las pasadas.
out-of-the-open-event-base64 =
    base64 es una codificación, no un cifrado: cualquiera la deshace con
    base64 -d, sin ninguna clave. Un secreto en base64 es un secreto en
    claro que pide un comando más para leerse.
out-of-the-open-event-gitignore =
    Un archivo .gitignore solo deja fuera de git los archivos sin
    seguimiento: .env ya tiene seguimiento, así que lo sigue teniendo, y git
    rm --cached solo lo quitaría de los próximos commits. La contraseña se
    queda en el historial de todos modos, y el despliegue, que lee .env del
    repositorio, perdería su configuración. Deja .env en git, pero cifrado.
out-of-the-open-event-key-made =
    Tienes tu propia clave age: la parte secreta se queda en
    ~/.config/sops/age/keys.txt (donde sops la busca, legible solo por
    ti), la parte pública (age1…) es la que das a los demás para que
    cifren para ti.
out-of-the-open-event-rule-written =
    El archivo .sops.yaml tiene una regla de creación: cada archivo cuya
    ruta coincide con path_regex se cifra para las claves listadas en age,
    sea quien sea quien ejecute sops. .env y el mail.env del relé de correo
    coincidirán los dos.
out-of-the-open-event-wrong-recipient =
    El archivo .env está cifrado, pero no para el servidor: su clave
    ({ $key }) no está entre los destinatarios, así que root en pestillo no
    puede descifrarlo al desplegar. sops solo puede descifrar con una clave
    para la que se cifró el archivo. Descífralo, o rehazlo con los
    destinatarios correctos.
out-of-the-open-event-not-yours =
    El archivo .env está cifrado para el servidor, pero no para ti: a
    partir de ahora, no podrías leerlo ni editarlo tú. Añade tu propia
    clave pública a los destinatarios.
out-of-the-open-event-encrypted =
    El archivo .env es ahora un archivo SOPS: los nombres de las variables
    siguen legibles (git diff sigue siendo útil), cada valor es un bloque
    ENC[AES256_GCM,…], y las líneas sops_ del final guardan la clave de
    datos, cifrada una vez para cada destinatario, y un MAC sobre todos los
    valores.
out-of-the-open-event-rotated =
    La base de datos tiene una contraseña nueva. La antigua ya no vale nada
    para quien copió el historial. Mientras la aplicación no tenga la
    nueva, fallará en su próximo reinicio: la contraseña tiene que llegar
    a .env y a la configuración desplegada.
out-of-the-open-event-ciphertext-deployed =
    /etc/repairline/env contiene los valores cifrados: deploy.sh
    copió .env tal cual, ENC[…] incluido, y la aplicación leería eso como su
    contraseña. El despliegue tiene que descifrar el archivo, con una clave
    que tenga el servidor.
out-of-the-open-event-root-without-key =
    sops se ejecutó como root y no encontró ninguna clave age: busca en
    ~/.config/sops/age/keys.txt de la cuenta que lo ejecuta, y el de root
    no tiene. La clave del servidor está en /etc/repairline/age.key: la
    variable SOPS_AGE_KEY_FILE le dice a sops dónde buscar (man sops).
out-of-the-open-event-app-down =
    Repairline no ha podido arrancar: no consigue conectarse a la base de
    datos (journalctl -u repairline dice por qué). La contraseña de
    /etc/repairline/env y la de la base de datos tienen que ser la misma.
out-of-the-open-event-env-readable =
    /etc/repairline/env, la configuración descifrada, la puede leer
    cualquier cuenta de pestillo. Solo root la necesita (systemd la lee
    antes de arrancar la aplicación): chmod 600.
out-of-the-open-event-deployed =
    El despliegue descifró .env con la clave del servidor y reinició la
    aplicación, que se conecta con la contraseña nueva.
out-of-the-open-event-clear-commit =
    La contraseña nueva está en un commit, en claro: ahora está en el
    historial, como la antigua. Elige otra, y no confirmes nunca .env hasta
    que esté cifrado.
out-of-the-open-event-committed-old =
    El .env cifrado está confirmado, pero sigue conteniendo la contraseña
    que se filtró: cifrarla no la vuelve secreta otra vez. Cámbiala en la
    base de datos, y luego en .env.
out-of-the-open-event-committed =
    El commit contiene el .env cifrado, .sops.yaml y el deploy.sh nuevo.
    git diff y git log siguen legibles: los nombres de las variables están
    en claro, solo los valores están cifrados.
out-of-the-open-event-pushed =
    origin también lo tiene: la próxima persona voluntaria que clone o haga
    pull recibe el archivo cifrado, y la regla que cifrará los siguientes.
out-of-the-open-event-end =
    Taslima: «La aplicación funciona, la contraseña que se filtró ya no
    sirve, y puedo leer el historial sin miedo. ¡Gracias!»

    ¡Bien hecho! Has terminado Fuera de la vista.

    LO QUE PASÓ
    La contraseña de la base de datos estaba en el repositorio, en claro,
    desde enero, y el repositorio fue público tres días. Creaste una clave
    age, escribiste .sops.yaml para que cada archivo .env se cifre para la
    clave del servidor y la tuya, y cifraste .env con sops. Como la
    contraseña antigua estaba en el historial, y en cada clon, la
    cambiaste en PostgreSQL y en el archivo cifrado. deploy.sh descifra
    ahora .env con la propia clave del servidor al desplegar, y solo root
    puede leer el resultado.

    BUENA PRÁCTICA
    - Un secreto que se confirmó en claro, aunque sea una vez, está
      comprometido: cámbialo. Reescribir el historial (git filter-repo)
      solo ayuda además, y no alcanza las copias ya hechas.
    - base64 no es un cifrado, y .gitignore no quita un archivo del
      seguimiento ni del historial.
    - Con sops, cada valor se cifra con una clave de datos, a su vez
      cifrada para cada destinatario (claves públicas age): .sops.yaml
      decide para quién, en cada archivo nuevo.
    - Cifra para las máquinas que despliegan además de para las personas
      que editan: la clave privada del servidor nunca sale de él, la tuya
      nunca sale de ti.
    - Descifra al desplegar, en un archivo que solo pueda leer quien lee
      para el servicio.

    OTRA FORMA DE HACERLO
    git-crypt cifra archivos enteros de forma transparente en git, y
    ansible-vault cifra archivos o valores para Ansible; un gestor de
    secretos (OpenBao, Vault) mantiene los secretos totalmente fuera de
    git, a cambio de un servicio que mantener. sops conserva la estructura
    legible y funciona con age, PGP y los servicios de claves de las nubes.

    DOCUMENTACIÓN
    - SOPS: https://getsops.io/docs/
    - Cifrar con age: https://getsops.io/docs/#encrypting-using-age
    - Las reglas de creación de .sops.yaml: https://getsops.io/docs/#using-sops-yaml-conf-to-select-kms-pgp-and-age-for-new-files
    - age: https://age-encryption.org/
    - gitignore: https://git-scm.com/docs/gitignore
