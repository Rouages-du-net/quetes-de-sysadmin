### apt und nginx: die Bemerkungen des Spiels (die eigenen Meldungen von apt
### und nginx bleiben auf Englisch, wie bei den echten Werkzeugen).

apt-usage =
    Usage: apt [options] command
    (Hier: apt update, apt install, apt remove, apt purge, apt autoremove, apt upgrade, apt list [--installed|--upgradable], apt search, apt show, apt policy; siehe man apt)
apt-get-usage =
    Usage: apt-get [options] command
    (Hier: apt-get update, install, remove, purge, autoremove, upgrade, dist-upgrade, clean; -y antwortet mit Ja, -qq bleibt still; siehe man apt-get)
apt-cache-usage =
    Usage: apt-cache [options] command
    (Hier: apt-cache policy, show, search, depends, pkgnames; siehe man apt-cache)
nginx-without-option = (Hier wird nginx nicht von Hand gestartet: Darum kümmert sich systemd. Nutze nginx -t, um die Konfiguration zu prüfen, nginx -T, um sie auszugeben, nginx -v für die Version; siehe man nginx.)

## certbot und openssl

certbot-usage =
    usage:
      certbot [SUBCOMMAND] [options] [-d DOMAIN] [-d DOMAIN] ...
    (Hier: certbot certificates, certbot renew [--dry-run], certbot certonly --webroot -w verzeichnis -d name, certbot reconfigure; siehe man certbot)
certbot-none-certificate = (Hier verwaltet certbot nur das Zertifikat, das auf dieser Maschine schon beantragt wurde, und es gibt keins.)
certbot-authenticator = (certbot würde dich hier fragen, wie du beweisen willst, dass du die Site kontrollierst. Sag es ihm: --webroot -w verzeichnis_der_site, oder --nginx; siehe man certbot.)
certbot-webroot-without-path = (Mit --webroot musst du certbot sagen, in welches Verzeichnis die Challenge soll: -w verzeichnis_der_site.)
certbot-without-domain = (Gib die Namen des Zertifikats mit -d an, ein -d pro Name.)
certbot-other-domains = (Hier verwaltet certbot nur das bestehende Zertifikat, für die Namen: { $names }. Gib genau diese Namen noch einmal mit -d an.)
openssl-usage =
    help:
    (Hier: openssl x509 -in datei -noout -text, openssl req, openssl verify, openssl s_client -connect maschine:443, openssl ca; siehe man openssl)
openssl-no-passphrase = (In diesem Spiel tragen private Schlüssel keine Passphrase: Füge -noenc (oder -nodes) hinzu und schütze den Schlüssel mit seinen Rechten, chmod 600, nur für seinen Besitzer lesbar.)
dpkg-usage =
    dpkg: error: need an action option

    Type dpkg --help for help about installing and deinstalling packages [*];
    Use 'apt' or 'aptitude' for user-friendly package management;
    Type dpkg -Dhelp for a list of dpkg debug flag values;
    Type dpkg --force-help for a list of forcing options;
    Type dpkg-deb --help for help about manipulating *.deb files;

    Options marked [*] produce a lot of output - pipe it through 'less' or 'more' !
