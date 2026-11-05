### Histoire « Le Club photo », chapitre 1 « Le Dossier partagé » : un
### export NFS (/etc/exports, exportfs), le pare-feu, mount -t nfs et
### fstab. La configuration, les chemins et les sorties des outils ne sont
### pas traduits.

chapter-nfs-export = Le Dossier partagé
    .summary = Les photos du club sont sur le NAS. L'ordinateur du labo doit les voir comme un de ses propres dossiers, et les voir encore après un redémarrage.

## Fichiers

nfs-export-message-margot =
    De :     Margot
    À :      toi
    Objet :  Les photos sur l'ordinateur du labo

    Bonjour,

    Bienvenue sur les machines du club ! Le NAS (où tu es) garde toutes
    nos photos dans /srv/photos. Au labo, il y a un ordinateur (darkroom,
    tu l'atteins avec ssh darkroom depuis ici) où on retouche et on
    imprime.

    Aujourd'hui, on promène les photos sur des clés USB. J'aimerais que
    l'ordinateur du labo voie le dossier du NAS dans /mnt/photos, comme
    s'il était à lui, et qu'il y soit encore après un redémarrage.

    Seulement l'ordinateur du labo, s'il te plaît : le NAS est sur le
    réseau du club, où sont aussi les portables des visiteur·ses.

    Ton mot de passe sudo (sur les deux machines) : obturateur-2028.

    Margot

## Événements

nfs-export-event-exports =
    /etc/exports est la liste de ce que le NAS partage en NFS, et avec
    qui : une ligne par dossier, puis chaque client avec ses options
    entre parenthèses, sans espace avant (man exports) :
    /srv/photos 192.0.2.32(rw,sync,no_subtree_check). Sans rw, un export
    est en lecture seule.
nfs-export-event-not-loaded =
    La ligne est dans /etc/exports, mais le NAS sert toujours son ancienne
    liste : le serveur lit le fichier à son démarrage, ou quand on le lui
    demande (sudo exportfs -ra ; exportfs -v montre ce qu'il sert).
nfs-export-event-loaded =
    Le NAS sert maintenant /srv/photos à l'ordinateur du labo
    (exportfs -v). Côté client : ssh darkroom, puis mount (man mount,
    man nfs).
nfs-export-event-too-open =
    Attention : cet export est pour tout le monde (*), ou avec
    no_root_squash. Les portables des visiteur·ses pourraient le monter,
    et root sur un client serait root sur les photos. Exporte vers
    l'ordinateur du labo seulement, et garde root_squash (le défaut).
nfs-export-event-no-mount-point =
    Un montage a besoin d'un répertoire existant où s'accrocher : crée
    d'abord /mnt/photos (sudo mkdir).
nfs-export-event-firewall =
    Le montage attend, puis abandonne : rien ne répond. Le pare-feu du NAS
    ne laisse entrer que SSH, et NFS (port 2049) est jeté. Ouvre-le pour
    l'ordinateur du labo seulement (man ufw). showmount interroge aussi
    rpcbind (port 111) ; mount seul, en NFSv4, n'a besoin que du 2049.
nfs-export-event-denied =
    Le NAS répond, et refuse : sa liste d'exports ne contient pas ce
    client (ou encore l'ancienne). Vérifie ce qu'il sert : sudo exportfs -v
    sur le NAS, et l'adresse de l'ordinateur du labo.
nfs-export-event-mounted =
    /mnt/photos montre les photos du NAS (df -h, mount | grep nfs).
    Jusqu'au prochain redémarrage : pour qu'il revienne, le /etc/fstab de
    l'ordinateur du labo doit le décrire (man fstab ; _netdev attend le
    réseau).
nfs-export-event-read-only =
    C'est monté, mais en lecture seule : un export sans rw est en ro.
    Ajoute rw aux options de l'export sur le NAS, puis sudo exportfs -ra.
nfs-export-event-end =
    L'ordinateur du labo voit les photos dans /mnt/photos, et fstab les
    ramènera à chaque démarrage. Margot : « Fini les clés USB ! Sam
    imprime déjà depuis le NAS. »

    Bravo ! Tu as terminé le chapitre « Le Dossier partagé ».

    CE QUI S'EST PASSÉ
    Le NAS n'exportait rien (le /etc/exports de Debian n'est que des
    commentaires), et son pare-feu jetait NFS. Un export pour
    l'ordinateur du labo seulement, le pare-feu ouvert pour lui, un
    montage, et une ligne dans fstab.

    NFS EN BREF
    - Sur le serveur : /etc/exports (dossier, clients, options), puis
      exportfs -ra ; exportfs -v liste ce qui est servi.
    - Sur le client : mount -t nfs serveur:/dossier /point ; dans
      /etc/fstab : serveur:/dossier /point nfs defaults,_netdev 0 0.
    - NFSv4 n'a besoin que du port 2049 (TCP).

    BONNES PRATIQUES
    - Exporter vers des clients nommés ou un petit réseau, jamais vers *.
    - Garder root_squash : root sur un client devient nobody sur le
      serveur.
    - NFS en sec=sys croit le client sur qui est qui : seulement des
      machines que tu gères. Pour plus, Kerberos (sec=krb5).

    DOCUMENTATION
    - exports(5) : https://man7.org/linux/man-pages/man5/exports.5.html
    - nfs(5) : https://man7.org/linux/man-pages/man5/nfs.5.html
    - Debian : https://wiki.debian.org/NFSServerSetup
