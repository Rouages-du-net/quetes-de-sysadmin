// Les Lettres du quartier, « L'atelier de réparation » : Apache derrière
// nginx. Rejoué dans chaque langue : la solution, une autre (les règles dans
// le VirtualHost, nginx qui transmet le nom), et les fausses pistes.

import { describe, expect, it } from 'vitest';
import { Console } from '../src/engine/console';
import { STORIES } from '../src/engine/chapters';
import { prerequisites } from '../src/engine/unlocking';
import { LANGUAGES } from '../src/texts';
import { machinesInLanguage } from './names';

const LETTERS = STORIES.find((h) => h.id === 'letters')!.chapters.map((c) => c.id);
const BEFORE = [...new Set([...STORIES.find((h) => h.id === 'eraser')!.chapters.map((c) => c.id), ...prerequisites('letters'), ...LETTERS.slice(0, LETTERS.indexOf('repair-cafe'))])];
const REPAIR = '/etc/apache2/sites-available/repair.conf';
const DIRECTORY = '    <Directory /var/www/repair>\n        AllowOverride All\n    </Directory>\n</VirtualHost>';

for (const language of LANGUAGES)
  describe(`Langue : ${language}`, () => {
    const fr = language === 'fr';
    const part = () => {
      const c = new Console({ language, finished: BEFORE });
      const play = (lines: string[]) =>
        lines
          .map((l) => {
            let s = c.execute(machinesInLanguage(c.t, l)) ?? '';
            if (c.shell.waiting) s += c.execute(machinesInLanguage(c.t, 'ants-2026')) ?? '';
            return s;
          })
          .join('\n');
      const write = (file: string, change: (text: string) => string) => {
        c.execute(`sudo nano ${file}`);
        if (c.shell.waiting) c.execute(machinesInLanguage(c.t, 'ants-2026'));
        c.save(change(c.edition!.text));
        return c.quitEdition();
      };
      // SSH écoute sur 2222 depuis « Le port ».
      play(['ssh -p 2222 letters', 'yes']);
      expect(c.remote?.shell.chapter.id).toBe('repair-cafe');
      return { c, jouer: play, ecrire: write };
    };

    it('solution : le port, le site, nginx devant, AllowOverride et mod_rewrite', () => {
      const { c, jouer: play, ecrire: write } = part();
      let all = play(['systemctl status apache2', 'journalctl -u apache2', 'sudo ss -tlnp']);
      expect(all).toContain('(98)Address already in use: AH00072: make_sock: could not bind to address [::]:80');
      expect(all).toContain('users:(("nginx",pid=701,fd=3))');
      if (fr) expect(all).toContain('nginx y est déjà');
      all = write('/etc/apache2/ports.conf', (t) => t.replace('Listen 80', 'Listen 127.0.0.1:8080'));
      all += play(['sudo apache2ctl configtest', 'sudo systemctl restart apache2', 'sudo ss -tlnp', 'sudo apache2ctl -S']);
      expect(all).toContain('Syntax OK');
      expect(all).toContain('127.0.0.1:8080');
      expect(all).toContain('users:(("apache2",pid=2301,fd=3))');
      // Le lien de Rania (sans .conf) n'est pas lu : seul 000-default apparaît.
      expect(all).toContain('*:80                   127.0.1.1 (/etc/apache2/sites-enabled/000-default.conf:1)');
      expect(all).not.toContain('repair.example (');
      all = play(['curl -H "Host: repair.example" http://127.0.0.1:8080/']);
      expect(all).toContain('Apache2 Debian Default Page');
      if (fr) expect(all).toContain('page par défaut');
      all = play(['sudo a2ensite repair']);
      expect(all).toContain('Enabling site repair.\nTo activate the new configuration, you need to run:\n  systemctl reload apache2');
      write(REPAIR, (t) => t.replace('<VirtualHost *:80>', '<VirtualHost 127.0.0.1:8080>'));
      all = play(['sudo systemctl reload apache2', 'sudo apache2ctl -S', 'curl -H "Host: repair.example" http://127.0.0.1:8080/']);
      expect(all).toContain('127.0.0.1:8080         repair.example (/etc/apache2/sites-enabled/repair.conf:1)');
      expect(all).toContain(c.t('repair-cafe-site-accueil'));
      // nginx n'a pas encore le site : la visite tombe sur les Lettres (site par défaut).
      all = play(['sudo ln -s /etc/nginx/sites-available/repair /etc/nginx/sites-enabled/', 'sudo nginx -t', 'sudo systemctl reload nginx', 'curl http://repair.example/']);
      expect(all).toContain(c.t('repair-cafe-site-accueil'));
      all = play(['curl http://repair.example/guide/42']);
      expect(all).toContain('The requested URL was not found on this server.');
      if (fr) expect(all).toContain('AllowOverride None');
      write(REPAIR, (t) => t.replace('</VirtualHost>', DIRECTORY));
      all = play(['sudo apache2ctl configtest', 'sudo systemctl reload apache2', 'curl -i http://repair.example/guide/42', 'sudo tail -1 /var/log/apache2/repair-error.log']);
      expect(all).toContain('HTTP/1.1 500 Internal Server Error');
      expect(all).toContain("/var/www/repair/.htaccess: Invalid command 'RewriteEngine', perhaps misspelled or defined by a module not included in the server configuration");
      expect(c.finished).not.toContain('repair-cafe');
      // apache2ctl -M relit la configuration sur le disque : le module y est, Apache ne l'a pas encore chargé.
      all = play(['sudo a2enmod rewrite', 'apache2ctl -M']);
      expect(all).toContain('systemctl restart apache2');
      expect(all).toContain(' rewrite_module (shared)');
      all = play(['sudo systemctl restart apache2', 'curl http://repair.example/guide/42']);
      expect(all).toContain(c.t('repair-cafe-fiche-42'));
      if (fr) expect(all).toContain('https://httpd.apache.org/docs/2.4/howto/htaccess.html');
      expect(c.finished).toContain('repair-cafe');
    });

    it('une autre solution : le site par défaut aussi sur 8080, nginx transmet le nom, les règles dans le VirtualHost', () => {
      const { c, jouer: play, ecrire: write } = part();
      write('/etc/apache2/ports.conf', (t) => t.replace('Listen 80', 'Listen 127.0.0.1:8080'));
      // Comme le dit le commentaire de ports.conf : le VirtualHost de 000-default aussi.
      write('/etc/apache2/sites-available/000-default.conf', (t) => t.replace('*:80', '*:8080'));
      write(REPAIR, (t) =>
        t
          .replace('*:80', '*:8080')
          .replace('</VirtualHost>', '    RewriteEngine On\n    RewriteRule ^/guide/([0-9]+)/?$ /guides/$1.html [L]\n</VirtualHost>'),
      );
      let all = play(['sudo rm /etc/apache2/sites-enabled/repair', 'sudo a2ensite repair.conf', 'sudo apache2ctl configtest']);
      // RewriteEngine sans le module : la configuration est refusée.
      expect(all).toContain(`AH00526: Syntax error on line 9 of /etc/apache2/sites-enabled/repair.conf:\nInvalid command 'RewriteEngine'`);
      all = play(['sudo a2enmod rewrite', 'sudo apache2ctl configtest', 'sudo systemctl restart apache2', 'sudo apache2ctl -S']);
      expect(all).toContain('*:8080                 is a NameVirtualHost');
      expect(all).toContain('         default server 127.0.1.1 (/etc/apache2/sites-enabled/000-default.conf:1)');
      // nginx transmet Host: 127.0.0.1:8080 par défaut : Apache sert son site par défaut.
      all = play(['sudo ln -s /etc/nginx/sites-available/repair /etc/nginx/sites-enabled/repair', 'sudo systemctl reload nginx', 'curl http://repair.example/']);
      expect(all).toContain('Apache2 Debian Default Page');
      expect(c.finished).not.toContain('repair-cafe');
      write('/etc/nginx/sites-available/repair', (t) => t.replace('proxy_pass http://127.0.0.1:8080;', 'proxy_pass http://127.0.0.1:8080;\n        proxy_set_header Host $host;'));
      all = play(['sudo nginx -t', 'sudo systemctl reload nginx', 'curl http://repair.example/guide/42']);
      expect(all).toContain(c.t('repair-cafe-fiche-42'));
      expect(c.finished).toContain('repair-cafe');
    });

    it('fausses pistes : Apache sur toutes les adresses, AllowOverride insuffisant, un .htaccess qui boucle', () => {
      const { c, jouer: play, ecrire: write } = part();
      write('/etc/apache2/ports.conf', (t) => t.replace('Listen 80', 'Listen 8080'));
      write(REPAIR, (t) => t.replace('*:80', '*:8080').replace('</VirtualHost>', DIRECTORY.replace('AllowOverride All', 'AllowOverride AuthConfig')));
      let all = play(['sudo a2ensite repair', 'sudo a2enmod rewrite', 'sudo systemctl restart apache2', 'sudo ss -tlnp']);
      expect(all).toContain('*:8080');
      if (fr) expect(all).toContain('toutes les adresses');
      all = play(['sudo a2enmod rewrite', 'sudo a2ensite nulle-part']);
      expect(all).toContain('Module rewrite already enabled');
      expect(all).toContain('ERROR: Site nulle-part does not exist!');
      play(['sudo ln -s /etc/nginx/sites-available/repair /etc/nginx/sites-enabled/', 'sudo systemctl reload nginx']);
      all = play(['curl http://repair.example/guide/42', 'sudo tail -1 /var/log/apache2/repair-error.log']);
      expect(all).toContain('/var/www/repair/.htaccess: RewriteEngine not allowed here');
      write(REPAIR, (t) => t.replace('AuthConfig', 'FileInfo'));
      // Une règle qui se réécrit sans fin (guide/42, guide/guide/42…) : Apache s'arrête au bout de 10 redirections internes.
      const before = c.remote!.shell.read('/var/www/repair/.htaccess')!;
      write('/var/www/repair/.htaccess', (t) => t.replace(/RewriteCond.*\n/, '').replace(/RewriteRule .*/, 'RewriteRule ^(.*)$ guide/$1 [L]'));
      all = play(['sudo systemctl reload apache2', 'curl http://repair.example/guide/42', 'sudo tail -1 /var/log/apache2/repair-error.log']);
      expect(all).toContain('AH00124: Request exceeded the limit of 10 internal redirects');
      write('/var/www/repair/.htaccess', () => before);
      play(['curl http://repair.example/guide/42']);
      // Tout marche, mais Apache écoute encore partout.
      expect(c.finished).not.toContain('repair-cafe');
      write('/etc/apache2/ports.conf', (t) => t.replace('Listen 8080', 'Listen 127.0.0.1:8080'));
      play(['sudo systemctl restart apache2']);
      expect(c.finished).toContain('repair-cafe');
    });

    it('les commandes : manuel, --help, configtest en échec, graceful refusé', () => {
      const { jouer: play, ecrire: write } = part();
      let all = play(['man a2ensite', 'apache2ctl --help', 'man -k apache', 'apache2ctl -x']);
      expect(all).toContain('a2ensite');
      expect(all).toContain('apache2ctl');
      expect(all).toContain("apache2: invalid option -- 'x'");
      write('/etc/apache2/ports.conf', (t) => t.replace('Listen 80', 'Listen 127.0.0.1:8080'));
      play(['sudo systemctl start apache2']);
      write(REPAIR, (t) => t.replace('</VirtualHost>', '<Directory /var/www/repair>\n'));
      all = play(['sudo a2ensite repair', 'sudo apache2ctl graceful', 'sudo systemctl reload apache2', 'systemctl is-active apache2']);
      expect(all).toContain('<Directory> was not closed.');
      expect(all).toContain("Action 'graceful' failed.");
      expect(all).toContain('Job for apache2.service failed');
      expect(all).toContain('active');
    });
  });
