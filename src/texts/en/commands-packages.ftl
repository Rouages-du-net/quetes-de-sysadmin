### apt and nginx: the game's remarks (apt's and nginx's own messages
### stay in English, like the real tools).

apt-usage =
    Usage: apt [options] command
    (Here: apt update, apt install package, apt list --installed; see man apt)
apt-list = (Here, apt list only knows --installed: apt list --installed.)
nginx-without-option = (Here, nginx is not started by hand: systemd takes care of it. Use nginx -t to check the configuration, nginx -T to print it, nginx -v for the version; see man nginx.)

## certbot and openssl

certbot-usage =
    usage:
      certbot [SUBCOMMAND] [options] [-d DOMAIN] [-d DOMAIN] ...
    (Here: certbot certificates, certbot renew [--dry-run], certbot certonly --webroot -w directory -d name, certbot reconfigure; see man certbot)
certbot-none-certificate = (Here, certbot only manages the certificate already requested on this machine, and there is none.)
certbot-authenticator = (certbot would ask you here how to prove that you control the site. Tell it: --webroot -w site_directory, or --nginx; see man certbot.)
certbot-webroot-without-path = (With --webroot, you must tell certbot which directory to put the challenge in: -w site_directory.)
certbot-without-domain = (Give the certificate's names with -d, one -d per name.)
certbot-other-domains = (Here, certbot only manages the existing certificate, for the names: { $noms }. Give exactly these names again with -d.)
openssl-usage =
    help:
    (Here: openssl x509 -in file -noout -dates, openssl s_client -connect machine:443; see man openssl)
dpkg-usage =
    dpkg: error: need an action option

    Type dpkg --help for help about installing and deinstalling packages [*];
    Use 'apt' or 'aptitude' for user-friendly package management;
    Type dpkg -Dhelp for a list of dpkg debug flag values;
    Type dpkg --force-help for a list of forcing options;
    Type dpkg-deb --help for help about manipulating *.deb files;

    Options marked [*] produce a lot of output - pipe it through 'less' or 'more' !
