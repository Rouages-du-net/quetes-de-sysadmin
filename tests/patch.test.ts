// « La Rustine », « Le cadenas » : Caddy et son HTTPS automatique. Rejoué
// dans chaque langue : la solution, une autre (une liste d'adresses, caddy
// reload, ufw allow http), et les fausses pistes.

import { describe, expect, it } from 'vitest';
import { Console } from '../src/engine/console';
import { STORIES } from '../src/engine/chapters';
import { prerequisites } from '../src/engine/unlocking';
import { LANGUAGES } from '../src/texts';
import { formatValue, readCaddyfile } from '../src/engine/caddy';
import { inLanguage, machinesInLanguage } from './names';

const ERASER = STORIES.find((h) => h.id === 'effaceur')!.chapters.map((c) => c.id);
const BEFORE = [...new Set([...ERASER, ...prerequisites('rustine')])];
const CADDYFILE = '/etc/caddy/Caddyfile';
const WWW = '\nwww.cycles.example {\n\tredir https://cycles.example{uri} permanent\n}\n';

describe('Le Caddyfile', () => {
  it('adresses, options globales, erreurs de Caddy', () => {
    const c = readCaddyfile('{\n\temail admin@cycles.example\n}\n\ncycles.example, www.cycles.example {\n\troot * /srv\n\tfile_server\n}\n\n:8080 {\n\trespond "ok"\n}');
    expect(c.sites.map((s) => s.addresses.map((a) => `${a.host}:${a.port}`))).toEqual([['cycles.example:443', 'www.cycles.example:443'], [':8080']]);
    expect(c.global[0].args).toEqual(['admin@cycles.example']);
    expect(c.notFormatted).toBeNull();
    // Un seul site, sans accolades.
    expect(readCaddyfile('cycles.example\nfile_server').sites[0].directives[0].name).toBe('file_server');
    expect(() => readCaddyfile('cycles.example {\n\tfile-server\n}')).toThrow('/etc/caddy/Caddyfile:2: unrecognized directive: file-server');
    expect(() => readCaddyfile('{\n\temial x\n}')).toThrow('unrecognized global option: emial');
    expect(() => readCaddyfile('cycles.example {\n\troot\n}')).toThrow("Wrong argument count or unexpected line ending after 'root'");
    expect(() => readCaddyfile('cycles.example {\n\tfile_server\n')).toThrow('Unexpected EOF');
    expect(() => readCaddyfile('}\n')).toThrow("Unexpected '}' because no matching opening brace");
    expect(() => readCaddyfile('a.example {\n}\na.example {\n}')).toThrow('ambiguous site definition: a.example');
    expect(formatValue('a.example   {\n    root *   /srv\n\n\n  file_server\n}\n')).toBe('a.example {\n\troot * /srv\n\n\tfile_server\n}');
    expect(readCaddyfile('a.example {\n    file_server\n}').notFormatted).toBe(2);
  });
});

for (const language of LANGUAGES)
  describe(`Langue : ${language}`, () => {
    const fr = language === 'fr';
    const part = () => {
      const c = new Console({ language, finished: BEFORE });
      const L = (l: string) => inLanguage(c.t, machinesInLanguage(c.t, l));
      const play = (lines: string[]) =>
        lines
          .map((l) => {
            let s = c.execute(L(l)) ?? '';
            if (c.shell.waiting) s += c.execute(L('rayons-2027')) ?? '';
            return s;
          })
          .join('\n');
      const write = (file: string, change: (text: string) => string) => {
        c.execute(`sudo nano ${file}`);
        if (c.shell.waiting) c.execute(L('rayons-2027'));
        c.save(change(c.edition!.text));
        return c.quitEdition();
      };
      play(['ssh rustine', 'yes']);
      expect(c.remote?.shell.chapter.id).toBe('cadenas');
      return { c, jouer: play, ecrire: write, L };
    };

    it('solution : le nom du site, le pare-feu, puis www', () => {
      const { c, jouer: play, ecrire: write } = part();
      let all = play(['cat message_de_ines.txt', 'systemctl status caddy', 'curl -I http://localhost', 'curl https://cycles.example']);
      expect(all).toContain('"msg":"server is listening only on the HTTP port, so no automatic HTTPS will be applied to this server"');
      expect(all).toContain('HTTP/1.1 200 OK');
      expect(all).toContain("curl: (7) Failed to connect to cycles.example port 443 after 0 ms: Couldn't connect to server");
      if (fr) expect(all).toContain('par le nom du site');
      all = write(CADDYFILE, (t) => t.replace(':80 {', 'cycles.example {'));
      all += play(['caddy validate --config /etc/caddy/Caddyfile', 'sudo systemctl reload caddy', 'journalctl -u caddy -n 8', 'curl https://cycles.example']);
      expect(all).toContain('Valid configuration');
      expect(all).toContain('203.0.113.40: Timeout during connect (likely firewall problem)');
      expect(all).toContain('"msg":"will retry"');
      expect(all).toContain('curl: (35) OpenSSL/3.5.1: error:0A000438:SSL routines::tlsv1 alert internal error');
      if (fr) expect(all).toContain('ufw ne laisse entrer que ssh');
      all = play(['sudo ufw status', 'sudo ufw allow 80/tcp', 'sudo ufw allow 443/tcp', 'journalctl -u caddy -n 3', 'curl -I http://cycles.example', 'curl https://cycles.example']);
      expect(all).toContain('"msg":"certificate obtained successfully","identifier":"cycles.example"');
      expect(all).toContain('HTTP/1.1 308 Permanent Redirect\nConnection: close\nLocation: https://cycles.example/');
      expect(all).toContain(c.t('cadenas-site').split('\n')[0]);
      expect(all).toContain(c.t('cadenas-site').split('\n').at(-1));
      if (fr) expect(all).toContain('adresse des affiches');
      expect(c.finished).not.toContain('cadenas');
      all = play(['curl https://www.cycles.example']);
      expect(all).toContain('tlsv1 alert internal error');
      write(CADDYFILE, (t) => `${t}\n${WWW}`);
      all = play(['sudo systemctl reload caddy', 'curl -I https://www.cycles.example', 'sudo ls /var/lib/caddy/.local/share/caddy/certificates/acme-v02.api.letsencrypt.org-directory']);
      expect(all).toContain('HTTP/2 301 \nalt-svc: h3=":443"; ma=2592000\nlocation: https://cycles.example/');
      expect(all).toContain('cycles.example/  www.cycles.example/');
      if (fr) expect(all).toContain('https://caddyserver.com/docs/automatic-https');
      expect(c.finished).toContain('cadenas');
    });

    it('autre solution : une liste d’adresses, ufw allow http et https, caddy reload', () => {
      const { c, jouer: play, ecrire: write } = part();
      play(['sudo ufw allow http', 'sudo ufw allow https']);
      write(CADDYFILE, (t) => t.replace(':80 {', 'cycles.example, www.cycles.example {'));
      let all = play(['caddy reload --config /etc/caddy/Caddyfile', 'journalctl -u caddy | grep obtained', 'sudo ss -tlnp']);
      expect(all).toContain('"identifier":"www.cycles.example"');
      expect(all).toContain('*:443');
      all = play(['curl https://www.cycles.example', 'caddy version', 'caddy adapt --config /etc/caddy/Caddyfile --pretty']);
      expect(all).toContain(c.t('cadenas-site').split('\n')[0]);
      expect(all).toContain('v2.10.2');
      expect(all).toContain('"listen": [\n\t\t\t\t\t\t":443"\n\t\t\t\t\t]');
      expect(c.finished).toContain('cadenas');
    });

    it('fausses pistes : http://, une directive mal écrite, caddy run, le seul port 443, le format', () => {
      const { c, jouer: play, ecrire: write } = part();
      let all = play(['caddy reload', 'caddy run', 'caddy frobnicate', 'caddy validate --config /nulle/part']);
      expect(all).toContain('Error: no config file to load');
      expect(all).toContain('bind: address already in use');
      expect(all).toContain('Error: unknown command "frobnicate" for "caddy"');
      expect(all).toContain('Error: reading config from file: open /nulle/part: no such file or directory');
      // http:// : un site en HTTP seulement.
      all = write(CADDYFILE, (t) => t.replace(':80 {', 'http://cycles.example {'));
      all += play(['sudo systemctl reload caddy']);
      if (fr) expect(all).toContain('le nom seul suffit');
      // Une directive mal écrite : le rechargement échoue, Caddy garde l'ancienne configuration.
      write(CADDYFILE, (t) => t.replace('http://cycles.example {', 'cycles.example {').replace('\tfile_server', '\tfile-server'));
      all = play(['caddy validate --config /etc/caddy/Caddyfile', 'sudo systemctl reload caddy', 'journalctl -u caddy -n 3', 'systemctl is-active caddy']);
      expect(all).toContain('Error: adapting config using caddyfile: /etc/caddy/Caddyfile:16: unrecognized directive: file-server');
      expect(all).toContain('Job for caddy.service failed');
      expect(all).toContain('active');
      // Le seul port 443 : Caddy a son certificat (TLS-ALPN), mais HTTP reste fermé dehors.
      write(CADDYFILE, (t) => t.replace('\tfile-server', '    file_server'));
      all = play(['sudo ufw allow 443/tcp', 'sudo systemctl reload caddy', 'caddy validate --config /etc/caddy/Caddyfile']);
      expect(all).toContain("Caddyfile input is not formatted; run 'caddy fmt --overwrite' to fix inconsistencies");
      if (fr) expect(all).toContain('un avertissement');
      all = play(['caddy fmt --overwrite /etc/caddy/Caddyfile', 'sudo caddy fmt --overwrite /etc/caddy/Caddyfile', 'caddy validate --config /etc/caddy/Caddyfile']);
      expect(all).toContain('Error: open /etc/caddy/Caddyfile: permission denied');
      expect(all).not.toContain('not formatted');
      write(CADDYFILE, (t) => `${t}\n${WWW}`);
      play(['sudo systemctl reload caddy', 'curl -I https://www.cycles.example']);
      expect(c.remote!.shell.flags.has('certificat')).toBe(true);
      expect(c.finished).not.toContain('cadenas');
      play(['sudo ufw allow 80/tcp']);
      expect(c.finished).toContain('cadenas');
    });
  });
