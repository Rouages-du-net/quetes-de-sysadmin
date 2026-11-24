### Graded hints for The Language Café (see src/engine/hints.ts): one
### message per step, hint-<chapter>-<event>, with .lead (a direction,
### without the exact command) and .solution (almost the answer).

## Chapter 1 — New Neighbour

hint-new-neighbour-rocky =
    .lead = Before typing Debian's commands, ask the machine what it is: a file in /etc says it, and Seun's notes too.
    .solution = cat /etc/os-release; cat notes_from_seun.txt
hint-new-neighbour-installed =
    .lead = On the Red Hat family, Apache's package is httpd, and the package manager is dnf (man dnf: search, info, install).
    .solution = dnf search httpd; sudo dnf install httpd (answer y)
hint-new-neighbour-running =
    .lead = Start the service, and make it start at every boot, in one systemctl command.
    .solution = sudo systemctl enable --now httpd; systemctl status httpd
hint-new-neighbour-blocked =
    .lead = Test from where the users are: the noticeboard. If kettle refuses, look at what firewalld's zone allows (man firewall-cmd).
    .solution = ssh noticeboard, then curl -I http://www.commontongue.example/; on kettle: sudo firewall-cmd --list-all
hint-new-neighbour-runtime-only =
    .lead = A firewalld service is allowed by its name (http, https), in the runtime configuration and in the permanent one.
    .solution = sudo firewall-cmd --add-service=http --add-service=https; sudo firewall-cmd --permanent --add-service=http --add-service=https
hint-new-neighbour-permanent-only =
    .lead = Is what you allowed active now, and still there after a reload? Compare both configurations.
    .solution = sudo firewall-cmd --list-all; sudo firewall-cmd --permanent --list-all; sudo firewall-cmd --reload
hint-new-neighbour-reached =
    .lead = Check from the noticeboard that httpd answers.
    .solution = ssh noticeboard; curl http://www.commontongue.example/ | head
hint-new-neighbour-end =
    .lead = httpd installed, running and enabled; http and https allowed at runtime and permanently; SELinux enforcing; the noticeboard gets an answer.
    .solution = systemctl is-enabled httpd; sudo firewall-cmd --permanent --list-services; sudo firewall-cmd --list-services; getenforce

## Chapter 2 — Permission Denied, But…

hint-wrong-label-test-page =
    .lead = Ask the site yourself, then read httpd's error log: which file, and which error?
    .solution = curl -I http://localhost/; sudo tail /var/log/httpd/error_log
hint-wrong-label-error-log =
    .lead = The Unix rights are fine. Compare the SELinux labels of the site's files with those of /var/www/html (man ls: -Z).
    .solution = ls -lZ /srv/site; ls -Zd /var/www/html; ps -eZ | grep httpd
hint-wrong-label-labels =
    .lead = Who refused, and what exactly? The audit log keeps SELinux's denials (man ausearch).
    .solution = sudo ausearch -m avc -ts recent
hint-wrong-label-avc =
    .lead = Ask why: audit2why explains a denial. If bash doesn't know it, find its package with dnf.
    .solution = sudo ausearch -m avc -ts recent | audit2why
hint-wrong-label-tools-missing =
    .lead = Which package has the semanage command? dnf can search files (man dnf: provides).
    .solution = dnf provides semanage; sudo dnf install policycoreutils-python-utils
hint-wrong-label-tools =
    .lead = Which label does the policy give /srv/site, and /var/www? semanage lists the file contexts.
    .solution = sudo semanage fcontext -l | grep -E '^/srv|^/var/www'
hint-wrong-label-rule =
    .lead = Teach the policy that /srv/site and everything in it is web content (man semanage-fcontext), then apply it to the files.
    .solution = sudo semanage fcontext -a -t httpd_sys_content_t "/srv/site(/.*)?"; sudo restorecon -Rv /srv/site
hint-wrong-label-relabelled =
    .lead = Did the relabel put back what you set by hand? A rule in the policy is what survives it.
    .solution = ls -Z /srv/site; sudo semanage fcontext -a -t httpd_sys_content_t "/srv/site(/.*)?"; sudo restorecon -Rv /srv/site
hint-wrong-label-end =
    .lead = SELinux enforcing; the site and its stylesheet served to the noticeboard; labels from the policy (restorecon -Rnv changes nothing); no 777, no module, no home boolean.
    .solution = getenforce; restorecon -Rnv /srv/site; sudo semanage fcontext -l -C; ssh noticeboard then curl http://www.commontongue.example/css/style.css

## Chapter 3 — A Port and a Boolean

hint-port-and-boolean-down =
    .lead = Why doesn't httpd start? Its unit's status and journal say it.
    .solution = systemctl status httpd; sudo journalctl -u httpd | tail
hint-port-and-boolean-bind-avc =
    .lead = Nothing else listens on 8010 (ss -tlnp): look for SELinux's denial, then for the ports the policy lets httpd use.
    .solution = sudo ausearch -m avc -c httpd; sudo semanage port -l | grep http_port_t
hint-port-and-boolean-port =
    .lead = Give 8010 the type of a web port (man semanage-port), then start httpd again.
    .solution = sudo semanage port -a -t http_port_t -p tcp 8010; sudo systemctl restart httpd
hint-port-and-boolean-up =
    .lead = Test the two new things: the sign-up page by its name, the rota from the café's network.
    .solution = curl -H 'Host: signup.commontongue.example' http://localhost/; ssh noticeboard then curl http://kettle:8010/
hint-port-and-boolean-proxy-503 =
    .lead = The app answers on its own port; httpd can't reach it. Look for the denial.
    .solution = curl http://127.0.0.1:8086/; sudo ausearch -m avc -ts recent | audit2why
hint-port-and-boolean-connect-avc =
    .lead = A boolean lets httpd connect to other ports (getsebool -a | grep httpd); set it so that it survives a reboot.
    .solution = sudo setsebool -P httpd_can_network_connect on
hint-port-and-boolean-boolean =
    .lead = Now the rota: only the café's network (198.51.100.0/24) should reach port 8010 (man firewall-cmd: rich rules), at runtime and permanently.
    .solution = sudo firewall-cmd --permanent --add-rich-rule='rule family="ipv4" source address="198.51.100.0/24" port port="8010" protocol="tcp" accept'; sudo firewall-cmd --reload
hint-port-and-boolean-rota-office =
    .lead = Is the rule in both configurations, and nothing opening 8010 to everyone?
    .solution = sudo firewall-cmd --list-rich-rules; sudo firewall-cmd --permanent --list-all
hint-port-and-boolean-end =
    .lead = httpd up and enabled; site and sign-up for everyone, the rota for the café only; httpd_can_network_connect with -P; no nis_enabled, no module; SELinux enforcing.
    .solution = getsebool httpd_can_network_connect nis_enabled; sudo semanage boolean -l -C; sudo semodule -l | grep httpd; sudo firewall-cmd --permanent --list-all
