### Histoire « L'Autre Unix », chapitre « La dernière règle gagne » : une
### configuration pf écrite avec des habitudes d'iptables. Les commandes,
### options, règles et chemins ne sont pas traduits.

chapter-last-rule = La dernière règle gagne
    .summary = La base de données du ciné-club répond à tout internet : activer pf sans s'enfermer dehors, et apprendre que dans pf, c'est la dernière règle qui correspond qui gagne.

## Fichiers

last-rule-message-romy =
    De :  Romy
    À :   toi

    Un adhérent qui travaille dans l'informatique a scanné notre serveur
    (avec notre accord) : la base de données, port 3306, répond à tout
    internet. Seul le site devrait lui parler, depuis le serveur lui-même.

    Yanis a écrit une configuration de pare-feu, /etc/pf.conf, « comme
    iptables », dit-il. Il n'a pas osé l'activer : la dernière fois qu'il a
    touché à un pare-feu, plus personne n'a pu se connecter pendant deux
    jours.

    Tu peux l'activer, sans nous enfermer dehors ?

    Romy

## Événements

last-rule-event-checked =
    pfctl -n lit la configuration et s'arrête là : la syntaxe est bonne
    s'il ne dit rien. Mais une syntaxe correcte ne veut pas dire que les
    règles font ce que tu veux : pfctl -sr les montrera telles que pf les
    comprend, une fois chargées.
last-rule-event-locked-out =
    Attention : avec ces règles en vigueur, ta prochaine connexion ssh
    serait refusée, et le site ne répond plus. Dans pf, TOUTES les règles
    sont lues, et c'est la dernière qui correspond qui gagne : « block in
    all », à la fin, bloque aussi ssh et le web. Ta session actuelle reste
    ouverte (pf garde les connexions qu'il connaît déjà) : corrige pf.conf,
    puis recharge-le.
last-rule-event-on =
    pf est actif, et ssh passe toujours.
last-rule-event-not-at-boot =
    pf filtre comme il faut… jusqu'au prochain redémarrage : sans
    pf_enable="YES" dans rc.conf, il ne redémarrera pas.
last-rule-event-file-differs =
    Les règles en vigueur ne sont plus celles de /etc/pf.conf : après avoir
    modifié le fichier, recharge-le (pfctl -f), sinon un redémarrage
    ramènerait autre chose.
last-rule-event-end =
    Romy : « Le scan dit 22 et 80, rien d'autre. Et on peut toujours se
    connecter ! »

    Bravo ! Tu as terminé le chapitre « La dernière règle gagne » et
    l'histoire « L'Autre Unix ».

    CE QUI S'EST PASSÉ
    Yanis a écrit ses règles dans l'ordre où iptables les lit : accepter,
    puis bloquer le reste. pf les lit toutes, et c'est la DERNIÈRE règle qui
    correspond qui décide : son « block in all » final bloquait tout, ssh
    compris. Bloquer d'abord, puis ouvrir (ou des pass « quick »), dit la
    même chose dans la langue de pf. pf démarre désormais au boot, avec les
    règles du fichier.

    BONNE PRATIQUE
    - Vérifier une configuration avant de la charger (pfctl -nf), puis
      vérifier ce qui est vraiment en vigueur (pfctl -sr) et tester de
      l'extérieur.
    - Dans pf : bloquer d'abord, puis les pass ; ou quick sur les règles
      qui doivent décider tout de suite.
    - Par ssh, garder sa session ouverte pendant qu'on teste un nouveau
      pare-feu, et en ouvrir une deuxième pour vérifier qu'on entre encore.
    - Mieux encore pour une base de données : la faire écouter sur
      127.0.0.1 seulement. Le pare-feu est une deuxième ligne, pas la seule.

    UNE AUTRE FAÇON DE FAIRE
    pf sait aussi tenir des listes d'adresses (tables), freiner les
    attaquant·es (max-src-conn-rate avec overload, l'équivalent pf de
    fail2ban), et faire du NAT pour un routeur. FreeBSD fournit aussi ipfw,
    son autre pare-feu, avec sa propre syntaxe (où c'est la première règle
    qui gagne).

    DOCUMENTATION
    - pf.conf(5) : https://man.freebsd.org/cgi/man.cgi?query=pf.conf
    - pfctl(8) : https://man.freebsd.org/cgi/man.cgi?query=pfctl
    - Le Handbook, PF : https://docs.freebsd.org/en/books/handbook/firewalls/#firewalls-pf
