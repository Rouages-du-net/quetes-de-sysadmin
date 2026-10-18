// Chaque chapitre est rejoué jusqu'au bout (solution attendue), avec des
// fausses pistes en chemin : le moteur doit les refuser sans bloquer la
// partie. Les parties sont rejouées dans chaque langue disponible ; les
// textes attendus, eux, sont vérifiés en français (langue de référence).

import { describe, expect, it } from 'vitest';
import { Shell } from '../src/moteur/shell';
import { Console } from '../src/moteur/console';
import { HISTOIRES } from '../src/moteur/chapitres';
import { LANGUES, LANGUE_DE_REFERENCE } from '../src/textes';

const chapitre = (id: string) => HISTOIRES.flatMap((h) => h.chapitres).find((c) => c.id === id)!;

for (const langue of LANGUES)
  describe(`Langue : ${langue}`, () => {
    const reference = langue === LANGUE_DE_REFERENCE;
    // Un texte attendu, vérifié seulement dans la langue de référence.
    const contient = (tout: string, texte: string) => {
      if (reference) expect(tout).toContain(texte);
    };

    function jouer(id: string, commandes: string[]) {
      const s = new Shell(chapitre(id), langue);
      const sorties = ['cat ' + chapitre(id).accueil, ...commandes].map((c) => s.executer(c) ?? '');
      return { s, sorties, tout: sorties.join('\n') };
    }

    describe('L’Effaceur', () => {
      it('chapitre 1 — L’Île du Phare', () => {
        const { s, tout } = jouer('eveil', [
          'cat message.txt',
          'cd Colline/EcoleDesSignaux/SalleDExercice',
          'mv crabe Seau',
          'cd ../Cours',
          'ls -a',
          'cat .note_secrete',
          'cd ~/Jetee/Phare',
          'cd ~/Jetee',
          'mv filet ~/Port/Hangar',
          'cd Phare',
          'cd ~/Port/Remise',
          'ls -a',
          'mv .ampoule_de_secours ~/Jetee/Phare/Escalier/Lanterne',
          'cd ~/Jetee/Phare/Escalier/Lanterne',
          'mv .ampoule_de_secours ampoule',
        ]);
        contient(tout, 'Un énorme filet emmêlé bloque la porte du Phare');
        contient(tout, 'ne s’appelle pas exactement ampoule');
        expect(s.termine).toBe(true);
      });

      it('chapitre 1 — l’ampoule portée et renommée d’un coup', () => {
        const { s } = jouer('eveil', [
          'mv Jetee/filet Port/Hangar',
          'cd Port/Remise',
          'mv .ampoule_de_secours ~/Jetee/Phare/Escalier/Lanterne/ampoule',
        ]);
        expect(s.termine).toBe(true);
      });

      it('chapitre 2 — Le Bourg', () => {
        const { s, tout } = jouer('bourg', [
          'cd Mairie',
          'cd Archives',
          'grep Effaceur *',
          'ls -a',
          'cat .paillasson',
          'cd Archives',
          'grep -i effaceur chronique.txt',
          'cd ~/Ruelle',
          'cd ~/Boulangerie',
          'rm levain',
          'cp levain levain_2',
          'cp levain levain_3',
          'cd ~/Atelier',
          'touch engrenage',
          'cp engrenage engrenage_2',
          'cp engrenage engrenage_3',
          'cp engrenage engrenage_4',
          'cp engrenage engrenage_5',
          'cd ~/Ruelle',
          'cd Cour',
          'mv barricade ..',
          'rm barricade',
          'cd Cour/Egout',
          'cd Galerie',
          'cp ~/Marche/fromage .',
          'cd Galerie',
          'cat nour.txt',
          'cd ~/Ecole',
          'mkdir Classe',
        ]);
        contient(tout, 'La porte des Archives est fermée à clé');
        contient(tout, '« Pas mon dernier levain ! »');
        contient(tout, 'La barricade est trop lourde pour mv');
        contient(tout, 'l’Effaceur a effacé ma Classe');
        expect(s.termine).toBe(true);
      });

      it('chapitre 3 — La Racine', () => {
        const { s, tout } = jouer('racine', [
          'cat arrivee.txt',
          'ls -l',
          'chmod o-w souvenirs',
          'cat /var/log/effaceur.log',
          'grep cible /var/log/effaceur.log',
          'cp ~/effaceur.conf.corrige /etc/effaceur.conf',
          'grep "mot de passe" journal.txt',
          'sudo ls /root',
          'mauvais',
          'tournesol',
          'sudo cd /root',
          'sudo cp ~/effaceur.conf.corrige /etc/effaceur.conf',
        ]);
        contient(tout, 'Permission non accordée');
        contient(tout, 'Désolé, essayez de nouveau.');
        contient(tout, 'cd : commande introuvable');
        expect(s.termine).toBe(true);
      });
    });

    describe('L’Effaceur, chapitre 4 — La Sauvegarde', () => {
      // crontab -e : écrire la crontab dans l'éditeur, puis la fermer.
      const crontab = (s: Shell, changer: (texte: string) => string) => {
        s.executer('crontab -e');
        s.enregistrerEdition(changer(s.edition!.texte));
        return s.quitterEdition();
      };

      it('solution : rsync, crontab, la nuit, la restauration', () => {
        const { s, tout } = jouer('sauvegarde', [
          'cat mot_de_maelle.txt',
          'rsync souvenirs /mnt/sauvegarde',
          'rsync -av ~/souvenirs/ /mnt/sauvegarde/souvenirs/',
          'crontab -l',
        ]);
        expect(tout).toContain('skipping directory souvenirs');
        expect(tout).toContain('sending incremental file list');
        expect(tout).toContain('no crontab for vous');
        contient(tout, 'Demande à cron de la refaire chaque nuit');
        const erreur = crontab(s, (t) => t + '15 25 * * * rsync -a ~/souvenirs/ /mnt/sauvegarde/souvenirs/\n');
        expect(erreur).toContain('"/tmp/crontab.Zx81Ab/crontab":24: bad hour');
        expect(erreur).toContain("errors in crontab file, can't install.");
        const nuit = crontab(s, (t) => t + '15 3 * * * rsync -a ~/souvenirs/ /mnt/sauvegarde/souvenirs/\n');
        expect(nuit).toContain('crontab: installing new crontab');
        contient(nuit, 'fete-du-phare.txt y est, sans que tu aies rien tapé');
        expect(s.existe('/mnt/sauvegarde/souvenirs/fete-du-phare.txt')).toBe(true);
        expect(s.existe('/home/vous/souvenirs/premiere-lettre.txt')).toBe(false);
        s.executer('rsync -av /mnt/sauvegarde/souvenirs/premiere-lettre.txt ~/souvenirs/');
        expect(s.termine).toBe(true);
      });

      it('une autre solution : @daily, copie dans un dossier, restauration avec cp', () => {
        const s = new Shell(chapitre('sauvegarde'), langue);
        crontab(s, (t) => t + '@daily rsync -a souvenirs /mnt/sauvegarde/\n');
        expect(s.drapeaux.has('nuit-ok')).toBe(true);
        s.executer('cp /mnt/sauvegarde/souvenirs/premiere-lettre.txt souvenirs/');
        expect(s.termine).toBe(true);
      });

      it('fausses pistes : une tâche qui ne tourne pas la nuit, une tâche fausse, --delete après l’effacement', () => {
        const s = new Shell(chapitre('sauvegarde'), langue);
        const rien = crontab(s, (t) => t + '0 12 * * * rsync -a ~/souvenirs/ /mnt/sauvegarde/souvenirs/\n');
        contient(rien, 'aucune tâche de ta crontab ne tombait cette nuit');
        const courrier = crontab(s, (t) => t.replace('0 12', '0 2').replace('~/souvenirs/', '~/souvenir/'));
        expect(courrier).toContain('rsync: [sender] link_stat "/home/vous/souvenir" failed: No such file or directory (2)');
        crontab(s, (t) => t.replace('~/souvenir/', '~/souvenirs/'));
        expect(s.drapeaux.has('nuit-ok')).toBe(true);
        const perdu = s.executer('rsync -a --delete ~/souvenirs/ /mnt/sauvegarde/souvenirs/')!;
        contient(perdu, 'de la sauvegarde aussi');
        expect(s.termine).toBe(false);
      });
    });

    describe('Autres histoires', () => {
      it('Le Datacenter', () => {
        const L = '/var/log/nginx/access.log';
        const { s } = jouer('premier-jour', [
          'cat notes_awa.txt',
          `grep " 503 " ${L} | wc -l`,
          `cut -d " " -f 1 ${L} | sort | uniq -c | sort -n | tail -3`,
          'ps aux',
          'kill 4242',
          'sudo kill 4242',
          'bienvenue-2026',
          `echo "deny 198.51.100.77;" | sudo tee -a /etc/nginx/bloques.conf`,
          'sudo systemctl reload nginx',
          'ps aux',
          'sudo kill 4244',
          `grep " 503 " ${L} | wc -l > ~/rapport.txt`,
          'echo "Coupable : 198.51.100.77" >> rapport.txt',
        ]);
        expect(s.termine).toBe(true);
      });

      it('Le Datacenter, chapitre 2 — Deuxième jour', () => {
        const { s, tout } = jouer('deuxieme-jour', [
          'id',
          'id malo',
          'ls -l /var/log/nginx',
          'cat /home/malo/x',
          'usermod -aG adm malo',
          'sudo usermod -G adm malo',
          'bienvenue-2026',
          'groups malo',
          'sudo usermod -aG equipe-web malo',
          'sudo chmod o+r /var/log/nginx/access.log',
          'sudo chmod 640 /var/log/nginx/access.log',
          'chgrp equipe-web /srv/equipe',
          'sudo chmod 777 /srv/equipe',
          'sudo chgrp equipe-web /srv/equipe',
          'sudo chmod 770 /srv/equipe',
        ]);
        contient(tout, 'uid=1000(vous) gid=1000(vous) groupes=1000(vous),4(adm),27(sudo),1003(equipe-web)');
        contient(tout, '-rw-r----- www-data adm');
        contient(tout, 'usermod : Permission non accordée.');
        contient(tout, 'malo : malo adm');
        contient(tout, 'Malo n’est plus dans le groupe equipe-web'.replace('’', "'"));
        contient(tout, 'TOUS les comptes de la machine peuvent lire');
        contient(tout, "chgrp : modification du groupe de '/srv/equipe' : Opération non permise");
        contient(tout, 'n’importe quel compte'.replace('’', "'"));
        contient(tout, 'https://wiki.debian.org/SystemGroups');
        expect(s.termine).toBe(true);
      });

      it('Le Datacenter, chapitre 2 — une autre solution correcte', () => {
        const { s } = jouer('deuxieme-jour', [
          'sudo usermod -aG adm malo',
          'bienvenue-2026',
          'sudo chown root:equipe-web /srv/equipe',
          'sudo chmod g+w,o-rx /srv/equipe',
        ]);
        expect(s.termine).toBe(true);
      });

      it('Le Datacenter, chapitre 3 — La nuit du redémarrage', () => {
        const { s, tout } = jouer('redemarrage', [
          'systemctl --failed',
          'systemctl status nginx',
          'systemctl status catalogue',
          'journalctl -xeu catalogue',
          'systemctl start nginx',
          'sudo systemctl start nginx',
          'bienvenue-2026',
          'sudo systemctl restart catalogue',
          'sudo chmod 777 /var/log/catalogue',
          'sudo chmod 755 /var/log/catalogue',
          'sudo chown www-data: /var/log/catalogue',
          'sudo systemctl restart catalogue',
          'sudo reboot',
          'systemctl is-active nginx',
          'sudo systemctl enable --now nginx',
          'systemctl --failed',
          'sudo reboot',
          'systemctl --failed',
        ]);
        contient(tout, '× catalogue.service');
        contient(tout, 'Loaded: loaded (/usr/lib/systemd/system/nginx.service; disabled; preset: enabled)');
        contient(tout, 'failed to open error_log (/var/log/catalogue/error.log): Permission denied (13)');
        contient(tout, 'Failed to start nginx.service: Access denied');
        contient(tout, 'Job for catalogue.service failed because the control process exited with error code.');
        contient(tout, 'n’importe quel compte peut maintenant écrire'.replace('’', "'"));
        contient(tout, 'systemctl start ne vaut que jusqu');
        contient(tout, 'Created symlink /etc/systemd/system/multi-user.target.wants/nginx.service');
        contient(tout, 'https://www.freedesktop.org/software/systemd/man/latest/journalctl.html');
        expect(s.termine).toBe(true);
      });

      it('Le Datacenter, chapitre 3 — une autre solution correcte', () => {
        const { s } = jouer('redemarrage', [
          'sudo chown -R www-data:www-data /var/log/catalogue',
          'bienvenue-2026',
          'sudo systemctl enable nginx',
          'sudo reboot',
          'systemctl status nginx catalogue',
        ]);
        expect(s.termine).toBe(true);
      });

      it('Le Datacenter, chapitre 3 — réparer sans redémarrer ne suffit pas', () => {
        const { s } = jouer('redemarrage', [
          'sudo chown www-data: /var/log/catalogue',
          'bienvenue-2026',
          'sudo systemctl enable --now nginx',
          'sudo systemctl restart catalogue',
          'systemctl --failed',
        ]);
        expect(s.termine).toBe(false);
      });

      it('Le Datacenter, chapitre 4 — Le grand incendie', () => {
        const { s, tout } = jouer('incendie', [
          'cat /mnt/sauvegarde/PRA.txt',
          // Fausse piste : une machine neuve ne connaît encore aucun paquet.
          'sudo apt install nginx',
          'bienvenue-2026',
          'sudo apt update',
          'sudo apt install nginx',
          'y',
          'curl http://localhost',
          // Fausse piste : l'archive de cette nuit a été coupée par le feu.
          'tar -tzf /mnt/sauvegarde/mediatheque-2026-10-23.tar.gz',
          'tar -tzf /mnt/sauvegarde/mediatheque-2026-10-22.tar.gz',
          'sudo tar -xzf /mnt/sauvegarde/mediatheque-2026-10-22.tar.gz -C /',
          // Fausse piste : deux sites « default_server » sur le port 80.
          'sudo nginx -t',
          'sudo systemctl reload nginx',
          'sudo rm /etc/nginx/sites-enabled/default',
          'sudo nginx -t',
          'sudo systemctl reload nginx',
          'curl http://mediatheque.example',
        ]);
        expect(tout).toContain('Error: Unable to locate package nginx');
        expect(tout).toContain('Welcome to nginx!');
        expect(tout).toContain('a duplicate default server for 0.0.0.0:80 in /etc/nginx/sites-enabled/mediatheque:2');
        expect(tout).toContain('Job for nginx.service failed');
        expect(tout).toContain('test is successful');
        contient(tout, 'Une machine neuve ne connaît encore aucun paquet');
        contient(tout, 'Fin de fichier inattendue');
        contient(tout, 'le feu a pris');
        contient(tout, 'tant que la nouvelle configuration est refusée');
        contient(tout, 'Vacances de la Toussaint');
        expect(s.termine).toBe(true);
      });

      it('Le Datacenter, chapitre 4 — restaurer d’abord, installer ensuite, garder le site Debian', () => {
        const { s, tout } = jouer('incendie', [
          'cd /',
          'sudo tar -xzf /mnt/sauvegarde/mediatheque-2026-10-22.tar.gz',
          'bienvenue-2026',
          'sudo apt update',
          // nginx ne démarre pas : deux serveurs par défaut.
          'sudo apt install -y nginx',
          'systemctl is-active nginx',
        ]);
        expect(tout).toContain('dpkg: error processing package nginx (--configure):');
        expect(tout).toContain('failed');
        expect(s.termine).toBe(false);
        // Autre solution : la médiathèque n'est plus le site par défaut ; on la joint par son nom.
        const conf = '/etc/nginx/sites-enabled/mediatheque';
        s.executer(`sudo nano ${conf}`);
        s.enregistrerEdition(s.edition!.texte.replaceAll(' default_server', ''));
        s.quitterEdition();
        s.executer('sudo nginx -t');
        s.executer('sudo systemctl start nginx');
        expect(s.executer('curl localhost')).toContain('Welcome to nginx!');
        expect(s.termine).toBe(true);
      });

      it('Le Datacenter, chapitre 4 — fausses pistes : extraire dans ~, l’archive coupée, celle de mercredi', () => {
        const { s, tout } = jouer('incendie', [
          'sudo apt update',
          'bienvenue-2026',
          'sudo apt install -y nginx',
          'sudo rm /etc/nginx/sites-enabled/default',
          'sudo tar -xzf /mnt/sauvegarde/mediatheque-2026-10-22.tar.gz',
          'sudo tar -xzf /mnt/sauvegarde/mediatheque-2026-10-23.tar.gz -C /',
          'sudo systemctl reload nginx',
          'curl -I mediatheque.example',
          'sudo tar -xzf /mnt/sauvegarde/mediatheque-2026-10-21.tar.gz -C /',
          'sudo systemctl reload nginx',
        ]);
        contient(tout, 'extraite là où tu étais');
        // L'archive coupée rend la configuration, mais aucune page : 404.
        expect(tout).toContain('HTTP/1.1 404 Not Found');
        contient(tout, 'avec la page de mercredi');
        expect(s.termine).toBe(false);
        s.executer('sudo tar -xzf /mnt/sauvegarde/mediatheque-2026-10-22.tar.gz -C /');
        expect(s.termine).toBe(true);
      });

      it('Le Datacenter, chapitre 5 — Le certificat a expiré', () => {
        const { s, tout } = jouer('certificat', [
          'curl https://mediatheque.example',
          'journalctl -u certbot -n 8',
          'sudo certbot certificates',
          'bienvenue-2026',
          'sudo certbot renew --dry-run',
          'sudo cat /etc/letsencrypt/renewal/mediatheque.example.conf',
          // Fausse piste : --dry-run n'enregistre rien.
          'sudo certbot renew --dry-run --webroot -w /var/www/mediatheque',
          'sudo certbot renew --webroot -w /var/www/mediatheque',
          // Fausse piste : renouvelé sur le disque, mais nginx sert encore l'ancien.
          'curl https://mediatheque.example',
          'sudo certbot reconfigure --cert-name mediatheque.example --deploy-hook "systemctl reload nginx"',
          'sudo systemctl reload nginx',
          'curl -I https://mediatheque.example',
        ]);
        expect(tout).toContain('curl: (60) SSL certificate problem: certificate has expired');
        expect(tout).toContain('(INVALID: EXPIRED)');
        expect(tout).toContain('Invalid response from http://mediatheque.example/.well-known/acme-challenge/');
        expect(tout).toContain('Congratulations, all simulated renewals succeeded');
        expect(tout).toContain('Congratulations, all renewals succeeded');
        expect(tout).toContain('Dry run: skipping deploy hook command: systemctl reload nginx');
        expect(tout).toContain('HTTP/1.1 200 OK');
        contient(tout, 'Le certificat a bien expiré');
        contient(tout, 'pas là où nginx sert ce site');
        contient(tout, 'mais curl voit encore');
        expect(s.termine).toBe(true);
      });

      it('Le Datacenter, chapitre 5 — corriger le fichier de renouvellement, script de deploy hook', () => {
        const { s, tout } = jouer('certificat', [
          'sudo certbot renew',
          'bienvenue-2026',
          'sudo nano /etc/letsencrypt/renewal/mediatheque.example.conf',
        ]);
        expect(tout).toContain('Some challenges have failed');
        s.enregistrerEdition(s.edition!.texte.replaceAll('/var/www/html', '/var/www/mediatheque'));
        s.quitterEdition();
        const suite = [
          'sudo certbot renew --dry-run',
          'echo "systemctl reload nginx" | sudo tee /etc/letsencrypt/renewal-hooks/deploy/recharger-nginx',
          // Fausse piste : un script qui n'est pas exécutable est ignoré.
          'sudo certbot renew',
        ].map((l) => s.executer(l) ?? '');
        expect(suite.join('\n')).toContain("Skipping deploy-hook '/etc/letsencrypt/renewal-hooks/deploy/recharger-nginx' as it is not executable.");
        expect(s.termine).toBe(false);
        s.executer('sudo chmod +x /etc/letsencrypt/renewal-hooks/deploy/recharger-nginx');
        s.executer('sudo systemctl reload nginx');
        expect(s.termine).toBe(true);
      });

      it('Le Datacenter, chapitre 5 — le module nginx de certbot', () => {
        const { s, tout } = jouer('certificat', [
          'sudo certbot renew --nginx',
          'bienvenue-2026',
          'sudo apt install -y python3-certbot-nginx',
          'sudo certbot renew --nginx',
          'openssl s_client -connect mediatheque.example:443 | openssl x509 -noout -enddate',
        ]);
        expect(tout).toContain('The requested nginx plugin does not appear to be installed');
        expect(tout).toContain('notAfter=Apr 21');
        expect(s.termine).toBe(true);
      });

      it('Le Paquet perdu', () => {
        const { s } = jouer('paquet-perdu', [
          'cat carnet.txt',
          'ping 192.168.1.1',
          'ping 9.9.9.9',
          'ping lettres.example',
          'dig lettres.example',
          'cat /etc/resolv.conf',
          'dig @9.9.9.9 lettres.example',
          'sudo cp /etc/resolv.conf.box /etc/resolv.conf',
          'fourmiliere',
          'ping lettres.example',
          'traceroute lettres.example',
          'curl -I https://lettres.example',
        ]);
        expect(s.termine).toBe(true);
      });

      it('La Machine à remonter le temps', () => {
        const { s } = jouer('manuscrit', [
          'cd roman',
          'git log --oneline',
          'git diff HEAD~1 roman.txt',
          'git restore --source=HEAD~1 roman.txt',
          'git commit -m "x"',
          'git add roman.txt',
          'git commit -m "Restaure le chapitre 3"',
          'cd ../poemes',
          'git init',
          'git add .',
          'git commit -m "Premiers poèmes"',
        ]);
        expect(s.termine).toBe(true);
      });

      it('Les Archives', () => {
        const { s } = jouer('archives', [
          'cat notes_rosa.txt',
          'du -sh fonds',
          'df -h /media/cle',
          'tar -czf /media/cle/fonds.tar.gz fonds',
          'find fonds -name "*.tmp" -delete',
          'tar -czf /media/cle/fonds.tar.gz fonds',
          'tar -tzf /media/cle/fonds.tar.gz',
        ]);
        expect(s.termine).toBe(true);
      });
    });

    describe('Les Archives, chapitre 2 — Les versions (restic)', () => {
      const R = 'restic -r /mnt/mairie/restic-bibliotheque --password-file ~/.config/restic/mot-de-passe';
      // Les identifiants des instantanés, du plus ancien au plus récent.
      const instantanes = (s: Shell) => [...(s.executer(`${R} snapshots`) ?? '').matchAll(/^([0-9a-f]{8}) {2}/gm)].map((m) => m[1]);

      it('solution : find, restore, forget, prune, check, chmod', () => {
        const { s, tout } = jouer('versions', ['df -h /mnt/mairie', `${R} find --long journal_de_marie.txt`]);
        expect(tout).toContain('2027-02-02 02:00:13 /home/vous/fonds/manuscrits/journal_de_marie.txt');
        const ids = instantanes(s);
        expect(ids).toHaveLength(30);
        const bon = ids[25];
        const suite = [
          `${R} diff ${bon} ${ids[26]}`,
          `${R} restore ${bon} --target /tmp/restauration --include /home/vous/fonds/manuscrits/journal_de_marie.txt`,
          'cp /tmp/restauration/home/vous/fonds/manuscrits/journal_de_marie.txt ~/fonds/manuscrits/',
          `${R} forget --keep-daily 7 --keep-weekly 4 --keep-monthly 12 --dry-run`,
          // Fausse piste : forget seul ne rend pas la place.
          `${R} forget --keep-daily 7 --keep-weekly 4 --keep-monthly 12`,
          `${R} prune`,
          'chmod 600 ~/.config/restic/mot-de-passe',
          `${R} check`,
        ]
          .map((l) => s.executer(l) ?? '')
          .join('\n');
        expect(suite).toContain('M    /home/vous/fonds/manuscrits/journal_de_marie.txt');
        expect(suite).toContain('Would have removed the snapshots above (dry run).');
        expect(suite).toContain('remove 21 snapshots:');
        expect(suite).toContain('no errors were found');
        contient(suite, 'pas à sa place');
        contient(suite, 'mais df -h /mnt/mairie ne');
        contient(suite, 'Le disque respire');
        expect(s.termine).toBe(true);
      });

      it('autre solution : le mot de passe tapé, dump, forget --prune, puis une sauvegarde', () => {
        const { s, tout } = jouer('versions', ['chmod go-rwx ~/.config/restic/mot-de-passe', 'restic -r /mnt/mairie/restic-bibliotheque snapshots', 'mauvais']);
        expect(tout).toContain('Fatal: wrong password or no key found');
        contient(tout, 'Mauvais mot de passe');
        const ids = instantanes(s);
        for (const l of [
          `${R} dump ${ids[20]} /home/vous/fonds/manuscrits/journal_de_marie.txt > ~/fonds/manuscrits/journal_de_marie.txt`,
          `${R} backup ~/fonds`,
          `${R} forget --keep-last 2 --prune`,
          `${R} check`,
        ])
          s.executer(l);
        expect(s.termine).toBe(true);
      });

      it('fausse piste : forget trop sévère avant de restaurer', () => {
        const { s, tout } = jouer('versions', [`${R} forget --keep-last 3 --prune`, `${R} check`, 'chmod 600 ~/.config/restic/mot-de-passe']);
        contient(tout, 'Plus aucun instantané ne contient la bonne version');
        expect(s.termine).toBe(false);
      });
    });

    describe('Les Lettres du quartier, chapitre 4 — La colocation (nginx)', () => {
      // nano : remplace du texte dans un fichier et enregistre.
      const modifier = (s: Shell, fichier: string, avant: string | RegExp, apres: string) => {
        s.executer(`sudo nano ${fichier}`);
        s.enregistrerEdition(s.edition!.texte.replace(avant, apres));
        s.quitterEdition();
      };

      it('solution, avec les fausses pistes : lien relatif, nom en double, 502, barre finale', () => {
        const { s, tout } = jouer('colocation', [
          'curl http://cafe.example',
          'cd /etc/nginx',
          'sudo cp sites-available/lettres sites-available/cafe',
          'fourmis-2026',
          'sudo ln -s sites-available/cafe sites-enabled/',
          'sudo nginx -t',
          'sudo rm sites-enabled/cafe',
          'sudo ln -s /etc/nginx/sites-available/cafe /etc/nginx/sites-enabled/',
          'ls -l sites-enabled',
        ]);
        expect(tout).toContain('open() "/etc/nginx/sites-enabled/cafe" failed (2: No such file or directory)');
        expect(tout).toContain('cafe -> /etc/nginx/sites-available/cafe');
        contient(tout, 'le site des Lettres qui répond');
        contient(tout, 'le lien est cassé');
        modifier(s, '/etc/nginx/sites-available/cafe', /default_server/g, '');
        const conflit = s.executer('sudo nginx -t') ?? '';
        expect(conflit).toContain('nginx: [warn] conflicting server name "lettres.example" on 0.0.0.0:80, ignored');
        contient(conflit, 'deux sites répondent au même nom');
        modifier(s, '/etc/nginx/sites-available/cafe', /lettres/g, 'cafe');
        s.executer('sudo systemctl reload nginx');
        expect(s.executer('curl -H "Host: cafe.example" http://127.0.0.1')).toContain('Le café associatif');
        modifier(s, '/etc/nginx/sites-available/lettres', '    location / {', '    location /agenda/ {\n        proxy_pass http://127.0.0.1:3000;\n    }\n\n    location / {');
        const suite = ['sudo nginx -t', 'sudo systemctl reload nginx', 'curl -I http://lettres.example/agenda/', 'sudo tail -1 /var/log/nginx/error.log', 'sudo systemctl enable --now agenda', 'curl http://lettres.example/agenda/']
          .map((l) => s.executer(l) ?? '')
          .join('\n');
        expect(suite).toContain('HTTP/1.1 502 Bad Gateway');
        expect(suite).toContain('connect() failed (111: Connection refused) while connecting to upstream');
        expect(suite).toContain('Cannot GET /agenda/');
        contient(suite, 'la barre finale');
        expect(s.termine).toBe(false);
        modifier(s, '/etc/nginx/sites-available/lettres', 'proxy_pass http://127.0.0.1:3000;', 'proxy_pass http://127.0.0.1:3000/;');
        s.executer('sudo systemctl reload nginx');
        expect(s.executer('curl http://lettres.example/agenda/ateliers')).toContain('Les ateliers');
        expect(s.termine).toBe(true);
      });

      it('autre solution : un nouveau fichier écrit à la main, location exacte du préfixe, agenda démarré puis activé', () => {
        const { s } = jouer('colocation', ['sudo systemctl start agenda', 'fourmis-2026']);
        s.executer('sudo nano /etc/nginx/sites-available/cafe');
        s.enregistrerEdition('server {\n    listen 80;\n    server_name cafe.example;\n    root /var/www/cafe;\n}');
        s.quitterEdition();
        s.executer('sudo ln -s /etc/nginx/sites-available/cafe /etc/nginx/sites-enabled/cafe');
        modifier(s, '/etc/nginx/sites-available/lettres', '    location / {', '    location /agenda/ {\n        proxy_pass http://localhost:3000/;\n    }\n    location / {');
        s.executer('sudo systemctl reload nginx');
        expect(s.termine).toBe(false);
        s.executer('sudo systemctl enable agenda');
        expect(s.termine).toBe(true);
      });
    });

    describe('Les Lettres du quartier, chapitre 5 — Ça marche chez moi (DNS)', () => {
      const ZONE = '/etc/bind/zones/db.cafe.example';
      const modifier = (s: Shell, change: (texte: string) => string) => {
        s.executer(`sudo nano ${ZONE}`);
        s.enregistrerEdition(change(s.edition!.texte));
        s.quitterEdition();
      };

      it('solution, avec les fausses pistes : serial oublié, point final oublié, zone fausse', () => {
        const { s, tout } = jouer('chez-moi', ['dig cafe.example', 'dig @localhost cafe.example +short', 'dig www.cafe.example', 'sudo rndc status', 'fourmis-2026']);
        expect(tout).toContain('198.51.100.80');
        expect(tout).toContain('status: NXDOMAIN');
        expect(tout).toContain('server is up and running');
        // Une adresse mal tapée : named garde l'ancienne zone.
        modifier(s, (t) => t.replace('198.51.100.80', '203.0.113.310'));
        const fausse = ['named-checkzone cafe.example ' + ZONE, 'sudo rndc reload cafe.example'].map((l) => s.executer(l) ?? '').join('\n');
        expect(fausse).toContain("near '203.0.113.310': bad dotted quad");
        expect(fausse).toContain("rndc: 'reload' failed: failure");
        contient(fausse, 'named refuse la zone');
        // Le bon contenu, mais ni serial ni point final.
        modifier(s, (t) => t.replace('203.0.113.310', '203.0.113.10') + '\nwww     IN CNAME cafe.example');
        const demi = ['sudo rndc reload cafe.example', 'journalctl -u named', 'dig @localhost www.cafe.example', 'dig @ns2.registre.example cafe.example +short', 'dig cafe.example']
          .map((l) => s.executer(l) ?? '')
          .join('\n');
        expect(demi).toContain('zone serial (2026091501) unchanged. zone may fail to transfer to secondaries.');
        expect(demi).toContain('cafe.example.cafe.example.');
        contient(demi, 'son numéro de série');
        contient(demi, 'sans point final');
        contient(demi, 'les caches');
        expect(s.termine).toBe(false);
        modifier(s, (t) => t.replace('2026091501', '2027032001').replace('CNAME cafe.example', 'CNAME cafe.example.'));
        s.executer('named-checkzone cafe.example ' + ZONE);
        expect(s.executer('sudo rndc reload')).toContain('server reload successful');
        expect(s.termine).toBe(true);
        expect(s.executer('dig @ns2.registre.example www.cafe.example +short')).toBe('cafe.example.\n203.0.113.10');
      });

      it('autre solution : un enregistrement A pour www, et systemctl reload named', () => {
        const { s } = jouer('chez-moi', ['sudo id', 'fourmis-2026']);
        modifier(s, (t) => t.replace('2026091501', '2026091502').replaceAll('198.51.100.80', '203.0.113.10') + '\nwww 300 IN A 203.0.113.10');
        s.executer('sudo systemctl reload named');
        expect(s.termine).toBe(true);
      });
    });

    describe('Les Lettres du quartier, chapitre 6 — Le soir du concert (awk, limit_req)', () => {
      const SITE = '/etc/nginx/sites-available/lettres';
      const modifier = (s: Shell, fichier: string, change: (texte: string) => string) => {
        s.executer(`sudo nano ${fichier}`);
        s.enregistrerEdition(change(s.edition!.texte));
        s.quitterEdition();
      };

      it('solution, avec les fausses pistes : zone inconnue, limite sans rafale', () => {
        const { s, tout } = jouer('concert', [
          "sudo awk '{print $9}' /var/log/nginx/access.log | sort | uniq -c",
          'fourmis-2026',
          "sudo awk '{print $1}' /var/log/nginx/access.log | sort | uniq -c | sort -n",
        ]);
        expect(tout).toMatch(/\d+ 504/);
        contient(tout, 'robot qui aspire le site');
        // limit_req sans limit_req_zone : nginx -t refuse.
        modifier(s, SITE, (t) => t.replace('proxy_pass http://127.0.0.1:3000/;', 'limit_req zone=agenda;\n        proxy_pass http://127.0.0.1:3000/;'));
        expect(s.executer('sudo nginx -t')).toContain('zero size shared memory zone "agenda"');
        modifier(s, SITE, (t) => 'limit_req_zone $binary_remote_addr zone=agenda:10m rate=2r/s;\n\n' + t);
        const sansRafale = s.executer('sudo systemctl reload nginx') ?? '';
        contient(sansRafale, 'La limite refuse aussi des vraies personnes');
        expect(s.termine).toBe(false);
        modifier(s, SITE, (t) => t.replace('limit_req zone=agenda;', 'limit_req zone=agenda burst=10 nodelay;\n        limit_req_status 429;'));
        s.executer('sudo systemctl reload nginx');
        expect(s.termine).toBe(true);
        expect(s.executer("sudo awk '$9 == 429' /var/log/nginx/access.log | wc -l")).toMatch(/^\d{3,}$/);
      });

      it('fausse piste : bloquer les adresses du robot ne suffit pas à Kofi', () => {
        const { s } = jouer('concert', ['sudo id', 'fourmis-2026']);
        modifier(s, SITE, (t) => t.replace('    location /agenda/ {', '    deny 198.51.100.0/24;\n\n    location /agenda/ {'));
        const sortie = s.executer('sudo systemctl reload nginx') ?? '';
        contient(sortie, 'ces robots changent');
        expect(s.termine).toBe(false);
      });

      it('autre solution : la zone dans conf.d, la limite sur tout le site, 1 requête par seconde', () => {
        const { s } = jouer('concert', ['sudo id', 'fourmis-2026']);
        s.executer('echo "limit_req_zone $binary_remote_addr zone=lettres:10m rate=1r/s;" | sudo tee /etc/nginx/conf.d/limites.conf');
        modifier(s, SITE, (t) => t.replace('    root /var/www/lettres;', '    limit_req zone=lettres burst=20 nodelay;\n    root /var/www/lettres;'));
        s.executer('sudo systemctl reload nginx');
        expect(s.termine).toBe(true);
      });
    });

    describe('La Fabrique, chapitre 1 — La mise à jour (docker)', () => {
      it('solution : copier la base, volume, nouveau conteneur, --restart, et ça tient après un redémarrage', () => {
        const { s, tout } = jouer('mise-a-jour', [
          'docker ps',
          'sudo docker ps -a',
          'fablab-2027',
          "sudo docker inspect -f '{{json .Mounts}}' outiltheque",
          'sudo docker cp outiltheque:/var/lib/outiltheque ./sauvegarde',
          // Fausse piste : l'ancien conteneur occupe encore le port 8080.
          'sudo docker run -d --name outiltheque-15 -p 8080:8080 -v outiltheque-donnees:/var/lib/outiltheque registre.example/outiltheque:1.5',
          'sudo docker stop outiltheque',
          'sudo docker start outiltheque-15',
          'sudo docker cp sauvegarde/. outiltheque-15:/var/lib/outiltheque',
          'sudo docker restart outiltheque-15',
          'sudo docker logs -n 3 outiltheque-15',
          'curl http://localhost:8080',
        ]);
        expect(tout).toContain('permission denied while trying to connect to the Docker daemon socket');
        expect(tout).toContain('Bind for 0.0.0.0:8080 failed: port is already allocated.');
        expect(tout).toContain('Migrating database schema 3 -> 4');
        expect(tout).toContain('37 prêts en cours');
        contient(tout, 'la couche du conteneur');
        contient(tout, 'une base toute neuve et vide');
        expect(s.termine).toBe(false);
        s.executer('sudo docker update --restart unless-stopped outiltheque-15');
        expect(s.termine).toBe(true);
        s.executer('sudo reboot');
        expect(s.executer('curl http://localhost:8080')).toContain('outiltheque 1.5');
      });

      it('autre solution : un dossier de la machine (bind mount), --restart always, l’ancien supprimé', () => {
        const { s } = jouer('mise-a-jour', [
          'sudo mkdir /srv/outiltheque',
          'fablab-2027',
          'sudo docker cp outiltheque:/var/lib/outiltheque/outiltheque.db /srv/outiltheque/',
          'sudo docker rm -f outiltheque',
          'sudo docker run -d --name outiltheque --restart always -p 8080:8080 -v /srv/outiltheque:/var/lib/outiltheque registre.example/outiltheque:1.5',
        ]);
        expect(s.termine).toBe(true);
      });

      it('fausse piste : supprimer le conteneur avant de copier sa base', () => {
        const { s, tout } = jouer('mise-a-jour', ['sudo docker rm outiltheque', 'fablab-2027', 'sudo docker rm -f outiltheque']);
        expect(tout).toContain('container is running: stop the container before removing or force remove');
        contient(tout, 'Les 37 prêts ont disparu');
        s.executer('sudo docker run -d --name outiltheque --restart always -p 8080:8080 -v outiltheque:/var/lib/outiltheque registre.example/outiltheque:1.5');
        expect(s.termine).toBe(false);
      });
    });

    describe('La Fabrique, chapitre 2 — La composition (docker compose)', () => {
      const modifier = (s: Shell, fichier: string, change: (texte: string) => string) => {
        s.executer(`sudo nano ${fichier}`);
        s.enregistrerEdition(change(s.edition!.texte));
        s.quitterEdition();
      };
      // Le fichier corrigé : nom du service, variable, volume, redémarrage, sans version:.
      const corriger = (t: string) =>
        t
          .replace('version: "3.8"\n\n', '')
          .replace('@localhost:', '@db:')
          .replaceAll('atelier2027', '${POSTGRES_PASSWORD}')
          .replace('    depends_on:', '    restart: unless-stopped\n    depends_on:')
          .replace('      - POSTGRES_DB=reservations', '      - POSTGRES_DB=reservations\n    volumes:\n      - donnees:/var/lib/postgresql/data\n    restart: unless-stopped\n\nvolumes:\n  donnees:');

      it('solution, avec la fausse piste localhost', () => {
        const { s, tout } = jouer('composition', ['cd /srv/reservations', 'sudo docker compose up -d', 'fablab-2027', 'sudo docker compose logs appli', 'curl http://localhost:8081']);
        expect(tout).toContain('the attribute `version` is obsolete');
        expect(tout).toContain('Error: connect ECONNREFUSED 127.0.0.1:5432');
        expect(tout).toContain("curl: (7) Failed to connect to localhost port 8081");
        contient(tout, 'dans un conteneur, localhost désigne le conteneur');
        modifier(s, '/srv/reservations/compose.yaml', corriger);
        const config = s.executer('sudo docker compose config') ?? '';
        expect(config).toContain('The "POSTGRES_PASSWORD" variable is not set.');
        s.executer('echo POSTGRES_PASSWORD=atelier2027 | sudo tee .env');
        s.executer('sudo docker compose up -d');
        expect(s.executer('curl http://localhost:8081')).toContain('base de données connectée');
        expect(s.termine).toBe(false);
        s.executer('sudo chmod 600 .env');
        expect(s.termine).toBe(true);
        s.executer('sudo reboot');
        expect(s.executer('curl http://localhost:8081')).toContain('Réserver une machine');
      });

      it('fausse piste : changer POSTGRES_PASSWORD après la création de la base, puis down -v', () => {
        const { s } = jouer('composition', ['cd /srv/reservations', 'sudo id', 'fablab-2027']);
        modifier(s, '/srv/reservations/compose.yaml', (t) => corriger(t).replaceAll('${POSTGRES_PASSWORD}', 'atelier2027'));
        s.executer('sudo docker compose up -d');
        expect(s.executer('curl http://localhost:8081')).toContain('base de données connectée');
        // Le mot de passe passe dans .env… mais un autre que celui de la base existante.
        modifier(s, '/srv/reservations/compose.yaml', (t) => t.replaceAll('atelier2027', '${POSTGRES_PASSWORD}'));
        s.executer('echo POSTGRES_PASSWORD=nouveau-secret | sudo tee .env');
        s.executer('sudo chmod 600 .env');
        const echec = s.executer('sudo docker compose up -d') ?? '';
        expect(s.executer('sudo docker compose logs appli')).toContain('password authentication failed for user "fablab"');
        contient(echec, 'password authentication failed');
        expect(s.termine).toBe(false);
        const refait = ['sudo docker compose down -v', 'sudo docker compose up -d'].map((l) => s.executer(l) ?? '').join('\n');
        contient(refait, 'les volumes du projet sont effacés');
        expect(s.termine).toBe(true);
      });
    });

    describe('La Fabrique, chapitre 3 — Le trou dans le pare-feu (docker et ufw)', () => {
      const AVANT = ['eveil', 'bourg', 'racine', 'mise-a-jour', 'composition'];
      const modifier = (s: Shell, change: (texte: string) => string) => {
        s.executer('sudo nano /srv/reservations/compose.yaml');
        s.enregistrerEdition(change(s.edition!.texte));
        s.quitterEdition();
      };

      it('solution, testée depuis le poste : ufw ne suffit pas, port lié à 127.0.0.1, ménage', () => {
        const c = new Console({ langue, termines: AVANT });
        const jouerC = (lignes: string[]) => lignes.map((l) => c.executer(l) ?? '').join('\n');
        expect(jouerC(['nc -zv fabrique 5432'])).toContain('Connection to fabrique (192.0.2.15) 5432 port [tcp/postgresql] succeeded!');
        const dedans = jouerC(['ssh fabrique', 'yes', 'sudo ss -tlnp', 'fablab-2027', 'sudo ufw deny 5432', 'df -h /']);
        expect(dedans).toContain('0.0.0.0:5432');
        expect(dedans).toMatch(/9\d% \//);
        contient(dedans, 'contourne ufw');
        contient(dedans, 'ne change rien');
        expect(jouerC(['exit', 'nc -zv fabrique 5432'])).toContain('succeeded!');
        jouerC(['ssh fabrique', 'cd /srv/reservations']);
        modifier(c.shell, (t) => t.replace('      - "5432:5432"', '      - "127.0.0.1:5432:5432"'));
        jouerC(['sudo docker compose up -d', 'sudo docker image prune -a', 'y']);
        expect(c.termines).toContain('contournement');
        const dehors = jouerC(['exit', 'nc -zv fabrique 5432']);
        expect(dehors).toContain('timed out');
      });

      it('autre solution : plus de port pour la base, docker system prune -a -f', () => {
        const { s } = jouer('contournement', ['cd /srv/reservations', 'sudo id', 'fablab-2027']);
        modifier(s, (t) => t.replace('    # Pour pgAdmin, depuis mon portable (Yasmine)\n    ports:\n      - "5432:5432"\n', ''));
        s.executer('sudo docker compose up -d');
        const menage = s.executer('sudo docker system prune -a -f') ?? '';
        expect(menage).toContain('Deleted Containers:');
        expect(menage).toContain('untagged: registre.example/ia-locale:latest');
        expect(s.termine).toBe(true);
      });

      it('fausse piste : docker volume prune -a emporte le wiki', () => {
        const { s, tout } = jouer('contournement', ['sudo docker volume prune', 'fablab-2027', 'y', 'sudo docker volume ls', 'sudo docker volume prune -a', 'y']);
        expect(tout).toContain('WARNING! This will remove anonymous local volumes not used by at least one container.');
        expect(tout).toContain('Deleted Volumes:\nwiki-ancien');
        contient(tout, 'Le volume wiki-ancien a disparu');
        expect(s.termine).toBe(false);
      });
    });

    describe('La Fabrique, chapitre 4 — Les pleins pouvoirs (conteneur sans root)', () => {
      const modifier = (s: Shell, change: (texte: string) => string) => {
        s.executer('sudo nano /srv/galerie/compose.yaml');
        s.enregistrerEdition(change(s.edition!.texte));
        s.quitterEdition();
      };
      const avecUtilisateur = (u: string) => (t: string) => t.replace('    restart: unless-stopped', `    restart: unless-stopped\n    user: ${u}`);

      it('solution : user: "1001:1001" dans compose.yaml, puis chown -R', () => {
        const { s, tout } = jouer('pleins-pouvoirs', [
          'cd /srv/galerie',
          'sudo docker exec galerie-galerie-1 id',
          'fablab-2027',
          'ps aux',
          'ls -lan photos',
        ]);
        expect(tout).toContain('uid=0(root) gid=0(root) groups=0(root)');
        expect(tout).toMatch(/^root\s+\d+.*node serveur\.js$/m);
        contient(tout, "l'uid 0 du conteneur EST l'uid 0 de la machine");
        modifier(s, avecUtilisateur('"1001:1001"'));
        const echec = ['sudo docker compose up -d', 'sudo docker compose ps', 'sudo docker compose logs galerie']
          .map((l) => s.executer(l))
          .join('\n');
        expect(echec).toContain('Restarting (1)');
        expect(echec).toContain("Error: EACCES: permission denied, open '/app/photos/.miniatures/index.json'");
        contient(echec, 'EACCES, permission refusée');
        expect(s.termine).toBe(false);
        // Sans -R, le dossier change de propriétaire, pas ce qu'il contient.
        s.executer('sudo chown 1001:1001 /srv/galerie/photos');
        expect(s.termine).toBe(false);
        const fin = ['sudo chown -R 1001:1001 /srv/galerie/photos', 'sudo docker exec galerie-galerie-1 id', 'ps aux', 'curl -s localhost:8082']
          .map((l) => s.executer(l))
          .join('\n');
        expect(fin).toContain('uid=1001 gid=1001 groups=1001');
        expect(fin).toMatch(/^yasmine\s+\d+.*node serveur\.js$/m);
        expect(fin).toContain('14 photos');
        contient(fin, 'Tu as terminé le chapitre 4 de La Fabrique');
        expect(s.termine).toBe(true);
      });

      it('autre solution : docker run -u node, le groupe de Yasmine et chmod -R g+w', () => {
        const { s, tout } = jouer('pleins-pouvoirs', [
          'sudo docker rm -f galerie-galerie-1',
          'fablab-2027',
          'sudo docker run -d --name galerie -u node -p 8082:3000 -v /srv/galerie/photos:/app/photos --restart unless-stopped registre.example/galerie:3.2',
          'sudo chown -R 1000 /srv/galerie/photos',
          'sudo docker exec galerie whoami',
          'ls -l /srv/galerie',
        ]);
        expect(tout).toContain('node');
        expect(tout).toMatch(/drwxr-xr-x vous +vous +4096 photos/);
        contient(tout, "l'uid 1000, c'est toi");
        expect(s.termine).toBe(false);
        s.executer('sudo chgrp -R yasmine /srv/galerie/photos');
        s.executer('sudo chmod -R g+w /srv/galerie/photos');
        expect(s.executer('ls -ln /srv/galerie')).toMatch(/drwxrwxr-x 1000 +1001 +4096 photos/);
        expect(s.termine).toBe(true);
      });

      it("fausses pistes : un nom inconnu de l'image, chmod 777, une photo effacée", () => {
        const { s } = jouer('pleins-pouvoirs', ['cd /srv/galerie', 'sudo id', 'fablab-2027']);
        modifier(s, avecUtilisateur('galerie'));
        const inconnu = s.executer('sudo docker compose up -d') ?? '';
        expect(inconnu).toContain('unable to find user galerie: no matching entries in passwd file');
        contient(inconnu, "DE L'IMAGE");
        modifier(s, (t) => t.replace('user: galerie', 'user: "1001:1001"'));
        s.executer('sudo docker compose up -d');
        const ouvert = s.executer('sudo chmod -R 777 /srv/galerie/photos') ?? '';
        contient(ouvert, 'ouvert en écriture à tous');
        expect(s.executer('sudo docker exec galerie-galerie-1 id')).toContain('uid=1001');
        expect(s.termine).toBe(false);
        const perdu = s.executer('sudo rm /srv/galerie/photos/velo-repare.jpg') ?? '';
        contient(perdu, 'Une photo a disparu');
        s.executer('sudo chmod -R o-w /srv/galerie/photos');
        expect(s.termine).toBe(false);
      });
    });

    describe('La Gazette, chapitre 1 — Le dépôt nu (déployer par git)', () => {
      const editer = (s: Shell, fichier: string, change: (texte: string) => string) => {
        s.executer(`nano ${fichier}`);
        s.enregistrerEdition(change(s.edition!.texte));
        s.quitterEdition();
      };
      const CROCHET = '#!/bin/sh\ngit --work-tree=/var/www/gazette checkout -f main\necho "Site publié"';

      it("solution : la dérive d'abord, un dépôt nu à soi, un crochet exécutable, puis chaque correction par git push", () => {
        const { s, tout } = jouer('depot-nu', ['diff -r gazette /var/www/gazette', 'sudo git init --bare /srv/git/gazette.git', 'gazette-2027']);
        expect(tout).toContain('Seulement dans gazette : fete-des-voisins.html');
        expect(tout).toContain('> <h1>La Gazette du quartier</h1>');
        contient(tout, 'Voilà la correction de Théo');
        expect(tout).toContain('Dépôt Git vide initialisé dans /srv/git/gazette.git/');
        s.executer('sudo chown -R vous:vous /srv/git/gazette.git');
        editer(s, '/srv/git/gazette.git/hooks/post-receive', () => CROCHET);
        s.executer('chmod +x /srv/git/gazette.git/hooks/post-receive');
        s.executer('cd ~/gazette');
        editer(s, 'index.html', (t) => t.replaceAll('Gazzette', 'Gazette'));
        expect(s.executer('git commit -am "Titre : Gazette, sans faute"')).toContain('2 insertions(+), 2 suppressions(-)');
        s.executer('git remote add prod /srv/git/gazette.git');
        const push = s.executer('git push prod main') ?? '';
        expect(push).toContain('remote: Site publié');
        expect(push).toContain(' * [new branch]      main -> main');
        contient(push, 'Mon article est en ligne');
        expect(s.termine).toBe(false);
        editer(s, 'agenda.html', (t) => t.replace('2027-06-21', '2027-06-12').replace('>21 ', '>12 '));
        s.executer('git commit -am "Agenda : le vide-grenier est le 12 juin"');
        const fin = s.executer('git push prod') ?? '';
        expect(fin).toMatch(/ {3}[0-9a-f]{7}\.\.[0-9a-f]{7} {2}main -> main/);
        contient(fin, 'Tu as terminé le chapitre 1 de La Gazette');
        expect(s.executer('curl -s http://gazette.example/agenda.html')).toContain('datetime="2027-06-12"');
        expect(s.termine).toBe(true);
      });

      it('fausses pistes : dépôt à root, crochet non exécutable, checkout sans -f, correction de Théo perdue, retouche sur le serveur', () => {
        const { s } = jouer('depot-nu', [
          'sudo git init --bare /srv/git/gazette.git',
          'gazette-2027',
          'cd ~/gazette',
          'git remote add prod /srv/git/gazette.git',
        ]);
        const root = s.executer('git push prod main') ?? '';
        expect(root).toContain('error: droits insuffisants pour ajouter un objet');
        expect(root).toContain(' ! [remote rejected] main -> main (unpacker error)');
        contient(root, 'il appartient à root');
        s.executer('sudo chown -R vous: /srv/git/gazette.git');
        contient(s.executer('git push prod main') ?? '', 'rien ne les extrait');
        editer(s, '/srv/git/gazette.git/hooks/post-receive', () => '#!/bin/sh\ngit --work-tree=/var/www/gazette checkout main');
        s.executer('git rm style.css');
        s.executer('git commit -m "Sans style"');
        contient(s.executer('git push prod main') ?? '', "il n'est pas exécutable");
        s.executer('chmod +x /srv/git/gazette.git/hooks/post-receive');
        s.executer('git restore --source=HEAD~1 style.css');
        s.executer('git add style.css');
        s.executer('git commit -m "Le style revient"');
        const sansF = s.executer('git push prod main') ?? '';
        expect(sansF).toContain("remote: error: Les fichiers suivants non suivis de la copie de travail seraient écrasés par l'extraction :");
        contient(sansF, 'Avec -f (force)');
        editer(s, '/srv/git/gazette.git/hooks/post-receive', (t) => t.replace('checkout main', 'checkout -f main'));
        editer(s, 'agenda.html', (t) => t.replace('8 h', '9 h'));
        s.executer('git commit -am "Ouverture à 9 h"');
        contient(s.executer('git push prod main') ?? '', 'La correction de Théo a disparu');
        // Corriger l'agenda sur le serveur, sans git : refusé.
        s.executer('echo \'<time datetime="2027-06-12">\' > /var/www/gazette/agenda.html');
        expect(s.termine).toBe(false);
      });
    });

    describe('La Gazette, chapitre 2 — Le retour arrière (versions, lien current, tests)', () => {
      const crochet = (s: Shell, change: (texte: string) => string) => {
        s.executer('nano /srv/git/gazette.git/hooks/post-receive');
        s.enregistrerEdition(change(s.edition!.texte));
        return s.quitterEdition();
      };
      const AVEC_TESTS = (t: string) => t.replace('ln -sfn', 'cd /srv/gazette/releases/$VERSION\nsh tests.sh\nln -sfn');
      const publierTheo = (s: Shell) =>
        [
          'cd ~/gazette',
          'git pull prod main',
          'mv accueil.html index.html',
          'git add .',
          'git commit -m "Accueil : index.html"',
          'git push prod main',
        ]
          .map((l) => s.executer(l))
          .join('\n');

      it("solution : ln -sfn vers la version d'avant, tests.sh dans le crochet avant de basculer, puis la mise en page réparée", () => {
        const { s, tout } = jouer('retour-arriere', [
          'curl -I http://gazette.example/',
          'ls -l /srv/gazette',
          'cd /srv/gazette',
          'ln -sfn releases/20270514101502 current',
        ]);
        expect(tout).toContain('HTTP/1.1 403 Forbidden');
        expect(tout).toContain('current -> /srv/gazette/releases/20270517203012');
        contient(tout, "nginx sert /srv/gazette/current, mais n'y trouve pas");
        contient(tout, 'Le site répond de nouveau');
        expect(s.executer('readlink -f /srv/gazette/current')).toBe('/srv/gazette/releases/20270514101502');
        const theo = crochet(s, AVEC_TESTS);
        expect(theo).toContain("remote: Vérification de la page d'accueil (index.html)...");
        expect(theo).not.toContain('en ligne');
        contient(theo, "le crochet s'est arrêté avant de basculer current");
        expect(s.termine).toBe(false);
        const fin = publierTheo(s);
        expect(fin).toContain('Avance rapide');
        expect(fin).toContain('remote: Tests OK');
        expect(fin).toMatch(/remote: Version \d{14} en ligne/);
        contient(fin, 'Tu as terminé le chapitre 2 de La Gazette');
        expect(s.executer('curl -s http://gazette.example/')).toContain('class="une"');
        expect(s.termine).toBe(true);
      });

      it('fausses pistes : ln sans -n, tests après la bascule, tests lancés depuis le dépôt', () => {
        const { s, tout } = jouer('retour-arriere', ['cd /srv/gazette', 'ln -sf releases/20270514101502 current', 'curl -I http://gazette.example/']);
        contient(tout, 'Le nouveau lien a été créé DANS la version cassée');
        expect(tout).toContain('HTTP/1.1 403 Forbidden');
        s.executer('ln -sfn /srv/gazette/releases/20270514101502 /srv/gazette/current');
        // Les tests après la bascule : trop tard, la version de Théo est en ligne.
        const trop = crochet(s, (t) => t.replace('echo', 'sh tests.sh\necho'));
        contient(trop, 'Le push cassé de Théo est passé en ligne');
        expect(s.executer('curl -I http://gazette.example/')).toContain('403 Forbidden');
        s.executer('ln -sfn /srv/gazette/releases/20270514101502 /srv/gazette/current');
        // Avant la bascule, mais depuis le dépôt : tout est refusé, même une bonne version.
        crochet(s, (t) => t.replace('sh tests.sh\necho', 'echo').replace('ln -sfn', 'sh tests.sh\nln -sfn'));
        contient(publierTheo(s), 'tests.sh cherche index.html dans le lieu');
        expect(s.termine).toBe(false);
      });
    });

    describe('La Gazette, chapitre 3 — Bleu et vert (déployer sans coupure)', () => {
      const editer = (s: Shell, fichier: string, change: (texte: string) => string) => {
        s.executer(`sudo nano ${fichier}`);
        s.enregistrerEdition(change(s.edition!.texte));
        return s.quitterEdition();
      };
      const VERS_VERT = (t: string) => t.replace('127.0.0.1:3001', '127.0.0.1:3002');
      const SMTP = (t: string) => `${t}\nKIOSQUE_SMTP=smtp.gazette.example`;

      it('solution : la 1.5.0 sur vert, /health, la configuration des notes, puis nginx bascule et bleu reste allumé', () => {
        const { s, tout } = jouer('bleu-vert', [
          'curl -s http://localhost:3001/health',
          'ln -sfn /srv/kiosque/versions/1.5.0 /srv/kiosque/vert',
          'sudo systemctl start kiosque-vert',
          'gazette-2027',
          'curl -s localhost:3002/health',
          'cat /srv/kiosque/versions/1.5.0/NOTES.txt',
        ]);
        expect(tout).toContain('{"status":"ok","version":"1.4.2"}');
        expect(tout).toContain('{"status":"error","version":"1.5.0","error":"KIOSQUE_SMTP is not set"}');
        contient(tout, '/health répond 503');
        editer(s, '/etc/kiosque/kiosque.env', SMTP);
        const sante = ['sudo systemctl restart kiosque-vert', 'curl -i localhost:3002/health'].map((l) => s.executer(l)).join('\n');
        expect(sante).toContain('HTTP/1.1 200 OK');
        expect(sante).toContain('{"status":"ok","version":"1.5.0"}');
        editer(s, '/etc/nginx/sites-available/gazette', VERS_VERT);
        const fin = ['sudo nginx -t', 'sudo systemctl reload nginx'].map((l) => s.executer(l)).join('\n');
        expect(fin).toContain('test is successful');
        contient(fin, 'Tu as terminé le chapitre 3 de La Gazette');
        expect(s.executer('curl -s http://gazette.example/kiosque/')).toContain('Kiosque 1.5.0');
        expect(s.termine).toBe(true);
      });

      it('fausses pistes : sans redémarrer, bascule avant /health, sans reload, puis bleu arrêté trop tôt', () => {
        const { s, tout } = jouer('bleu-vert', [
          'sudo systemctl start kiosque-vert',
          'gazette-2027',
          'ln -sfn /srv/kiosque/versions/1.5.0 /srv/kiosque/vert',
          'curl -s localhost:3002/health',
        ]);
        contient(tout, 'un programme lit son code');
        s.executer('sudo systemctl restart kiosque-vert');
        editer(s, '/etc/nginx/sites-available/gazette', VERS_VERT);
        contient(s.executer('curl -s http://gazette.example/kiosque/') ?? '', 'il ne relit sa configuration');
        contient(s.executer('sudo systemctl reload nginx') ?? '', 'les lecteur·rices reçoivent une erreur');
        expect(s.executer('curl -s http://gazette.example/kiosque/')).toBe('Internal Server Error');
        editer(s, '/etc/kiosque/kiosque.env', SMTP);
        s.executer('sudo systemctl restart kiosque-vert');
        expect(s.termine).toBe(true);
        // Une fois la bascule faite, arrêter bleu enlève le filet.
        contient(s.executer('sudo systemctl stop kiosque-bleu') ?? '', 'plus de retour arrière instantané');
      });
    });

    describe('La Gazette, chapitre 4 — Le canari (upstream, weight, access.log)', () => {
      const site = (s: Shell, change: (texte: string) => string) => {
        s.executer('sudo nano /etc/nginx/sites-available/gazette');
        s.enregistrerEdition(change(s.edition!.texte));
        return s.quitterEdition();
      };
      const CANARI = (t: string) =>
        `upstream kiosque {\n    server 127.0.0.1:3002 weight=9;\n    server 127.0.0.1:3001 weight=1;\n}\n\n${t.replace('http://127.0.0.1:3002/', 'http://kiosque/')}`;
      const recharger = (s: Shell) => ['sudo nginx -t', 'sudo systemctl reload nginx'].map((l) => s.executer(l)).join('\n');

      it('solution : canari de la 1.6.0, les 500 dans access.log, arrêt, 1.6.1, canari propre, bascule', () => {
        const { s } = jouer('canari', [
          'ln -sfn /srv/kiosque/versions/1.6.0 /srv/kiosque/bleu',
          'sudo systemctl restart kiosque-bleu',
          'gazette-2027',
        ]);
        expect(s.executer('curl -s localhost:3001/health')).toBe('{"status":"ok","version":"1.6.0"}');
        site(s, CANARI);
        const heure = recharger(s);
        contient(heure, '60 visites sur le Kiosque');
        contient(heure, 'Le canari est en place');
        expect(s.executer("awk '{print $9}' /var/log/nginx/access.log | sort | uniq -c")).toMatch(/\s+\d+ 500/);
        const erreurs = s.executer('grep " 500 " /var/log/nginx/access.log') ?? '';
        expect(erreurs).toContain('"GET /kiosque/archives HTTP/1.1" 500');
        contient(erreurs, 'Des 500 sur /kiosque/archives');
        expect(s.executer('curl -s localhost:3001/archives')).toBe('Internal Server Error');
        site(s, (t) => t.replace('3001 weight=1;', '3001 weight=1 down;'));
        contient(recharger(s), 'Canari arrêté');
        s.executer('ln -sfn /srv/kiosque/versions/1.6.1 /srv/kiosque/bleu');
        s.executer('sudo systemctl restart kiosque-bleu');
        site(s, (t) => t.replace(' down;', ';'));
        contient(recharger(s), 'aucune erreur dans ce lot');
        expect(s.termine).toBe(false);
        site(s, (t) => t.replace('3002 weight=9;', '3002 weight=9 down;'));
        contient(recharger(s), 'Tu as terminé le chapitre 4 de La Gazette');
        expect(s.executer('curl -s http://gazette.example/kiosque/')).toContain('Kiosque 1.6.1');
        expect(s.termine).toBe(true);
      });

      it("fausses pistes : tout d'un coup sur la 1.6.0, puis un « canari » à 50 %", () => {
        const { s } = jouer('canari', [
          'ln -sfn /srv/kiosque/versions/1.6.0 /srv/kiosque/bleu',
          'sudo systemctl restart kiosque-bleu',
          'gazette-2027',
        ]);
        site(s, (t) => t.replace('127.0.0.1:3002/', '127.0.0.1:3001/'));
        contient(recharger(s), "Tout le trafic est passé d'un coup à la 1.6.0");
        site(
          s,
          (t) =>
            `upstream kiosque {\n    server 127.0.0.1:3002;\n    server 127.0.0.1:3001;\n}\n\n${t.replace('http://127.0.0.1:3001/', 'http://kiosque/')}`,
        );
        contient(recharger(s), 'Une grosse part du trafic');
        expect(s.termine).toBe(false);
      });
    });

    describe('La Gazette, chapitre 5 — La migration (réparer en avant)', () => {
      const editer = (s: Shell, fichier: string, change: (texte: string) => string) => {
        s.executer(`sudo nano ${fichier}`);
        s.enregistrerEdition(change(s.edition!.texte));
        return s.quitterEdition();
      };
      const SMTP_URL = (t: string) => `${t}\nKIOSQUE_SMTP_URL=smtp://smtp.gazette.example:587`;

      it('solution : le journal raconte la migration, la variable renommée, puis bleu en 2.0.0', () => {
        const { s, tout } = jouer('migration', [
          'curl -s localhost:3002/health',
          'curl -s localhost:3001/health',
          'sudo journalctl -u kiosque-vert',
          'gazette-2027',
        ]);
        expect(tout).toContain('"error":"KIOSQUE_SMTP_URL is not set"');
        expect(tout).toContain('"error":"database schema 4 is newer than supported (3)"');
        expect(tout).toContain('Running migration 004_rename_abonnes_courriel_to_email... done');
        contient(tout, 'il reste à réparer en avant');
        editer(s, '/etc/kiosque/kiosque.env', SMTP_URL);
        contient(s.executer('sudo systemctl restart kiosque-vert') ?? '', 'Le Kiosque répond de nouveau');
        expect(s.termine).toBe(false);
        s.executer('ln -sfn /srv/kiosque/versions/2.0.0 /srv/kiosque/bleu');
        contient(s.executer('sudo systemctl restart kiosque-bleu') ?? '', 'Tu as terminé le chapitre 5 de La Gazette');
        expect(s.executer('curl -s localhost:3001/health')).toBe('{"status":"ok","version":"2.0.0"}');
        expect(s.termine).toBe(true);
      });

      it('fausse piste : revenir sur bleu (1.6.1) ne répare rien, la base a changé', () => {
        const { s } = jouer('migration', ['sudo id', 'gazette-2027']);
        const retour = editer(s, '/etc/nginx/sites-available/gazette', (t) => t.replace('127.0.0.1:3002/', '127.0.0.1:3001/'));
        const recharge = (s.executer('sudo systemctl reload nginx') ?? '') + retour;
        contient(recharge, 'la base a été migrée sous ses pieds');
        expect(s.executer('curl -s http://gazette.example/kiosque/')).toBe('Internal Server Error');
        expect(s.termine).toBe(false);
      });
    });

    describe('La Ludothèque, chapitre 1 — La rançon (rançongiciel, sauvegarde hors ligne)', () => {
      const RESTIC = 'sudo restic -r /mnt/cle/depot';
      const MDP = 'pion-cavalier-tour-27';

      it('solution : arrêter le chiffreur et sa crontab, verrouiller le compte, restaurer depuis la clé en lecture seule, la démonter', () => {
        const { s, tout } = jouer('rancon', [
          'find /srv/partage -name "*.locked" | wc -l',
          'ps aux',
          'sudo kill 3141',
          'ludo-2027',
          'sudo crontab -u accueil -l',
          'sudo crontab -u accueil -r',
          'sudo usermod -L accueil',
          'sudo journalctl -u ssh',
          'ls /mnt/nas/partage',
          'lsblk -f',
          'sudo mount -o ro /dev/sdb1 /mnt/cle',
          'touch /mnt/cle/essai',
          `${RESTIC} snapshots`,
          MDP,
          `${RESTIC} restore latest --target /`,
          MDP,
        ]);
        expect(tout).toMatch(/^6$/m);
        expect(tout).toContain('accueil      3141  97.3   1.4 /home/accueil/.cache/.maj/maj-systeme --silencieux');
        expect(tout).toContain('*/10 * * * * /home/accueil/.cache/.maj/maj-systeme --silencieux');
        expect(tout).toContain('Accepted password for accueil from 203.0.113.66');
        expect(tout).toContain('SAUVEGARDE');
        expect(tout).toContain('touch: /mnt/cle/essai: Système de fichiers accessible en lecture seulement');
        expect(tout).toContain('Summary: Restored 6 files/dirs');
        contient(tout, 'On ne paie pas');
        contient(tout, "Une copie synchronisée, toujours branchée, n'est pas une sauvegarde");
        contient(tout, 'Les six fichiers sont revenus');
        expect(s.termine).toBe(false);
        const fin = [
          'sudo find /srv/partage -name "*.locked" -delete',
          'sudo find /srv/partage -name LISEZ-MOI-POUR-RECUPERER.txt -delete',
          'sudo umount /mnt/cle',
        ]
          .map((l) => s.executer(l))
          .join('\n');
        contient(fin, 'Tu as terminé le chapitre 1 de La Ludothèque');
        expect(s.executer('cat /srv/partage/regles/dames.txt')).toContain('devient une dame');
        expect(s.termine).toBe(true);
      });

      it("fausses pistes : restaurer avant d'arrêter le chiffreur, l'oublier dans la crontab, démonter depuis dedans", () => {
        const { s, tout } = jouer('rancon', [
          'sudo mount /dev/sdb1 /mnt/cle',
          'ludo-2027',
          `${RESTIC} restore latest --target /`,
          MDP,
          'ls /srv/partage',
        ]);
        contient(tout, 'le disque de sauvegarde est branché alors que le chiffreur tourne encore');
        contient(tout, "Des fichiers restaurés viennent d'être chiffrés à leur tour");
        expect(tout).not.toMatch(/inventaire\.csv(?!\.locked)/);
        // Arrêté, mais sa crontab le relance.
        const retour = ['sudo kill 3141', 'ls', 'ls', 'ls'].map((l) => s.executer(l)).join('\n');
        contient(retour, 'Le chiffreur est revenu');
        expect(s.executer('ps aux')).toContain('maj-systeme');
        s.executer('cd /mnt/cle');
        expect(s.executer('sudo umount /mnt/cle')).toBe('umount: /mnt/cle: target is busy.');
        expect(s.termine).toBe(false);
      });
    });

    describe('La Ludothèque, chapitre 2 — Les instantanés (rsnapshot, liens physiques, cron)', () => {
      const editer = (s: Shell, commande: string, change: (texte: string) => string) => {
        s.executer(commande);
        s.enregistrerEdition(change(s.edition!.texte));
        return s.quitterEdition();
      };
      const REGLAGES = (t: string) =>
        t
          .replace('snapshot_root\t/var/cache/rsnapshot/', 'snapshot_root\t/mnt/instantanes/')
          .replace('retain\talpha\t6\nretain\tbeta\t7\nretain\tgamma\t4', 'retain\tdaily\t7\nretain\tweekly\t4')
          .replace('backup\t/home/\t\tlocalhost/\nbackup\t/etc/\t\tlocalhost/\nbackup\t/usr/local/\tlocalhost/', 'backup\t/srv/partage/\tlocalhost/');
      const CRON = (t: string) => `${t}0 3 * * 1 /usr/bin/rsnapshot weekly\n30 3 * * * /usr/bin/rsnapshot daily\n`;
      const D = '/mnt/instantanes';

      it("solution : la configuration (tabulations), configtest, cron de root, puis l'inventaire de la veille", () => {
        const { s } = jouer('instantanes', ['sudo rsnapshot configtest', 'ludo-2027']);
        editer(s, 'sudo nano /etc/rsnapshot.conf', REGLAGES);
        expect(s.executer('sudo rsnapshot configtest')).toBe('Syntax OK');
        expect(s.executer('sudo rsnapshot -t daily')).toContain(
          `/usr/bin/rsync -a --delete --numeric-ids --relative --delete-excluded /srv/partage/ ${D}/daily.0/localhost/`,
        );
        const semaines = editer(s, 'sudo crontab -e', CRON);
        contient(semaines, 'Deux semaines passent');
        contient(semaines, "Hier soir, j'ai remplacé l'inventaire");
        expect(s.executer(`ls ${D}`)).toBe('daily.0/    daily.1/    daily.2/    daily.3/    daily.4/    daily.5/    daily.6/    weekly.0/');
        const du = s.executer('sudo rsnapshot du') ?? '';
        expect(du).toMatch(/^46M\t\/mnt\/instantanes\/daily\.0\/$/m);
        expect(du).toMatch(/^\d+K?\t\/mnt\/instantanes\/daily\.1\/$/m);
        const inodes =
          s.executer(`ls -i ${D}/daily.0/localhost/srv/partage/regles/scans-regles.pdf ${D}/daily.6/localhost/srv/partage/regles/scans-regles.pdf`) ??
          '';
        const [a, b] = inodes.split('\n\n').map((l) => l.trim().split(' ')[0]);
        expect(a).toBe(b);
        expect(s.executer(`diff ${D}/daily.0/localhost/srv/partage/inventaire.csv ${D}/daily.1/localhost/srv/partage/inventaire.csv`)).toContain(
          '> jeu offert n°13;1;neuf',
        );
        expect(s.termine).toBe(false);
        contient(
          s.executer(`sudo cp ${D}/daily.1/localhost/srv/partage/inventaire.csv /srv/partage/`) ?? '',
          'Tu as terminé le chapitre 2 de La Ludothèque',
        );
        expect(s.termine).toBe(true);
      });

      it("fausses pistes : des espaces au lieu de tabulations, la crontab d'un compte ordinaire, la version de cette nuit", () => {
        const { s } = jouer('instantanes', ['sudo id', 'ludo-2027']);
        editer(s, 'sudo nano /etc/rsnapshot.conf', (t) => REGLAGES(t).replace('snapshot_root\t/mnt/instantanes/', 'snapshot_root /mnt/instantanes/'));
        const erreur = s.executer('sudo rsnapshot configtest') ?? '';
        expect(erreur).toContain('ERROR: snapshot_root /mnt/instantanes/ - Unknown config directive');
        expect(erreur).toContain("ERROR: sure you don't have spaces where only tabs should be.");
        contient(erreur, 'jamais par des espaces');
        editer(s, 'sudo nano /etc/rsnapshot.conf', (t) => t.replace('snapshot_root /mnt/instantanes/', 'snapshot_root\t/mnt/instantanes/'));
        const mails = editer(s, 'crontab -e', CRON);
        contient(mails, "n'a pas les droits de root");
        expect(s.executer(`ls ${D}`)).toBe('');
        expect(s.termine).toBe(false);
      });
    });

    describe.runIf(reference)('Le manuel, premier réflexe', () => {
      const s = new Shell(chapitre('eveil'), langue);
      it('man affiche une vraie page', () => {
        const page = s.executer('man ls')!;
        for (const section of ['NOM', 'SYNOPSIS', 'DESCRIPTION', 'OPTIONS', 'EXEMPLES', 'VOIR AUSSI']) expect(page).toContain(section);
      });
      it('--help, man -k, whatis', () => {
        expect(s.executer('ls --help')).toContain('Utilisation : ls');
        expect(s.executer('man -k copie')).toContain('cp (1)');
        expect(s.executer('whatis mv')).toMatch(/^mv \(1\)/);
      });
      it('option inconnue : le vrai message', () => {
        expect(s.executer('ls -z')).toBe("ls : option invalide -- 'z'\nSaisissez « ls --help » pour plus d'informations.");
      });
      it('messages de man-db', () => {
        expect(s.executer('man')).toContain('Quelle page de manuel voulez-vous ?');
        expect(s.executer('man xyz')).toBe("Il n'y a pas de page de manuel pour xyz.");
      });
      it('chaque commande du jeu a une page', () => {
        for (const h of HISTOIRES) for (const c of h.chapitres) for (const cmd of c.commandes) expect(s.executer(`man ${cmd}`)).toContain('NOM');
      });
    });
    it('chaque commande du jeu a une page de manuel', () => {
      const s = new Shell(chapitre('eveil'), langue);
      for (const h of HISTOIRES)
        for (const c of h.chapitres)
          for (const cmd of c.commandes) expect(s.executer(`man ${cmd}`)).toMatch(new RegExp(`^${cmd.toUpperCase()}\\([18]\\)`));
    });
  });
