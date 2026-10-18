### Histoire « Le Datacenter », chapitre « La nuit du redémarrage » :
### services systemd. Le serveur a redémarré cette nuit et le site est
### tombé. Les commandes, les noms de services, les chemins et les messages
### de systemd ou de php-fpm (en anglais) ne se traduisent pas.

chapitre-redemarrage = La nuit du redémarrage
    .resume = Des services qui ne repartent pas : systemctl, journalctl, enable, et vérifier après un redémarrage.

## Fichiers

redemarrage-courriel-awa =
    De : Awa (responsable d'exploitation)
    À : toi
    Objet : Le site est tombé cette nuit

    Cette nuit à 3 h 12, le serveur a redémarré tout seul : les mises à jour
    automatiques avaient installé un nouveau noyau. Depuis, le site de la
    médiathèque ne répond plus.

    1. Trouve quels services ne tournent pas, et pourquoi. Le journal de
       systemd sait tout.
    2. Répare.
    3. Le plus important : assure-toi que tout repartira TOUT SEUL au
       prochain redémarrage. La seule façon d'en être sûr·e : redémarrer
       (sudo reboot), puis vérifier. Tu seras déconnecté·e pendant le
       redémarrage : reconnecte-toi avec ssh datacenter.

    Mes notes sont dans ~/notes_awa.txt. Le mot de passe pour sudo n'a pas
    changé.
redemarrage-notes-awa =
    NOTES D'AWA — QUAND UN SERVICE NE DÉMARRE PAS

      systemctl --failed           les services en échec
      systemctl status nom         l'état d'un service et ses derniers messages
      journalctl -u nom            tous les messages d'un service
      journalctl -xeu nom          la formule classique : la fin, avec des explications

    Lis la PREMIÈRE erreur : les suivantes n'en sont souvent que la
    conséquence.

    Attention : « actif » (il tourne maintenant) et « activé » (il démarre
    avec la machine) sont deux choses différentes. Tout est dans
    man systemctl.

## Événements

# { $logs } : le dossier des journaux du catalogue
redemarrage-evenement-logs-ouverts =
    Prudence : n'importe quel compte peut maintenant écrire dans { $logs },
    et donc y effacer les journaux… ou y glisser de faux messages pour brouiller
    les pistes. Un dossier de journaux doit appartenir au compte du service
    qui y écrit, sans droit d'écriture pour les autres.
redemarrage-evenement-nginx =
    nginx tourne : le site répond de nouveau… pour l'instant.

    Regarde bien la ligne Loaded de systemctl status nginx : « disabled ».
    Que se passera-t-il au prochain redémarrage ?
redemarrage-evenement-nginx-active =
    nginx tourne, et il est activé (enabled) : il repartira tout seul au
    prochain démarrage de la machine.
redemarrage-evenement-catalogue =
    Le catalogue démarre : php-fpm, qui tourne sous le compte www-data, peut
    de nouveau écrire son journal. Les recherches du site remarchent.
redemarrage-evenement-oubli =
    La machine a redémarré… et nginx ne tourne pas : le site est de nouveau
    en panne. systemctl start ne vaut que jusqu'au prochain démarrage. Pour
    qu'un service démarre avec la machine, relis man systemctl.
redemarrage-evenement-fin =
    Après le redémarrage, tout est reparti tout seul : nginx et le catalogue
    tournent, et tu l'as vérifié. Awa : « C'est exactement ça, le métier :
    pas seulement réparer, mais s'assurer que ça tiendra. »

    Bravo ! Tu as terminé le chapitre 3 du Datacenter.

    CE QUI S'EST PASSÉ
    Le redémarrage de la nuit a révélé deux problèmes cachés depuis
    vendredi : nginx avait été désactivé (disable) pendant un test, et un
    « chown -R root: » avait donné à root le dossier où php-fpm, qui tourne
    sous www-data, écrit son journal. Tant que la machine tournait, rien ne
    se voyait.

    LA BONNE PRATIQUE
    - Après chaque redémarrage : systemctl --failed.
    - Un service refuse de démarrer : journalctl -xeu nom, et lire la
      première erreur.
    - start (maintenant) n'est pas enable (à chaque démarrage) ;
      enable --now fait les deux.
    - Le dossier d'un service appartient au compte du service, jamais en 777.
    - Un serveur qu'on n'a jamais redémarré est un serveur dont on ne sait
      pas s'il redémarre : tester un redémarrage en heure creuse.

    LA DOCUMENTATION
    - systemctl : https://www.freedesktop.org/software/systemd/man/latest/systemctl.html
    - journalctl : https://www.freedesktop.org/software/systemd/man/latest/journalctl.html
