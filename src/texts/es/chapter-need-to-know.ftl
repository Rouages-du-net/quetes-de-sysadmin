### Historia «El Albergue», capítulo «Necesidad de saber»: una aplicación
### que lee sus secretos con el token root; una política solo para ella, un
### token que la lleva, el token root revocado. Los comandos, las opciones,
### las rutas, los nombres de políticas y de tokens y la salida de OpenBao
### no se traducen.

chapter-need-to-know = Necesidad de saber
    .summary = El sitio de reservas lee sus contraseñas de la caja fuerte con el token root, el todopoderoso que se mostró en la instalación. Escribe una política que le deje leer sus propios secretos y nada más, dale un token propio y deshazte del token root.

## Archivos

need-to-know-message-desta =
    De: Desta
    Martes 9 de marzo, 10:15

    ¡Hola otra vez!

    Ruslan ha vuelto de su travesía y ha enviado sus notas de instalación
    (están en tu carpeta personal). Una línea me ha preocupado: «bunks.env:
    token root de momento, a sustituir». Reconoce que «de momento» significa
    «hasta que alguien se encargue».

    ¿Puedes ser ese alguien? Si lo entiendo bien, Bunks solo debería poder
    leer sus dos secretos: ni los datos bancarios de Hiroko, ni la wifi de
    los huéspedes, y sobre todo no debería cambiar nada. Y después, el token
    root debería desaparecer: Ruslan dice que nadie debería tener uno por
    ahí.

    Desta

need-to-know-notes-ruslan =
    Notas de Ruslan (candado, OpenBao, febrero de 2027)

    - OpenBao 2.7.3, del propio .deb de OpenBao (no está en el archivo de
      Debian). Configuración: /etc/openbao/openbao.hcl; datos en
      /opt/openbao/data; API en el puerto 8200 (TLS, el certificado
      autofirmado del paquete); registro de auditoría:
      /var/log/openbao/audit.log.
    - Inicializado el 14 de febrero: 5 fragmentos, umbral 3. El token root
      del init es el de /etc/bunks/bunks.env (¡provisional!).
    - Secretos: un motor KV versión 2 en secret/. Bunks: secret/bunks/db
      (username, password) y secret/bunks/payments (account, api_key).
      También secret/treasurer/bank (Hiroko) y secret/wifi/guests.
    - KV versión 2 guarda versiones: la CLI dice bao kv get secret/bunks/db,
      pero la API, y por tanto las políticas, ven secret/data/bunks/db (y
      los metadatos bajo secret/metadata/).
    - Cada admin tiene un token huérfano con la política admin (bao policy
      read admin), en ~/.vault-token. Huérfano: no depende del token root.
    - Bunks lee BAO_TOKEN de bunks.env al arrancar (sudo systemctl restart
      bunks para que lo vuelva a leer). Su salud:
      curl http://127.0.0.1:8080/health
    - man bao.

## Eventos

need-to-know-event-resealed =
    OpenBao se ha reiniciado, así que ha vuelto sellado. Desta, Hiroko y
    Nnamdi han pasado a escribir sus fragmentos: vuelve a estar desellado.
    Las políticas y los tokens surten efecto al momento; OpenBao nunca
    necesita un reinicio para ellos.
need-to-know-event-no-data =
    Esa política tiene una regla en secret/… sin data/: no coincide con
    ninguna petición de Bunks. Con KV versión 2, la ruta de API del secreto
    bunks/db es secret/data/bunks/db (y sus metadatos,
    secret/metadata/bunks/db). Los comandos bao kv ocultan ese prefijo; las
    políticas no.
need-to-know-event-too-wide =
    Esa política da más de lo que Bunks necesita. Compruébalo con bao token
    capabilities: Bunks debe leer secret/data/bunks/*, y nada más: ni
    create, ni update, ni delete, nada bajo treasurer o wifi, ni políticas,
    ni tokens.
need-to-know-event-policy =
    La política está guardada en OpenBao (bao policy list, bao policy read).
    Una política no hace nada por sí sola: se aplica a los tokens que la
    llevan.
need-to-know-event-from-root =
    Ese token se creó con el token root: es su hijo, y revocar un token
    revoca a todos sus hijos. Cuando el token root desaparezca, este se irá
    con él. Crea el token de Bunks con tu propio token admin, que es
    huérfano.
need-to-know-event-token =
    Un token que lleva la política. bao token lookup muestra sus políticas y
    su duración (creation_ttl, expire_time); bao token capabilities TOKEN
    RUTA muestra lo que puede hacer en una ruta.
need-to-know-event-denied =
    Bunks no ha podido arrancar: «permission denied» en su secreto
    (journalctl -u bunks). El token de bunks.env no tiene permiso para leer
    esa ruta: ¿qué políticas lleva, y qué dice bao token capabilities sobre
    secret/data/bunks/db?
need-to-know-event-switched =
    Bunks ha arrancado con su propio token: lee sus dos secretos, y nada
    más.
need-to-know-event-wide-app =
    Bunks funciona con un token que puede hacer más que leer sus dos
    secretos (bao token capabilities). Quien lo robe se lleva todo eso.
need-to-know-event-checked =
    La página de salud responde, con el token nuevo.
need-to-know-event-early-revoke =
    El token root está revocado, pero Bunks arrancó con él: guarda sus
    secretos en memoria y de momento no nota nada, pero su próximo arranque
    fallará. Dale ahora su propio token.
need-to-know-event-root-revoked =
    El token root está revocado: bao token lookup sobre él responde ahora
    «bad token». Si algún día hace falta otro, tres personas con fragmento
    pueden generarlo (bao operator generate-root), para revocarlo justo
    después.
need-to-know-event-end =
    Desta: «Ruslan ha leído tu política y ha dicho: necesidad de saber,
    como debe ser. Tacha el "de momento".»

    ¡Bien hecho! Has terminado el capítulo «Necesidad de saber».

    QUÉ HA PASADO
    Bunks arrancaba con el token root del init: ilimitado y sin caducidad.
    Escribiste una política solo para Bunks (read en secret/data/bunks/*: la
    API de KV versión 2 pone data/ en la ruta), la cargaste con bao policy
    write, creaste un token que la lleva (con tu token admin huérfano, así
    que tiene una duración y no depende de root), lo pusiste en bunks.env y
    reiniciaste Bunks; luego revocaste el token root. bao token capabilities
    demuestra lo que un token puede y no puede hacer.

    BUENA PRÁCTICA
    - Una política por aplicación, el mínimo privilegio: las rutas que lee,
      las capacidades que necesita (read), nada más; todo lo demás se
      deniega por defecto.
    - Los tokens caducan: una aplicación que funciona mucho tiempo renueva
      su token (renew-self) o recibe uno nuevo antes del final de su TTL.
    - Cuidado con la jerarquía: un token hijo muere con su padre; los
      servicios reciben tokens huérfanos (o un rol).
    - El token root: se genera cuando hace falta (bao operator
      generate-root), se revoca justo después, nunca se guarda en un archivo.
    - El archivo de token de una aplicación solo lo puede leer su cuenta
      (bunks.env es root:bunks, 0640).

    OTRA MANERA
    En lugar de un token en un archivo, una aplicación puede iniciar sesión
    por sí misma: AppRole (un identificador de rol y un identificador
    secreto entregados por separado), o una identidad de máquina
    (certificado TLS, JWT, Kubernetes); OpenBao Agent puede iniciar sesión y
    renovar por la aplicación, y escribir sus secretos en un archivo. Más
    piezas, menos secretos de larga duración.

    DOCUMENTACIÓN
    - Las políticas: https://openbao.org/docs/concepts/policies/
    - Los tokens: https://openbao.org/docs/concepts/tokens/
    - KV versión 2 y sus rutas: https://openbao.org/docs/secrets/kv/kv-v2/
    - bao token create: https://openbao.org/docs/commands/token/create/
    - AppRole: https://openbao.org/docs/auth/approle/
