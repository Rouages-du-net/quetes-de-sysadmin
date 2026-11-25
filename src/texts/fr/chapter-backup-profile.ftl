### Histoire « La Fanzinothèque », chapitre « Un profil à nous » : un
### script de sauvegarde qui tourne en root reçoit son propre profil
### AppArmor : aa-autodep, le mode complain, une exécution, aa-logprof,
### aa-enforce. Les commandes, options, chemins, règles de profil et sorties
### ne se traduisent pas.

chapter-backup-profile = Un profil à nous
    .summary = Le script de sauvegarde de la fanzinothèque tourne en root et sauvegarde tout ce que liste sa configuration : le mois dernier, le fichier des mots de passe y est passé. Donnez-lui son propre profil AppArmor, appris de ce qu'il fait vraiment, pour que même en root il n'atteigne que les scans, le catalogue et son archive.

## Fichiers

backup-profile-message-hinewai =
    De : Hinewai (la Fanzinothèque)
    Mardi 22 mars, 19 h 10

    Bonsoir ! Merci encore pour le salon. Maintenant, un souci à moi.

    Mon script de sauvegarde, /usr/local/sbin/zine-backup, tourne en root
    toutes les nuits (cron) et sauvegarde ce que liste
    /etc/zine-backup.conf. En février, quelqu'un a ajouté /etc à SOURCES
    « pour garder les réglages de nginx », et l'archive copiée sur la clé
    USB partagée des bénévoles contenait /etc/shadow. J'ai retiré /etc et on
    a changé tous les mots de passe, mais rien n'empêche que ça recommence :
    le script est root, il lit ce qu'on lui dit de lire.

    Le bureau aimerait qu'il soit confiné par AppArmor, comme php-fpm : les
    scans, la base du catalogue, son archive dans /srv/backup, et rien
    d'autre, quoi que dise sa configuration. Rahim a installé auditd la
    semaine dernière (le wiki de Debian dit que les outils de profils le
    veulent) : les lignes d'AppArmor vont maintenant dans
    /var/log/audit/audit.log.

    Vous pouvez lancer la sauvegarde quand vous voulez : sudo zine-backup,
    ou sudo systemctl start zine-backup. Personne n'utilise le catalogue à
    cette heure-ci.

    Hinewai

## Événements

backup-profile-event-script =
    Le script lit sa liste dans /etc/zine-backup.conf et la passe à tar, en
    root : une ligne dans ce fichier suffit pour sauvegarder n'importe quoi.
    Un profil ne le laissera atteindre que ce dont une sauvegarde a besoin.
    aa-autodep en écrit un premier (man aa-autodep).

backup-profile-event-profile-file =
    Le script a un profil dans /etc/apparmor.d, chargé en mode complain : il
    laisse tout passer et note ce que ses règles ne couvrent pas. Lancez
    maintenant la sauvegarde, pour que le noyau voie ce qu'elle fait
    vraiment.

backup-profile-event-too-early =
    Le profil, en mode enforce, a refusé quelque chose dont la sauvegarde a
    besoin, et elle a échoué : les lignes DENIED de /var/log/audit/audit.log
    disent quoi. Soit le programme n'a pas d'abord été observé en mode
    complain (c'est trop tôt pour enforce), soit une règle est trop étroite :
    le nom de l'archive change à chaque exécution, sa règle ne doit pas
    nommer le fichier de ce soir.

backup-profile-event-not-attached =
    Un profil est chargé, mais le script a tourné sans confinement : son
    rattachement (le chemin après le nom du profil, ou le nom lui-même
    quand il commence par /) doit correspondre à
    /usr/local/sbin/zine-backup.

backup-profile-event-observed =
    L'exécution est passée en mode complain, et audit.log a reçu ses lignes
    apparmor="ALLOWED" : la configuration lue, date, tar et gzip exécutés,
    les scans et le catalogue lus (avec capability dac_read_search : le
    catalogue appartient à www-data et les autres ne peuvent pas le lire,
    alors même root en a besoin), l'archive écrite. aa-logprof les
    transforme en règles, une question à la fois (man aa-logprof).

backup-profile-event-too-wide =
    Ce profil laisse encore la sauvegarde atteindre { $path } : rien dont
    une sauvegarde ait besoin. Un motif qui remonte trop
    haut (/**), ou tar lancé sans confinement (ux), rend ce que le profil
    devait retirer.

backup-profile-event-rules =
    Le profil contient maintenant les règles de la sauvegarde. Il est encore
    en mode complain : il ne protège encore rien.

backup-profile-event-enforced =
    Le profil est en mode enforce. Relancez la sauvegarde : elle doit
    toujours passer.

backup-profile-event-shadow =
    tar: /etc/shadow: Cannot open: Permission denied, et une ligne
    apparmor="DENIED" : avec /etc/shadow dans SOURCES, le profil le refuse,
    root ou pas. Retirez-le de la configuration : la sauvegarde devrait
    alors réussir.

backup-profile-event-end =
    Hinewai : « Le bureau est content. Et je dormirai mieux : quoi qu'on
    mette dans ce fichier, le script ne peut plus emporter les mots de
    passe. »

    Bravo ! Vous avez terminé Un profil à nous.

    CE QUI S'EST PASSÉ
    Le script de sauvegarde tournait en root et lisait tout ce que listait
    sa configuration. Vous lui avez donné son propre profil : aa-autodep l'a
    créé en mode complain, une exécution a laissé le noyau noter ce que
    faisait le script (avec auditd, dans /var/log/audit/audit.log),
    aa-logprof a transformé ces lignes en règles (tar et gzip en ix, les
    répertoires avec des motifs, capability dac_read_search pour le
    catalogue), puis aa-enforce. Le script est un nouveau processus à
    chaque exécution : le profil s'attache à son prochain exec, rien à
    redémarrer. Root ou pas, il ne peut plus lire /etc/shadow.

    BONNES PRATIQUES
    - Observer avant d'appliquer : le mode complain, une vraie exécution (le
      chemin habituel de la tâche de nuit), puis les règles.
    - Lire chaque question d'aa-logprof : permettre ce dont le programme a
      besoin, un motif pour un répertoire plutôt que la liste de ses
      fichiers, jamais ux, jamais /**.
    - Vérifier un profil dans les deux sens : la tâche réussit, et ce
      qu'elle ne doit pas toucher est refusé (DENIED).
    - Sous AppArmor, root n'est pas tout-puissant : les capacités sont des
      règles aussi (capability dac_read_search).
    - Garder le mode complain court, et ranger le profil avec la
      configuration de la machine (et dans ses sauvegardes).

    UNE AUTRE FAÇON DE FAIRE
    Le bac à sable de systemd restreint ce que voit un service sans profil
    (ProtectSystem=strict, ReadWritePaths=, InaccessiblePaths=/etc/shadow).
    SELinux confine par étiquettes : un domaine pour le script, des types
    sur ses fichiers ; une séparation plus forte, mais étiqueter tout ce que
    lit une sauvegarde demande plus de travail.

    DOCUMENTATION
    - aa-logprof(8) : https://manpages.debian.org/trixie/apparmor-utils/aa-logprof.8.en.html
    - aa-autodep(8) : https://manpages.debian.org/trixie/apparmor-utils/aa-autodep.8.en.html
    - aa-enforce(8), aa-complain(8) : https://manpages.debian.org/trixie/apparmor-utils/aa-enforce.8.en.html
    - apparmor.d(5) : https://manpages.debian.org/trixie/apparmor/apparmor.d.5.en.html
    - Écrire un profil avec les outils : https://gitlab.com/apparmor/apparmor/-/wikis/Profiling_with_tools
