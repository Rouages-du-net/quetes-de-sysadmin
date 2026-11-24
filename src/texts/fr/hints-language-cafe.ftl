### Indices gradués du Café des langues (voir src/engine/hints.ts) : un
### message par étape, hint-<chapitre>-<événement>, avec .lead (une piste,
### sans la commande exacte) et .solution (presque la réponse).

## Chapitre 1 — Nouveau voisin

hint-new-neighbour-rocky =
    .lead = Avant de taper les commandes de Debian, demandez à la machine ce qu'elle est : un fichier de /etc le dit, et les notes de Seun aussi.
    .solution = cat /etc/os-release ; cat notes_de_seun.txt
hint-new-neighbour-installed =
    .lead = Dans la famille Red Hat, le paquet d'Apache s'appelle httpd, et le gestionnaire de paquets est dnf (man dnf : search, info, install).
    .solution = dnf search httpd ; sudo dnf install httpd (répondre y)
hint-new-neighbour-running =
    .lead = Démarrez le service, et faites-le démarrer à chaque boot, en une seule commande systemctl.
    .solution = sudo systemctl enable --now httpd ; systemctl status httpd
hint-new-neighbour-blocked =
    .lead = Testez depuis là où sont les gens : le panneau. Si bouilloire refuse, regardez ce que la zone de firewalld autorise (man firewall-cmd).
    .solution = ssh panneau, puis curl -I http://www.commontongue.example/ ; sur bouilloire : sudo firewall-cmd --list-all
hint-new-neighbour-runtime-only =
    .lead = Un service firewalld s'autorise par son nom (http, https), dans la configuration d'exécution et dans la permanente.
    .solution = sudo firewall-cmd --add-service=http --add-service=https ; sudo firewall-cmd --permanent --add-service=http --add-service=https
hint-new-neighbour-permanent-only =
    .lead = Ce que vous avez autorisé est-il actif maintenant, et toujours là après un rechargement ? Comparez les deux configurations.
    .solution = sudo firewall-cmd --list-all ; sudo firewall-cmd --permanent --list-all ; sudo firewall-cmd --reload
hint-new-neighbour-reached =
    .lead = Vérifiez depuis le panneau que httpd répond.
    .solution = ssh panneau ; curl http://www.commontongue.example/ | head
hint-new-neighbour-end =
    .lead = httpd installé, démarré et activé ; http et https autorisés à l'exécution et en permanence ; SELinux en enforcing ; le panneau reçoit une réponse.
    .solution = systemctl is-enabled httpd ; sudo firewall-cmd --permanent --list-services ; sudo firewall-cmd --list-services ; getenforce

## Chapitre 2 — Permission refusée, mais…

hint-wrong-label-test-page =
    .lead = Demandez le site vous-même, puis lisez le journal d'erreurs de httpd : quel fichier, et quelle erreur ?
    .solution = curl -I http://localhost/ ; sudo tail /var/log/httpd/error_log
hint-wrong-label-error-log =
    .lead = Les droits Unix sont bons. Comparez les étiquettes SELinux des fichiers du site avec celles de /var/www/html (man ls : -Z).
    .solution = ls -lZ /srv/site ; ls -Zd /var/www/html ; ps -eZ | grep httpd
hint-wrong-label-labels =
    .lead = Qui a refusé, et quoi exactement ? Le journal d'audit garde les refus de SELinux (man ausearch).
    .solution = sudo ausearch -m avc -ts recent
hint-wrong-label-avc =
    .lead = Demandez pourquoi : audit2why explique un refus. Si bash ne le connaît pas, trouvez son paquet avec dnf.
    .solution = sudo ausearch -m avc -ts recent | audit2why
hint-wrong-label-tools-missing =
    .lead = Quel paquet contient la commande semanage ? dnf sait chercher des fichiers (man dnf : provides).
    .solution = dnf provides semanage ; sudo dnf install policycoreutils-python-utils
hint-wrong-label-tools =
    .lead = Quelle étiquette la politique donne-t-elle à /srv/site, et à /var/www ? semanage liste les contextes de fichiers.
    .solution = sudo semanage fcontext -l | grep -E '^/srv|^/var/www'
hint-wrong-label-rule =
    .lead = Apprenez à la politique que /srv/site et tout ce qu'il contient est du contenu web (man semanage-fcontext), puis appliquez-le aux fichiers.
    .solution = sudo semanage fcontext -a -t httpd_sys_content_t "/srv/site(/.*)?" ; sudo restorecon -Rv /srv/site
hint-wrong-label-relabelled =
    .lead = Le réétiquetage a-t-il remis ce que vous aviez posé à la main ? Une règle dans la politique, c'est ce qui y survit.
    .solution = ls -Z /srv/site ; sudo semanage fcontext -a -t httpd_sys_content_t "/srv/site(/.*)?" ; sudo restorecon -Rv /srv/site
hint-wrong-label-end =
    .lead = SELinux en enforcing ; le site et sa feuille de style servis au panneau ; des étiquettes venues de la politique (restorecon -Rnv ne change rien) ; pas de 777, pas de module, pas de booléen « home ».
    .solution = getenforce ; restorecon -Rnv /srv/site ; sudo semanage fcontext -l -C ; ssh panneau puis curl http://www.commontongue.example/css/style.css

## Chapitre 3 — Un port et un booléen

hint-port-and-boolean-down =
    .lead = Pourquoi httpd ne démarre-t-il pas ? L'état de son unité et son journal le disent.
    .solution = systemctl status httpd ; sudo journalctl -u httpd | tail
hint-port-and-boolean-bind-avc =
    .lead = Rien d'autre n'écoute sur 8010 (ss -tlnp) : cherchez le refus de SELinux, puis les ports que la politique laisse à httpd.
    .solution = sudo ausearch -m avc -c httpd ; sudo semanage port -l | grep http_port_t
hint-port-and-boolean-port =
    .lead = Donnez à 8010 le type d'un port web (man semanage-port), puis redémarrez httpd.
    .solution = sudo semanage port -a -t http_port_t -p tcp 8010 ; sudo systemctl restart httpd
hint-port-and-boolean-up =
    .lead = Testez les deux nouveautés : la page d'inscription par son nom, le planning depuis le réseau du café.
    .solution = curl -H 'Host: signup.commontongue.example' http://localhost/ ; ssh panneau puis curl http://bouilloire:8010/
hint-port-and-boolean-proxy-503 =
    .lead = L'appli répond sur son propre port ; httpd ne la joint pas. Cherchez le refus.
    .solution = curl http://127.0.0.1:8086/ ; sudo ausearch -m avc -ts recent | audit2why
hint-port-and-boolean-connect-avc =
    .lead = Un booléen laisse httpd se connecter à d'autres ports (getsebool -a | grep httpd) ; posez-le pour qu'il survive à un redémarrage.
    .solution = sudo setsebool -P httpd_can_network_connect on
hint-port-and-boolean-boolean =
    .lead = Maintenant le planning : seul le réseau du café (198.51.100.0/24) doit joindre le port 8010 (man firewall-cmd : règles riches), à l'exécution et en permanence.
    .solution = sudo firewall-cmd --permanent --add-rich-rule='rule family="ipv4" source address="198.51.100.0/24" port port="8010" protocol="tcp" accept' ; sudo firewall-cmd --reload
hint-port-and-boolean-rota-office =
    .lead = La règle est-elle dans les deux configurations, et rien n'ouvre-t-il 8010 à tout le monde ?
    .solution = sudo firewall-cmd --list-rich-rules ; sudo firewall-cmd --permanent --list-all
hint-port-and-boolean-end =
    .lead = httpd démarré et activé ; site et inscription pour tous, planning pour le café seulement ; httpd_can_network_connect avec -P ; pas de nis_enabled, pas de module ; SELinux en enforcing.
    .solution = getsebool httpd_can_network_connect nis_enabled ; sudo semanage boolean -l -C ; sudo semodule -l | grep httpd ; sudo firewall-cmd --permanent --list-all
