### Lo que comparten los capítulos de «Las Ondas»: los archivos de la
### autoridad de certificación de la federación en mast (las notas de Kwame,
### la política) y las páginas de sus sitios. Los comandos, las opciones,
### las rutas y las salidas no se traducen.

airwaves-readme-ca-1 =
    La autoridad de certificación de la Federación Airwaves -- Kwame, febrero de 2028

    Nuestros nombres terminan en airwaves.internal: ninguna autoridad
    pública los certificará, así que tenemos la nuestra. Los PC de las
    emisoras confían en nuestra raíz porque instalé ca.crt en cada uno
    (Firefox y el sistema).

      ca.crt            el certificado de la raíz (Airwaves Root CA, 10 años)
      private/ca.key    la clave privada de la raíz: las joyas de la corona
      ca.srl            el último número de serie usado
      issued/           una copia de cada certificado firmado

    Cómo hice el certificado de la intranet (8 de febrero de 2028):

      openssl req -new -key /etc/nginx/ssl/intranet.key -subj /CN=intranet.airwaves.internal -out intranet.csr
      openssl x509 -req -in intranet.csr -CA ca.crt -CAkey private/ca.key -days 825 -out intranet.crt

    Luego cópialo en /etc/nginx/ssl/ y recarga nginx.
    Antes de firmar nada, lee POLICY.txt.
airwaves-readme-ca-2 =
    { airwaves-readme-ca-1 }

    Marzo de 2030 -- la CA emisora

    La raíz no debería firmar todos los certificados: su clave debería
    dormir fuera de línea. El 11 de marzo hice una autoridad intermedia,
    firmada por la raíz: issuing/ (Airwaves Issuing CA 1). Funciona con
    openssl ca y su propio openssl.cnf (base de datos index.txt, serial,
    newcerts/). A partir de ahora firma los certificados de los servidores
    y de los portátiles. La clave de la raíz sale de mast la semana que
    viene.
airwaves-readme-ca-3 =
    { airwaves-readme-ca-2 }

    Abril de 2030

    La clave de la raíz está en una memoria USB en la caja fuerte de
    Adaeze; la lista de revocación (CRL) de la raíz, escrita en la misma
    ceremonia, está en crl/root.crl (válida un año). Portátiles: un
    certificado de cliente cada uno, emitido por issuing/ (copias en
    issuing/certs/ e issuing/newcerts/).
airwaves-policy =
    Federación Airwaves -- política de certificados (versión 2, enero de 2030)

    1. Certificados de servidor
       - cada nombre que usa un cliente va en subjectAltName (DNS:...);
         los navegadores ignoran el Common Name
       - validez: un año (365 días), nunca más de 398
       - no es una CA (basicConstraints CA:FALSE)
       - clave: EC P-256 o RSA de al menos 2048 bits
    2. Las claves de la CA
       - solo las puede leer root (chmod 600), nunca se copian a otro sitio
       - solo se distribuyen los certificados, nunca las claves
    3. Revocación
       - una clave perdida o robada: revocar su certificado el mismo día,
         y publicar la lista de revocación
airwaves-site-intranet =
    <!DOCTYPE html>
    <html lang="es"><head><title>Intranet Airwaves</title></head>
    <body><h1>Federación Airwaves</h1><p>La parrilla de la semana, el turno de los presentadores, las sintonías compartidas.</p></body></html>
airwaves-site-archive =
    <!DOCTYPE html>
    <html lang="es"><head><title>Archivo Airwaves</title></head>
    <body><h1>Archivo de programas</h1><p>Todos los programas de las cinco emisoras desde 2019.</p></body></html>
airwaves-site-contrib =
    <!DOCTYPE html>
    <html lang="es"><head><title>Contribuciones Airwaves</title></head>
    <body><h1>Contribuciones</h1><p>Grabaciones desde el terreno: el programa de envío las manda aquí.</p></body></html>
