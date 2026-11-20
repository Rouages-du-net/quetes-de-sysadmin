### apt et nginx : remarques du jeu (les messages d'apt et de nginx, eux,
### restent en anglais, comme les vrais outils).

apt-usage =
    Usage: apt [options] command
    (Ici : apt update, apt install, apt remove, apt purge, apt autoremove, apt upgrade, apt list [--installed|--upgradable], apt search, apt show, apt policy ; voir man apt)
apt-get-usage =
    Usage: apt-get [options] command
    (Ici : apt-get update, install, remove, purge, autoremove, upgrade, dist-upgrade, clean ; -y répond oui, -qq se tait ; voir man apt-get)
apt-cache-usage =
    Usage: apt-cache [options] command
    (Ici : apt-cache policy, show, search, depends, pkgnames ; voir man apt-cache)
nginx-without-option = (Ici, nginx ne se lance pas à la main : systemd s'en occupe. Utilise nginx -t pour vérifier la configuration, nginx -T pour l'afficher, nginx -v pour la version ; voir man nginx.)

## certbot et openssl

certbot-usage =
    usage:
      certbot [SUBCOMMAND] [options] [-d DOMAIN] [-d DOMAIN] ...
    (Ici : certbot certificates, certbot renew [--dry-run], certbot certonly --webroot -w dossier -d nom, certbot reconfigure ; voir man certbot)
certbot-none-certificate = (Ici, certbot ne gère que le certificat déjà demandé sur cette machine, et il n'y en a pas.)
certbot-authenticator = (certbot demanderait ici comment prouver que tu tiens le site. Donne-le-lui : --webroot -w dossier_du_site, ou --nginx ; voir man certbot.)
certbot-webroot-without-path = (Avec --webroot, il faut dire à certbot dans quel dossier déposer le défi : -w dossier_du_site.)
certbot-without-domain = (Donne les noms du certificat avec -d, un -d par nom.)
certbot-other-domains = (Ici, certbot ne gère que le certificat existant, pour les noms : { $names }. Redonne exactement ces noms avec -d.)
openssl-usage =
    help:
    (Ici : openssl x509 -in fichier -noout -dates, openssl s_client -connect machine:443 ; voir man openssl)
dpkg-usage =
    dpkg: error: need an action option

    Type dpkg --help for help about installing and deinstalling packages [*];
    Use 'apt' or 'aptitude' for user-friendly package management;
    Type dpkg -Dhelp for a list of dpkg debug flag values;
    Type dpkg --force-help for a list of forcing options;
    Type dpkg-deb --help for help about manipulating *.deb files;

    Options marked [*] produce a lot of output - pipe it through 'less' or 'more' !
