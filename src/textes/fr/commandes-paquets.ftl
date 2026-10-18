### apt et nginx : remarques du jeu (les messages d'apt et de nginx, eux,
### restent en anglais, comme les vrais outils).

apt-usage =
    Usage: apt [options] command
    (Ici : apt update, apt install paquet, apt list --installed ; voir man apt)
apt-list = (Ici, apt list ne connaît que --installed : apt list --installed.)
nginx-sans-option = (Ici, nginx ne se lance pas à la main : systemd s'en occupe. Utilise nginx -t pour vérifier la configuration, nginx -T pour l'afficher, nginx -v pour la version ; voir man nginx.)
