### Pistas graduales de Windows al Lado (ver src/engine/hints.ts): un
### mensaje por paso, hint-<capítulo>-<evento>, con .lead (una dirección) y
### .solution (casi la respuesta).

## Capítulo 1 — Caracteres invisibles

hint-line-endings-bad-interpreter =
    .lead = Ejecuta el script como lo haría cron, y lee el error con atención (cd ~/ops).
    .solution = ./nightly-copy.sh: «/bin/bash^M: bad interpreter». El ^M es un carácter que no ves en el archivo.
hint-line-endings-crlf =
    .lead = Mira los bytes del archivo, no su texto (man file, man cat: -A, man od: -c).
    .solution = file nightly-copy.sh, o cat -A nightly-copy.sh (^M$ al final de cada línea), u od -c nightly-copy.sh | head (\r \n).
hint-line-endings-converted =
    .lead = Convierte los finales de línea de los de Windows a los de Unix (man dos2unix; sed y tr también pueden hacerlo).
    .solution = dos2unix nightly-copy.sh, o sed -i 's/\r$//' nightly-copy.sh, luego file nightly-copy.sh.
hint-line-endings-ran =
    .lead = Ejecuta el script convertido.
    .solution = ./nightly-copy.sh, luego ls /srv/nightly.
hint-line-endings-committed =
    .lead = Dile a git que los archivos .sh son texto con finales LF, en un archivo que vive en el repositorio (man gitattributes), y haz un commit con él y el script.
    .solution = echo '*.sh text eol=lf' > .gitattributes, luego git add .gitattributes nightly-copy.sh y git commit -m "Scripts en LF".
hint-line-endings-end =
    .lead = Tres cosas: el script en LF, una copia hecha, el .gitattributes en un commit con él (git status, git log).
    .solution = git status debe estar limpio, git show --stat el último commit con .gitattributes y nightly-copy.sh.

## Capítulo 2 — El recurso de al lado

hint-smb-mount-listed =
    .lead = Pregunta a armario qué recursos ofrece, con la cuenta de las notas de Priya (man smbclient).
    .solution = smbclient -L //armario -U compass-svc, luego la contraseña de notas-de-priya.txt.
hint-smb-mount-helper =
    .lead = mount -t cifs necesita un programa ayudante que viene en un paquete (man mount.cifs, man apt).
    .solution = sudo apt install cifs-utils.
hint-smb-mount-mounted =
    .lead = Monta //armario/plans en /mnt/plans con el tipo cifs, sin SMB1 y sin la contraseña en la línea de comandos (man mount.cifs: credentials=).
    .solution = sudo nano /root/.smbcredentials (username=compass-svc y password=…), sudo chmod 600 /root/.smbcredentials, luego sudo mount -t cifs //armario/plans /mnt/plans -o credentials=/root/.smbcredentials.
hint-smb-mount-writable =
    .lead = ¿De quién son los archivos de /mnt/plans, y con qué cuenta se ejecuta Plotter? En un recurso Windows, los propietarios son opciones del montaje (man mount.cifs: uid=, gid=).
    .solution = sudo umount /mnt/plans, luego sudo mount -t cifs //armario/plans /mnt/plans -o credentials=/root/.smbcredentials,uid=plotter,gid=plotter.
hint-smb-mount-credentials =
    .lead = El archivo de credenciales: de root, legible solo por root, con username= y password= (ls -l /root necesita sudo).
    .solution = sudo chown root: /root/.smbcredentials y sudo chmod 600 /root/.smbcredentials.
hint-smb-mount-fstab =
    .lead = Una línea en /etc/fstab con las mismas opciones, más las que evitan que el arranque dependa de armario (man fstab, man mount.cifs).
    .solution = sudo nano /etc/fstab: //armario/plans /mnt/plans cifs credentials=/root/.smbcredentials,uid=plotter,gid=plotter,_netdev,nofail 0 0
hint-smb-mount-end =
    .lead = Compruébalo todo: montado, con escritura para plotter, archivo de credenciales en 600, línea de fstab sin contraseña, con _netdev y nofail.
    .solution = sudo umount /mnt/plans, sudo mount -a, luego sudo -u plotter touch /mnt/plans/exports/test.

## Capítulo 3 — El otro lado

hint-full-volume-full =
    .lead = Plotter dice «No space left on device»: ¿cuánto está lleno el recurso, visto desde compas (man df)?
    .solution = df -h /mnt/plans.
hint-full-volume-outside =
    .lead = Compáralo con lo que contiene el propio recurso (man du).
    .solution = du -sh /mnt/plans: unos 60G, mientras que el volumen es de 500G y está lleno.
hint-full-volume-powershell =
    .lead = Lo que lo llena está fuera del recurso: ve a mirar en el propio armario (el correo de Ifeoma: OpenSSH, integrado en Windows).
    .solution = ssh armario.
hint-full-volume-volume =
    .lead = En PowerShell, ¿qué volumen está lleno? Get-Command lista los cmdlets; Get-Help NOMBRE es el manual.
    .solution = Get-Volume, o Get-PSDrive.
hint-full-volume-culprit =
    .lead = Recorre todo el volumen y ordena los archivos por tamaño, los más grandes primero (Get-Help Get-ChildItem, Get-Help Sort-Object, Get-Help Select-Object).
    .solution = Get-ChildItem D:\ -Recurse -File | Sort-Object Length -Descending | Select-Object -First 5
hint-full-volume-end =
    .lead = Anota el volumen y el archivo con su ruta completa en ~/informe-armario.txt (exit para volver a compas).
    .solution = exit, luego nano ~/informe-armario.txt: D: (Data) lleno, D:\Backup\plans-full-2029-11-03.zip desde el 3 de noviembre, evento 2013 de srv.
