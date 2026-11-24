### Historia «La Colmena», capítulo «El directorio»: las cuentas del equipo
### en OpenLDAP. Los comandos, los atributos LDAP, los DN y las rutas no se
### traducen.

chapter-directory = El directorio
    .summary = Las cuentas del equipo están en un directorio LDAP: quitar a alguien que se ha ido (de verdad), añadir a Sami con un LDIF, una contraseña con hash y el grupo correcto.

## Archivos

# { $admin }: el DN del administrador del directorio; { $password }: su contraseña
directory-email-malik =
    De:      Malik
    Para:    tú
    Asunto:  El directorio, antes del wifi

    Siguiente paso: un wifi de verdad para las oficinas, donde cada persona
    se conecte con su propia cuenta. Se apoyará en el directorio LDAP que
    Sacha montó en el router (slapd). Pero ya no está al día:

    - Camille se fue en diciembre, y su cuenta sigue ahí;
    - Sami, del Anexo, no tiene cuenta. Necesita el mismo tipo de entrada
      que los demás (Sami Lemaire, uid sami), y tiene que estar en el
      grupo «oficinas», como nosotros.

    Sacha guardó el archivo que sirvió para Inès: plantilla-ines.ldif.

    Para leer el directorio: ldapsearch -x (la base ya está en
    /etc/ldap/ldap.conf). Para escribir, hay que autenticarse:
    { $admin }, contraseña { $password }; o, como root en esta máquina,
    sudo … -Y EXTERNAL -H ldapi:/// (sin contraseña).
    Todo está en man ldapsearch, man ldapadd, man ldapmodify.

    Para sudo: abeja-2027

## Eventos

directory-event-clear =
    Cuidado: hay una contraseña guardada EN CLARO en el directorio
    (userPassword sin {"{"}SSHA{"}"} delante). Cualquiera que lea el
    directorio con los permisos adecuados, o una copia, puede verla.
    slappasswd calcula un hash para poner en su lugar; ldappasswd cambia
    la contraseña y guarda él mismo el hash.
directory-event-uid-double =
    Cuidado: dos cuentas tienen el mismo uidNumber. Para Linux, sería la
    misma persona: mismos archivos, mismos permisos. Cada cuenta tiene su
    propio número (un ldapsearch sobre uidNumber muestra los ocupados).
directory-event-camille-rest =
    La entrada de Camille ha desaparecido… pero no su nombre en los grupos
    (memberUid: camille). Un posixGroup solo contiene nombres: nada lo
    actualiza cuando se borra una entrada, y una futura cuenta «camille»
    heredaría sus permisos. Hay que quitarla de ahí (ldapmodify, delete:
    memberUid).
directory-event-sami-only =
    Sami tiene su cuenta, pero no está en el grupo «oficinas»: el wifi de
    las oficinas no le dejará entrar. Un posixGroup enumera sus miembros
    en memberUid.
directory-event-stopped =
    slapd ya no funciona: nadie puede conectarse con su cuenta del
    directorio. Vuelve a ponerlo en marcha.
directory-event-end =
    Camille ya no tiene cuenta en ningún sitio, Sami tiene la suya, con
    una contraseña con hash, y está en el grupo oficinas. Malik: «¡Estamos
    listos para el wifi!»

    ¡Bien hecho! Has terminado el capítulo «El directorio».

    QUÉ HA PASADO
    Un directorio LDAP guarda entradas en un árbol: cada una tiene un
    nombre único (su DN, uid=sami,ou=people,dc=thehive,dc=example), clases
    (inetOrgPerson para una persona, posixAccount para una cuenta Linux)
    que exigen ciertos atributos, y valores. Se consulta con ldapsearch y
    un filtro; se modifica con archivos LDIF (ldapadd, ldapmodify) o con
    ldapdelete. Los grupos posixGroup solo contienen nombres: borrar una
    entrada no los actualiza.

    BUENA PRÁCTICA
    - Alguien se va: borra la cuenta Y quítala de todos los grupos
      (ldapsearch "(memberUid=camille)" para encontrarlos).
    - Nunca una contraseña en claro: {"{"}SSHA{"}"} (slappasswd), o
      ldappasswd; y la contraseña elegida por la propia persona.
    - Un uidNumber único por cuenta; y copias regulares
      (sudo slapcat > copia.ldif).

    OTRA MANERA
    FreeIPA (LDAP, Kerberos, certificados y reglas sudo en un solo sitio),
    o Samba como controlador de dominio Active Directory cuando hay
    máquinas Windows. Para el inicio de sesión único en aplicaciones web
    (OIDC, SAML), Keycloak se conecta al directorio. OpenLDAP solo:
    ligero y estándar, pero lo escribes todo tú.

    DOCUMENTACIÓN
    - OpenLDAP (herramientas, LDIF): https://www.openldap.org/doc/admin26/dbtools.html
    - ldapmodify: https://manpages.debian.org/trixie/ldap-utils/ldapmodify.1.en.html
    - OpenLDAP en Debian: https://wiki.debian.org/LDAP/OpenLDAPSetup

# La organización en lo alto del directorio (atributo o).
directory-organisation = La Colmena
