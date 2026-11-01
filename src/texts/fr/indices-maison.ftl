### Indices gradués de La Maison des associations (voir src/engine/hints.ts) :
### un message par étape, indice-<chapitre>-<événement>, avec .piste (une
### direction, sans la commande exacte) et .solution (presque la réponse : la
### commande, avec ce qu'elle fait). Chaque indice dit où taper : sur ton
### poste, sur maison (la passerelle) ou sur une machine interne (wiki).

## Chapitre 1 — Les clés

indice-cles-copiee =
    .piste = Une paire de clés se crée sur TON poste, jamais sur le serveur (man ssh-keygen). Puis sa moitié publique va dans ~/.ssh/authorized_keys sur maison (man ssh-copy-id).
    .solution = Sur ton poste : ssh-keygen (Entrée pour accepter le chemin, phrase de passe au choix), puis ssh-copy-id maison (mot de passe provisoire : lilas-2027).
indice-cles-par-cle =
    .piste = Ta clé publique est posée : reconnecte-toi, ssh ne doit plus te demander le mot de passe du compte.
    .solution = Si tu es sur maison : exit ; puis, sur ton poste : ssh maison
indice-cles-fermee =
    .piste = Sur maison, c'est le serveur SSH qui décide d'accepter les mots de passe : cherche PasswordAuthentication dans /etc/ssh/sshd_config (man sshd_config). Vérifie la syntaxe avant de recharger.
    .solution = Sur maison : sudo nano /etc/ssh/sshd_config, la ligne #PasswordAuthentication yes devient PasswordAuthentication no ; puis sudo sshd -t et sudo systemctl reload ssh.
indice-cles-fin =
    .piste = Avant de partir, vérifie qu'on entre toujours, par la clé, maintenant que les mots de passe sont refusés.
    .solution = Sur maison : exit ; puis, sur ton poste : ssh maison

## Chapitre 2 — Le rebond

indice-rebond-au-wiki =
    .piste = Le wiki n'est joignable que depuis maison, mais ta clé privée doit rester sur ton poste : ssh sait rebondir par une machine (man ssh, option -J).
    .solution = Sur ton poste : ssh -J maison wiki (réponds yes pour chacune des deux machines).
indice-rebond-raccourci =
    .piste = Pour qu'un simple « ssh wiki » suffise, écris le chemin une fois pour toutes dans ~/.ssh/config, sur ton poste (man ssh_config, Host et ProxyJump).
    .solution = Sur ton poste : nano ~/.ssh/config, et ajoute un bloc Host wiki avec, en dessous, HostName wiki, User vous et ProxyJump maison.
indice-rebond-fin =
    .piste = Le raccourci et le rebond suffisent : aucune clé privée ne doit rester sur la passerelle.
    .solution = Sur ton poste : ssh wiki. Si tu avais copié ta clé privée sur maison, efface-la là-bas : rm ~/.ssh/id_ed25519

## Chapitre 3 — Le tunnel

indice-tunnel-validees =
    .piste = L'administration n'écoute que sur 127.0.0.1:8080 DU WIKI : un tunnel ssh fait arriver un port de ton poste jusque là-bas (man ssh, -L, et -f -N pour qu'il reste ouvert). Puis curl, depuis ton poste, lit la page et ses adresses.
    .solution = Sur ton poste : ssh -f -N -L 8080:localhost:8080 wiki (ou avec -J maison), curl localhost:8080/admin, puis curl localhost:8080/admin/valider/samir et curl localhost:8080/admin/valider/lea (pas promo-casino).
indice-tunnel-fin =
    .piste = Le tunnel tourne encore en arrière-plan sur ton poste : retrouve son processus, puis arrête-le.
    .solution = Sur ton poste : ps (la ligne ssh -f -N -L…), puis kill suivi de son PID.

## Chapitre 4 — Les transferts

indice-transferts-rapport =
    .piste = scp copie un fichier entre machines, comme cp, en préfixant le chemin distant par le nom de la machine ; le raccourci wiki de ~/.ssh/config vaut aussi pour lui (man scp).
    .solution = Sur ton poste : scp wiki:/srv/wiki/exports/rapport-2027.pdf .
indice-transferts-sauvegarde =
    .piste = La sauvegarde se fait depuis maison vers archives, avec rsync (man rsync). Attention à la barre oblique finale de la source : avec elle, rsync copie le CONTENU du dossier. Essaie d'abord à blanc, avec -n.
    .solution = Sur maison : rsync -av /srv/partage/ archives:/srv/sauvegardes/partage/ (ajoute --delete si un dossier partage en trop est apparu en face).
indice-transferts-fin =
    .piste = Il faut les deux : le rapport intact sur ton poste, et sur archives une sauvegarde identique à /srv/partage, sans dossier imbriqué.
    .solution = Sur ton poste : scp wiki:/srv/wiki/exports/rapport-2027.pdf . ; sur maison : rsync -av --delete /srv/partage/ archives:/srv/sauvegardes/partage/

## Chapitre 5 — L'hébergeur

indice-hebergeur-fin =
    .piste = D'abord rapatrier /srv/wiki/site sur ton poste, par SSH (man sftp, get -r). Puis le publier avec lftp sur le nom que couvre le certificat de l'hébergeur (courriel_hebergeur.txt, sur maison), dans public_html : mirror -R envoie vers l'hébergement, --delete retire ce qui n'est plus au site (man lftp).
    .solution = Sur ton poste : sftp wiki, get -r /srv/wiki/site, bye ; puis lftp -u maisonasso ftp.hosting.example (mot de passe dans courriel_yasmine.txt, sur maison), mirror -R --delete site public_html, bye.
