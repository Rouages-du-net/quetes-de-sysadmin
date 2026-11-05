### Les indices gradués de l'histoire « Le Club photo » : une piste, puis
### presque la réponse, pour chaque étape (voir src/engine/hints.ts).

## Chapitre 1 — Le Dossier partagé

hint-nfs-export-exports =
    .lead = Que partage le NAS en NFS, et avec qui ? (/etc/exports, man exports)
    .solution = Dans /etc/exports : /srv/photos  192.0.2.32(rw,sync,no_subtree_check)
hint-nfs-export-loaded =
    .lead = Le fichier est lu au démarrage du serveur, ou sur demande (man exportfs : -r, -a, -v).
    .solution = sudo exportfs -ra, puis sudo exportfs -v.
hint-nfs-export-firewall =
    .lead = NFS passe-t-il le pare-feu du NAS ? (man ufw ; NFSv4 : port 2049)
    .solution = sudo ufw allow from 192.0.2.32 to any port 2049 proto tcp
hint-nfs-export-mounted =
    .lead = Sur l'ordinateur du labo (ssh darkroom) : un point de montage, puis mount (man mount, man nfs).
    .solution = sudo mkdir /mnt/photos, puis sudo mount -t nfs nas.internal:/srv/photos /mnt/photos
hint-nfs-export-end =
    .lead = Pour qu'il revienne après un redémarrage : le /etc/fstab de l'ordinateur du labo (man fstab).
    .solution = nas.internal:/srv/photos  /mnt/photos  nfs  defaults,_netdev  0  0 (sudo mount -a pour vérifier)

## Chapitre 2 — À qui sont ces fichiers ?

hint-nfs-owners-numbers =
    .lead = Qui est qui, en numéros, sur chaque machine ? (man id, man ls : -n)
    .solution = id sam sur le NAS (1002) et sur l'ordinateur du labo (1001) ; 1001, c'est nora sur le NAS.
hint-nfs-owners-squash =
    .lead = Pourquoi sudo n'aide-t-il pas sur l'ordinateur du labo ? (man exports : root_squash)
    .solution = root devient nobody sur le NAS : c'est root_squash, garde-le.
hint-nfs-owners-uid =
    .lead = Donne à Sam le numéro du NAS sur l'ordinateur du labo (man usermod : -u) ; sa session doit d'abord être fermée.
    .solution = Sur darkroom : sudo pkill -u sam, puis sudo usermod -u 1002 sam.
hint-nfs-owners-end =
    .lead = Les scans copiés avant portent encore le numéro de Nora sur le NAS (man chown : -R).
    .solution = Sur le NAS : sudo chown -R sam:club /srv/photos/2028-film-scans

## Chapitre 3 — Les Portables

hint-samba-share-share =
    .lead = Un partage est une section de smb.conf (man smb.conf : path, read only, valid users).
    .solution = Dans /etc/samba/smb.conf : [photos], path = /srv/photos, read only = no, valid users = @club ; puis sudo testparm -s.
hint-samba-share-passwords =
    .lead = Samba a ses propres mots de passe (man smbpasswd : -a).
    .solution = sudo smbpasswd -a sam (negatif-2028), sudo smbpasswd -a nora (diapo-2028).
hint-samba-share-masks =
    .lead = Avec quels droits Samba crée-t-il les fichiers ? (man smb.conf : create mask, directory mask, force group)
    .solution = create mask = 0664, directory mask = 2775, force group = club dans [photos].
hint-samba-share-end =
    .lead = Et les portables sur le Wi-Fi : SMB passe-t-il le pare-feu ? (man ufw ; port 445, application Samba)
    .solution = sudo ufw allow from 192.0.2.0/24 to any app Samba
