### Story "The Language Café", chapter "Permission Denied, But…": a site
### moved with mv keeps its home's SELinux label; httpd may not read it.
### ls -Z, the audit log (ausearch, audit2why), semanage fcontext and
### restorecon. Commands, options, paths, labels and outputs are not
### translated.

chapter-wrong-label = Permission Denied, But…
    .summary = The new site is in place, the permissions look perfect, and the café's screen shows a test page. httpd is refused something the Unix rights allow: find who refuses, read why, and fix it so that it holds after the next relabel, without switching SELinux off.

## Files

wrong-label-message-thuy =
    From: Thuy (Vietnamese table, and the noticeboard's keeper)
    Saturday 12 December, 10:15

    Hello!

    Itzel put the new site on kettle this morning, and since then the screen
    by the door shows the grey "Test Page" again instead of the tables. She
    checked the rights twice; she even sent me a screenshot of ls -l, all
    rw-r--r--. On Thursday 40 people came; on Saturday we have the
    open day, and I would love the tables to be on the screen.

    Kaveh, from the association next door, is coming tonight at 22:00 to
    reboot kettle for a kernel update. Seun left kettle ready for that, he
    said.

    Thuy

wrong-label-message-itzel =
    From: Itzel
    Saturday 12 December, 09:45

    I built the new site in my home on kettle (~/site), then moved it to
    /srv/site, where websites go, I read. Exactly what I did:

        sudo mkdir /srv/site
        cd ~/site && sudo mv css index.html tables.html /srv/site/

    Then a file for httpd, /etc/httpd/conf.d/commontongue.conf, with
    DocumentRoot "/srv/site", and sudo systemctl restart httpd. No error. The
    files are readable by everyone. What else does httpd want?

    Itzel

## Events

wrong-label-event-test-page =
    That test page is httpd saying 403 for "/": Rocky's welcome.conf shows
    it whenever httpd refuses the home page. httpd found the site but was
    not allowed to read it. Its error log (/var/log/httpd/error_log) says
    which file.

wrong-label-event-error-log =
    "Permission denied" for a file every account may read: the Unix rights
    are not the only ones on kettle. Every file also has a SELinux label,
    which ls can show (man ls, -Z), and every process one (ps -Z): httpd's
    is httpd_t.

wrong-label-event-labels =
    user_home_t: the label of a home directory's files. mv doesn't relabel:
    the files kept the label they had in Itzel's home, and httpd_t may not
    read user_home_t. Compare with /var/www/html (ls -Zd). Who refused, and
    when, is in the audit log.

wrong-label-event-avc =
    An AVC is SELinux's refusal: who (scontext, httpd_t), what (tcontext,
    the file's type; tclass) and which permission ({"{"} read {"}"}),
    permissive=0: refused. audit2why explains a denial (its package may be
    missing: dnf finds which package has a command).

wrong-label-event-tools-missing =
    semanage, audit2why and audit2allow are not in a minimal installation:
    they come with a package. dnf can tell which (man dnf: provides).

wrong-label-event-tools =
    The policy's tools are there. audit2why reads denials and says why;
    semanage fcontext -l says which label the policy gives each path. What
    does it give /srv/site?

wrong-label-event-permissive =
    Permissive: SELinux refuses nothing any more, so the site shows; that
    proves SELinux is the cause, but every confined service on kettle has
    lost its protection, not just httpd. Put enforcing back (setenforce 1)
    and fix the labels instead.

wrong-label-event-config-off =
    /etc/selinux/config no longer says SELINUX=enforcing: at the next boot
    (tonight, with Kaveh), kettle would start without SELinux's protection.
    Put enforcing back in the file.

wrong-label-event-chmod =
    A file of the site is now writable by everyone (chmod 777 or o+w): the
    Unix rights were already enough for httpd, they were not the problem.
    Put them back (644 for files, 755 for directories); the label is what
    httpd lacks.

wrong-label-event-home-boolean =
    httpd_read_user_content lets httpd read every home directory's files:
    the site would show, but so would anything any account leaves in its
    home. Switch it off again; the site shouldn't look like a home.

wrong-label-event-module =
    A module made by audit2allow is loaded: httpd_t may now read whatever
    has that label, in /srv/site and in every home. It allows what was
    refused, not what you meant. Remove it (semodule -r) and give the files
    the right label.

wrong-label-event-var-t =
    restorecon did what the policy says: /srv/site is var_t, like anything
    under /srv the policy doesn't know (semanage fcontext -l | grep /srv).
    httpd may not read var_t either. The policy must first learn what
    /srv/site is; then restorecon will apply it.

wrong-label-event-rule =
    The policy now labels the site as web content. Files keep their current
    label until something relabels them: restorecon -Rv, then check from the
    noticeboard.

wrong-label-event-relabelled =
    22:00. Kaveh: "I rebooted kettle for the kernel update. It took ages:
    something about 'relabelling the file system'? Thuy says the screen is
    back to the test page."

    Seun had left /.autorelabel: at boot, the whole disk was relabelled from
    the policy. Labels set with chcon are not in the policy: they are gone,
    and /srv/site is var_t again. Teach the policy (semanage fcontext), then
    restorecon.

wrong-label-event-rebooted =
    22:00. Kaveh: "I rebooted kettle for the kernel update. Looks fine!"

    This time no relabel ran (/.autorelabel was gone), so the labels set by
    hand survived. They are still not in the policy: the next restorecon or
    relabel puts back var_t. Teach the policy (semanage fcontext).

wrong-label-event-end =
    Thuy: "The tables are on the screen, in seven languages. Itzel is
    dancing in the kitchen."

    Well done! You finished Permission Denied, But….

    WHAT HAPPENED
    Itzel moved the site from her home with mv, and mv keeps a file's SELinux
    label: the files stayed user_home_t, which httpd_t may not read, so
    httpd got "Permission denied" from the kernel although the Unix rights
    allowed it (AH00132 in its error log, an AVC in the audit log). The
    policy itself labels /srv/site var_t. You taught the policy that
    /srv/site is web content (semanage fcontext), then relabelled the files
    from it (restorecon), so the labels hold at the next relabel too.

    GOOD PRACTICE
    - A "Permission denied" the Unix rights can't explain: look at the
      labels (ls -Z, ps -Z) and the audit log (ausearch -m avc -ts recent).
    - Copy into place (cp, which gives the new file its place's label) or
      relabel after a move: mv keeps the old label.
    - Fix the policy, not the file: semanage fcontext -a -t
      httpd_sys_content_t "/srv/site(/.*)?" (or -e /var/www /srv/site),
      then restorecon -Rv /srv/site. chcon lasts until the next relabel.
    - setenforce 0 is a diagnosis that lasts seconds, never a fix; chmod 777
      fixes nothing SELinux refuses, and opens the files to everyone.
    - audit2allow writes a rule for what was refused: here, httpd reading
      home directories. Read audit2why first: usually the answer is a label,
      a port type or a boolean.
    - Or use what the policy already knows: /var/www, or /srv/www (the
      policy labels /srv/www, and /srv/anything/www, as web content).

    DOCUMENTATION
    - RHEL 10, Using SELinux, troubleshooting: https://docs.redhat.com/en/documentation/red_hat_enterprise_linux/10/html/using_selinux/troubleshooting-problems-related-to-selinux_using-selinux
    - semanage-fcontext(8): https://man7.org/linux/man-pages/man8/semanage-fcontext.8.html
    - restorecon(8): https://man7.org/linux/man-pages/man8/restorecon.8.html
    - Rocky Linux, learning SELinux: https://docs.rockylinux.org/guides/security/learning_selinux/
