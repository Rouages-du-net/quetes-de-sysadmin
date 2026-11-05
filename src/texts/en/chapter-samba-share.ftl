### Story "The Photo Club", chapter 3 "The Laptops": a Samba share
### (smb.conf, testparm, smbpasswd, masks, smbclient). Configuration,
### paths and the tools' outputs are not translated.

chapter-samba-share = The Laptops
    .summary = The members' Windows laptops should open the photos too, on the club's Wi-Fi. A Samba share for the club only, where a photo added by one member can be retouched by the others.

## Files

samba-share-message-margot =
    From:     Margot
    To:       you
    Subject:  And our laptops?

    Hello,

    The darkroom computer works wonders. Now Sam and Nora would like to
    open the photos from their laptops (Windows), on the club's Wi-Fi
    (192.0.2.0/24). Samba is installed on the NAS (smbd runs), but shares
    nothing yet.

    - A share "photos" with /srv/photos, for the club's members only.
      Tom has left the club: he keeps his account on the NAS for his old
      files, but no access to the share.
    - A photo added by one member must be retouchable by the others.
    - No guest access, obviously.

    Same sudo password: shutter-2028. For the tests, Sam's laptop
    password will be negative-2028, Nora's will be slide-2028 (they'll
    change them).

    Margot

## Events

samba-share-event-share =
    A share serves /srv/photos. testparm checks smb.conf (sudo testparm
    -s), smbclient tries it from here: smbclient //localhost/photos -U sam
    -c "ls". smbd reads smb.conf for each new connection: no restart
    needed for a share.
samba-share-event-unknown =
    testparm doesn't know one of the parameters: it is ignored, as if it
    weren't there. Check its spelling in man smb.conf (valid users, read
    only, create mask…).
samba-share-event-logon-failure =
    Samba refuses the login: it keeps its own passwords, separate from the
    Unix ones (man smbpasswd: -a). Each member needs one: sudo smbpasswd
    -a sam.
samba-share-event-read-only =
    The share is read-only: that's Samba's default. read only = no (or
    writable = yes) in the share's section.
samba-share-event-guest =
    guest ok = yes lets anyone on the Wi-Fi in, without a password (as
    nobody). The club asked for the opposite: remove it, and list who may
    enter (valid users = @club).
samba-share-event-tom =
    Any account of the NAS can enter this share, Tom included, as soon as
    he has a Samba password. valid users = @club keeps the share for the
    group's members.
samba-share-event-passwords =
    Sam and Nora can log in. Try adding a photo as Sam (smbclient … -c
    "put /tmp/contact-sheet.jpg sheet.jpg"), then look at its rights on
    the NAS: could Nora retouch it?
samba-share-event-masks =
    Look at the new file's rights (ls -l): by default, Samba creates files
    rw-r--r-- (create mask = 0744), and only their author can change them.
    For the club: create mask = 0664 and directory mask = 2775 (and the
    files must belong to the club group: force group = club, or the setgid
    of /srv/photos).
samba-share-event-firewall =
    The share is ready, but the laptops are on the Wi-Fi, and the NAS's
    firewall only lets SSH and NFS in: SMB uses port 445 (ufw knows the
    application "Samba"). Open it to the club's network only.
samba-share-event-end =
    The laptops open \\nas\photos with each member's Samba password; Tom
    and the guests stay out, and a photo added by one is retouchable by
    the others. Margot: "Nora retouched Sam's heron. He's thrilled.
    Mostly."

    Well done! You have finished the chapter "The Laptops".

    WHAT HAPPENED
    Samba was installed but shared nothing. A share for the club's group,
    Samba passwords for its members, masks so that the group can write,
    and the firewall opened to the club's network.

    A SAMBA SHARE
    - In /etc/samba/smb.conf: [photos], path = /srv/photos, read only =
      no, valid users = @club, create mask = 0664, directory mask = 2775,
      force group = club.
    - testparm -s after each change; smbd reads the file for each new
      connection.
    - smbpasswd -a NAME: Samba's own password; pdbedit -L lists them.
    - smbclient //server/share -U NAME -c "ls" to try it.

    GOOD PRACTICE
    - No guest ok on a share with personal files.
    - Linux permissions still apply under Samba: the masks and the group
      decide who can change what.
    - SMB only on the local network (445), never open to the Internet.

    DOCUMENTATION
    - smb.conf(5): https://www.samba.org/samba/docs/current/man-html/smb.conf.5.html
    - smbpasswd(8): https://www.samba.org/samba/docs/current/man-html/smbpasswd.8.html
    - Debian: https://wiki.debian.org/Samba/ServerSimple
