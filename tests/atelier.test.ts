// Les Lettres du quartier, « L'atelier de réparation » : Apache derrière
// nginx. Rejoué dans chaque langue : la solution, une autre (les règles dans
// le VirtualHost, nginx qui transmet le nom), et les fausses pistes.

import { describe, expect, it } from 'vitest';
import { Console } from '../src/moteur/console';
import { HISTOIRES } from '../src/moteur/chapitres';
import { prerequis } from '../src/moteur/deverrouillage';
import { LANGUES, LANGUE_DE_REFERENCE } from '../src/textes';
import { machinesDansLaLangue } from './noms';

const LETTRES = HISTOIRES.find((h) => h.id === 'lettres')!.chapitres.map((c) => c.id);
const AVANT = [...new Set([...HISTOIRES.find((h) => h.id === 'effaceur')!.chapitres.map((c) => c.id), ...prerequis('lettres'), ...LETTRES.slice(0, LETTRES.indexOf('atelier'))])];
const REPAIR = '/etc/apache2/sites-available/repair.conf';
const DIRECTORY = '    <Directory /var/www/repair>\n        AllowOverride All\n    </Directory>\n</VirtualHost>';

for (const langue of LANGUES)
  describe(`Langue : ${langue}`, () => {
    const fr = langue === LANGUE_DE_REFERENCE;
    const partie = () => {
      const c = new Console({ langue, termines: AVANT });
      const jouer = (lignes: string[]) =>
        lignes
          .map((l) => {
            let s = c.executer(machinesDansLaLangue(c.t, l)) ?? '';
            if (c.shell.attente) s += c.executer(machinesDansLaLangue(c.t, 'fourmis-2026')) ?? '';
            return s;
          })
          .join('\n');
      const ecrire = (fichier: string, changer: (texte: string) => string) => {
        c.executer(`sudo nano ${fichier}`);
        if (c.shell.attente) c.executer(machinesDansLaLangue(c.t, 'fourmis-2026'));
        c.enregistrer(changer(c.edition!.texte));
        return c.quitterEdition();
      };
      // SSH écoute sur 2222 depuis « Le port ».
      jouer(['ssh -p 2222 lettres', 'yes']);
      expect(c.distant?.shell.chapitre.id).toBe('atelier');
      return { c, jouer, ecrire };
    };

    it('solution : le port, le site, nginx devant, AllowOverride et mod_rewrite', () => {
      const { c, jouer, ecrire } = partie();
      let tout = jouer(['systemctl status apache2', 'journalctl -u apache2', 'sudo ss -tlnp']);
      expect(tout).toContain('(98)Address already in use: AH00072: make_sock: could not bind to address [::]:80');
      expect(tout).toContain('users:(("nginx",pid=701,fd=3))');
      if (fr) expect(tout).toContain('nginx y est déjà');
      tout = ecrire('/etc/apache2/ports.conf', (t) => t.replace('Listen 80', 'Listen 127.0.0.1:8080'));
      tout += jouer(['sudo apache2ctl configtest', 'sudo systemctl restart apache2', 'sudo ss -tlnp', 'sudo apache2ctl -S']);
      expect(tout).toContain('Syntax OK');
      expect(tout).toContain('127.0.0.1:8080');
      expect(tout).toContain('users:(("apache2",pid=2301,fd=3))');
      // Le lien de Rania (sans .conf) n'est pas lu : seul 000-default apparaît.
      expect(tout).toContain('*:80                   127.0.1.1 (/etc/apache2/sites-enabled/000-default.conf:1)');
      expect(tout).not.toContain('repair.example (');
      tout = jouer(['curl -H "Host: repair.example" http://127.0.0.1:8080/']);
      expect(tout).toContain('Apache2 Debian Default Page');
      if (fr) expect(tout).toContain('page par défaut');
      tout = jouer(['sudo a2ensite repair']);
      expect(tout).toContain('Enabling site repair.\nTo activate the new configuration, you need to run:\n  systemctl reload apache2');
      ecrire(REPAIR, (t) => t.replace('<VirtualHost *:80>', '<VirtualHost 127.0.0.1:8080>'));
      tout = jouer(['sudo systemctl reload apache2', 'sudo apache2ctl -S', 'curl -H "Host: repair.example" http://127.0.0.1:8080/']);
      expect(tout).toContain('127.0.0.1:8080         repair.example (/etc/apache2/sites-enabled/repair.conf:1)');
      expect(tout).toContain(c.t('atelier-site-accueil'));
      // nginx n'a pas encore le site : la visite tombe sur les Lettres (site par défaut).
      tout = jouer(['sudo ln -s /etc/nginx/sites-available/repair /etc/nginx/sites-enabled/', 'sudo nginx -t', 'sudo systemctl reload nginx', 'curl http://repair.example/']);
      expect(tout).toContain(c.t('atelier-site-accueil'));
      tout = jouer(['curl http://repair.example/guide/42']);
      expect(tout).toContain('The requested URL was not found on this server.');
      if (fr) expect(tout).toContain('AllowOverride None');
      ecrire(REPAIR, (t) => t.replace('</VirtualHost>', DIRECTORY));
      tout = jouer(['sudo apache2ctl configtest', 'sudo systemctl reload apache2', 'curl -i http://repair.example/guide/42', 'sudo tail -1 /var/log/apache2/repair-error.log']);
      expect(tout).toContain('HTTP/1.1 500 Internal Server Error');
      expect(tout).toContain("/var/www/repair/.htaccess: Invalid command 'RewriteEngine', perhaps misspelled or defined by a module not included in the server configuration");
      expect(c.termines).not.toContain('atelier');
      // apache2ctl -M relit la configuration sur le disque : le module y est, Apache ne l'a pas encore chargé.
      tout = jouer(['sudo a2enmod rewrite', 'apache2ctl -M']);
      expect(tout).toContain('systemctl restart apache2');
      expect(tout).toContain(' rewrite_module (shared)');
      tout = jouer(['sudo systemctl restart apache2', 'curl http://repair.example/guide/42']);
      expect(tout).toContain(c.t('atelier-fiche-42'));
      if (fr) expect(tout).toContain('https://httpd.apache.org/docs/2.4/howto/htaccess.html');
      expect(c.termines).toContain('atelier');
    });

    it('une autre solution : le site par défaut aussi sur 8080, nginx transmet le nom, les règles dans le VirtualHost', () => {
      const { c, jouer, ecrire } = partie();
      ecrire('/etc/apache2/ports.conf', (t) => t.replace('Listen 80', 'Listen 127.0.0.1:8080'));
      // Comme le dit le commentaire de ports.conf : le VirtualHost de 000-default aussi.
      ecrire('/etc/apache2/sites-available/000-default.conf', (t) => t.replace('*:80', '*:8080'));
      ecrire(REPAIR, (t) =>
        t
          .replace('*:80', '*:8080')
          .replace('</VirtualHost>', '    RewriteEngine On\n    RewriteRule ^/guide/([0-9]+)/?$ /guides/$1.html [L]\n</VirtualHost>'),
      );
      let tout = jouer(['sudo rm /etc/apache2/sites-enabled/repair', 'sudo a2ensite repair.conf', 'sudo apache2ctl configtest']);
      // RewriteEngine sans le module : la configuration est refusée.
      expect(tout).toContain(`AH00526: Syntax error on line 9 of /etc/apache2/sites-enabled/repair.conf:\nInvalid command 'RewriteEngine'`);
      tout = jouer(['sudo a2enmod rewrite', 'sudo apache2ctl configtest', 'sudo systemctl restart apache2', 'sudo apache2ctl -S']);
      expect(tout).toContain('*:8080                 is a NameVirtualHost');
      expect(tout).toContain('         default server 127.0.1.1 (/etc/apache2/sites-enabled/000-default.conf:1)');
      // nginx transmet Host: 127.0.0.1:8080 par défaut : Apache sert son site par défaut.
      tout = jouer(['sudo ln -s /etc/nginx/sites-available/repair /etc/nginx/sites-enabled/repair', 'sudo systemctl reload nginx', 'curl http://repair.example/']);
      expect(tout).toContain('Apache2 Debian Default Page');
      expect(c.termines).not.toContain('atelier');
      ecrire('/etc/nginx/sites-available/repair', (t) => t.replace('proxy_pass http://127.0.0.1:8080;', 'proxy_pass http://127.0.0.1:8080;\n        proxy_set_header Host $host;'));
      tout = jouer(['sudo nginx -t', 'sudo systemctl reload nginx', 'curl http://repair.example/guide/42']);
      expect(tout).toContain(c.t('atelier-fiche-42'));
      expect(c.termines).toContain('atelier');
    });

    it('fausses pistes : Apache sur toutes les adresses, AllowOverride insuffisant, un .htaccess qui boucle', () => {
      const { c, jouer, ecrire } = partie();
      ecrire('/etc/apache2/ports.conf', (t) => t.replace('Listen 80', 'Listen 8080'));
      ecrire(REPAIR, (t) => t.replace('*:80', '*:8080').replace('</VirtualHost>', DIRECTORY.replace('AllowOverride All', 'AllowOverride AuthConfig')));
      let tout = jouer(['sudo a2ensite repair', 'sudo a2enmod rewrite', 'sudo systemctl restart apache2', 'sudo ss -tlnp']);
      expect(tout).toContain('*:8080');
      if (fr) expect(tout).toContain('toutes les adresses');
      tout = jouer(['sudo a2enmod rewrite', 'sudo a2ensite nulle-part']);
      expect(tout).toContain('Module rewrite already enabled');
      expect(tout).toContain('ERROR: Site nulle-part does not exist!');
      jouer(['sudo ln -s /etc/nginx/sites-available/repair /etc/nginx/sites-enabled/', 'sudo systemctl reload nginx']);
      tout = jouer(['curl http://repair.example/guide/42', 'sudo tail -1 /var/log/apache2/repair-error.log']);
      expect(tout).toContain('/var/www/repair/.htaccess: RewriteEngine not allowed here');
      ecrire(REPAIR, (t) => t.replace('AuthConfig', 'FileInfo'));
      // Une règle qui se réécrit sans fin (guide/42, guide/guide/42…) : Apache s'arrête au bout de 10 redirections internes.
      const avant = c.distant!.shell.lire('/var/www/repair/.htaccess')!;
      ecrire('/var/www/repair/.htaccess', (t) => t.replace(/RewriteCond.*\n/, '').replace(/RewriteRule .*/, 'RewriteRule ^(.*)$ guide/$1 [L]'));
      tout = jouer(['sudo systemctl reload apache2', 'curl http://repair.example/guide/42', 'sudo tail -1 /var/log/apache2/repair-error.log']);
      expect(tout).toContain('AH00124: Request exceeded the limit of 10 internal redirects');
      ecrire('/var/www/repair/.htaccess', () => avant);
      jouer(['curl http://repair.example/guide/42']);
      // Tout marche, mais Apache écoute encore partout.
      expect(c.termines).not.toContain('atelier');
      ecrire('/etc/apache2/ports.conf', (t) => t.replace('Listen 8080', 'Listen 127.0.0.1:8080'));
      jouer(['sudo systemctl restart apache2']);
      expect(c.termines).toContain('atelier');
    });

    it('les commandes : manuel, --help, configtest en échec, graceful refusé', () => {
      const { jouer, ecrire } = partie();
      let tout = jouer(['man a2ensite', 'apache2ctl --help', 'man -k apache', 'apache2ctl -x']);
      expect(tout).toContain('a2ensite');
      expect(tout).toContain('apache2ctl');
      expect(tout).toContain("apache2: invalid option -- 'x'");
      ecrire('/etc/apache2/ports.conf', (t) => t.replace('Listen 80', 'Listen 127.0.0.1:8080'));
      jouer(['sudo systemctl start apache2']);
      ecrire(REPAIR, (t) => t.replace('</VirtualHost>', '<Directory /var/www/repair>\n'));
      tout = jouer(['sudo a2ensite repair', 'sudo apache2ctl graceful', 'sudo systemctl reload apache2', 'systemctl is-active apache2']);
      expect(tout).toContain('<Directory> was not closed.');
      expect(tout).toContain("Action 'graceful' failed.");
      expect(tout).toContain('Job for apache2.service failed');
      expect(tout).toContain('active');
    });
  });
