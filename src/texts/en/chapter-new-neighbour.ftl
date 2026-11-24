### Story "The Language Café", chapter "New Neighbour": a Debian sysadmin on
### a Rocky Linux 10 machine: /etc/os-release, dnf, systemctl, firewalld's
### runtime and permanent configurations. Commands, options, paths,
### configuration lines and outputs are not translated.

chapter-new-neighbour = New Neighbour
    .summary = The café's little server runs Rocky Linux, not Debian: no apt, no ufw. Find the other family's package manager and firewall, put a web server up, and open it so that it stays open after a reload.

## Files

new-neighbour-message-dilnoza =
    From: Dilnoza (coordinator, Common Tongue)
    Monday 7 December, 18:30

    Hello, and welcome to Common Tongue!

    Every Thursday evening our café runs free conversation tables: Arabic,
    Dari, Spanish, Tigrinya, Ukrainian, Vietnamese, and French and English
    for everyone. The screen by the door (we call it the noticeboard) should
    show the week's tables, from our own little server, kettle, in the back
    office.

    Seun, our last techie, installed kettle before he left for three months
    of work abroad. He says it is "Rocky Linux, like at my job", which means
    nothing to me, and he says you know Debian. Is that the same thing?

    Could you put a web server on kettle tonight, and make sure the
    noticeboard can reach it? Itzel is finishing the site; she will put it
    in place this week. Seun left you some notes. sudo works with your
    password.

    Thank you!
    Dilnoza

new-neighbour-notes-seun =
    Notes from Seun (kettle, 30 November)

    - kettle is Rocky Linux 10, a rebuild of Red Hat Enterprise Linux. Same
      Linux, same systemd and journalctl, same bash, but it is not Debian:
      look at /etc/os-release.
    - Packages: not apt. I installed nano for you, nothing else.
    - The firewall is firewalld, not ufw. It is running, with the default
      setup of a fresh install.
    - SELinux is on (enforcing). Leave it on, please. At work we never turn
      it off, we fix what it complains about.
    - The noticeboard (the screen by the door) is a small Debian box on the
      café's network: ssh noticeboard from kettle, your key is in place. Its
      browser loads http://www.commontongue.example/ every five minutes; on
      the café's network that name is kettle.

## Events

new-neighbour-event-debian =
    bash doesn't know that command: kettle is not a Debian. Its packages,
    its firewall and its web server have other names. Seun's notes say where
    to look first, and /etc/os-release says which family kettle belongs to.

new-neighbour-event-rocky =
    Rocky Linux 10: the Red Hat family, like RHEL, AlmaLinux and, further
    away, Fedora. Packages come from repositories through dnf (its manual:
    man dnf), the firewall is firewalld (man firewall-cmd), and Apache's
    package is not apache2 but httpd.

new-neighbour-event-installed =
    httpd is installed: its configuration is in /etc/httpd, its pages in
    /var/www/html, its logs in /var/log/httpd. Like on Debian, installing a
    service doesn't start it here: on Red Hat systems, a new service waits
    to be started and enabled.

new-neighbour-event-running =
    httpd runs, and will come back after a reboot. curl http://localhost/
    on kettle answers; the noticeboard is another story: between them stands
    the firewall.

new-neighbour-event-not-enabled =
    httpd runs, but it is not enabled: after the next reboot, the café's
    screen would stay blank. systemctl knows how to do both at once.

new-neighbour-event-blocked =
    From the noticeboard, kettle refuses at once: firewalld's public zone
    allows ssh, cockpit and dhcpv6-client, and rejects the rest. firewall-cmd
    --list-all shows what the zone allows; man firewall-cmd tells how to add
    a service.

new-neighbour-event-runtime-only =
    The rule works now: it is in firewalld's runtime configuration. It is
    not in the permanent one: the next firewall-cmd --reload, or the next
    reboot, will load the permanent configuration and forget it. Compare
    firewall-cmd --list-all with firewall-cmd --permanent --list-all.

new-neighbour-event-permanent-only =
    The rule is in the permanent configuration, in
    /etc/firewalld/zones/public.xml. But firewalld is still filtering with
    its runtime configuration, which doesn't have it yet: nothing changes
    until a reload.

new-neighbour-event-lost =
    The reload loaded the permanent configuration in place of the runtime
    one: what was only at runtime is gone. That is the point of --reload,
    and the trap of a change made only at runtime.

new-neighbour-event-firewall-off =
    firewalld is not running (or will not start at boot): every port of
    kettle is open to the café's network and to the internet. Opening one
    service is enough; start firewalld again (and enable it).

new-neighbour-event-selinux-off =
    SELinux is no longer enforcing (setenforce, or /etc/selinux/config). It
    doesn't stand between the noticeboard and httpd: the firewall does.
    Seun asked to keep it on: put it back.

new-neighbour-event-reached =
    The noticeboard reached httpd: what it shows is Rocky's test page, the
    welcome httpd serves while /var/www/html has no index.html (with a 403
    status: welcome.conf turns that refusal into this page). The site will
    come.

new-neighbour-event-end =
    Dilnoza: "Thuy says the screen shows a page that says 'Test Page' in
    big letters. I'm told that is good news!"

    Well done! You finished New Neighbour.

    WHAT HAPPENED
    kettle runs Rocky Linux 10, of the Red Hat family: dnf instead of apt,
    httpd instead of apache2, firewalld instead of ufw. You installed httpd
    with dnf, started and enabled it with systemctl, and allowed http and
    https in firewalld's public zone, at runtime and in the permanent
    configuration, so that the noticeboard reaches it now and after a reload
    or a reboot.

    GOOD PRACTICE
    - Look before you type: /etc/os-release (or hostnamectl) says which
      system you are on, and so which tools it has.
    - firewalld has two configurations: runtime (what filters now) and
      permanent (what --reload and the next boot load). Change both: the
      command with and without --permanent, or the permanent one then
      --reload, or the runtime one then --runtime-to-permanent.
    - Allow a service by its name (http, https: firewall-cmd --info-service
      shows its ports) rather than a bare port: the rule says why.
    - Check from where the users are (here, the noticeboard): curl
      localhost on the server doesn't cross the firewall.
    - Keep SELinux enforcing; the next chapters are about living with it.

    ANOTHER WAY
    nftables is underneath both ufw and firewalld (nft list ruleset shows
    what firewalld built). Writing nftables rules by hand works too, but on
    a Rocky machine firewalld owns them: keep to one tool.

    DOCUMENTATION
    - Rocky Linux, firewalld for beginners: https://docs.rockylinux.org/guides/security/firewalld-beginners/
    - firewall-cmd(1): https://firewalld.org/documentation/man-pages/firewall-cmd.html
    - DNF command reference: https://dnf.readthedocs.io/en/latest/command_ref.html
    - RHEL 10, Managing software with the DNF tool: https://docs.redhat.com/en/documentation/red_hat_enterprise_linux/10/html/managing_software_with_the_dnf_tool/

## What the three chapters of the story share: kept here so that they load with the story.

language-cafe-site-index =
    <!doctype html>
    <html lang="en">
    <head><meta charset="utf-8"><title>Common Tongue: this week's tables</title><link rel="stylesheet" href="/css/style.css"></head>
    <body class="common-tongue-site">
    <h1>Common Tongue</h1>
    <p>Free conversation tables, every Thursday from 18:30 at the café. Come as you are: newcomers and neighbours, every level welcome.</p>
    <p><a href="/tables.html">This week's tables</a></p>
    </body>
    </html>

language-cafe-site-tables =
    <!doctype html>
    <html lang="en">
    <head><meta charset="utf-8"><title>This week's tables</title><link rel="stylesheet" href="/css/style.css"></head>
    <body class="common-tongue-site">
    <h1>Thursday's tables</h1>
    <table>
    <tr><th>Table</th><th>Host</th></tr>
    <tr><td>Arabic</td><td>Hamza</td></tr>
    <tr><td>Dari</td><td>Farida</td></tr>
    <tr><td>Spanish</td><td>Itzel</td></tr>
    <tr><td>Tigrinya</td><td>Selam</td></tr>
    <tr><td>Ukrainian</td><td>Oksana</td></tr>
    <tr><td>Vietnamese</td><td>Thuy</td></tr>
    <tr><td>French and English</td><td>everyone</td></tr>
    </table>
    </body>
    </html>

language-cafe-old-index =
    <!doctype html>
    <html lang="en"><head><meta charset="utf-8"><title>Common Tongue</title></head>
    <body><p>Common Tongue: our new site is coming soon.</p></body></html>

language-cafe-rota =
    <!doctype html>
    <html lang="en"><head><meta charset="utf-8"><title>Volunteers' rota</title></head>
    <body class="common-tongue-rota">
    <h1>Volunteers' rota (café's network only)</h1>
    <p>Thursday: set up at 18:00 (Hamza, Thuy), tea and coffee (Farida), close up at 21:00 (Itzel).</p>
    </body></html>

language-cafe-signup-page =
    <!doctype html>
    <html lang="en"><head><meta charset="utf-8"><title>Sign up to volunteer</title></head>
    <body class="common-tongue-signup">
    <h1>Volunteer with Common Tongue</h1>
    <form method="post" action="/signup"><label>Your name <input name="name"></label> <label>Languages you speak <input name="languages"></label> <button>Sign up</button></form>
    </body></html>

language-cafe-signup-readme =
    signup: the volunteers' sign-up app (Tenzin)

    A small Python app, run by systemd (signup.service) as the signup
    account. It listens on 127.0.0.1:{ $port } only: httpd is its front door
    (see /etc/httpd/conf.d/signup.conf).
