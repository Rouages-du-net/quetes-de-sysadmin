### Las pistas graduadas de la historia «El Club de Fotografía»: una
### dirección, y luego casi la respuesta, para cada paso (ver
### src/engine/hints.ts).

## Capítulo 1 — La carpeta compartida

hint-nfs-export-exports =
    .lead = ¿Qué comparte el NAS por NFS, y con quién? (/etc/exports, man exports)
    .solution = En /etc/exports: /srv/photos  192.0.2.32(rw,sync,no_subtree_check)
hint-nfs-export-loaded =
    .lead = El archivo se lee cuando arranca el servidor, o cuando se le pide (man exportfs: -r, -a, -v).
    .solution = sudo exportfs -ra, y luego sudo exportfs -v.
hint-nfs-export-firewall =
    .lead = ¿Pasa NFS por el cortafuegos del NAS? (man ufw; NFSv4: puerto 2049)
    .solution = sudo ufw allow from 192.0.2.32 to any port 2049 proto tcp
hint-nfs-export-mounted =
    .lead = En el ordenador del laboratorio (ssh darkroom): un punto de montaje, y luego mount (man mount, man nfs).
    .solution = sudo mkdir /mnt/photos, y luego sudo mount -t nfs nas.internal:/srv/photos /mnt/photos
hint-nfs-export-end =
    .lead = Para que vuelva tras un reinicio: el /etc/fstab del ordenador del laboratorio (man fstab).
    .solution = nas.internal:/srv/photos  /mnt/photos  nfs  defaults,_netdev  0  0 (sudo mount -a para comprobar)

## Capítulo 2 — ¿De quién son estos archivos?

hint-nfs-owners-numbers =
    .lead = ¿Quién es quién, en números, en cada máquina? (man id, man ls: -n)
    .solution = id sam en el NAS (1002) y en el ordenador del laboratorio (1001); el 1001 es nora en el NAS.
hint-nfs-owners-squash =
    .lead = ¿Por qué no ayuda sudo en el ordenador del laboratorio? (man exports: root_squash)
    .solution = root se convierte en nobody en el NAS: es root_squash, consérvalo.
hint-nfs-owners-uid =
    .lead = Dale a Sam el número del NAS en el ordenador del laboratorio (man usermod: -u); antes hay que cerrar su sesión.
    .solution = En darkroom: sudo pkill -u sam, y luego sudo usermod -u 1002 sam.
hint-nfs-owners-end =
    .lead = Los escaneos copiados antes siguen llevando el número de Nora en el NAS (man chown: -R).
    .solution = En el NAS: sudo chown -R sam:club /srv/photos/2028-film-scans

## Capítulo 3 — Los portátiles

hint-samba-share-share =
    .lead = Un recurso compartido es una sección de smb.conf (man smb.conf: path, read only, valid users).
    .solution = En /etc/samba/smb.conf: [photos], path = /srv/photos, read only = no, valid users = @club; y luego sudo testparm -s.
hint-samba-share-passwords =
    .lead = Samba tiene sus propias contraseñas (man smbpasswd: -a).
    .solution = sudo smbpasswd -a sam (negativo-2028), sudo smbpasswd -a nora (diapositiva-2028).
hint-samba-share-masks =
    .lead = ¿Con qué permisos crea Samba los archivos? (man smb.conf: create mask, directory mask, force group)
    .solution = create mask = 0664, directory mask = 2775, force group = club en [photos].
hint-samba-share-end =
    .lead = ¿Y los portátiles de la wifi: pasa SMB por el cortafuegos? (man ufw; puerto 445, aplicación Samba)
    .solution = sudo ufw allow from 192.0.2.0/24 to any app Samba
