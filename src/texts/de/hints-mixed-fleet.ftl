### Abgestufte Hinweise für Windows nebenan (siehe src/engine/hints.ts): eine
### Nachricht pro Schritt, hint-<chapter>-<event>, mit .lead (eine Richtung)
### und .solution (fast die Antwort).

## Kapitel 1 — Unsichtbare Zeichen

hint-line-endings-bad-interpreter =
    .lead = Führe das Skript so aus, wie cron es tun würde, und lies den Fehler genau (cd ~/ops).
    .solution = ./nightly-copy.sh: „/bin/bash^M: bad interpreter“. Das ^M ist ein Zeichen, das du in der Datei nicht siehst.
hint-line-endings-crlf =
    .lead = Sieh dir die Bytes der Datei an, nicht ihren Text (man file, man cat: -A, man od: -c).
    .solution = file nightly-copy.sh, oder cat -A nightly-copy.sh (^M$ am Ende jeder Zeile), oder od -c nightly-copy.sh | head (\r \n).
hint-line-endings-converted =
    .lead = Wandle die Zeilenenden von denen von Windows in die von Unix um (man dos2unix; sed und tr können das auch).
    .solution = dos2unix nightly-copy.sh, oder sed -i 's/\r$//' nightly-copy.sh, dann file nightly-copy.sh.
hint-line-endings-ran =
    .lead = Führe das umgewandelte Skript aus.
    .solution = ./nightly-copy.sh, dann ls /srv/nightly.
hint-line-endings-committed =
    .lead = Sag git, dass die .sh-Dateien Text mit LF-Zeilenenden sind, in einer Datei, die im Repository lebt (man gitattributes), und committe sie mit dem Skript.
    .solution = echo '*.sh text eol=lf' > .gitattributes, dann git add .gitattributes nightly-copy.sh und git commit -m "Skripte in LF".
hint-line-endings-end =
    .lead = Drei Dinge: das Skript in LF, ein Backup gemacht, die .gitattributes damit committet (git status, git log).
    .solution = git status sollte sauber sein, git show --stat der letzte Commit mit .gitattributes und nightly-copy.sh.

## Kapitel 2 — Die Freigabe nebenan

hint-smb-mount-listed =
    .lead = Frag schrank, welche Freigaben es anbietet, mit dem Konto aus Priyas Notizen (man smbclient).
    .solution = smbclient -L //schrank -U compass-svc, dann das Passwort aus notizen-priya.txt.
hint-smb-mount-helper =
    .lead = mount -t cifs braucht ein Hilfsprogramm, das in einem Paket kommt (man mount.cifs, man apt).
    .solution = sudo apt install cifs-utils.
hint-smb-mount-mounted =
    .lead = Häng //schrank/plans mit dem Typ cifs auf /mnt/plans ein, ohne SMB1 und ohne das Passwort auf der Befehlszeile (man mount.cifs: credentials=).
    .solution = sudo nano /root/.smbcredentials (username=compass-svc und password=…), sudo chmod 600 /root/.smbcredentials, dann sudo mount -t cifs //schrank/plans /mnt/plans -o credentials=/root/.smbcredentials.
hint-smb-mount-writable =
    .lead = Wem gehören die Dateien in /mnt/plans, und als wer läuft Plotter? Auf einer Windows-Freigabe sind die Besitzer Optionen des Einhängens (man mount.cifs: uid=, gid=).
    .solution = sudo umount /mnt/plans, dann sudo mount -t cifs //schrank/plans /mnt/plans -o credentials=/root/.smbcredentials,uid=plotter,gid=plotter.
hint-smb-mount-credentials =
    .lead = Die Zugangsdatendatei: im Besitz von root, nur für root lesbar, mit username= und password= (ls -l /root braucht sudo).
    .solution = sudo chown root: /root/.smbcredentials und sudo chmod 600 /root/.smbcredentials.
hint-smb-mount-fstab =
    .lead = Eine Zeile in /etc/fstab mit denselben Optionen, plus denen, die den Boot unabhängig von schrank machen (man fstab, man mount.cifs).
    .solution = sudo nano /etc/fstab: //schrank/plans /mnt/plans cifs credentials=/root/.smbcredentials,uid=plotter,gid=plotter,_netdev,nofail 0 0
hint-smb-mount-end =
    .lead = Prüfe alles: eingehängt, für plotter beschreibbar, Zugangsdatendatei 600, fstab-Zeile ohne Passwort, mit _netdev und nofail.
    .solution = sudo umount /mnt/plans, sudo mount -a, dann sudo -u plotter touch /mnt/plans/exports/test.

## Kapitel 3 — Die andere Seite

hint-full-volume-full =
    .lead = Plotter sagt „No space left on device“: Wie voll ist die Freigabe, von kompass aus gesehen (man df)?
    .solution = df -h /mnt/plans.
hint-full-volume-outside =
    .lead = Vergleiche mit dem, was die Freigabe selbst enthält (man du).
    .solution = du -sh /mnt/plans: etwa 60G, während das Volume 500G hat und voll ist.
hint-full-volume-powershell =
    .lead = Was es füllt, liegt außerhalb der Freigabe: Sieh auf schrank selbst nach (Ifeomas E-Mail: OpenSSH, in Windows eingebaut).
    .solution = ssh schrank.
hint-full-volume-volume =
    .lead = Welches Volume ist in PowerShell voll? Get-Command listet die Cmdlets auf; Get-Help NAME ist das Handbuch.
    .solution = Get-Volume, oder Get-PSDrive.
hint-full-volume-culprit =
    .lead = Steig das ganze Volume hinab und sortiere die Dateien nach Größe, die größten zuerst (Get-Help Get-ChildItem, Get-Help Sort-Object, Get-Help Select-Object).
    .solution = Get-ChildItem D:\ -Recurse -File | Sort-Object Length -Descending | Select-Object -First 5
hint-full-volume-end =
    .lead = Schreib das Volume und die Datei mit vollem Pfad in ~/schrank-bericht.txt (exit, um zu kompass zurückzukommen).
    .solution = exit, dann nano ~/schrank-bericht.txt: D: (Data) voll, D:\Backup\plans-full-2029-11-03.zip seit dem 3. November, Ereignis 2013 von srv.
