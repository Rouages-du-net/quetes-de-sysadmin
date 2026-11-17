### Histoire « Le traitement de nuit », chapitre « Le fichier en retard » :
### le minuteur a lancé le traitement avant l'arrivée du fichier du centre.
### Attendre que le fichier soit complet, ne jamais le traiter deux fois, et
### rendre un échec visible. Les commandes, chemins, fichiers d'unités et
### sorties des programmes ne sont pas traduits.

chapter-late-file = Le fichier en retard
    .summary = Le traitement a tourné à 02:00 sur le fichier de la veille sans rien dire : le faire attendre le fichier complet, le traiter une seule fois, et être prévenu quand il échoue.

## Fichiers

late-file-email-ayesha =
    De :  Ayesha
    À :   toi

    Mauvaise nouvelle. Ce matin, la comptabilité a remarqué que le relevé
    des prélèvements avait la même date de traitement que celui d'hier : à
    02:00, le traitement a repris le fichier du 22 une deuxième fois. Le
    fichier du centre est arrivé à 02:41 cette nuit, après notre minuteur.
    Et le traitement n'a rien dit : le service s'est terminé « avec
    succès ».

    Je l'ai relancé à la main sur le bon fichier à 8 h 10, et j'ai enlevé le
    .done (le centre écrit contrib.ebc.done une fois son envoi terminé). Le
    relevé est juste maintenant : personne ne sera prélevé deux fois.

    Le centre prévient que son fichier pourra encore être en retard.
    Pourrais-tu réparer la tuyauterie ? Le traitement doit attendre que le
    fichier soit complet, ne jamais traiter deux fois le même fichier, et
    si le programme se termine mal, il faut qu'on le sache (un courriel à
    moi ou à toi suffit). Le minuteur et le service sont dans
    /etc/systemd/system, le script d'enrobage est /opt/batch/run-night.sh.

    Le centre a accepté une répétition : chaque fois que tu modifies le
    script, les unités ou une crontab, ses deux nuits suivantes seront en
    retard exprès, et il manquera un enregistrement au deuxième fichier.

    Ayesha

## La répétition

late-file-rehearsal = Répétition avec le centre de traitement : les deux nuits suivantes.
late-file-night-first = Nuit du { $date } : le fichier est en retard, son .done arrive à { $done }.
late-file-night-second = Nuit du { $date } : le fichier est encore plus en retard, son .done arrive à { $done }, et il manque un enregistrement (l'enregistrement de fin le compte toujours).
late-file-run = { $time } : le traitement a tourné sur le fichier du { $date }, code retour { $rc }.
late-file-no-run = Le traitement n'a traité aucun fichier.
late-file-verdict-stale = Raté : il a traité un ancien fichier, et les adhérent·es seraient prélevé·es deux fois. Ne traiter qu'un fichier dont le .done est là.
late-file-verdict-partial = Raté : il a démarré sur un fichier encore en cours d'écriture (pas encore d'enregistrement de fin : code retour 12). Attendre le .done.
late-file-verdict-none = Raté : le fichier de la nuit n'a jamais été traité. Le traitement réessaie-t-il après 02:00 ? systemd a-t-il relu le minuteur, et est-il actif (systemctl daemon-reload, systemctl list-timers) ? Ou la crontab est-elle installée ?
late-file-verdict-twice = Raté : le fichier de la nuit a été traité { $count } fois. Une fois traité, enlever son .done (rm ou mv).
late-file-verdict-too-late = Raté : traité à { $time }, après 07:00, quand la comptabilité envoie le relevé à la banque. Réessayer plus souvent.
late-file-verdict-ok = Réussi : traité une fois, complet, avec le code retour 0.
late-file-verdict-mailed = Réussi : code retour 8, et { $who } a reçu un courriel à { $time }.
late-file-verdict-failed = Réussi : code retour 8, et systemd a marqué { $unit } en échec à { $time } (systemctl status, journalctl -u).
late-file-verdict-silent = Raté : code retour 8, mais personne ne le sait. Le service s'est terminé avec succès et personne n'a reçu de courriel : le script doit transmettre le code du programme (set -e, ou exit avec lui), ou envoyer un courriel.
late-file-rehearsal-again = Change ce qui doit l'être : le centre répétera les deux nuits suivantes.

## Événements

late-file-event-diagnosed =
    Voilà : le traitement a tourné à 02:00 jeudi puis vendredi, et les deux
    fois il a lu le fichier du 22 (RUN DATE 291122). Vendredi à 02:00, le
    nouveau fichier n'était pas encore là ; le minuteur ne le sait pas, il
    ne connaît que l'heure.
late-file-event-unscheduled =
    Plus rien n'est programmé : aucun minuteur actif, aucune crontab. Cette
    nuit, le traitement ne tournera pas du tout.
late-file-event-first-night =
    La nuit en retard s'est bien passée : le traitement a attendu le .done,
    puis traité le fichier une fois, avec le code retour 0.
late-file-event-second-night =
    Le fichier incomplet a été repéré : code retour 8, et quelqu'un le sait.
late-file-event-end =
    Ayesha : « Deux nuits, deux pièges, et le traitement a passé les deux.
    Ramón a lu ton script : il dit que c'est la première fois en trente ans
    que le traitement prévient quelqu'un quand quelque chose ne va pas. »

    Bravo ! Tu as terminé le chapitre « Le fichier en retard », et l'histoire
    « Le traitement de nuit ».

    CE QUI S'EST PASSÉ
    Le minuteur lançait le traitement à heure fixe, que le fichier soit là
    ou non, et le script se terminait par un echo : son code de sortie
    valait toujours 0. Le programme avait fait ce qu'on lui demandait. Tu as
    changé la tuyauterie autour : le traitement attend maintenant le .done
    du centre (le signe que l'envoi est complet), l'enlève une fois le
    fichier traité, réessaie pendant la nuit, et transmet le code retour du
    programme, pour qu'un échec se voie.

    BONNE PRATIQUE
    - Lancer un travail sur un événement (le fichier est complet : un .done,
      une taille qui ne bouge plus), pas seulement à une heure.
    - Rendre un travail idempotent : le même fichier ne doit jamais être
      traité deux fois (enlever son drapeau, le ranger dans une archive).
    - Un script d'enrobage transmet les codes retour de ses programmes
      (set -e, exit $RC) : systemd marque le service en échec (systemctl
      --failed), cron envoie la sortie par courriel.
    - Prévenir un humain, et fixer une heure limite : un fichier qui ne
      vient jamais est aussi un incident.

    UNE AUTRE FAÇON DE FAIRE
    Une unité path de systemd (PathExists=/srv/drop/contrib.ebc.done) lance
    le service dès que le .done apparaît, sans réessayer toutes les dix
    minutes ; OnFailure= lance une autre unité (un courriel) quand le
    service échoue. Sur un mainframe, l'ordonnanceur (et le COND du JCL)
    faisait tout cela : c'est la partie à déménager avec le plus de soin.

    DOCUMENTATION
    - systemd.timer : https://www.freedesktop.org/software/systemd/man/latest/systemd.timer.html
    - systemd.path : https://www.freedesktop.org/software/systemd/man/latest/systemd.path.html
    - sh, set -e et exit : https://manpages.debian.org/bookworm/dash/sh.1.en.html
    - crontab(5) : https://manpages.debian.org/bookworm/cron/crontab.5.en.html
