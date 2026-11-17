### Graded hints for Next Door Windows (see src/engine/hints.ts): one message
### per step, hint-<chapter>-<event>, with .lead (a direction) and .solution
### (almost the answer).

## Chapter 1 — Invisible Characters

hint-line-endings-bad-interpreter =
    .lead = Run the script the way cron would, and read the error closely (cd ~/ops).
    .solution = ./nightly-copy.sh: "/bin/bash^M: bad interpreter". The ^M is a character you don't see in the file.
hint-line-endings-crlf =
    .lead = Look at the file's bytes, not its text (man file, man cat: -A, man od: -c).
    .solution = file nightly-copy.sh, or cat -A nightly-copy.sh (^M$ at each line's end), or od -c nightly-copy.sh | head (\r \n).
hint-line-endings-converted =
    .lead = Convert the line endings from Windows' to Unix's (man dos2unix; sed and tr can do it too).
    .solution = dos2unix nightly-copy.sh, or sed -i 's/\r$//' nightly-copy.sh, then file nightly-copy.sh.
hint-line-endings-ran =
    .lead = Run the converted script.
    .solution = ./nightly-copy.sh, then ls /srv/nightly.
hint-line-endings-committed =
    .lead = Tell git that the .sh files are text with LF endings, in a file that lives in the repository (man gitattributes), and commit it with the script.
    .solution = echo '*.sh text eol=lf' > .gitattributes, then git add .gitattributes nightly-copy.sh and git commit -m "Scripts in LF".
hint-line-endings-end =
    .lead = Three things: the script in LF, one backup done, the .gitattributes committed with it (git status, git log).
    .solution = git status should be clean, git show --stat the last commit with .gitattributes and nightly-copy.sh.

## Chapter 2 — The Share Next Door

hint-smb-mount-listed =
    .lead = Ask cabinet which shares it offers, with the account in Priya's notes (man smbclient).
    .solution = smbclient -L //cabinet -U compass-svc, then the password from notes-priya.txt.
hint-smb-mount-helper =
    .lead = mount -t cifs needs a helper program that comes in a package (man mount.cifs, man apt).
    .solution = sudo apt install cifs-utils.
hint-smb-mount-mounted =
    .lead = Mount //cabinet/plans on /mnt/plans with the cifs type, without SMB1 and without the password on the command line (man mount.cifs: credentials=).
    .solution = sudo nano /root/.smbcredentials (username=compass-svc and password=…), sudo chmod 600 /root/.smbcredentials, then sudo mount -t cifs //cabinet/plans /mnt/plans -o credentials=/root/.smbcredentials.
hint-smb-mount-writable =
    .lead = Who owns the files in /mnt/plans, and who does Plotter run as? On a Windows share, the owners are mount options (man mount.cifs: uid=, gid=).
    .solution = sudo umount /mnt/plans, then sudo mount -t cifs //cabinet/plans /mnt/plans -o credentials=/root/.smbcredentials,uid=plotter,gid=plotter.
hint-smb-mount-credentials =
    .lead = The credentials file: root's, readable by root alone, with username= and password= (ls -l /root needs sudo).
    .solution = sudo chown root: /root/.smbcredentials and sudo chmod 600 /root/.smbcredentials.
hint-smb-mount-fstab =
    .lead = A line in /etc/fstab with the same options, plus those that keep the boot from depending on cabinet (man fstab, man mount.cifs).
    .solution = sudo nano /etc/fstab: //cabinet/plans /mnt/plans cifs credentials=/root/.smbcredentials,uid=plotter,gid=plotter,_netdev,nofail 0 0
hint-smb-mount-end =
    .lead = Check it all: mounted, writable for plotter, credentials file 600, fstab line without password, with _netdev and nofail.
    .solution = sudo umount /mnt/plans, sudo mount -a, then sudo -u plotter touch /mnt/plans/exports/test.

## Chapter 3 — The Other Side

hint-full-volume-full =
    .lead = Plotter says "No space left on device": how full is the share, seen from compass (man df)?
    .solution = df -h /mnt/plans.
hint-full-volume-outside =
    .lead = Compare with what the share itself holds (man du).
    .solution = du -sh /mnt/plans: about 60G, while the volume is 500G and full.
hint-full-volume-powershell =
    .lead = What fills it is outside the share: go and look on cabinet itself (Ifeoma's email: OpenSSH, built into Windows).
    .solution = ssh cabinet.
hint-full-volume-volume =
    .lead = In PowerShell, which volume is full? Get-Command lists the cmdlets; Get-Help NAME is the manual.
    .solution = Get-Volume, or Get-PSDrive.
hint-full-volume-culprit =
    .lead = Go down the whole volume and sort the files by size, largest first (Get-Help Get-ChildItem, Get-Help Sort-Object, Get-Help Select-Object).
    .solution = Get-ChildItem D:\ -Recurse -File | Sort-Object Length -Descending | Select-Object -First 5
hint-full-volume-end =
    .lead = Write down the volume and the file with its full path in ~/cabinet-report.txt (exit to come back to compass).
    .solution = exit, then nano ~/cabinet-report.txt: D: (Data) full, D:\Backup\plans-full-2029-11-03.zip since 3 November, event 2013 from srv.
