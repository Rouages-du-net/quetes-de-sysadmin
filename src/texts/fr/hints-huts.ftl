### Les indices gradués de l'histoire « Les Refuges » : une piste, puis
### presque la réponse, pour chaque étape (voir src/engine/hints.ts).

## Chapitre 1 — Rassembler les journaux

hint-central-logs-silent =
    .lead = Quelque chose écoute-t-il les refuges ici ? (man ss : -u, -l, -n, -p ; la configuration de rsyslog : /etc/rsyslog.conf)
    .solution = ss -ulnp ne montre rien sur 514 ; dans /etc/rsyslog.conf, module(load="imudp") et input(type="imudp" port="514") sont en commentaire.
hint-central-logs-listening =
    .lead = Active la réception en UDP, vérifie la configuration, redémarre rsyslog (man rsyslogd : -N1).
    .solution = Décommente les deux lignes imudp de /etc/rsyslog.conf, sudo rsyslogd -N1, sudo systemctl restart rsyslog.
hint-central-logs-end =
    .lead = Laisse passer les refuges dans le pare-feu (man ufw), puis une règle pour leurs messages : un fichier par refuge, et rien dans syslog (man rsyslog.conf : template, stop).
    .solution = sudo ufw allow from 198.51.100.0/24 to any port 514 proto udp ; dans /etc/rsyslog.d/10-remote.conf : un modèle "/var/log/remote/%HOSTNAME%.log", puis if $fromhost-ip startswith '198.51.100.' then {"{"} action(type="omfile" dynaFile="…") stop {"}"} ; redémarre rsyslog.

## Chapitre 2 — Le Journal plein

hint-journal-full-disk =
    .lead = Où va la place ? (man df, man du : -s, -h)
    .solution = df -h : / à 93 % ; sudo du -sh /var/log/* /var/lib/* : /var/log/journal prend 6G.
hint-journal-full-journal =
    .lead = Combien prend le journal, et comment le réduire ? (man journalctl : --disk-usage, --vacuum-size)
    .solution = journalctl --disk-usage, puis sudo journalctl --vacuum-size=500M.
hint-journal-full-end =
    .lead = Pour qu'il reste petit : une limite pour journald, lue à son démarrage (man journald.conf : SystemMaxUse=).
    .solution = SystemMaxUse=500M sous {"["}Journal] dans /etc/systemd/journald.conf, puis sudo systemctl restart systemd-journald.

## Chapitre 3 — Échecs de connexion

hint-ssh-alerts-failures =
    .lead = À quoi ressemble un échec de connexion dans le fichier d'un refuge ? (grep dans /var/log/remote)
    .solution = sudo grep Failed /var/log/remote/refuge-lac.log : sshd[…]: Failed password for invalid user admin from…
hint-ssh-alerts-rule =
    .lead = Une règle avec une condition sur le programme et sur le message (man rsyslog.conf : if … then).
    .solution = if $programname == 'sshd' and $msg contains 'Failed password' then /var/log/remote/ssh-failures.log
hint-ssh-alerts-end =
    .lead = Les règles s'appliquent dans l'ordre, et les messages des refuges s'arrêtent à la règle par refuge (10-remote.conf) : mets la tienne avant, puis redémarre rsyslog.
    .solution = Ta règle dans /etc/rsyslog.d/05-ssh-failures.conf, sudo rsyslogd -N1, sudo systemctl restart rsyslog.
