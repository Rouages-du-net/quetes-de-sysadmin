### apt y nginx: los comentarios del juego (los mensajes propios de apt y
### de nginx se quedan en inglés, como en las herramientas reales).

apt-usage =
    Usage: apt [options] command
    (Aquí: apt update, apt install, apt remove, apt purge, apt autoremove, apt upgrade, apt list [--installed|--upgradable], apt search, apt show, apt policy; mira man apt)
apt-get-usage =
    Usage: apt-get [options] command
    (Aquí: apt-get update, install, remove, purge, autoremove, upgrade, dist-upgrade, clean; -y responde que sí, -qq se calla; mira man apt-get)
apt-cache-usage =
    Usage: apt-cache [options] command
    (Aquí: apt-cache policy, show, search, depends, pkgnames; mira man apt-cache)
nginx-without-option = (Aquí nginx no se arranca a mano: se encarga systemd. Usa nginx -t para comprobar la configuración, nginx -T para mostrarla, nginx -v para la versión; mira man nginx.)

## certbot y openssl

certbot-usage =
    usage:
      certbot [SUBCOMMAND] [options] [-d DOMAIN] [-d DOMAIN] ...
    (Aquí: certbot certificates, certbot renew [--dry-run], certbot certonly --webroot -w carpeta -d nombre, certbot reconfigure; mira man certbot)
certbot-none-certificate = (Aquí certbot solo gestiona el certificado ya pedido en esta máquina, y no hay ninguno.)
certbot-authenticator = (Aquí certbot te preguntaría cómo demostrar que controlas el sitio. Díselo: --webroot -w carpeta_del_sitio, o --nginx; mira man certbot.)
certbot-webroot-without-path = (Con --webroot, tienes que decirle a certbot en qué carpeta poner el desafío: -w carpeta_del_sitio.)
certbot-without-domain = (Da los nombres del certificado con -d, un -d por nombre.)
certbot-other-domains = (Aquí certbot solo gestiona el certificado existente, para los nombres: { $names }. Vuelve a dar exactamente esos nombres con -d.)
openssl-usage =
    help:
    (Aquí: openssl x509 -in archivo -noout -text, openssl req, openssl verify, openssl s_client -connect máquina:443, openssl ca; mira man openssl)
openssl-no-passphrase = (En este juego, las claves privadas no llevan frase de contraseña: añade -noenc (o -nodes) y protege la clave con sus permisos, chmod 600, legible solo por su propietario.)
dpkg-usage =
    dpkg: error: need an action option

    Type dpkg --help for help about installing and deinstalling packages [*];
    Use 'apt' or 'aptitude' for user-friendly package management;
    Type dpkg -Dhelp for a list of dpkg debug flag values;
    Type dpkg --force-help for a list of forcing options;
    Type dpkg-deb --help for help about manipulating *.deb files;

    Options marked [*] produce a lot of output - pipe it through 'less' or 'more' !
