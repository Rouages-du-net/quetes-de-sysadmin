// Chaque chapitre est rejoué jusqu'au bout (solution attendue), avec des
// fausses pistes en chemin : le moteur doit les refuser sans bloquer la
// partie. Les parties sont rejouées dans chaque langue disponible ; les
// textes attendus, eux, sont vérifiés en français (langue de référence).

import { describe, expect, it } from 'vitest';
import { Shell } from '../src/moteur/shell';
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
