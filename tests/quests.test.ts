// Chaque chapitre est rejoué jusqu'au bout (solution attendue), avec des
// fausses pistes en chemin : le moteur doit les refuser sans bloquer la
// partie. Les parties sont rejouées dans chaque langue disponible ; les
// textes attendus, eux, sont vérifiés en français (langue de référence).

import { describe, expect, it } from 'vitest';
import { machineName } from '../src/engine/machines';
import { Shell } from '../src/engine/shell';
import { Console } from '../src/engine/console';
import { STORIES } from '../src/engine/chapters';
import { prerequisites } from '../src/engine/unlocking';
import { LANGUAGES, translator, typography } from '../src/texts';
import { clean } from '../src/engine/world';
import { inLanguage, machinesInLanguage } from './names';
import { withoutColours } from '../src/engine/colours';

const chapter = (id: string) => STORIES.flatMap((h) => h.chapters).find((c) => c.id === id)!;

for (const language of LANGUAGES)
  describe(`Langue : ${language}`, () => {
    const reference = language === 'fr';
    // Une ligne écrite avec les noms français, dans la langue de la partie.
    const L = (line: string) => inLanguage(translator(language), line);
    // Un texte attendu, vérifié seulement dans la langue de référence.
    const contains = (all: string, text: string) => {
      if (reference) expect(all).toContain(text);
    };

    function play(id: string, commands: string[]) {
      const s = new Shell(chapter(id), language);
      // Dans la langue de référence, la partie se joue avec les couleurs, comme
      // dans l'interface : les événements doivent les ignorer (voir couleurs.ts).
      // Les sorties comparées ici sont lues sans les couleurs.
      s.colours = reference;
      const execute = s.execute.bind(s);
      s.execute = (line: string) => {
        const output = execute(line);
        return output === null ? null : withoutColours(output);
      };
      const outputs = ['cat ' + s.welcome, ...commands].map((c) => s.execute(chapter(id).names ? L(c) : c) ?? '');
      return { s, outputs, tout: outputs.join('\n') };
    }

    describe('L’Effaceur', () => {
      it('chapitre 1 — L’Île du Phare', () => {
        const { s, tout: all } = play('lighthouse', [
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
        contains(all, 'Un énorme filet emmêlé bloque la porte du Phare');
        contains(all, 'ne s’appelle pas exactement ampoule');
        expect(s.finished).toBe(true);
      });

      it('chapitre 1 — l’ampoule portée et renommée d’un coup', () => {
        const { s } = play('lighthouse', [
          'mv Jetee/filet Port/Hangar',
          'cd Port/Remise',
          'mv .ampoule_de_secours ~/Jetee/Phare/Escalier/Lanterne/ampoule',
        ]);
        expect(s.finished).toBe(true);
      });

      it('chapitre 2 — Le Bourg', () => {
        const { s, tout: all } = play('village', [
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
        contains(all, 'La porte des Archives est fermée à clé');
        contains(all, '« Pas mon dernier levain ! »');
        contains(all, 'La barricade est trop lourde pour mv');
        contains(all, 'l’Effaceur a effacé ma Classe');
        expect(s.finished).toBe(true);
      });

      it('chapitre 3 — La Racine', () => {
        const { s, tout: all } = play('root', [
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
        contains(all, 'Permission non accordée');
        contains(all, 'Désolé, essayez de nouveau.');
        contains(all, 'cd : commande introuvable');
        expect(s.finished).toBe(true);
      });
    });

    describe('L’Effaceur, chapitre 4 — La Sauvegarde', () => {
      // crontab -e : écrire la crontab dans l'éditeur, puis la fermer.
      const crontab = (s: Shell, change: (text: string) => string) => {
        s.execute('crontab -e');
        s.saveEdition(change(s.edition!.text));
        return s.quitEdition();
      };

      it('solution : rsync, crontab, la nuit, la restauration', () => {
        const { s, tout: all } = play('backup', [
          'cat mot_de_maelle.txt',
          'rsync souvenirs /mnt/sauvegarde',
          'rsync -av ~/souvenirs/ /mnt/sauvegarde/souvenirs/',
          'crontab -l',
        ]);
        expect(all).toContain(L('skipping directory souvenirs'));
        expect(all).toContain('sending incremental file list');
        expect(all).toContain(L('no crontab for vous'));
        contains(all, 'Demande à cron de la refaire chaque nuit');
        const error = crontab(s, (t) => t + L('15 25 * * * rsync -a ~/souvenirs/ /mnt/sauvegarde/souvenirs/\n'));
        expect(error).toContain('"/tmp/crontab.Zx81Ab/crontab":24: bad hour');
        expect(error).toContain("errors in crontab file, can't install.");
        const night = crontab(s, (t) => t + L('15 3 * * * rsync -a ~/souvenirs/ /mnt/sauvegarde/souvenirs/\n'));
        expect(night).toContain('crontab: installing new crontab');
        contains(night, 'fete-du-phare.txt y est, sans que tu aies rien tapé');
        expect(s.exists(L('/mnt/sauvegarde/souvenirs/fete-du-phare.txt'))).toBe(true);
        expect(s.exists(L('/home/vous/souvenirs/premiere-lettre.txt'))).toBe(false);
        s.execute(L('rsync -av /mnt/sauvegarde/souvenirs/premiere-lettre.txt ~/souvenirs/'));
        expect(s.finished).toBe(true);
      });

      it('une autre solution : @daily, copie dans un dossier, restauration avec cp', () => {
        const s = new Shell(chapter('backup'), language);
        crontab(s, (t) => t + L('@daily rsync -a souvenirs /mnt/sauvegarde/\n'));
        expect(s.flags.has('nuit-ok')).toBe(true);
        s.execute(L('cp /mnt/sauvegarde/souvenirs/premiere-lettre.txt souvenirs/'));
        expect(s.finished).toBe(true);
      });

      it('fausses pistes : une tâche qui ne tourne pas la nuit, une tâche fausse, --delete après l’effacement', () => {
        const s = new Shell(chapter('backup'), language);
        const nothing = crontab(s, (t) => t + L('0 12 * * * rsync -a ~/souvenirs/ /mnt/sauvegarde/souvenirs/\n'));
        contains(nothing, 'aucune tâche de ta crontab ne tombait cette nuit');
        const mail = crontab(s, (t) => t.replace('0 12', '0 2').replace(L('~/souvenirs/'), L('~/souvenirs/').replace(/s\/$/, '/')));
        expect(mail).toContain(L(`rsync: [sender] link_stat "${L('/home/vous/souvenirs').replace(/s$/, '')}" failed: No such file or directory (2)`));
        crontab(s, (t) => t.replace(L('~/souvenirs/').replace(/s\/$/, '/'), L('~/souvenirs/')));
        expect(s.flags.has('nuit-ok')).toBe(true);
        const perdu = s.execute(L('rsync -a --delete ~/souvenirs/ /mnt/sauvegarde/souvenirs/'))!;
        contains(perdu, 'de la sauvegarde aussi');
        expect(s.finished).toBe(false);
      });
    });

    describe('Autres histoires', () => {
      it('Le Datacenter', () => {
        const L = '/var/log/nginx/access.log';
        const { s } = play('first-day', [
          'cat notes_awa.txt',
          `grep " 503 " ${L} | wc -l`,
          `cut -d " " -f 1 ${L} | sort | uniq -c | sort -n | tail -3`,
          'ps aux',
          'kill 4242',
          'sudo kill 4242',
          'bienvenue-2026',
          `echo "deny 198.51.100.77;" | sudo tee -a /etc/nginx/blocked.conf`,
          'sudo systemctl reload nginx',
          'ps aux',
          'sudo kill 4244',
          `grep " 503 " ${L} | wc -l > ~/rapport.txt`,
          'echo "Coupable : 198.51.100.77" >> rapport.txt',
        ]);
        expect(s.finished).toBe(true);
      });

      it('Le Datacenter — fausses pistes : tout lire, grep sans compter, les adresses sans les regrouper', () => {
        const J = '/var/log/nginx/access.log';
        const tr = translator(language);
        // Le texte tel que le jeu l'affiche (paragraphes recollés, typographie de la langue).
        const t = (id: string, v?: Record<string, string>) => typography(clean(tr(id, v)), language);
        const { s, outputs } = play('first-day', [
          `cat ${J}`,
          `grep " 503 " ${J}`,
          `grep " 503 " ${J} | wc -l`,
          `cut -d " " -f 1 ${J}`,
          `cut -d " " -f 1 ${J} | sort | uniq -c | sort -n | tail -3`,
        ]);
        // Chaque piste trop longue renvoie aux notes d'Awa, sans donner la commande ; la bonne passe ensuite.
        expect(outputs[1]).toContain(t('first-day-evenement-tout-lire'));
        expect(outputs[2]).toContain(t('first-day-evenement-grep-seul'));
        expect(outputs[3]).toContain(t('first-day-evenement-compte', { erreurs: outputs[3].split('\n')[0] }).slice(0, 12));
        expect(outputs[4]).toContain(t('first-day-evenement-adresses-seules'));
        expect(s.flags.has('robot')).toBe(true);
        // Une fois le compte fait, relire le journal ne redit rien.
        expect(s.execute(`cat ${J}`)).not.toContain(t('first-day-evenement-tout-lire'));
      });

      it('Le Datacenter, chapitre 2 — Deuxième jour', () => {
        const { s, tout: all } = play('second-day', [
          'id',
          'id malo',
          'ls -l /var/log/nginx',
          'cat /home/malo/x',
          'usermod -aG adm malo',
          'sudo usermod -G adm malo',
          'bienvenue-2026',
          'groups malo',
          'sudo usermod -aG web-team malo',
          'sudo chmod o+r /var/log/nginx/access.log',
          'sudo chmod 640 /var/log/nginx/access.log',
          'chgrp web-team /srv/equipe',
          'sudo chmod 777 /srv/equipe',
          'sudo chgrp web-team /srv/equipe',
          'sudo chmod 770 /srv/equipe',
        ]);
        contains(all, 'uid=1000(vous) gid=1000(vous) groupes=1000(vous),4(adm),27(sudo),1003(web-team)');
        contains(all, '-rw-r----- www-data adm');
        contains(all, 'usermod : Permission non accordée.');
        contains(all, 'malo : malo adm');
        contains(all, 'Malo n’est plus dans le groupe web-team'.replace('’', "'"));
        contains(all, 'TOUS les comptes de la machine peuvent lire');
        contains(all, "chgrp : modification du groupe de '/srv/equipe' : Opération non permise");
        contains(all, 'n’importe quel compte'.replace('’', "'"));
        contains(all, 'https://wiki.debian.org/SystemGroups');
        expect(s.finished).toBe(true);
      });

      it('Le Datacenter, chapitre 2 — une autre solution correcte', () => {
        const { s } = play('second-day', [
          'sudo usermod -aG adm malo',
          'bienvenue-2026',
          'sudo chown root:web-team /srv/equipe',
          'sudo chmod g+w,o-rx /srv/equipe',
        ]);
        expect(s.finished).toBe(true);
      });

      it('Le Datacenter, chapitre 3 — La nuit du redémarrage', () => {
        const { s, tout: all } = play('reboot-night', [
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
        contains(all, '× catalogue.service');
        contains(all, 'Loaded: loaded (/usr/lib/systemd/system/nginx.service; disabled; preset: enabled)');
        contains(all, 'failed to open error_log (/var/log/catalogue/error.log): Permission denied (13)');
        contains(all, 'Failed to start nginx.service: Access denied');
        contains(all, 'Job for catalogue.service failed because the control process exited with error code.');
        contains(all, 'n’importe quel compte peut maintenant écrire'.replace('’', "'"));
        contains(all, 'systemctl start ne vaut que jusqu');
        contains(all, 'Created symlink /etc/systemd/system/multi-user.target.wants/nginx.service');
        contains(all, 'https://www.freedesktop.org/software/systemd/man/latest/journalctl.html');
        expect(s.finished).toBe(true);
      });

      it('Le Datacenter, chapitre 3 — une autre solution correcte', () => {
        const { s } = play('reboot-night', [
          'sudo chown -R www-data:www-data /var/log/catalogue',
          'bienvenue-2026',
          'sudo systemctl enable nginx',
          'sudo reboot',
          'systemctl status nginx catalogue',
        ]);
        expect(s.finished).toBe(true);
      });

      it('Le Datacenter, chapitre 3 — réparer sans redémarrer ne suffit pas', () => {
        const { s } = play('reboot-night', [
          'sudo chown www-data: /var/log/catalogue',
          'bienvenue-2026',
          'sudo systemctl enable --now nginx',
          'sudo systemctl restart catalogue',
          'systemctl --failed',
        ]);
        expect(s.finished).toBe(false);
      });

      it('Le Datacenter, chapitre 4 — Le grand incendie', () => {
        const { s, tout: all } = play('fire', [
          'cat /mnt/sauvegarde/PRA.txt',
          // Fausse piste : une machine neuve ne connaît encore aucun paquet.
          'sudo apt install nginx',
          'bienvenue-2026',
          'sudo apt update',
          'sudo apt install nginx',
          'y',
          'curl http://localhost',
          // Fausse piste : l'archive de cette nuit a été coupée par le feu.
          'tar -tzf /mnt/sauvegarde/medialibrary-2026-10-23.tar.gz',
          'tar -tzf /mnt/sauvegarde/medialibrary-2026-10-22.tar.gz',
          'sudo tar -xzf /mnt/sauvegarde/medialibrary-2026-10-22.tar.gz -C /',
          // Fausse piste : deux sites « default_server » sur le port 80.
          'sudo nginx -t',
          'sudo systemctl reload nginx',
          'sudo rm /etc/nginx/sites-enabled/default',
          'sudo nginx -t',
          'sudo systemctl reload nginx',
          'curl http://medialibrary.example',
        ]);
        expect(all).toContain('Error: Unable to locate package nginx');
        expect(all).toContain('Welcome to nginx!');
        expect(all).toContain('a duplicate default server for 0.0.0.0:80 in /etc/nginx/sites-enabled/medialibrary:2');
        expect(all).toContain('Job for nginx.service failed');
        expect(all).toContain('test is successful');
        contains(all, 'Une machine neuve ne connaît encore aucun paquet');
        contains(all, 'Fin de fichier inattendue');
        contains(all, 'le feu a pris');
        contains(all, 'tant que la nouvelle configuration est refusée');
        contains(all, 'Vacances de la Toussaint');
        expect(s.finished).toBe(true);
      });

      it('Le Datacenter, chapitre 4 — restaurer d’abord, installer ensuite, garder le site Debian', () => {
        const { s, tout: all } = play('fire', [
          'cd /',
          'sudo tar -xzf /mnt/sauvegarde/medialibrary-2026-10-22.tar.gz',
          'bienvenue-2026',
          'sudo apt update',
          // nginx ne démarre pas : deux serveurs par défaut.
          'sudo apt install -y nginx',
          'systemctl is-active nginx',
        ]);
        expect(all).toContain('dpkg: error processing package nginx (--configure):');
        expect(all).toContain('failed');
        expect(s.finished).toBe(false);
        // Autre solution : la médiathèque n'est plus le site par défaut ; on la joint par son nom.
        const conf = '/etc/nginx/sites-enabled/medialibrary';
        s.execute(`sudo nano ${conf}`);
        s.saveEdition(s.edition!.text.replaceAll(' default_server', ''));
        s.quitEdition();
        s.execute('sudo nginx -t');
        s.execute('sudo systemctl start nginx');
        expect(s.execute('curl localhost')).toContain('Welcome to nginx!');
        expect(s.finished).toBe(true);
      });

      it('Le Datacenter, chapitre 4 — fausses pistes : extraire dans ~, l’archive coupée, celle de mercredi', () => {
        const { s, tout: all } = play('fire', [
          'sudo apt update',
          'bienvenue-2026',
          'sudo apt install -y nginx',
          'sudo rm /etc/nginx/sites-enabled/default',
          'sudo tar -xzf /mnt/sauvegarde/medialibrary-2026-10-22.tar.gz',
          'sudo tar -xzf /mnt/sauvegarde/medialibrary-2026-10-23.tar.gz -C /',
          'sudo systemctl reload nginx',
          'curl -I medialibrary.example',
          'sudo tar -xzf /mnt/sauvegarde/medialibrary-2026-10-21.tar.gz -C /',
          'sudo systemctl reload nginx',
        ]);
        contains(all, 'extraite là où tu étais');
        // L'archive coupée rend la configuration, mais aucune page : 404.
        expect(all).toContain('HTTP/1.1 404 Not Found');
        contains(all, 'avec la page de mercredi');
        expect(s.finished).toBe(false);
        s.execute(L('sudo tar -xzf /mnt/sauvegarde/medialibrary-2026-10-22.tar.gz -C /'));
        expect(s.finished).toBe(true);
      });

      it('Le Datacenter, chapitre 5 — Le certificat a expiré', () => {
        const { s, tout: all } = play('certificate', [
          'curl https://medialibrary.example',
          'journalctl -u certbot -n 8',
          'sudo certbot certificates',
          'bienvenue-2026',
          'sudo certbot renew --dry-run',
          'sudo cat /etc/letsencrypt/renewal/medialibrary.example.conf',
          // Fausse piste : --dry-run n'enregistre rien.
          'sudo certbot renew --dry-run --webroot -w /var/www/medialibrary',
          'sudo certbot renew --webroot -w /var/www/medialibrary',
          // Fausse piste : renouvelé sur le disque, mais nginx sert encore l'ancien.
          'curl https://medialibrary.example',
          'sudo certbot reconfigure --cert-name medialibrary.example --deploy-hook "systemctl reload nginx"',
          'sudo systemctl reload nginx',
          'curl -I https://medialibrary.example',
        ]);
        expect(all).toContain('curl: (60) SSL certificate problem: certificate has expired');
        expect(all).toContain('(INVALID: EXPIRED)');
        expect(all).toContain('Invalid response from http://medialibrary.example/.well-known/acme-challenge/');
        expect(all).toContain('Congratulations, all simulated renewals succeeded');
        expect(all).toContain('Congratulations, all renewals succeeded');
        expect(all).toContain('Dry run: skipping deploy hook command: systemctl reload nginx');
        expect(all).toContain('HTTP/1.1 200 OK');
        contains(all, 'Le certificat a bien expiré');
        contains(all, 'pas là où nginx sert ce site');
        contains(all, 'mais curl voit encore');
        expect(s.finished).toBe(true);
      });

      it('Le Datacenter, chapitre 5 — corriger le fichier de renouvellement, script de deploy hook', () => {
        const { s, tout: all } = play('certificate', [
          'sudo certbot renew',
          'bienvenue-2026',
          'sudo nano /etc/letsencrypt/renewal/medialibrary.example.conf',
        ]);
        expect(all).toContain('Some challenges have failed');
        s.saveEdition(s.edition!.text.replaceAll('/var/www/html', '/var/www/medialibrary'));
        s.quitEdition();
        const next = [
          'sudo certbot renew --dry-run',
          'echo "systemctl reload nginx" | sudo tee /etc/letsencrypt/renewal-hooks/deploy/recharger-nginx',
          // Fausse piste : un script qui n'est pas exécutable est ignoré.
          'sudo certbot renew',
        ].map((l) => s.execute(l) ?? '');
        expect(next.join('\n')).toContain("Skipping deploy-hook '/etc/letsencrypt/renewal-hooks/deploy/recharger-nginx' as it is not executable.");
        expect(s.finished).toBe(false);
        s.execute('sudo chmod +x /etc/letsencrypt/renewal-hooks/deploy/recharger-nginx');
        s.execute('sudo systemctl reload nginx');
        expect(s.finished).toBe(true);
      });

      it('Le Datacenter, chapitre 5 — le module nginx de certbot', () => {
        const { s, tout: all } = play('certificate', [
          'sudo certbot renew --nginx',
          'bienvenue-2026',
          'sudo apt install -y python3-certbot-nginx',
          'sudo certbot renew --nginx',
          'openssl s_client -connect medialibrary.example:443 | openssl x509 -noout -enddate',
        ]);
        expect(all).toContain('The requested nginx plugin does not appear to be installed');
        expect(all).toContain('notAfter=Apr 21');
        expect(s.finished).toBe(true);
      });

      it('Le Paquet perdu', () => {
        const { s } = play('lost-packet', [
          'cat carnet.txt',
          'ping 192.168.1.1',
          'ping 9.9.9.9',
          'ping letters.example',
          'dig letters.example',
          'cat /etc/resolv.conf',
          'dig @9.9.9.9 letters.example',
          'sudo cp /etc/resolv.conf.box /etc/resolv.conf',
          'fourmiliere',
          'ping letters.example',
          'traceroute letters.example',
          'curl -I https://letters.example',
        ]);
        expect(s.finished).toBe(true);
      });

      it('La Machine à remonter le temps', () => {
        const { s } = play('manuscript', [
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
        expect(s.finished).toBe(true);
      });

      it('Les Archives', () => {
        const { s } = play('archives', [
          'cat notes_rosa.txt',
          'du -sh fonds',
          'df -h /media/cle',
          'tar -czf /media/cle/fonds.tar.gz fonds',
          'find fonds -name "*.tmp" -delete',
          'tar -czf /media/cle/fonds.tar.gz fonds',
          'tar -tzf /media/cle/fonds.tar.gz',
        ]);
        expect(s.finished).toBe(true);
      });
    });

    describe('Les Archives, chapitre 2 — Les versions (restic)', () => {
      const R = 'restic -r /mnt/mairie/restic-bibliotheque --password-file ~/.config/restic/mot-de-passe';
      // Les identifiants des instantanés, du plus ancien au plus récent.
      const snapshotList = (s: Shell) => [...(s.execute(L(`${R} snapshots`)) ?? '').matchAll(/^([0-9a-f]{8}) {2}/gm)].map((m) => m[1]);

      it('solution : find, restore, forget, prune, check, chmod', () => {
        const { s, tout: all } = play('versions', ['df -h /mnt/mairie', `${R} find --long journal_de_marie.txt`]);
        expect(all).toContain(L('2027-02-02 02:00:13 /home/vous/fonds/manuscrits/journal_de_marie.txt'));
        const ids = snapshotList(s);
        expect(ids).toHaveLength(30);
        const good = ids[25];
        const next = [
          `${R} diff ${good} ${ids[26]}`,
          `${R} restore ${good} --target /tmp/restauration --include /home/vous/fonds/manuscrits/journal_de_marie.txt`,
          'cp /tmp/restauration/home/vous/fonds/manuscrits/journal_de_marie.txt ~/fonds/manuscrits/',
          `${R} forget --keep-daily 7 --keep-weekly 4 --keep-monthly 12 --dry-run`,
          // Fausse piste : forget seul ne rend pas la place.
          `${R} forget --keep-daily 7 --keep-weekly 4 --keep-monthly 12`,
          `${R} prune`,
          'chmod 600 ~/.config/restic/mot-de-passe',
          `${R} check`,
        ]
          .map((l) => s.execute(L(l)) ?? '')
          .join('\n');
        expect(next).toContain(L('M    /home/vous/fonds/manuscrits/journal_de_marie.txt'));
        expect(next).toContain('Would have removed the snapshots above (dry run).');
        expect(next).toContain('remove 21 snapshots:');
        expect(next).toContain('no errors were found');
        contains(next, 'pas à sa place');
        contains(next, 'mais df -h /mnt/mairie ne');
        contains(next, 'Le disque respire');
        expect(s.finished).toBe(true);
      });

      it('autre solution : le mot de passe tapé, dump, forget --prune, puis une sauvegarde', () => {
        const { s, tout: all } = play('versions', ['chmod go-rwx ~/.config/restic/mot-de-passe', 'restic -r /mnt/mairie/restic-bibliotheque snapshots', 'mauvais']);
        expect(all).toContain('Fatal: wrong password or no key found');
        contains(all, 'Mauvais mot de passe');
        const ids = snapshotList(s);
        for (const l of [
          `${R} dump ${ids[20]} /home/vous/fonds/manuscrits/journal_de_marie.txt > ~/fonds/manuscrits/journal_de_marie.txt`,
          `${R} backup ~/fonds`,
          `${R} forget --keep-last 2 --prune`,
          `${R} check`,
        ])
          s.execute(L(l));
        expect(s.finished).toBe(true);
      });

      it('fausse piste : forget trop sévère avant de restaurer', () => {
        const { s, tout: all } = play('versions', [`${R} forget --keep-last 3 --prune`, `${R} check`, 'chmod 600 ~/.config/restic/mot-de-passe']);
        contains(all, 'Plus aucun instantané ne contient la bonne version');
        expect(s.finished).toBe(false);
      });
    });

    describe('Les Lettres du quartier, chapitre 4 — La colocation (nginx)', () => {
      // nano : remplace du texte dans un fichier et enregistre.
      const modify = (s: Shell, file: string, before: string | RegExp, after: string) => {
        s.execute(`sudo nano ${file}`);
        s.saveEdition(s.edition!.text.replace(before, after));
        s.quitEdition();
      };

      it('solution, avec les fausses pistes : lien relatif, nom en double, 502, barre finale', () => {
        const { s, tout: all } = play('sharing', [
          'curl http://cafe.example',
          'cd /etc/nginx',
          'sudo cp sites-available/letters sites-available/cafe',
          'fourmis-2026',
          'sudo ln -s sites-available/cafe sites-enabled/',
          'sudo nginx -t',
          'sudo rm sites-enabled/cafe',
          'sudo ln -s /etc/nginx/sites-available/cafe /etc/nginx/sites-enabled/',
          'ls -l sites-enabled',
        ]);
        expect(all).toContain('open() "/etc/nginx/sites-enabled/cafe" failed (2: No such file or directory)');
        expect(all).toContain('cafe -> /etc/nginx/sites-available/cafe');
        contains(all, 'le site des Lettres qui répond');
        contains(all, 'le lien est cassé');
        modify(s, '/etc/nginx/sites-available/cafe', /default_server/g, '');
        const conflict = s.execute('sudo nginx -t') ?? '';
        expect(conflict).toContain('nginx: [warn] conflicting server name "letters.example" on 0.0.0.0:80, ignored');
        contains(conflict, 'deux sites répondent au même nom');
        modify(s, '/etc/nginx/sites-available/cafe', /lettres|letters/g, 'cafe');
        s.execute('sudo systemctl reload nginx');
        if (reference) expect(s.execute('curl -H "Host: cafe.example" http://127.0.0.1')).toContain('Le café associatif');
        modify(s, '/etc/nginx/sites-available/letters', '    location / {', '    location /agenda/ {\n        proxy_pass http://127.0.0.1:3000;\n    }\n\n    location / {');
        const next = ['sudo nginx -t', 'sudo systemctl reload nginx', 'curl -I http://letters.example/agenda/', 'sudo tail -1 /var/log/nginx/error.log', 'sudo systemctl enable --now agenda', 'curl http://letters.example/agenda/']
          .map((l) => s.execute(l) ?? '')
          .join('\n');
        expect(next).toContain('HTTP/1.1 502 Bad Gateway');
        expect(next).toContain('connect() failed (111: Connection refused) while connecting to upstream');
        expect(next).toContain('Cannot GET /agenda/');
        contains(next, 'la barre finale');
        expect(s.finished).toBe(false);
        modify(s, '/etc/nginx/sites-available/letters', 'proxy_pass http://127.0.0.1:3000;', 'proxy_pass http://127.0.0.1:3000/;');
        s.execute('sudo systemctl reload nginx');
        if (reference) expect(s.execute('curl http://letters.example/agenda/ateliers')).toContain('Les ateliers');
        expect(s.finished).toBe(true);
      });

      it('autre solution : un nouveau fichier écrit à la main, location exacte du préfixe, agenda démarré puis activé', () => {
        const { s } = play('sharing', ['sudo systemctl start agenda', 'fourmis-2026']);
        s.execute('sudo nano /etc/nginx/sites-available/cafe');
        s.saveEdition('server {\n    listen 80;\n    server_name cafe.example;\n    root /var/www/cafe;\n}');
        s.quitEdition();
        s.execute('sudo ln -s /etc/nginx/sites-available/cafe /etc/nginx/sites-enabled/cafe');
        modify(s, '/etc/nginx/sites-available/letters', '    location / {', '    location /agenda/ {\n        proxy_pass http://localhost:3000/;\n    }\n    location / {');
        s.execute('sudo systemctl reload nginx');
        expect(s.finished).toBe(false);
        s.execute('sudo systemctl enable agenda');
        expect(s.finished).toBe(true);
      });
    });

    describe('Les Lettres du quartier, chapitre 5 — Ça marche chez moi (DNS)', () => {
      const ZONE = '/etc/bind/zones/db.cafe.example';
      const modify = (s: Shell, change: (text: string) => string) => {
        s.execute(`sudo nano ${ZONE}`);
        s.saveEdition(change(s.edition!.text));
        s.quitEdition();
      };

      it('solution, avec les fausses pistes : serial oublié, point final oublié, zone fausse', () => {
        const { s, tout: all } = play('works-for-me', ['dig cafe.example', 'dig @localhost cafe.example +short', 'dig www.cafe.example', 'sudo rndc status', 'fourmis-2026']);
        expect(all).toContain('198.51.100.80');
        expect(all).toContain('status: NXDOMAIN');
        expect(all).toContain('server is up and running');
        // Une adresse mal tapée : named garde l'ancienne zone.
        modify(s, (t) => t.replace('198.51.100.80', '203.0.113.310'));
        const no = ['named-checkzone cafe.example ' + ZONE, 'sudo rndc reload cafe.example'].map((l) => s.execute(l) ?? '').join('\n');
        expect(no).toContain("near '203.0.113.310': bad dotted quad");
        expect(no).toContain("rndc: 'reload' failed: failure");
        contains(no, 'named refuse la zone');
        // Le bon contenu, mais ni serial ni point final.
        modify(s, (t) => t.replace('203.0.113.310', '203.0.113.10') + '\nwww     IN CNAME cafe.example');
        const half = ['sudo rndc reload cafe.example', 'journalctl -u named', 'dig @localhost www.cafe.example', 'dig @ns2.registry.example cafe.example +short', 'dig cafe.example']
          .map((l) => s.execute(l) ?? '')
          .join('\n');
        expect(half).toContain('zone serial (2026091501) unchanged. zone may fail to transfer to secondaries.');
        expect(half).toContain('cafe.example.cafe.example.');
        contains(half, 'son numéro de série');
        contains(half, 'sans point final');
        contains(half, 'les caches');
        expect(s.finished).toBe(false);
        modify(s, (t) => t.replace('2026091501', '2027032001').replace('CNAME cafe.example', 'CNAME cafe.example.'));
        s.execute('named-checkzone cafe.example ' + ZONE);
        expect(s.execute('sudo rndc reload')).toContain('server reload successful');
        expect(s.finished).toBe(true);
        expect(s.execute('dig @ns2.registry.example www.cafe.example +short')).toBe('cafe.example.\n203.0.113.10');
      });

      it('autre solution : un enregistrement A pour www, et systemctl reload named', () => {
        const { s } = play('works-for-me', ['sudo id', 'fourmis-2026']);
        modify(s, (t) => t.replace('2026091501', '2026091502').replaceAll('198.51.100.80', '203.0.113.10') + '\nwww 300 IN A 203.0.113.10');
        s.execute('sudo systemctl reload named');
        expect(s.finished).toBe(true);
      });
    });

    describe('Les Lettres du quartier, chapitre 6 — Le soir du concert (awk, limit_req)', () => {
      const SITE = '/etc/nginx/sites-available/letters';
      const modify = (s: Shell, file: string, change: (text: string) => string) => {
        s.execute(`sudo nano ${file}`);
        s.saveEdition(change(s.edition!.text));
        s.quitEdition();
      };

      it('solution, avec les fausses pistes : zone inconnue, limite sans rafale', () => {
        const { s, tout: all } = play('concert', [
          "sudo awk '{print $9}' /var/log/nginx/access.log | sort | uniq -c",
          'fourmis-2026',
          "sudo awk '{print $1}' /var/log/nginx/access.log | sort | uniq -c | sort -n",
        ]);
        expect(all).toMatch(/\d+ 504/);
        contains(all, 'robot qui aspire le site');
        // limit_req sans limit_req_zone : nginx -t refuse.
        modify(s, SITE, (t) => t.replace('proxy_pass http://127.0.0.1:3000/;', 'limit_req zone=agenda;\n        proxy_pass http://127.0.0.1:3000/;'));
        expect(s.execute('sudo nginx -t')).toContain('zero size shared memory zone "agenda"');
        modify(s, SITE, (t) => 'limit_req_zone $binary_remote_addr zone=agenda:10m rate=2r/s;\n\n' + t);
        const withoutBurst = s.execute('sudo systemctl reload nginx') ?? '';
        contains(withoutBurst, 'La limite refuse aussi des vraies personnes');
        expect(s.finished).toBe(false);
        modify(s, SITE, (t) => t.replace('limit_req zone=agenda;', 'limit_req zone=agenda burst=10 nodelay;\n        limit_req_status 429;'));
        s.execute('sudo systemctl reload nginx');
        expect(s.finished).toBe(true);
        expect(s.execute("sudo awk '$9 == 429' /var/log/nginx/access.log | wc -l")).toMatch(/^\d{3,}$/);
      });

      it('fausse piste : bloquer les adresses du robot ne suffit pas à Kofi', () => {
        const { s } = play('concert', ['sudo id', 'fourmis-2026']);
        modify(s, SITE, (t) => t.replace('    location /agenda/ {', '    deny 198.51.100.0/24;\n\n    location /agenda/ {'));
        const output = s.execute('sudo systemctl reload nginx') ?? '';
        contains(output, 'ces robots changent');
        expect(s.finished).toBe(false);
      });

      it('autre solution : la zone dans conf.d, la limite sur tout le site, 1 requête par seconde', () => {
        const { s } = play('concert', ['sudo id', 'fourmis-2026']);
        s.execute('echo "limit_req_zone $binary_remote_addr zone=lettres:10m rate=1r/s;" | sudo tee /etc/nginx/conf.d/limites.conf');
        modify(s, SITE, (t) => t.replace('    root /var/www/letters;', '    limit_req zone=lettres burst=20 nodelay;\n    root /var/www/letters;'));
        s.execute('sudo systemctl reload nginx');
        expect(s.finished).toBe(true);
      });
    });

    describe('La Fabrique, chapitre 1 — La mise à jour (docker)', () => {
      it('docker inspect sans -f donne le JSON du conteneur (pas [])', () => {
        const { outputs } = play('update', ['sudo docker inspect outiltheque', 'fablab-2027']);
        expect(outputs.at(-1)).toContain('"Mounts"');
        expect(outputs.at(-1)).toContain('outiltheque');
      });

      it('solution : copier la base, volume, nouveau conteneur, --restart, et ça tient après un redémarrage', () => {
        const { s, tout: all } = play('update', [
          'docker ps',
          'sudo docker ps -a',
          'fablab-2027',
          "sudo docker inspect -f '{{json .Mounts}}' outiltheque",
          'sudo docker cp outiltheque:/var/lib/outiltheque ./sauvegarde',
          // Fausse piste : l'ancien conteneur occupe encore le port 8080.
          'sudo docker run -d --name outiltheque-15 -p 8080:8080 -v outiltheque-donnees:/var/lib/outiltheque registry.example/outiltheque:1.5',
          'sudo docker stop outiltheque',
          'sudo docker start outiltheque-15',
          'sudo docker cp sauvegarde/. outiltheque-15:/var/lib/outiltheque',
          'sudo docker restart outiltheque-15',
          'sudo docker logs -n 3 outiltheque-15',
          'curl http://localhost:8080',
        ]);
        expect(all).toContain('permission denied while trying to connect to the Docker daemon socket');
        expect(all).toContain('Bind for 0.0.0.0:8080 failed: port is already allocated.');
        expect(all).toContain('Migrating database schema 3 -> 4');
        if (reference) expect(all).toContain('37 prêts en cours');
        contains(all, 'la couche du conteneur');
        contains(all, 'une base toute neuve et vide');
        expect(s.finished).toBe(false);
        s.execute('sudo docker update --restart unless-stopped outiltheque-15');
        expect(s.finished).toBe(true);
        s.execute('sudo reboot');
        expect(s.execute('curl http://localhost:8080')).toContain('outiltheque 1.5');
      });

      it('autre solution : un dossier de la machine (bind mount), --restart always, l’ancien supprimé', () => {
        const { s } = play('update', [
          'sudo mkdir /srv/outiltheque',
          'fablab-2027',
          'sudo docker cp outiltheque:/var/lib/outiltheque/outiltheque.db /srv/outiltheque/',
          'sudo docker rm -f outiltheque',
          'sudo docker run -d --name outiltheque --restart always -p 8080:8080 -v /srv/outiltheque:/var/lib/outiltheque registry.example/outiltheque:1.5',
        ]);
        expect(s.finished).toBe(true);
      });

      it('fausse piste : supprimer le conteneur avant de copier sa base', () => {
        const { s, tout: all } = play('update', ['sudo docker rm outiltheque', 'fablab-2027', 'sudo docker rm -f outiltheque']);
        expect(all).toContain('container is running: stop the container before removing or force remove');
        contains(all, 'Les 37 prêts ont disparu');
        s.execute('sudo docker run -d --name outiltheque --restart always -p 8080:8080 -v outiltheque:/var/lib/outiltheque registry.example/outiltheque:1.5');
        expect(s.finished).toBe(false);
      });
    });

    describe('La Fabrique, chapitre 2 — La composition (docker compose)', () => {
      const modify = (s: Shell, file: string, change: (text: string) => string) => {
        s.execute(`sudo nano ${file}`);
        s.saveEdition(change(s.edition!.text));
        s.quitEdition();
      };
      // Le fichier corrigé : nom du service, variable, volume, redémarrage, sans version:.
      const fix = (t: string) =>
        t
          .replace('version: "3.8"\n\n', '')
          .replace('@localhost:', '@db:')
          .replaceAll(L('atelier2027'), '${POSTGRES_PASSWORD}')
          .replace('    depends_on:', '    restart: unless-stopped\n    depends_on:')
          .replace('      - POSTGRES_DB=reservations', '      - POSTGRES_DB=reservations\n    volumes:\n      - donnees:/var/lib/postgresql/data\n    restart: unless-stopped\n\nvolumes:\n  donnees:');

      it('solution, avec la fausse piste localhost', () => {
        const { s, tout: all } = play('compose', ['cd /srv/reservations', 'sudo docker compose up -d', 'fablab-2027', 'sudo docker compose logs appli', 'curl http://localhost:8081']);
        expect(all).toContain('the attribute `version` is obsolete');
        expect(all).toContain('Error: connect ECONNREFUSED 127.0.0.1:5432');
        expect(all).toContain("curl: (7) Failed to connect to localhost port 8081");
        contains(all, 'dans un conteneur, localhost désigne le conteneur');
        modify(s, '/srv/reservations/compose.yaml', fix);
        const config = s.execute('sudo docker compose config') ?? '';
        expect(config).toContain('The "POSTGRES_PASSWORD" variable is not set.');
        s.execute(L('echo POSTGRES_PASSWORD=atelier2027 | sudo tee .env'));
        s.execute('sudo docker compose up -d');
        if (reference) expect(s.execute('curl http://localhost:8081')).toContain('base de données connectée');
        expect(s.finished).toBe(false);
        s.execute('sudo chmod 600 .env');
        expect(s.finished).toBe(true);
        s.execute('sudo reboot');
        if (reference) expect(s.execute('curl http://localhost:8081')).toContain('Réserver une machine');
      });

      it('fausse piste : changer POSTGRES_PASSWORD après la création de la base, puis down -v', () => {
        const { s } = play('compose', ['cd /srv/reservations', 'sudo id', 'fablab-2027']);
        modify(s, '/srv/reservations/compose.yaml', (t) => fix(t).replaceAll('${POSTGRES_PASSWORD}', L('atelier2027')));
        s.execute('sudo docker compose up -d');
        if (reference) expect(s.execute('curl http://localhost:8081')).toContain('base de données connectée');
        // Le mot de passe passe dans .env… mais un autre que celui de la base existante.
        modify(s, '/srv/reservations/compose.yaml', (t) => t.replaceAll(L('atelier2027'), '${POSTGRES_PASSWORD}'));
        s.execute('echo POSTGRES_PASSWORD=nouveau-secret | sudo tee .env');
        s.execute('sudo chmod 600 .env');
        const failure = s.execute('sudo docker compose up -d') ?? '';
        expect(s.execute('sudo docker compose logs appli')).toContain('password authentication failed for user "fablab"');
        contains(failure, 'password authentication failed');
        expect(s.finished).toBe(false);
        const redone = ['sudo docker compose down -v', 'sudo docker compose up -d'].map((l) => s.execute(l) ?? '').join('\n');
        contains(redone, 'les volumes du projet sont effacés');
        expect(s.finished).toBe(true);
      });
    });

    describe('La Fabrique, chapitre 3 — Le trou dans le pare-feu (docker et ufw)', () => {
      const BEFORE = [...prerequisites('fablab'), 'update', 'compose'];
      const modify = (s: Shell, change: (text: string) => string) => {
        s.execute('sudo nano /srv/reservations/compose.yaml');
        s.saveEdition(change(s.edition!.text));
        s.quitEdition();
      };

      it('solution, testée depuis le poste : ufw ne suffit pas, port lié à 127.0.0.1, ménage', () => {
        const c = new Console({ language, finished: BEFORE });
        const playC = (lines: string[]) => lines.map((l) => c.execute(machinesInLanguage(c.t, l)) ?? '').join('\n');
        expect(playC(['nc -zv fabrique 5432'])).toContain(`Connection to ${machineName(c.t, 'fabrique')} (192.0.2.15) 5432 port [tcp/postgresql] succeeded!`);
        const inside = playC(['ssh fabrique', 'yes', 'sudo ss -tlnp', 'fablab-2027', 'sudo ufw deny 5432', 'df -h /']);
        expect(inside).toContain('0.0.0.0:5432');
        expect(inside).toMatch(/9\d% \//);
        contains(inside, 'contourne ufw');
        contains(inside, 'ne change rien');
        expect(playC(['exit', 'nc -zv fabrique 5432'])).toContain('succeeded!');
        playC(['ssh fabrique', 'cd /srv/reservations']);
        modify(c.shell, (t) => t.replace('      - "5432:5432"', '      - "127.0.0.1:5432:5432"'));
        playC(['sudo docker compose up -d', 'sudo docker image prune -a', 'y']);
        expect(c.finished).toContain('firewall-hole');
        const outside = playC(['exit', 'nc -zv fabrique 5432']);
        expect(outside).toContain('timed out');
      });

      it('autre solution : plus de port pour la base, docker system prune -a -f', () => {
        const { s } = play('firewall-hole', ['cd /srv/reservations', 'sudo id', 'fablab-2027']);
        modify(s, (t) => t.replace('    # Pour pgAdmin, depuis mon portable (Yasmine)\n    ports:\n      - "5432:5432"\n', ''));
        s.execute('sudo docker compose up -d');
        const menage = s.execute('sudo docker system prune -a -f') ?? '';
        expect(menage).toContain('Deleted Containers:');
        expect(menage).toContain('untagged: registry.example/ia-locale:latest');
        expect(s.finished).toBe(true);
      });

      it('fausse piste : docker volume prune -a emporte le wiki', () => {
        const { s, tout: all } = play('firewall-hole', ['sudo docker volume prune', 'fablab-2027', 'y', 'sudo docker volume ls', 'sudo docker volume prune -a', 'y']);
        expect(all).toContain('WARNING! This will remove anonymous local volumes not used by at least one container.');
        expect(all).toContain('Deleted Volumes:\nwiki-ancien');
        contains(all, 'Le volume wiki-ancien a disparu');
        expect(s.finished).toBe(false);
      });
    });

    describe('La Fabrique, chapitre 4 — Les pleins pouvoirs (conteneur sans root)', () => {
      const modify = (s: Shell, change: (text: string) => string) => {
        s.execute('sudo nano /srv/galerie/compose.yaml');
        s.saveEdition(change(s.edition!.text));
        s.quitEdition();
      };
      const withUser = (u: string) => (t: string) => t.replace('    restart: unless-stopped', `    restart: unless-stopped\n    user: ${u}`);

      it('solution : user: "1001:1001" dans compose.yaml, puis chown -R', () => {
        const { s, tout: all } = play('full-powers', [
          'cd /srv/galerie',
          'sudo docker exec galerie-galerie-1 id',
          'fablab-2027',
          'ps aux',
          'ls -lan photos',
        ]);
        expect(all).toContain('uid=0(root) gid=0(root) groups=0(root)');
        expect(all).toMatch(/^root\s+\d+.*node serveur\.js$/m);
        contains(all, "l'uid 0 du conteneur EST l'uid 0 de la machine");
        modify(s, withUser('"1001:1001"'));
        const failure = ['sudo docker compose up -d', 'sudo docker compose ps', 'sudo docker compose logs galerie']
          .map((l) => s.execute(l))
          .join('\n');
        expect(failure).toContain('Restarting (1)');
        expect(failure).toContain("Error: EACCES: permission denied, open '/app/photos/.miniatures/index.json'");
        contains(failure, 'EACCES, permission refusée');
        expect(s.finished).toBe(false);
        // Sans -R, le dossier change de propriétaire, pas ce qu'il contient.
        s.execute('sudo chown 1001:1001 /srv/galerie/photos');
        expect(s.finished).toBe(false);
        const end = ['sudo chown -R 1001:1001 /srv/galerie/photos', 'sudo docker exec galerie-galerie-1 id', 'ps aux', 'curl -s localhost:8082']
          .map((l) => s.execute(l))
          .join('\n');
        expect(end).toContain('uid=1001 gid=1001 groups=1001');
        expect(end).toMatch(/^yasmine\s+\d+.*node serveur\.js$/m);
        expect(end).toContain('14 photos');
        contains(end, 'Tu as terminé le chapitre 4 de La Fabrique');
        expect(s.finished).toBe(true);
      });

      it('autre solution : docker run -u node, le groupe de Yasmine et chmod -R g+w', () => {
        const { s, tout: all } = play('full-powers', [
          'sudo docker rm -f galerie-galerie-1',
          'fablab-2027',
          'sudo docker run -d --name galerie -u node -p 8082:3000 -v /srv/galerie/photos:/app/photos --restart unless-stopped registry.example/galerie:3.2',
          'sudo chown -R 1000 /srv/galerie/photos',
          'sudo docker exec galerie whoami',
          'ls -l /srv/galerie',
        ]);
        expect(all).toContain('node');
        expect(all).toMatch(new RegExp(`drwxr-xr-x ${L('vous')} +${L('vous')} +4096 photos`));
        contains(all, "l'uid 1000, c'est toi");
        expect(s.finished).toBe(false);
        s.execute('sudo chgrp -R yasmine /srv/galerie/photos');
        s.execute('sudo chmod -R g+w /srv/galerie/photos');
        expect(s.execute('ls -ln /srv/galerie')).toMatch(/drwxrwxr-x 1000 +1001 +4096 photos/);
        expect(s.finished).toBe(true);
      });

      it("fausses pistes : un nom inconnu de l'image, chmod 777, une photo effacée", () => {
        const { s } = play('full-powers', ['cd /srv/galerie', 'sudo id', 'fablab-2027']);
        modify(s, withUser('galerie'));
        const unknown = s.execute('sudo docker compose up -d') ?? '';
        expect(unknown).toContain('unable to find user galerie: no matching entries in passwd file');
        contains(unknown, "DE L'IMAGE");
        modify(s, (t) => t.replace('user: galerie', 'user: "1001:1001"'));
        s.execute('sudo docker compose up -d');
        const open = s.execute('sudo chmod -R 777 /srv/galerie/photos') ?? '';
        contains(open, 'ouvert en écriture à tous');
        expect(s.execute('sudo docker exec galerie-galerie-1 id')).toContain('uid=1001');
        expect(s.finished).toBe(false);
        const perdu = s.execute('sudo rm /srv/galerie/photos/velo-repare.jpg') ?? '';
        contains(perdu, 'Une photo a disparu');
        s.execute('sudo chmod -R o-w /srv/galerie/photos');
        expect(s.finished).toBe(false);
      });
    });

    describe('La Gazette, chapitre 1 — Le dépôt nu (déployer par git)', () => {
      const edit = (s: Shell, file: string, change: (text: string) => string) => {
        s.execute(`nano ${file}`);
        s.saveEdition(change(s.edition!.text));
        s.quitEdition();
      };
      const HOOK = '#!/bin/sh\ngit --work-tree=/var/www/gazette checkout -f main\necho "Site publié"';

      it("solution : la dérive d'abord, un dépôt nu à soi, un crochet exécutable, puis chaque correction par git push", () => {
        const { s, tout: all } = play('bare-repo', ['diff -r gazette /var/www/gazette', 'sudo git init --bare /srv/git/gazette.git', 'gazette-2027']);
        if (reference) expect(all).toContain('Seulement dans gazette : fete-des-voisins.html');
        if (reference) expect(all).toContain('> <h1>La Gazette du quartier</h1>');
        contains(all, 'Voilà la correction de Théo');
        if (reference) expect(all).toContain('Dépôt Git vide initialisé dans /srv/git/gazette.git/');
        s.execute(L('sudo chown -R vous:vous /srv/git/gazette.git'));
        edit(s, '/srv/git/gazette.git/hooks/post-receive', () => HOOK);
        s.execute('chmod +x /srv/git/gazette.git/hooks/post-receive');
        s.execute('cd ~/gazette');
        edit(s, 'index.html', (t) => t.replaceAll('Gazzette', 'Gazette'));
        if (reference) expect(s.execute('git commit -am "Titre : Gazette, sans faute"')).toContain('2 insertions(+), 2 suppressions(-)');
        s.execute('git remote add prod /srv/git/gazette.git');
        const push = s.execute('git push prod main') ?? '';
        expect(push).toContain('remote: Site publié');
        expect(push).toContain(' * [new branch]      main -> main');
        contains(push, 'Mon article est en ligne');
        expect(s.finished).toBe(false);
        edit(s, 'agenda.html', (t) => t.replace('2027-06-21', '2027-06-12').replace('>21 ', '>12 '));
        s.execute('git commit -am "Agenda : le vide-grenier est le 12 juin"');
        const end = s.execute('git push prod') ?? '';
        expect(end).toMatch(/ {3}[0-9a-f]{7}\.\.[0-9a-f]{7} {2}main -> main/);
        contains(end, 'Tu as terminé le chapitre 1 de La Gazette');
        expect(s.execute('curl -s http://gazette.example/agenda.html')).toContain('datetime="2027-06-12"');
        expect(s.finished).toBe(true);
      });

      it('fausses pistes : dépôt à root, crochet non exécutable, checkout sans -f, correction de Théo perdue, retouche sur le serveur', () => {
        const { s } = play('bare-repo', [
          'sudo git init --bare /srv/git/gazette.git',
          'gazette-2027',
          'cd ~/gazette',
          'git remote add prod /srv/git/gazette.git',
        ]);
        const root = s.execute('git push prod main') ?? '';
        if (reference) expect(root).toContain('error: droits insuffisants pour ajouter un objet');
        expect(root).toContain(' ! [remote rejected] main -> main (unpacker error)');
        contains(root, 'il appartient à root');
        s.execute(L('sudo chown -R vous: /srv/git/gazette.git'));
        contains(s.execute('git push prod main') ?? '', 'rien ne les extrait');
        edit(s, '/srv/git/gazette.git/hooks/post-receive', () => '#!/bin/sh\ngit --work-tree=/var/www/gazette checkout main');
        s.execute('git rm style.css');
        s.execute('git commit -m "Sans style"');
        contains(s.execute('git push prod main') ?? '', "il n'est pas exécutable");
        s.execute('chmod +x /srv/git/gazette.git/hooks/post-receive');
        s.execute('git restore --source=HEAD~1 style.css');
        s.execute('git add style.css');
        s.execute('git commit -m "Le style revient"');
        const withoutF = s.execute('git push prod main') ?? '';
        if (reference) expect(withoutF).toContain("remote: error: Les fichiers suivants non suivis de la copie de travail seraient écrasés par l'extraction :");
        contains(withoutF, 'Avec -f (force)');
        edit(s, '/srv/git/gazette.git/hooks/post-receive', (t) => t.replace('checkout main', 'checkout -f main'));
        edit(s, 'agenda.html', (t) => t.replace('8 h', '9 h'));
        s.execute('git commit -am "Ouverture à 9 h"');
        contains(s.execute('git push prod main') ?? '', 'La correction de Théo a disparu');
        // Corriger l'agenda sur le serveur, sans git : refusé.
        s.execute('echo \'<time datetime="2027-06-12">\' > /var/www/gazette/agenda.html');
        expect(s.finished).toBe(false);
      });
    });

    describe('La Gazette, chapitre 2 — Le retour arrière (versions, lien current, tests)', () => {
      const hook = (s: Shell, change: (text: string) => string) => {
        s.execute('nano /srv/git/gazette.git/hooks/post-receive');
        s.saveEdition(change(s.edition!.text));
        return s.quitEdition();
      };
      const WITH_TESTS = (t: string) => t.replace('ln -sfn', 'cd /srv/gazette/releases/$VERSION\nsh tests.sh\nln -sfn');
      const publishTheo = (s: Shell) =>
        [
          'cd ~/gazette',
          'git pull prod main',
          'mv accueil.html index.html',
          'git add .',
          'git commit -m "Accueil : index.html"',
          'git push prod main',
        ]
          .map((l) => s.execute(l))
          .join('\n');

      it("solution : ln -sfn vers la version d'avant, tests.sh dans le crochet avant de basculer, puis la mise en page réparée", () => {
        const { s, tout: all } = play('rollback', [
          'curl -I http://gazette.example/',
          'ls -l /srv/gazette',
          'cd /srv/gazette',
          'ln -sfn releases/20270514101502 current',
        ]);
        expect(all).toContain('HTTP/1.1 403 Forbidden');
        expect(all).toContain('current -> /srv/gazette/releases/20270517203012');
        contains(all, "nginx sert /srv/gazette/current, mais n'y trouve pas");
        contains(all, 'Le site répond de nouveau');
        expect(s.execute('readlink -f /srv/gazette/current')).toBe('/srv/gazette/releases/20270514101502');
        const theo = hook(s, WITH_TESTS);
        if (reference) expect(theo).toContain("remote: Vérification de la page d'accueil (index.html)...");
        expect(theo).not.toContain('en ligne');
        contains(theo, "le crochet s'est arrêté avant de basculer current");
        expect(s.finished).toBe(false);
        const end = publishTheo(s);
        if (reference) expect(end).toContain('Avance rapide');
        expect(end).toContain('remote: Tests OK');
        if (reference) expect(end).toMatch(/remote: Version \d{14} en ligne/);
        contains(end, 'Tu as terminé le chapitre 2 de La Gazette');
        expect(s.execute('curl -s http://gazette.example/')).toContain('class="une"');
        expect(s.finished).toBe(true);
      });

      it('fausses pistes : ln sans -n, tests après la bascule, tests lancés depuis le dépôt', () => {
        const { s, tout: all } = play('rollback', ['cd /srv/gazette', 'ln -sf releases/20270514101502 current', 'curl -I http://gazette.example/']);
        contains(all, 'Le nouveau lien a été créé DANS la version cassée');
        expect(all).toContain('HTTP/1.1 403 Forbidden');
        s.execute('ln -sfn /srv/gazette/releases/20270514101502 /srv/gazette/current');
        // Les tests après la bascule : trop tard, la version de Théo est en ligne.
        const trop = hook(s, (t) => t.replace('echo', 'sh tests.sh\necho'));
        contains(trop, 'Le push cassé de Théo est passé en ligne');
        expect(s.execute('curl -I http://gazette.example/')).toContain('403 Forbidden');
        s.execute('ln -sfn /srv/gazette/releases/20270514101502 /srv/gazette/current');
        // Avant la bascule, mais depuis le dépôt : tout est refusé, même une bonne version.
        hook(s, (t) => t.replace('sh tests.sh\necho', 'echo').replace('ln -sfn', 'sh tests.sh\nln -sfn'));
        contains(publishTheo(s), 'tests.sh cherche index.html dans le lieu');
        expect(s.finished).toBe(false);
      });
    });

    describe('La Gazette, chapitre 3 — Bleu et vert (déployer sans coupure)', () => {
      const edit = (s: Shell, file: string, change: (text: string) => string) => {
        s.execute(`sudo nano ${file}`);
        s.saveEdition(change(s.edition!.text));
        return s.quitEdition();
      };
      const TO_GREEN = (t: string) => t.replace('127.0.0.1:3001', '127.0.0.1:3002');
      const SMTP = (t: string) => `${t}\nKIOSK_SMTP=smtp.gazette.example`;

      it('solution : la 1.5.0 sur vert, /health, la configuration des notes, puis nginx bascule et bleu reste allumé', () => {
        const { s, tout: all } = play('blue-green', [
          'curl -s http://localhost:3001/health',
          'ln -sfn /srv/kiosk/versions/1.5.0 /srv/kiosk/green',
          'sudo systemctl start kiosk-green',
          'gazette-2027',
          'curl -s localhost:3002/health',
          'cat /srv/kiosk/versions/1.5.0/NOTES.txt',
        ]);
        expect(all).toContain('{"status":"ok","version":"1.4.2"}');
        expect(all).toContain('{"status":"error","version":"1.5.0","error":"KIOSK_SMTP is not set"}');
        contains(all, '/health répond 503');
        edit(s, '/etc/kiosk/kiosk.env', SMTP);
        const health = ['sudo systemctl restart kiosk-green', 'curl -i localhost:3002/health'].map((l) => s.execute(l)).join('\n');
        expect(health).toContain('HTTP/1.1 200 OK');
        expect(health).toContain('{"status":"ok","version":"1.5.0"}');
        edit(s, '/etc/nginx/sites-available/gazette', TO_GREEN);
        const end = ['sudo nginx -t', 'sudo systemctl reload nginx'].map((l) => s.execute(l)).join('\n');
        expect(end).toContain('test is successful');
        contains(end, 'Tu as terminé le chapitre 3 de La Gazette');
        expect(s.execute('curl -s http://gazette.example/kiosk/')).toContain(`${reference ? 'Kiosque' : 'Kiosk'} 1.5.0`);
        expect(s.finished).toBe(true);
      });

      it('fausses pistes : sans redémarrer, bascule avant /health, sans reload, puis bleu arrêté trop tôt', () => {
        const { s, tout: all } = play('blue-green', [
          'sudo systemctl start kiosk-green',
          'gazette-2027',
          'ln -sfn /srv/kiosk/versions/1.5.0 /srv/kiosk/green',
          'curl -s localhost:3002/health',
        ]);
        contains(all, 'un programme lit son code');
        s.execute('sudo systemctl restart kiosk-green');
        edit(s, '/etc/nginx/sites-available/gazette', TO_GREEN);
        contains(s.execute('curl -s http://gazette.example/kiosk/') ?? '', 'il ne relit sa configuration');
        contains(s.execute('sudo systemctl reload nginx') ?? '', 'les lecteur·rices reçoivent une erreur');
        expect(s.execute('curl -s http://gazette.example/kiosk/')).toBe('Internal Server Error');
        edit(s, '/etc/kiosk/kiosk.env', SMTP);
        s.execute('sudo systemctl restart kiosk-green');
        expect(s.finished).toBe(true);
        // Une fois la bascule faite, arrêter bleu enlève le filet.
        contains(s.execute('sudo systemctl stop kiosk-blue') ?? '', 'plus de retour arrière instantané');
      });
    });

    describe('La Gazette, chapitre 4 — Le canari (upstream, weight, access.log)', () => {
      const site = (s: Shell, change: (text: string) => string) => {
        s.execute('sudo nano /etc/nginx/sites-available/gazette');
        s.saveEdition(change(s.edition!.text));
        return s.quitEdition();
      };
      const CANARY = (t: string) =>
        `upstream kiosk {\n    server 127.0.0.1:3002 weight=9;\n    server 127.0.0.1:3001 weight=1;\n}\n\n${t.replace('http://127.0.0.1:3002/', 'http://kiosk/')}`;
      const reload = (s: Shell) => ['sudo nginx -t', 'sudo systemctl reload nginx'].map((l) => s.execute(l)).join('\n');

      it('solution : canari de la 1.6.0, les 500 dans access.log, arrêt, 1.6.1, canari propre, bascule', () => {
        const { s } = play('canary', [
          'ln -sfn /srv/kiosk/versions/1.6.0 /srv/kiosk/blue',
          'sudo systemctl restart kiosk-blue',
          'gazette-2027',
        ]);
        expect(s.execute('curl -s localhost:3001/health')).toBe('{"status":"ok","version":"1.6.0"}');
        site(s, CANARY);
        const timeOfDay = reload(s);
        contains(timeOfDay, '60 visites sur le Kiosque');
        contains(timeOfDay, 'Le canari est en place');
        expect(s.execute("awk '{print $9}' /var/log/nginx/access.log | sort | uniq -c")).toMatch(/\s+\d+ 500/);
        const errors = s.execute('grep " 500 " /var/log/nginx/access.log') ?? '';
        expect(errors).toContain('"GET /kiosk/archives HTTP/1.1" 500');
        contains(errors, 'Des 500 sur /kiosk/archives');
        expect(s.execute('curl -s localhost:3001/archives')).toBe('Internal Server Error');
        site(s, (t) => t.replace('3001 weight=1;', '3001 weight=1 down;'));
        contains(reload(s), 'Canari arrêté');
        s.execute('ln -sfn /srv/kiosk/versions/1.6.1 /srv/kiosk/blue');
        s.execute('sudo systemctl restart kiosk-blue');
        site(s, (t) => t.replace(' down;', ';'));
        contains(reload(s), 'aucune erreur dans ce lot');
        expect(s.finished).toBe(false);
        site(s, (t) => t.replace('3002 weight=9;', '3002 weight=9 down;'));
        contains(reload(s), 'Tu as terminé le chapitre 4 de La Gazette');
        expect(s.execute('curl -s http://gazette.example/kiosk/')).toContain(`${reference ? 'Kiosque' : 'Kiosk'} 1.6.1`);
        expect(s.finished).toBe(true);
      });

      it("fausses pistes : tout d'un coup sur la 1.6.0, puis un « canari » à 50 %", () => {
        const { s } = play('canary', [
          'ln -sfn /srv/kiosk/versions/1.6.0 /srv/kiosk/blue',
          'sudo systemctl restart kiosk-blue',
          'gazette-2027',
        ]);
        site(s, (t) => t.replace('127.0.0.1:3002/', '127.0.0.1:3001/'));
        contains(reload(s), "Tout le trafic est passé d'un coup à la 1.6.0");
        site(
          s,
          (t) =>
            `upstream kiosk {\n    server 127.0.0.1:3002;\n    server 127.0.0.1:3001;\n}\n\n${t.replace('http://127.0.0.1:3001/', 'http://kiosk/')}`,
        );
        contains(reload(s), 'Une grosse part du trafic');
        expect(s.finished).toBe(false);
      });
    });

    describe('La Gazette, chapitre 5 — La migration (réparer en avant)', () => {
      const edit = (s: Shell, file: string, change: (text: string) => string) => {
        s.execute(`sudo nano ${file}`);
        s.saveEdition(change(s.edition!.text));
        return s.quitEdition();
      };
      const SMTP_URL = (t: string) => `${t}\nKIOSK_SMTP_URL=smtp://smtp.gazette.example:587`;

      it('solution : le journal raconte la migration, la variable renommée, puis bleu en 2.0.0', () => {
        const { s, tout: all } = play('migration', [
          'curl -s localhost:3002/health',
          'curl -s localhost:3001/health',
          'sudo journalctl -u kiosk-green',
          'gazette-2027',
        ]);
        expect(all).toContain('"error":"KIOSK_SMTP_URL is not set"');
        expect(all).toContain('"error":"database schema 4 is newer than supported (3)"');
        expect(all).toContain('Running migration 004_rename_abonnes_courriel_to_email... done');
        contains(all, 'il reste à réparer en avant');
        edit(s, '/etc/kiosk/kiosk.env', SMTP_URL);
        contains(s.execute('sudo systemctl restart kiosk-green') ?? '', 'Le Kiosque répond de nouveau');
        expect(s.finished).toBe(false);
        s.execute('ln -sfn /srv/kiosk/versions/2.0.0 /srv/kiosk/blue');
        contains(s.execute('sudo systemctl restart kiosk-blue') ?? '', 'Tu as terminé le chapitre 5 de La Gazette');
        expect(s.execute('curl -s localhost:3001/health')).toBe('{"status":"ok","version":"2.0.0"}');
        expect(s.finished).toBe(true);
      });

      it('fausse piste : revenir sur bleu (1.6.1) ne répare rien, la base a changé', () => {
        const { s } = play('migration', ['sudo id', 'gazette-2027']);
        const back = edit(s, '/etc/nginx/sites-available/gazette', (t) => t.replace('127.0.0.1:3002/', '127.0.0.1:3001/'));
        const reload = (s.execute('sudo systemctl reload nginx') ?? '') + back;
        contains(reload, 'la base a été migrée sous ses pieds');
        expect(s.execute('curl -s http://gazette.example/kiosk/')).toBe('Internal Server Error');
        expect(s.finished).toBe(false);
      });
    });

    describe('La Ludothèque, chapitre 1 — La rançon (rançongiciel, sauvegarde hors ligne)', () => {
      const RESTIC = 'sudo restic -r /mnt/cle/depot';
      const MDP = 'pion-cavalier-tour-27';

      it('solution : arrêter le chiffreur et sa crontab, verrouiller le compte, restaurer depuis la clé en lecture seule, la démonter', () => {
        const { s, tout: all } = play('ransom', [
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
        expect(all).toMatch(/^6$/m);
        expect(all).toContain(L('accueil      3141  97.3   1.4 /home/accueil/.cache/.maj/maj-systeme --silencieux'));
        expect(all).toContain(L('*/10 * * * * /home/accueil/.cache/.maj/maj-systeme --silencieux'));
        expect(all).toContain('Accepted password for accueil from 203.0.113.66');
        expect(all).toContain('SAUVEGARDE');
        if (reference) expect(all).toContain('touch: /mnt/cle/essai: Système de fichiers accessible en lecture seulement');
        expect(all).toContain('Summary: Restored 6 files/dirs');
        contains(all, 'On ne paie pas');
        contains(all, "Une copie synchronisée, toujours branchée, n'est pas une sauvegarde");
        contains(all, 'Les six fichiers sont revenus');
        expect(s.finished).toBe(false);
        const end = [
          'sudo find /srv/partage -name "*.locked" -delete',
          'sudo find /srv/partage -name LISEZ-MOI-POUR-RECUPERER.txt -delete',
          'sudo umount /mnt/cle',
        ]
          .map((l) => s.execute(L(l)))
          .join('\n');
        contains(end, 'Tu as terminé le chapitre 1 de La Ludothèque');
        if (reference) expect(s.execute(L('cat /srv/partage/regles/dames.txt'))).toContain('devient une dame');
        expect(s.finished).toBe(true);
      });

      it("fausses pistes : restaurer avant d'arrêter le chiffreur, l'oublier dans la crontab, démonter depuis dedans", () => {
        const { s, tout: all } = play('ransom', [
          'sudo mount /dev/sdb1 /mnt/cle',
          'ludo-2027',
          `${RESTIC} restore latest --target /`,
          MDP,
          'ls /srv/partage',
        ]);
        contains(all, 'le disque de sauvegarde est branché alors que le chiffreur tourne encore');
        contains(all, "Des fichiers restaurés viennent d'être chiffrés à leur tour");
        expect(all).not.toMatch(new RegExp(`${L('inventaire.csv').replace('.', '\\.')}(?!\\.locked)`));
        // Arrêté, mais sa crontab le relance.
        const back = ['sudo kill 3141', 'ls', 'ls', 'ls'].map((l) => s.execute(L(l))).join('\n');
        contains(back, 'Le chiffreur est revenu');
        expect(s.execute('ps aux')).toContain(L('maj-systeme'));
        s.execute(L('cd /mnt/cle'));
        expect(s.execute(L('sudo umount /mnt/cle'))).toBe(L('umount: /mnt/cle: target is busy.'));
        expect(s.finished).toBe(false);
      });
    });

    describe('La Ludothèque, chapitre 2 — Les instantanés (rsnapshot, liens physiques, cron)', () => {
      const edit = (s: Shell, command: string, change: (text: string) => string) => {
        s.execute(command);
        s.saveEdition(change(s.edition!.text));
        return s.quitEdition();
      };
      const SETTINGS = (t: string) =>
        t
          .replace('snapshot_root\t/var/cache/rsnapshot/', L('snapshot_root\t/mnt/instantanes/'))
          .replace('retain\talpha\t6\nretain\tbeta\t7\nretain\tgamma\t4', 'retain\tdaily\t7\nretain\tweekly\t4')
          .replace('backup\t/home/\t\tlocalhost/\nbackup\t/etc/\t\tlocalhost/\nbackup\t/usr/local/\tlocalhost/', L('backup\t/srv/partage/\tlocalhost/'));
      const CRON = (t: string) => `${t}0 3 * * 1 /usr/bin/rsnapshot weekly\n30 3 * * * /usr/bin/rsnapshot daily\n`;
      const D = L('/mnt/instantanes');
      // Le partage, dans la langue (/srv/share en anglais).
      const P = L('/srv/partage');

      it("solution : la configuration (tabulations), configtest, cron de root, puis l'inventaire de la veille", () => {
        const { s } = play('snapshots', ['sudo rsnapshot configtest', 'ludo-2027']);
        edit(s, 'sudo nano /etc/rsnapshot.conf', SETTINGS);
        expect(s.execute('sudo rsnapshot configtest')).toBe('Syntax OK');
        expect(s.execute('sudo rsnapshot -t daily')).toContain(
          `/usr/bin/rsync -a --delete --numeric-ids --relative --delete-excluded ${P}/ ${D}/daily.0/localhost/`,
        );
        const weeks = edit(s, 'sudo crontab -e', CRON);
        contains(weeks, 'Deux semaines passent');
        contains(weeks, "Hier soir, j'ai remplacé l'inventaire");
        expect(s.execute(`ls ${D}`)).toBe('daily.0/  daily.1/  daily.2/  daily.3/  daily.4/  daily.5/  daily.6/  weekly.0/');
        const forEachOf = s.execute('sudo rsnapshot du') ?? '';
        expect(forEachOf).toMatch(new RegExp(`^46M\t${D}/daily\\.0/$`, 'm'));
        expect(forEachOf).toMatch(new RegExp(`^\\d+K?\t${D}/daily\\.1/$`, 'm'));
        const inodes =
          s.execute(L(`ls -i ${D}/daily.0/localhost/srv/partage/regles/scans-regles.pdf ${D}/daily.6/localhost/srv/partage/regles/scans-regles.pdf`)) ??
          '';
        const [a, b] = inodes.split('\n\n').map((l) => l.trim().split(' ')[0]);
        expect(a).toBe(b);
        if (reference) expect(s.execute(L(`diff ${D}/daily.0/localhost/srv/partage/inventaire.csv ${D}/daily.1/localhost/srv/partage/inventaire.csv`))).toContain(
          '> jeu offert n°13;1;neuf',
        );
        expect(s.finished).toBe(false);
        contains(
          s.execute(L(`sudo cp ${D}/daily.1/localhost/srv/partage/inventaire.csv /srv/partage/`)) ?? '',
          'Tu as terminé le chapitre 2 de La Ludothèque',
        );
        expect(s.finished).toBe(true);
      });

      it("fausses pistes : des espaces au lieu de tabulations, la crontab d'un compte ordinaire, la version de cette nuit", () => {
        const { s } = play('snapshots', ['sudo id', 'ludo-2027']);
        edit(s, 'sudo nano /etc/rsnapshot.conf', (t) => SETTINGS(t).replace(L('snapshot_root\t/mnt/instantanes/'), L('snapshot_root /mnt/instantanes/')));
        const error = s.execute('sudo rsnapshot configtest') ?? '';
        expect(error).toContain(L('ERROR: snapshot_root /mnt/instantanes/ - Unknown config directive'));
        expect(error).toContain("ERROR: sure you don't have spaces where only tabs should be.");
        contains(error, 'jamais par des espaces');
        edit(s, 'sudo nano /etc/rsnapshot.conf', (t) => t.replace(L('snapshot_root /mnt/instantanes/'), L('snapshot_root\t/mnt/instantanes/')));
        const mails = edit(s, 'crontab -e', CRON);
        contains(mails, "n'a pas les droits de root");
        expect(s.execute(`ls ${D}`)).toBe('');
        expect(s.finished).toBe(false);
      });
    });

    describe('La Ludothèque, chapitre 3 — La base (pg_dump, restauration de test, pg_restore -t)', () => {
      const PG = 'sudo -u postgres';
      const DUMP = '/var/backups/postgresql/ludo.dump';
      const count = (s: Shell, base: string, table: string) => s.execute(`${PG} psql -d ${base} -c "SELECT count(*) FROM ${table};"`) ?? '';

      it('solution : pg_dump -Fc sous postgres, restauration dans ludo_test, la table prets remise, crontab de postgres', () => {
        const { s, tout: all } = play('database', [
          'psql -l',
          `${PG} psql -l`,
          'ludo-2027',
          `${PG} psql -d ludo -c "\\dt"`,
          `${PG} pg_dump -Fc -f ${DUMP} ludo`,
          `${PG} createdb ludo_test`,
          `${PG} pg_restore -d ludo_test ${DUMP}`,
        ]);
        expect(all).toContain(L('FATAL:  role "vous" does not exist'));
        expect(all).toContain(' public | prets   | table | ludo');
        contains(all, 'sudo -u postgres (man sudo)');
        contains(all, 'la sauvegarde se restaure');
        // La commande suivante : l'incident.
        const test = count(s, 'ludo_test', 'prets');
        expect(test).toContain('  1873 ');
        contains(test, 'Un bénévole a cliqué');
        expect(count(s, 'ludo', 'prets')).toMatch(/^\s+0 $/m);
        contains(s.execute(`${PG} pg_restore -d ludo --data-only -t prets ${DUMP}`) ?? '', 'sont revenus');
        expect(count(s, 'ludo', 'jeux')).toContain('   412 ');
        expect(s.finished).toBe(false);
        s.execute('sudo crontab -u postgres -e');
        s.saveEdition(`${s.edition!.text}15 2 * * * pg_dump -Fc -f ${DUMP} ludo\n`);
        contains(s.quitEdition(), 'Tu as terminé le chapitre 3 de La Ludothèque');
        expect(s.finished).toBe(true);
      });

      it('fausses pistes : la redirection, restaurer par-dessus ludo, réinjecter dans une table pleine, cron de root', () => {
        const { s, tout: all } = play('database', [
          'sudo -u postgres pg_dump ludo > /var/backups/postgresql/ludo.sql',
          'ludo-2027',
          `${PG} pg_dump -Fc -f ${DUMP} ludo`,
          `${PG} pg_restore -d ludo ${DUMP}`,
        ]);
        if (reference) expect(all).toContain('/var/backups/postgresql/ludo.sql : Permission non accordée');
        expect(all).toContain('pg_restore: error: could not execute query: ERROR:  relation "jeux" already exists');
        contains(all, 'Restaurer par-dessus la vraie base');
        expect(count(s, 'ludo', 'prets')).toContain('  1873 ');
        s.execute('sudo crontab -e');
        s.saveEdition(`${s.edition!.text}15 2 * * * pg_dump -Fc -f ${DUMP} ludo\n`);
        contains(s.quitEdition(), "root, qui n'est pas un");
        expect(s.finished).toBe(false);
      });
    });

    describe("L'Astreinte, chapitre 1 — Le disque plein (du, lsof, truncate, logrotate)", () => {
      const edit = (s: Shell, file: string, change: (text: string) => string) => {
        s.execute(`sudo nano ${file}`);
        s.saveEdition(change(s.edition!.text));
        return s.quitEdition();
      };
      const ROTATION = (end: string) => () =>
        `/var/log/radio/*.log {\n    daily\n    rotate 7\n    compress\n    delaycompress\n    missingok\n    notifempty\n${end}}`;

      it('solution : du, le debug, truncate, info, logrotate avec copytruncate', () => {
        const { s, tout: all } = play('full-disk', [
          'df -h',
          'sudo du -sh /var/log/*',
          'antenne-2027',
          'sudo tail -n 2 /var/log/radio/stream.log',
          'sudo truncate -s 0 /var/log/radio/stream.log',
          'df -h',
        ]);
        expect(all).toMatch(/\/dev\/vda1 +19G +19G +0 100% \//);
        expect(all).toMatch(/^15G\t\/var\/log\/radio$/m);
        expect(all).toContain('DEBUG relay: packet');
        contains(all, 'Le disque respire');
        edit(s, '/etc/radio/stream.conf', (t) => t.replace('loglevel = debug', 'loglevel = info'));
        s.execute('sudo systemctl restart radio-stream');
        expect(s.finished).toBe(false);
        contains(edit(s, '/etc/logrotate.d/radio', ROTATION('    copytruncate\n')), "Tu as terminé le chapitre 1 de L'Astreinte");
        expect(s.execute('sudo logrotate -d /etc/logrotate.d/radio')).toContain('rotating pattern: /var/log/radio/*.log');
        expect(s.finished).toBe(true);
      });

      it("fausses pistes : rm d'un fichier ouvert, logrotate qui renomme sans faire rouvrir, une directive inconnue", () => {
        const { s, tout: all } = play('full-disk', ['sudo rm /var/log/radio/stream.log', 'antenne-2027', 'df -h', 'sudo lsof +L1']);
        expect(all).toContain('100% /');
        expect(all).toContain('/var/log/radio/stream.log (deleted)');
        contains(all, 'df dit toujours plein, mais du ne trouve plus le fichier');
        s.execute('sudo systemctl restart radio-stream');
        expect(s.execute('df -h')).not.toContain('100%');
        edit(s, '/etc/radio/stream.conf', (t) => t.replace('loglevel = debug', 'loglevel = info'));
        s.execute('sudo systemctl restart radio-stream');
        edit(s, '/etc/logrotate.d/radio', () => '/var/log/radio/*.log {\n    dayly\n    rotate 7\n}');
        expect(s.execute('sudo logrotate -d /etc/logrotate.d/radio')).toContain(
          "error: /etc/logrotate.d/radio:2 unknown option 'dayly' -- ignoring line",
        );
        edit(s, '/etc/logrotate.d/radio', ROTATION(''));
        contains(s.execute('sudo logrotate -f /etc/logrotate.d/radio') ?? '', "le relais écrit toujours dans l'ancien fichier");
        expect(s.execute('sudo lsof -p 1730')).toContain('/var/log/radio/stream.log.1');
        expect(s.finished).toBe(false);
      });
    });

    describe("L'Astreinte, chapitre 2 — La mémoire (OOM killer, MemoryMax=, Restart=, zombies)", () => {
      it('solution : dmesg, top, systemctl edit (MemoryMax=, Restart=), le parent des zombies redémarré', () => {
        const { s, tout: all } = play('memory', [
          'systemctl status radio-playlist',
          'sudo dmesg -T',
          'antenne-2027',
          'free -h',
          'ps -ef',
          'sudo systemctl edit radio-playlist',
        ]);
        expect(all).toContain('Active: failed (Result: oom-kill)');
        expect(all).toContain('[Sun Aug 22 04:12:30 2027] Out of memory: Killed process 2601 (node)');
        expect(all).toMatch(/^Mem: +2\.0Gi +\d+Mi/m);
        expect(all).toMatch(/radio +2411 +2305 .*\[convertir\] <defunct>/);
        contains(all, "l'OOM killer");
        s.saveEdition(`[Service]\nMemoryMax=600M\nRestart=on-failure\n${s.edition!.text}`);
        s.quitEdition();
        expect(s.read('/etc/systemd/system/radio-playlist.service.d/override.conf')).toBe('[Service]\nMemoryMax=600M\nRestart=on-failure');
        s.execute('sudo systemctl start radio-playlist');
        expect(s.execute('systemctl status radio-playlist')).toMatch(/Memory: \d+\.\dM \(max: 600\.0M/);
        // La fuite atteint la limite : systemd tue la playlist et la relance, la machine ne sent rien.
        let outputs = '';
        for (let i = 0; i < 8; i++) outputs += s.execute('top -b -n 1 -o %MEM');
        contains(outputs, 'systemd l');
        expect(s.execute('sudo dmesg')).toContain('Memory cgroup out of memory: Killed process');
        expect(s.execute('systemctl status radio-playlist')).toContain('restart counter is at 1');
        expect(s.finished).toBe(false);
        contains(s.execute('sudo systemctl restart radio-podcast') ?? '', "Tu as terminé le chapitre 2 de L'Astreinte");
        expect(s.execute('ps aux')).not.toContain('<defunct>');
        expect(s.finished).toBe(true);
      });

      it('autre solution : systemctl set-property, puis Restart= écrit à la main et daemon-reload', () => {
        const { s } = play('memory', ['sudo systemctl set-property radio-playlist MemoryMax=512M', 'antenne-2027']);
        expect(s.read('/etc/systemd/system.control/radio-playlist.service.d/50-MemoryMax.conf')).toContain('MemoryMax=536870912');
        expect(s.execute('sudo systemctl set-property radio-playlist Restart=on-failure')).toContain('Cannot set property Restart');
        s.execute('sudo mkdir -p /etc/systemd/system/radio-playlist.service.d');
        s.execute('sudo nano /etc/systemd/system/radio-playlist.service.d/restart.conf');
        s.saveEdition('[Service]\nRestart=on-failure\n');
        s.quitEdition();
        expect(s.execute('sudo systemctl start radio-playlist')).toContain("Run 'systemctl daemon-reload' to reload units.");
        s.execute('sudo systemctl restart radio-podcast');
        expect(s.finished).toBe(false);
        s.execute('sudo systemctl daemon-reload');
        expect(s.finished).toBe(true);
      });

      it('fausses pistes : kill -9 sur un zombie, relancer sans limite, une limite sans relance', () => {
        const { s, tout: all } = play('memory', ['sudo kill -9 2411', 'antenne-2027', 'ps aux', 'sudo systemctl start radio-playlist']);
        expect(all).toContain('[convertir] <defunct>');
        contains(all, 'kill ne fait rien à un zombie');
        let outputs = '';
        for (let i = 0; i < 16; i++) outputs += s.execute('free -m');
        contains(outputs, 'Et voilà');
        expect(s.execute('sudo dmesg')).toContain('node invoked oom-killer');
        contains(s.execute('sudo systemctl set-property radio-playlist MemoryMax=100M') ?? '', 'Cette limite est trop basse');
        s.execute('sudo systemctl set-property radio-playlist MemoryMax=400M');
        s.execute('sudo systemctl start radio-playlist');
        outputs = '';
        for (let i = 0; i < 5; i++) outputs += s.execute('free -m');
        contains(outputs, 'elle est restée arrêtée');
        expect(s.execute('systemctl is-active radio-playlist')).toBe('failed');
        expect(s.finished).toBe(false);
      });
    });

    describe("L'Astreinte, chapitre 3 — Les inodes (df -i, du --inodes, find -mtime -delete, cron)", () => {
      const crontab = (s: Shell, command: string, line: string) => {
        s.execute(command);
        s.saveEdition(`${s.edition!.text}${line}\n`);
        return s.quitEdition();
      };

      it('solution : df -i, du --inodes, find -mtime +30 -delete, puis une tâche cron', { timeout: 30_000 }, () => {
        const { s, tout: all } = play('inodes', [
          'df -h',
          'sudo df -i',
          'antenne-2027',
          'sudo du --inodes -d 1 /srv/radio',
          'sudo find /srv/radio/stats -type f -mtime +30 | wc -l',
          'sudo find /srv/radio/stats -type f -mtime +30 -delete',
          'df -ih /srv/radio',
        ]);
        if (reference) expect(all).toMatch(/\/dev\/vdb1 +1,0G +223M +801M +22% \/srv\/radio/);
        expect(all).toMatch(/\/dev\/vdb1 +65536 +65536 +0 +100% \/srv\/radio/);
        expect(all).toMatch(/^65519\t\/srv\/radio\/stats$/m);
        contains(all, "l'enregistrement de nuit a repris");
        expect(s.find(L('/srv/radio/emissions/nuit-2027-08-29.ogg'))).toBeTruthy();
        expect(s.finished).toBe(false);
        const night = crontab(s, 'sudo crontab -e', '15 4 * * * find /srv/radio/stats -type f -mtime +30 -delete');
        contains(night, 'Une journée et une nuit passent');
        contains(night, 'le plus ancien a 30 jours');
        contains(night, "Tu as terminé le chapitre 3 de L'Astreinte");
        expect(s.finished).toBe(true);
      });

      it('autre solution : la tâche cron du compte radio fait aussi le grand ménage', { timeout: 30_000 }, () => {
        const { s } = play('inodes', ['sudo df -i /srv/radio', 'antenne-2027']);
        const night = crontab(s, 'sudo crontab -u radio -e', '0 3 * * * find /srv/radio/stats -name "ecoute-*" -mtime +45 -delete');
        contains(night, 'Une journée et une nuit passent');
        expect(s.finished).toBe(true);
      });

      it('fausses pistes : rm *, une crontab sans les droits, une tâche qui efface tout', { timeout: 30_000 }, () => {
        const { s, tout: all } = play('inodes', ['sudo touch /srv/radio/essai', 'antenne-2027', 'cd /srv/radio/stats', 'sudo rm *']);
        if (reference) expect(all).toContain('Aucun espace disponible sur le périphérique');
        if (reference) expect(all).toContain("sudo: impossible d'exécuter /usr/bin/rm: Liste d'arguments trop longue");
        contains(all, 'le shell remplace * par tous les noms du lieu');
        // La crontab de « vous » : pas le droit d'effacer les fichiers du compte radio.
        const night = crontab(s, 'crontab -e', '15 4 * * * find /srv/radio/stats -type f -mtime +30 -delete');
        contains(night, 'Courrier de cron');
        if (reference) expect(night).toContain('Permission non accordée');
        contains(night, 'la tâche n');
        expect(s.finished).toBe(false);
        // Une tâche qui efface tout, sans regarder l'âge.
        contains(
          crontab(s, 'sudo crontab -e', '15 4 * * * find /srv/radio/stats -type f -delete'),
          'des statistiques de moins de 30 jours ont disparu',
        );
        expect(s.finished).toBe(false);
      });
    });

    describe("L'Astreinte, chapitre 4 — L'horloge (timedatectl, NTP, fuseau, cron)", () => {
      const fixNtp = (s: Shell) => {
        s.execute('sudo nano /etc/systemd/timesyncd.conf');
        s.saveEdition(s.edition!.text.replace('NTP=ntp.old-hosting.example', 'NTP=ntp.hosting.example'));
        return s.quitEdition();
      };

      it('solution : timedatectl, set-timezone, set-ntp, le bon serveur NTP, cron redémarré', () => {
        const { s, tout: all } = play('clock', [
          'date',
          'timedatectl',
          'cat mail_hebergeur.txt',
          'sudo timedatectl set-timezone Europe/Paris',
          'antenne-2027',
          'sudo timedatectl set-ntp true',
        ]);
        if (reference) expect(all).toMatch(/lun\. 30 août 2027 07:02:\d\d UTC/);
        expect(all).toContain('Time zone: Etc/UTC (UTC, +0000)');
        expect(all).toContain('System clock synchronized: no');
        contains(all, "C'est vrai de beaucoup de services");
        contains(all, 'le serveur NTP qu');
        expect(s.execute('sudo journalctl -u systemd-timesyncd')).toContain(
          'Timed out waiting for reply from 198.51.100.7:123 (ntp.old-hosting.example).',
        );
        fixNtp(s);
        contains(s.execute('sudo systemctl restart systemd-timesyncd') ?? '', "l'horloge est synchronisée");
        const state = s.execute('timedatectl')!;
        if (reference) expect(state).toMatch(/Local time: lun\. 2027-08-30 09:12:\d\d CEST/);
        expect(state).toContain('Time zone: Europe/Paris (CEST, +0200)');
        expect(state).toContain('System clock synchronized: yes');
        expect(s.execute('timedatectl timesync-status')).toContain('Server: 192.0.2.123 (ntp.hosting.example)');
        expect(s.finished).toBe(false);
        contains(s.execute('sudo systemctl restart cron') ?? '', "Tu as terminé le chapitre 4 de L'Astreinte");
        expect(s.finished).toBe(true);
      });

      it("autre solution : le serveur NTP d'abord, puis systemctl enable --now, le fuseau et cron", () => {
        const { s } = play('clock', ['sudo timedatectl', 'antenne-2027']);
        fixNtp(s);
        s.execute('sudo systemctl enable --now systemd-timesyncd');
        s.execute('sudo timedatectl set-timezone Europe/Paris');
        s.execute('sudo systemctl restart cron');
        expect(s.finished).toBe(true);
      });

      it('fausses pistes : date -s à la main, un fuseau mal écrit, set-time avec NTP actif, démarrer sans activer', () => {
        const { s, tout: all } = play('clock', ['sudo date -s "2027-08-30 09:12:00"', 'antenne-2027', 'sudo timedatectl set-timezone Europe/Pariss']);
        contains(all, 'pour l');
        expect(all).toContain("Failed to set time zone: Invalid or not installed time zone 'Europe/Pariss'");
        if (reference) expect(s.execute('date -s 09:00')).toContain('impossible de régler la date');
        fixNtp(s);
        contains(s.execute('sudo systemctl start systemd-timesyncd') ?? '', 'pas activé');
        expect(s.execute('sudo timedatectl set-time "2027-08-30 09:00:00"')).toContain(
          'Failed to set time: Automatic time synchronization is enabled',
        );
        s.execute('sudo timedatectl set-timezone Europe/Paris');
        s.execute('sudo systemctl restart cron');
        expect(s.finished).toBe(false);
        s.execute('sudo timedatectl set-ntp true');
        expect(s.finished).toBe(true);
      });
    });

    describe("L'Astreinte, chapitre 5 — La sonde (plugins de supervision, mail, timer systemd)", () => {
      const write = (s: Shell, file: string, change: (text: string) => string) => {
        s.execute(`sudo nano ${file}`);
        s.saveEdition(change(s.edition!.text));
        return s.quitEdition();
      };
      const CONTROLS =
        '\n$P/check_disk -w 20% -c 10% -W 20% -K 10% -p /srv/radio | grep -v " OK" | $ALERTE\n$P/check_http -H localhost -p 8000 -u /direct | grep -v " OK" | $ALERTE\n';
      const SERVICE = '[Unit]\nDescription=Sonde de Radio Quartier\n\n[Service]\nType=oneshot\nExecStart=/usr/local/bin/probe\n';
      const TIMER = (trigger: string) =>
        `[Unit]\nDescription=Sonde toutes les 5 minutes\n\n[Timer]\n${trigger}\n\n[Install]\nWantedBy=timers.target\n`;

      it('solution : les plugins, la sonde complétée, un timer systemd, et la nuit d exercice', { timeout: 30_000 }, () => {
        const { s, tout: all } = play('probe', [
          'check_disk -w 20% -c 10% -p /',
          '/usr/lib/nagios/plugins/check_disk -w 20% -c 10% -W 20% -K 10% -p /srv/radio',
          "systemd-analyze calendar '*:0/5'",
        ]);
        // Une adresse web (/direct), pas un chemin du monde : tapée telle quelle dans chaque langue.
        expect(s.execute('/usr/lib/nagios/plugins/check_http -H localhost -p 8000 -u /direct')).toContain('HTTP OK: HTTP/1.1 200 OK');
        if (reference) expect(all).toContain('check_disk : commande introuvable');
        contains(all, 'ne sont pas dans le PATH');
        expect(all).toContain('DISK OK - free space: /srv/radio 122 MB (47% inode=99%);');
        expect(all).toContain('Normalized form: *-*-* *:00/5:00');
        s.execute('sudo true');
        s.execute(machinesInLanguage(s.t, 'antenne-2027'));
        write(s, '/usr/local/bin/probe', (t) => t + CONTROLS);
        write(s, '/etc/systemd/system/probe.service', () => SERVICE);
        write(s, '/etc/systemd/system/probe.timer', () => TIMER('OnCalendar=*:0/5'));
        s.execute('sudo systemctl daemon-reload');
        const night = s.execute('sudo systemctl enable --now probe.timer')!;
        expect(night).toContain('Created symlink /etc/systemd/system/timers.target.wants/probe.timer → /etc/systemd/system/probe.timer.');
        contains(night, 'Zoé lance l');
        contains(night, 'Le direct a été muet 10 minutes');
        contains(night, 'bien avant la fin des inodes');
        contains(night, "Tu as terminé le chapitre 5 de L'Astreinte");
        expect(s.execute('systemctl list-timers')).toMatch(/probe\.timer +probe\.service/);
        expect(s.execute('sudo cat /var/mail/zoe')).toContain('HTTP CRITICAL - Unable to open TCP socket');
        expect(s.finished).toBe(true);
      });

      it('autre solution : une ligne de crontab, check_procs pour le relais', { timeout: 30_000 }, () => {
        const { s } = play('probe', ['sudo true', 'antenne-2027']);
        write(
          s,
          '/usr/local/bin/probe',
          (t) =>
            t.replace('$P/check_disk -w 20% -c 10% -p /', '$P/check_disk -w 20% -c 10% -W 20% -K 10% -p / -p /srv/radio') +
            '\n$P/check_procs -C stream -c 1: | grep -v " OK" | $ALERTE\n',
        );
        s.execute('sudo crontab -e');
        s.saveEdition(`${s.edition!.text}*/5 * * * * /usr/local/bin/probe\n`);
        contains(s.quitEdition(), "Tu as terminé le chapitre 5 de L'Astreinte");
        expect(s.finished).toBe(true);
      });

      it('fausses pistes : la sonde de départ, OnUnitActiveSec seul, des seuils trop serrés', { timeout: 60_000 }, () => {
        const { s } = play('probe', ['sudo true', 'antenne-2027']);
        write(s, '/etc/systemd/system/probe.service', () => SERVICE);
        write(s, '/etc/systemd/system/probe.timer', () => TIMER('OnUnitActiveSec=5min'));
        let night = s.execute('sudo systemctl enable --now probe.timer')!;
        contains(night, 'Rien n');
        contains(night, 'OnUnitActiveSec= seul ne part jamais');
        write(s, '/etc/systemd/system/probe.timer', () => TIMER('OnCalendar=*:0/5'));
        night = s.execute('sudo systemctl daemon-reload')!;
        contains(night, 'et personne n');
        contains(night, 'plus un inode libre');
        night = write(s, '/usr/local/bin/probe', (t) => t.replace('-w 20% -c 10% -p /', '-w 60% -c 10% -p /') + CONTROLS);
        contains(night, 'alors que tout allait bien');
        expect(s.finished).toBe(false);
      });
    });

    describe("L'Astreinte, chapitre 7 — Le goulot (iowait, iostat, pidstat, IOWriteBandwidthMax=)", () => {
      it('solution : top, iostat, pidstat, puis une limite de débit avec set-property', () => {
        const { s, tout: all } = play('bottleneck', [
          'top',
          'iostat -x',
          'sudo pidstat -d',
          'antenne-2027',
          'journalctl -u radio-stream -n 3',
          'sudo systemctl set-property radio-archives "IOWriteBandwidthMax=/dev/vda 20M"',
          'iostat -x',
        ]);
        expect(all).toMatch(/\d+\.\d wa/);
        expect(all).toContain('Device            r/s     rkB/s');
        expect(all).toContain('rsync');
        expect(all).toContain('read stall');
        contains(all, 'iowait');
        expect(s.read('/etc/systemd/system.control/radio-archives.service.d/50-IOWriteBandwidthMax.conf')).toContain(
          'IOWriteBandwidthMax=/dev/vda 20971520',
        );
        contains(all, 'https://docs.kernel.org/admin-guide/cgroup-v2.html#io');
        expect(s.finished).toBe(true);
      });

      it('une autre solution : systemctl edit, IOReadBandwidthMax= sur un chemin, daemon-reload', () => {
        const { s } = play('bottleneck', ['sudo systemctl edit radio-archives', 'antenne-2027']);
        s.saveEdition(`[Service]\nIOReadBandwidthMax=/srv 30M\n${s.edition!.text}`);
        s.quitEdition();
        s.execute('sudo systemctl daemon-reload');
        s.execute('iostat');
        expect(s.finished).toBe(true);
      });

      it('fausses pistes : ionice (ordonnanceur none), arrêter l’archivage, le mauvais disque, trop bas', () => {
        const { s, tout: all } = play('bottleneck', [
          'pidstat -d',
          'ionice -p 2190',
          'sudo ionice -c 3 -p 2190',
          'antenne-2027',
          'ionice -p 2190',
          'iostat -x',
          'cat /sys/block/vda/queue/scheduler',
          'sudo systemctl set-property radio-archives "IOWriteBandwidthMax=/dev/sda 20M"',
          'sudo systemctl set-property radio-archives "IOWriteBandwidthMax=/dev/vda 1M"',
          'sudo systemctl stop radio-archives',
        ]);
        expect(all).toContain('best-effort: prio 4');
        expect(all).toContain('idle');
        expect(all).toContain('[none] mq-deadline');
        contains(all, 'sans priorité');
        contains(all, 'un disque qui n');
        contains(all, "n'aura pas fini");
        contains(all, 'ne seront pas archivées');
        expect(s.finished).toBe(false);
        s.execute('sudo systemctl set-property radio-archives "IOWriteBandwidthMax=/dev/vda 25M"');
        s.execute('sudo systemctl start radio-archives');
        expect(s.finished).toBe(true);
      });
    });

    describe("L'Astreinte, chapitre 6 — Le post-mortem (journalctl --since, last, sans reproche)", () => {
      const POSTMORTEM = [
        '# Post-mortem : coupure du direct, nuit du 11 au 12 septembre 2027',
        '',
        '## Résumé',
        'Le direct a coupé dans la nuit de dimanche, puis Théo l a relancé.',
        '',
        '## Chronologie',
        '- 02:13 : la mise à jour automatique relance le relais, qui ne repart pas.',
        '- 02:15 : première alerte de la sonde.',
        '- 02:41 : Théo se connecte.',
        '- 02:58 : le relais repart.',
        '',
        '## Impact',
        '45 minutes de silence sur le direct.',
        '',
        '## Causes',
        'unattended-upgrades (needrestart) a relancé le relais ; une option inconnue (bitrate_max) attendait dans stream.conf depuis le 20 août.',
        '',
        '## Ce qui a bien marché',
        'La sonde a prévenu en 2 minutes.',
        '',
        '## Actions',
        '- Vérifier la configuration avant chaque redémarrage (ExecStartPre=).',
        '- Relancer le relais après chaque modification.',
      ].join('\n');
      // Le même post-mortem, écrit en anglais (titres et mots attendus de la version anglaise).
      const POSTMORTEM_IN = [
        '# Post-mortem: live stream outage, night of 11 to 12 September 2027',
        '',
        '## Summary',
        'The live stream went down on Sunday night, then Théo restarted it.',
        '',
        '## Timeline',
        '- 02:13: the automatic update restarts the relay, which does not come back.',
        '- 02:15: first alert from the probe.',
        '- 02:41: Théo logs in.',
        '- 02:58: the relay is back.',
        '',
        '## Impact',
        '45 minutes of silence on the live stream.',
        '',
        '## Causes',
        'unattended-upgrades (needrestart) restarted the relay; an unknown option (bitrate_max) had been waiting in stream.conf since 20 August.',
        '',
        '## What went well',
        'The probe alerted us within 2 minutes.',
        '',
        '## Actions',
        '- Check the configuration before every restart (ExecStartPre=).',
        '- Restart the relay after every change.',
      ].join('\n');

      it('solution : les journaux de la nuit, puis le post-mortem complet', () => {
        const { s, tout: all } = play('post-mortem', [
          'cat notes_theo.txt',
          'last',
          'sudo journalctl --since "2027-09-12 02:00" --until "2027-09-12 03:30"',
          'antenne-2027',
          'sudo cat /var/log/unattended-upgrades/unattended-upgrades-dpkg.log',
          'sudo journalctl | grep stream.conf',
        ]);
        contains(all, 'des pistes, pas des faits');
        expect(all).toMatch(/theo +pts\/0 +203\.0\.113\.45 +Sun Sep 12 02:41 - 03:05  \(00:24\)/);
        if (reference) expect(all).toContain("sept. 12 02:13:06 radio stream[24410]: /etc/radio/stream.conf:7: unknown option 'bitrate_max'");
        expect(all).not.toContain(
          'août 20 21:20:41 radio sudo[7790]:      zoe : TTY=pts/1 ; PWD=/home/zoe ; USER=root ; COMMAND=/usr/bin/nano /etc/radio/stream.conf\nsept. 12 02:12',
        );
        expect(all).toContain(' systemctl restart radio-stream.service');
        contains(all, 'trois semaines');
        s.execute('nano postmortem.md');
        s.saveEdition(reference ? POSTMORTEM : POSTMORTEM_IN);
        contains(s.quitEdition(), 'Tu as terminé L');
        expect(s.finished).toBe(true);
      });

      it('fausses pistes : les heures des notes de Théo, un coupable, une seule action', () => {
        const { s } = play('post-mortem', []);
        s.execute('nano postmortem.md');
        s.saveEdition(
          POSTMORTEM.replace('02:13', '02:20')
            .replace('Causes\n', 'Causes\nC est la faute de Zoé. ')
            .replace('- Relancer le relais après chaque modification.', ''),
        );
        const reread = s.quitEdition();
        contains(reread, 'faute');
        contains(reread, 'heure de la coupure');
        contains(reread, 'Au moins deux actions');
        expect(s.finished).toBe(false);
      });
    });

    describe.runIf(reference)('Le manuel, premier réflexe', () => {
      const s = new Shell(chapter('lighthouse'), language);
      it('man affiche une vraie page', () => {
        const page = s.execute('man ls')!;
        for (const section of ['NOM', 'SYNOPSIS', 'DESCRIPTION', 'OPTIONS', 'EXEMPLES', 'VOIR AUSSI']) expect(page).toContain(section);
      });
      it('--help, man -k, whatis', () => {
        expect(s.execute('ls --help')).toContain('Utilisation : ls');
        expect(s.execute('man -k copie')).toContain('cp (1)');
        expect(s.execute('whatis mv')).toMatch(/^mv \(1\)/);
      });
      it('option inconnue : le vrai message', () => {
        expect(s.execute('ls -z')).toBe("ls : option invalide -- 'z'\nSaisissez « ls --help » pour plus d'informations.");
      });
      it('messages de man-db', () => {
        expect(s.execute('man')).toContain(L('Quelle page de manuel voulez-vous ?'));
        expect(s.execute('man xyz')).toBe("Il n'y a pas de page de manuel pour xyz.");
      });
      it('chaque commande du jeu a une page', () => {
        for (const h of STORIES) for (const c of h.chapters) for (const cmd of c.commands) expect(s.execute(`man ${cmd}`)).toContain('NOM');
      });
    });
    it('chaque commande du jeu a une page de manuel', () => {
      const s = new Shell(chapter('lighthouse'), language);
      for (const h of STORIES)
        for (const c of h.chapters)
          for (const cmd of c.commands) expect(s.execute(`man ${cmd}`)).toMatch(new RegExp(`^${cmd.toUpperCase()}\\([18]\\)`));
    });
  });
