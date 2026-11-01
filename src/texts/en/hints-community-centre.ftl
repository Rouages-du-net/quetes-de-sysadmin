### Graded hints for The Community Centre (see src/engine/hints.ts): one
### message per step, indice-<chapter>-<event>, with .piste (a lead, without
### the exact command) and .solution (almost the answer). Each hint says
### where to type: on your workstation, on community (the gateway) or on an
### internal machine (wiki).

## Chapter 1 — The keys

hint-keys-copied =
    .lead = A key pair is created on YOUR workstation, never on the server (man ssh-keygen). Then its public half goes into ~/.ssh/authorized_keys on community (man ssh-copy-id).
    .solution = On your workstation: ssh-keygen (Enter to accept the path, passphrase of your choice), then ssh-copy-id community (temporary password: lilac-2027).
hint-keys-by-key =
    .lead = Your public key is in place: log in again, ssh should no longer ask for the account's password.
    .solution = If you are on community: exit; then, on your workstation: ssh community
hint-keys-closed =
    .lead = On community, the SSH server decides whether to accept passwords: look for PasswordAuthentication in /etc/ssh/sshd_config (man sshd_config). Check the syntax before reloading.
    .solution = On community: sudo nano /etc/ssh/sshd_config, the line #PasswordAuthentication yes becomes PasswordAuthentication no; then sudo sshd -t and sudo systemctl reload ssh.
hint-keys-end =
    .lead = Before you leave, check that you can still get in, with the key, now that passwords are refused.
    .solution = On community: exit; then, on your workstation: ssh community

## Chapter 2 — The Jump

hint-jump-to-wiki =
    .lead = The wiki can only be reached from community, but your private key must stay on your workstation: ssh can jump through a machine (man ssh, option -J).
    .solution = On your workstation: ssh -J community wiki (answer yes for each of the two machines).
hint-jump-shortcut =
    .lead = For a simple "ssh wiki" to be enough, write the route once and for all in ~/.ssh/config, on your workstation (man ssh_config, Host and ProxyJump).
    .solution = On your workstation: nano ~/.ssh/config, and add a Host wiki block with, below it, HostName wiki, User you and ProxyJump community.
hint-jump-end =
    .lead = The shortcut and the jump are enough: no private key should stay on the gateway.
    .solution = On your workstation: ssh wiki. If you had copied your private key onto community, delete it there: rm ~/.ssh/id_ed25519

## Chapter 3 — The tunnel

hint-tunnel-approved =
    .lead = The admin page only listens on 127.0.0.1:8080 OF THE WIKI: an ssh tunnel carries a port of your workstation all the way there (man ssh, -L, and -f -N so it stays open). Then curl, from your workstation, reads the page and its addresses.
    .solution = On your workstation: ssh -f -N -L 8080:localhost:8080 wiki (or with -J community), curl localhost:8080/admin, then curl localhost:8080/admin/valider/samir and curl localhost:8080/admin/valider/lea (not promo-casino).
hint-tunnel-end =
    .lead = The tunnel is still running in the background on your workstation: find its process, then stop it.
    .solution = On your workstation: ps (the ssh -f -N -L… line), then kill followed by its PID.

## Chapter 4 — Transfers

hint-transfers-report =
    .lead = scp copies a file between machines, like cp, with the remote path prefixed by the machine's name; the wiki shortcut in ~/.ssh/config works for it too (man scp).
    .solution = On your workstation: scp wiki:/srv/wiki/exports/report-2027.pdf .
hint-transfers-backup =
    .lead = The backup is done from community to archives, with rsync (man rsync). Mind the trailing slash on the source: with it, rsync copies the CONTENT of the directory. Try a dry run first, with -n.
    .solution = On community: rsync -av /srv/share/ archives:/srv/backups/share/ (add --delete if an extra share directory has appeared on the other side).
hint-transfers-end =
    .lead = You need both: the report, intact, on your workstation, and on archives a backup identical to /srv/share, with no nested directory.
    .solution = On your workstation: scp wiki:/srv/wiki/exports/report-2027.pdf . ; on community: rsync -av --delete /srv/share/ archives:/srv/backups/share/

## Chapter 5 — The web host

hint-web-host-end =
    .lead = First bring /srv/wiki/site back to your workstation, over SSH (man sftp, get -r). Then publish it with lftp under the name the host's certificate covers (email_hosting.txt, on community), into public_html: mirror -R sends to the hosting, --delete removes what is no longer in the site (man lftp).
    .solution = On your workstation: sftp wiki, get -r /srv/wiki/site, bye; then lftp -u maisonasso ftp.hosting.example (password in email_yasmine.txt, on community), mirror -R --delete site public_html, bye.
