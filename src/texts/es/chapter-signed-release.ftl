### Historia «La Biblioteca de Herramientas», capítulo «Firmado y sellado»:
### commits y etiquetas firmados con SSH, una forja que los exige, una
### versión cuyas sumas de comprobación están firmadas, y una comprobación
### como la haría quien la usa.
### Los comandos, las opciones, las rutas y las salidas no se traducen.

chapter-signed-release = Firmado y sellado
    .summary = Circula una versión falsa de Lendshed con una suma de comprobación que lo «prueba». Haz que cada paso de la próxima versión sea verificable, de los commits al tarball: firmado con las claves de los mantenedores, exigido por la forja, y comprobado como lo comprobará una biblioteca de herramientas al otro lado del mundo.

## Archivos

signed-release-message-aroha =
    De: Aroha (Wellington Tool Library)
    Domingo 24 de noviembre

    ¡Kia ora! Llevo Lendshed en nuestra biblioteca de herramientas. La
    semana pasada alguien publicó un «lendshed-2.3.1.tar.gz» en el foro de
    las bibliotecas de herramientas, con un archivo de sumas de
    comprobación al lado, diciendo que arregla los recordatorios. No hay
    ninguna 2.3.1 en su sitio. La suma coincidía con el archivo,
    claro, ya que venía con él.

    ¿Cómo puedo saber que una versión viene de ustedes? Comprobaría una
    firma encantada, si me dicen cómo. Instalaré la 2.4.0 en cuanto
    salga.

    Aroha

signed-release-note-wanjiru =
    De: Wanjiru
    Lunes 25 de noviembre, 9:30

    Aroha tiene razón, y después de octubre quiero que vayamos más lejos:
    cada commit de main firmado por un mantenedor, la forja rechazando
    los demás, la etiqueta de la versión firmada, y las sumas de
    comprobación de los tarballs firmadas también.

    Usemos claves SSH, ya las tenemos: la tuya es ~/.ssh/id_ed25519 (no
    la antigua de tu portátil anterior, esa nunca llegó a la forja).
    Nuestras claves públicas también están en la forja: las claves de cada
    cuenta están en https://forge.lendshed.example/NOMBRE.keys.

    El plan para la 2.4.0:
    - un archivo allowed_signers en la raíz del repositorio, con nuestras
      tres claves, para que cualquiera pueda comprobar nuestras firmas;
    - tus commits firmados (el cambio de versión en lendshed/__init__.py
      es lo único que falta);
    - main exigiendo commits firmados;
    - la etiqueta v2.4.0, firmada;
    - lendshed-2.4.0.tar.gz en /srv/www/downloads, hecho a partir de la
      etiqueta (prefijo lendshed-2.4.0/), con SHA256SUMS y su firma;
    - y comprobarlo todo como lo hará Aroha, antes de anunciarlo.

    Wanjiru

## Eventos

signed-release-event-signing =
    git firma ahora con SSH (gpg.format = ssh) y sabe con qué clave
    (user.signingKey): git commit -S firma un commit, commit.gpgsign =
    true los firma todos.
signed-release-event-old-key =
    Ese commit está firmado con la clave antigua de tu portátil anterior.
    Firma bien, pero nadie la conoce: no está en allowed_signers, y la
    forja no la tiene en tu cuenta. Una firma solo prueba algo con una
    clave en la que otros ya confían. Vuelve a firmar con
    ~/.ssh/id_ed25519 (git commit --amend -S --no-edit).
signed-release-event-signed-commit =
    Tu último commit lleva una firma hecha con tu clave. ¿Puede git
    comprobarla? Necesita saber de quién son las claves de confianza.
signed-release-event-no-allowed =
    Para comprobar una firma SSH, git lee un archivo allowed_signers: una
    línea por firmante, «principal clave», donde el principal es la
    dirección de quien escribió el commit. git config
    gpg.ssh.allowedSignersFile le dice dónde está el archivo.
signed-release-event-allowed =
    git conoce los firmantes autorizados, y tu clave entre ellos.
signed-release-event-verified =
    Good "git" signature para tu dirección: el commit lo firmó una clave
    que allowed_signers atribuye a su autor.
signed-release-event-require =
    main exige ahora commits firmados: Forgejo comprueba la firma de cada
    commit enviado con las claves de la cuenta cuya dirección lo firmó.
signed-release-event-unsigned-refused =
    La forja ha rechazado el push: un commit no está verificado, o sin
    firmar, o firmado por una clave que ninguna cuenta tiene con esa
    dirección. Firma los commits (git commit --amend -S --no-edit para el
    último) y vuelve a hacer push.
signed-release-event-not-in-repo =
    Tu commit firmado está en main, pero el repositorio todavía no tiene
    ningún archivo allowed_signers con tu clave: quienes lo clonen no
    pueden comprobar nuestras firmas. Añádelo en la raíz, haz commit y
    push.
signed-release-event-pushed =
    La cabeza de main está firmada, verificada por la forja, y el
    repositorio lleva allowed_signers: cualquiera puede comprobarlo con
    git verify-commit.
signed-release-event-lightweight =
    v2.4.0 es una etiqueta ligera: un simple nombre para un commit, sin
    autor de la etiqueta, sin mensaje, sin firma. git verify-tag no tiene
    nada que comprobar. Haz en su lugar una etiqueta anotada y firmada
    (git tag -s -f), y si la ligera se envió, envía la nueva con --force.
signed-release-event-tag =
    La etiqueta v2.4.0 está en la forja, anotada y firmada con tu clave,
    sobre main: git verify-tag v2.4.0 la comprueba.
signed-release-event-tarball =
    El tarball viene de la etiqueta (git archive): la misma etiqueta da
    siempre los mismos bytes, lo que permite a cualquiera reconstruirlo y
    comparar.
signed-release-event-sums =
    SHA256SUMS coincide con el tarball. Pero una suma de comprobación solo
    protege de una descarga dañada: quien sustituye el tarball sustituye
    la suma que está al lado, como hizo quien falsificó la 2.3.1.
signed-release-event-sum-only =
    sha256sum -c dice OK, pero eso ya lo tenía Aroha con la falsa 2.3.1.
    Sin una firma sobre SHA256SUMS, la suma no prueba nada sobre quién
    hizo el archivo. Fírmalo: ssh-keygen -Y sign -n file.
signed-release-event-sum-checked =
    La suma coincide, y el archivo de sumas está firmado: una
    comprobación más y la versión queda probada.
signed-release-event-sig =
    SHA256SUMS.sig: SHA256SUMS firmado con tu clave, en el espacio de
    nombres «file» (una firma hecha para git no puede hacerse pasar por la
    de un archivo, ni al revés).
signed-release-event-sig-checked =
    Good "file" signature: SHA256SUMS lo firmó tu clave, que
    allowed_signers atribuye a tu dirección.
signed-release-event-end =
    Wanjiru: «Firmado desde el primer commit hasta el último byte. He
    puesto los dos comandos en VERIFYING.md para Aroha y los demás».
    Aroha: «¡Comprobado! Las dos respuestas son buenas. Gracias».

    ¡Bien hecho! Has terminado el capítulo «Firmado y sellado».

    QUÉ HA PASADO
    Circulaba una versión falsa con una suma de comprobación, que no
    probaba nada ya que venía con el archivo. Configuraste git para firmar
    con tu clave SSH, publicaste las claves de los mantenedores en
    allowed_signers, firmaste tu commit, hiciste que la forja exigiera
    commits verificados en main, firmaste la etiqueta v2.4.0, construiste
    el tarball a partir de ella con git archive, escribiste y firmaste
    SHA256SUMS, y comprobaste la versión como lo haría quien la usa:
    sha256sum -c, luego ssh-keygen -Y verify con allowed_signers.

    BUENA PRÁCTICA
    - Una suma de comprobación detecta un archivo dañado; solo una firma
      dice quién lo hizo.
    - Firma commits y etiquetas con claves en las que otros ya confían
      (allowed_signers en el repositorio, claves en la forja); deja que la
      forja rechace el resto.
    - Una etiqueta anotada y firmada para cada versión; el tarball
      reconstruido a partir de ella.
    - Explica a quienes usan el programa cómo comprobar, en dos comandos.
    - SLSA y OpenSSF van más lejos: procedencia de las compilaciones,
      compilaciones reproducibles, revisión a cuatro ojos.

    DOCUMENTACIÓN
    - git, firmar tu trabajo: https://git-scm.com/book/en/v2/Git-Tools-Signing-Your-Work
    - git-config, gpg.format y gpg.ssh.allowedSignersFile: https://git-scm.com/docs/git-config
    - ssh-keygen -Y y ALLOWED SIGNERS: https://man.openbsd.org/ssh-keygen
    - Forgejo, ramas protegidas: https://forgejo.org/docs/latest/user/protection/
    - SLSA, amenazas a la cadena de suministro: https://slsa.dev/spec/v1.0/threats
