### Indices gradués des Voisins Windows (voir src/engine/hints.ts) : un
### message par étape, hint-<chapitre>-<événement>, avec .lead (une
### direction) et .solution (presque la réponse).

## Chapitre 1 — Caractères invisibles

hint-line-endings-bad-interpreter =
    .lead = Lancez le script comme cron le ferait, et lisez l'erreur de près (cd ~/ops).
    .solution = ./nightly-copy.sh : « /bin/bash^M: bad interpreter ». Le ^M est un caractère qu'on ne voit pas dans le fichier.
hint-line-endings-crlf =
    .lead = Regardez les octets du fichier, pas son texte (man file, man cat : -A, man od : -c).
    .solution = file nightly-copy.sh, ou cat -A nightly-copy.sh (^M$ en fin de ligne), ou od -c nightly-copy.sh | head (\r \n).
hint-line-endings-converted =
    .lead = Convertissez les fins de ligne de Windows en celles d'Unix (man dos2unix ; sed et tr savent aussi).
    .solution = dos2unix nightly-copy.sh, ou sed -i 's/\r$//' nightly-copy.sh, puis file nightly-copy.sh.
hint-line-endings-ran =
    .lead = Lancez le script converti.
    .solution = ./nightly-copy.sh, puis ls /srv/nightly.
hint-line-endings-committed =
    .lead = Dites à git que les fichiers .sh sont du texte en LF, dans un fichier qui vit dans le dépôt (man gitattributes), et validez-le avec le script.
    .solution = echo '*.sh text eol=lf' > .gitattributes, puis git add .gitattributes nightly-copy.sh et git commit -m "Scripts en LF".
hint-line-endings-end =
    .lead = Trois choses : le script en LF, une sauvegarde faite, le .gitattributes validé avec lui (git status, git log).
    .solution = git status doit être propre, et le dernier commit contenir .gitattributes et nightly-copy.sh.

## Chapitre 2 — Le partage d'à côté

hint-smb-mount-listed =
    .lead = Demandez à armoire quels partages elle propose, avec le compte des notes de Priya (man smbclient).
    .solution = smbclient -L //armoire -U compass-svc, puis le mot de passe de notes-de-priya.txt.
hint-smb-mount-helper =
    .lead = mount -t cifs a besoin d'un programme assistant, qui vient dans un paquet (man mount.cifs, man apt).
    .solution = sudo apt install cifs-utils.
hint-smb-mount-mounted =
    .lead = Montez //armoire/plans sur /mnt/plans avec le type cifs, sans SMB1 et sans le mot de passe sur la ligne de commande (man mount.cifs : credentials=).
    .solution = sudo nano /root/.smbcredentials (username=compass-svc et password=…), sudo chmod 600 /root/.smbcredentials, puis sudo mount -t cifs //armoire/plans /mnt/plans -o credentials=/root/.smbcredentials.
hint-smb-mount-writable =
    .lead = À qui sont les fichiers de /mnt/plans, et sous quel compte tourne Plotter ? Sur un partage Windows, les propriétaires sont des options du montage (man mount.cifs : uid=, gid=).
    .solution = sudo umount /mnt/plans, puis sudo mount -t cifs //armoire/plans /mnt/plans -o credentials=/root/.smbcredentials,uid=plotter,gid=plotter.
hint-smb-mount-credentials =
    .lead = Le fichier d'identifiants : à root, lisible par root seul, avec username= et password= (ls -l /root demande sudo).
    .solution = sudo chown root: /root/.smbcredentials et sudo chmod 600 /root/.smbcredentials.
hint-smb-mount-fstab =
    .lead = Une ligne dans /etc/fstab avec les mêmes options, plus celles qui empêchent le démarrage de dépendre d'armoire (man fstab, man mount.cifs).
    .solution = sudo nano /etc/fstab : //armoire/plans /mnt/plans cifs credentials=/root/.smbcredentials,uid=plotter,gid=plotter,_netdev,nofail 0 0
hint-smb-mount-end =
    .lead = Vérifiez tout : monté, inscriptible pour plotter, fichier d'identifiants en 600, ligne de fstab sans mot de passe, avec _netdev et nofail.
    .solution = sudo umount /mnt/plans, sudo mount -a, puis sudo -u plotter touch /mnt/plans/exports/essai.

## Chapitre 3 — De l'autre côté

hint-full-volume-full =
    .lead = Plotter dit « No space left on device » : à quel point le partage est-il plein, vu de compas (man df) ?
    .solution = df -h /mnt/plans.
hint-full-volume-outside =
    .lead = Comparez avec ce que le partage lui-même contient (man du).
    .solution = du -sh /mnt/plans : environ 60G, alors que le volume fait 500G et qu'il est plein.
hint-full-volume-powershell =
    .lead = Ce qui le remplit est hors du partage : allez voir sur armoire elle-même (le courriel d'Ifeoma : OpenSSH, intégré à Windows).
    .solution = ssh armoire.
hint-full-volume-volume =
    .lead = Dans PowerShell, quel volume est plein ? Get-Command liste les cmdlets ; Get-Help NOM est le manuel.
    .solution = Get-Volume, ou Get-PSDrive.
hint-full-volume-culprit =
    .lead = Descendez tout le volume et triez les fichiers par taille, les plus gros d'abord (Get-Help Get-ChildItem, Get-Help Sort-Object, Get-Help Select-Object).
    .solution = Get-ChildItem D:\ -Recurse -File | Sort-Object Length -Descending | Select-Object -First 5
hint-full-volume-end =
    .lead = Notez le volume et le fichier avec son chemin complet dans ~/rapport-armoire.txt (exit pour revenir sur compas).
    .solution = exit, puis nano ~/rapport-armoire.txt : D: (Data) plein, D:\Backup\plans-full-2029-11-03.zip depuis le 3 novembre, événement 2013 de srv.
